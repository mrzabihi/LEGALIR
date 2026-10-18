// ============================================================
// LEGALIR — Judicial drafting persistence (server-only)
// ============================================================
// The storage layer for the judicial documents family (اظهارنامه، لایحه،
// دادخواست، شکواییه). It follows the project's JSON-table convention
// (`readTable` / `writeTable`) and adds five ADDITIVE tables — no existing
// table is touched:
//
//   judicial_service_config          — six admin-editable service rows
//   judicial_questionnaires          — versioned, publishable schemas
//   judicial_requests                — one drafting request per user
//   judicial_questionnaire_responses — one row per answered question
//   judicial_attachments             — links to EXISTING `documents` rows
//   judicial_draft_versions          — immutable draft versions (append-only)
//
// Service settings live in `lib/judicial/service-config`, questionnaire DATA
// in `lib/judicial/questionnaires`; this module owns only rows the user
// creates, and every function here is owner-scoped on `userId`.
//
// Invariants enforced HERE, not in the UI:
//   • a foreign id is indistinguishable from a missing one (null → 404);
//   • an attachment is a REFERENCE resolved through the owner-scoped
//     `getDemoDocument(userId, id)` — a document id is never permission, and
//     the caller never supplies the file's name/mime/size;
//   • answers are validated against the exact questionnaire version stored on
//     the request, with an optimistic-concurrency guard;
//   • draft text is never mutated: regeneration APPENDS a version and marks
//     the previous working draft `superseded`;
//   • creation is idempotent by client key, so a double-click cannot produce
//     two requests (or two charges).
// ============================================================

import { createHash } from "node:crypto";
import { readTable, writeTable, recordActivity, removeActivity } from "@/lib/db";
import { getDemoDocument } from "@/lib/demo-seed";
import { getCaseById } from "@/lib/case-db";
import { JUDICIAL_REQUEST_STATUS_FA, JUDICIAL_SERVICE_FA } from "@legalir/types";
import type {
  JudicialAttachment,
  JudicialAttachmentRole,
  JudicialCreateRequestInput,
  JudicialDocumentType,
  JudicialDraftGenerator,
  JudicialDraftInputSnapshot,
  JudicialDraftReference,
  JudicialDraftVersion,
  JudicialQuestionnaireResponse,
  JudicialReadyDocumentRef,
  JudicialRequest,
  JudicialRequestStatus,
  JudicialRequestStep,
  JudicialServiceId,
  JudicialStartMode,
} from "@legalir/types";
import { JUDICIAL_DOCUMENT_TYPES } from "@legalir/types";
import { getQuestionnaireVersion, getPublishedQuestionnaire } from "./questionnaires";
import { deriveJudicialRouting } from "./routing";

const CONFIG_TABLE = "judicial_service_config";
const REQUESTS_TABLE = "judicial_requests";
const ANSWERS_TABLE = "judicial_questionnaire_responses";
const ATTACHMENTS_TABLE = "judicial_attachments";
const DRAFTS_TABLE = "judicial_draft_versions";

// ============================================================
// Helpers
// ============================================================

export function isDraftableType(value: unknown): value is JudicialDocumentType {
  return (
    typeof value === "string" &&
    (JUDICIAL_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

/** The concrete service that owns a document family. */
export function serviceIdForType(type: JudicialDocumentType): JudicialServiceId {
  return `judicial_${type}` as JudicialServiceId;
}

function defaultTitleFa(type: JudicialDocumentType | null): string {
  return type ? `پیش‌نویس ${JUDICIAL_SERVICE_FA[serviceIdForType(type)]}` : "درخواست اوراق قضایی";
}

/**
 * Normalize a stored request. Partial/legacy rows resolve to safe values so a
 * half-written draft can never crash a read.
 */
function normalizeRequest(row: JudicialRequest): JudicialRequest {
  return {
    ...row,
    documentType: isDraftableType(row.documentType) ? row.documentType : null,
    routing: row.routing ?? null,
    narrative: row.narrative ?? "",
    narrativeUpdatedAt: row.narrativeUpdatedAt ?? null,
    answers: row.answers ?? {},
    readyDocument: row.readyDocument ?? null,
    caseId: row.caseId ?? null,
    userConfirmed: row.userConfirmed ?? false,
    lastErrorFa: row.lastErrorFa ?? null,
    idempotencyKey: row.idempotencyKey ?? "",
    completedAt: row.completedAt ?? null,
    archivedAt: row.archivedAt ?? null,
  };
}

/** The request's title, derived from the type + the user's own words. */
export function deriveTitle(type: JudicialDocumentType | null, narrative: string): string {
  const base = defaultTitleFa(type);
  const snippet = narrative.trim().replace(/\s+/g, " ").slice(0, 60);
  return snippet ? `${base} · ${snippet}`.slice(0, 160) : base;
}

// ============================================================
// Activity mirror (history + notifications + dashboard)
// ============================================================

/**
 * Mirror the request into the activity feed so it appears in history and the
 * dashboard. Idempotent: `sourceId` is the request id, so an update rewrites
 * the same row instead of adding another.
 */
export function syncJudicialActivity(request: JudicialRequest): void {
  if (request.archivedAt) {
    removeActivity(request.userId, request.id);
    return;
  }
  recordActivity({
    userId: request.userId,
    type: "judicial",
    title: request.titleFa,
    status: request.status,
    statusFa: JUDICIAL_REQUEST_STATUS_FA[request.status],
    description: request.documentType
      ? JUDICIAL_SERVICE_FA[serviceIdForType(request.documentType)]
      : "اوراق قضایی",
    category: "judicial",
    categoryFa: "اوراق قضایی",
    sourceId: request.id,
  });
}

// ============================================================
// Reads
// ============================================================

/** Every request of one user, newest first. */
export function listRequestsForUser(
  userId: string,
  opts?: { includeArchived?: boolean }
): JudicialRequest[] {
  return readTable<JudicialRequest>(REQUESTS_TABLE)
    .filter((r) => r.userId === userId)
    .map(normalizeRequest)
    .filter((r) => (opts?.includeArchived ? true : r.archivedAt === null))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** An owner-scoped request, or `null` when it does not exist FOR THIS USER. */
export function getOwnedRequest(userId: string, requestId: string): JudicialRequest | null {
  const row = readTable<JudicialRequest>(REQUESTS_TABLE).find(
    (r) => r.id === requestId && r.userId === userId
  );
  return row ? normalizeRequest(row) : null;
}

/** Idempotent replay lookup — scoped by owner AND key. */
export function findRequestByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): JudicialRequest | null {
  if (!idempotencyKey) return null;
  const row = readTable<JudicialRequest>(REQUESTS_TABLE).find(
    (r) => r.userId === userId && r.idempotencyKey === idempotencyKey
  );
  return row ? normalizeRequest(row) : null;
}

// ============================================================
// Create
// ============================================================

/**
 * Create a request. Idempotent: replaying the same key returns the original
 * row untouched, so a retried POST can never duplicate work or a charge.
 *
 * The questionnaire version is resolved HERE, at creation, and stored on the
 * request — a later publish never silently changes the questions an in-flight
 * request is answered against.
 */
export function createRequest(
  userId: string,
  input: JudicialCreateRequestInput
): { request: JudicialRequest; replayed: boolean } {
  const replay = findRequestByIdempotencyKey(userId, input.idempotencyKey);
  if (replay) return { request: replay, replayed: true };

  const now = new Date().toISOString();
  const narrative = input.narrative?.trim() ?? "";

  // A case link is accepted only when the case is the caller's OWN. An
  // unknown/foreign id is dropped rather than stored.
  const requestedCaseId = input.caseId ? input.caseId : null;
  const ownedCase = requestedCaseId ? getCaseById(requestedCaseId) : undefined;
  const caseId = ownedCase && ownedCase.user_id === userId ? requestedCaseId : null;

  // The user's explicit pick wins; otherwise a probable path is derived from
  // their words and clearly marked as a suggestion.
  const declaredType = isDraftableType(input.documentType) ? input.documentType : null;
  const routing = deriveJudicialRouting(narrative, declaredType);
  const documentType =
    routing.suggested === "undetermined" ? null : routing.suggested;

  const questionnaire = documentType ? getPublishedQuestionnaire(documentType) : null;

  const request: JudicialRequest = {
    id: crypto.randomUUID(),
    userId,
    serviceId: documentType ? serviceIdForType(documentType) : input.serviceId,
    documentType,
    routing,
    startMode: input.startMode,
    status: documentType ? "collecting" : "draft",
    currentStep: !documentType ? "kind" : narrative ? "questionnaire" : "narrative",
    titleFa: (input.titleFa?.trim() || deriveTitle(documentType, narrative)).slice(0, 160),
    narrative,
    narrativeUpdatedAt: narrative ? now : null,
    questionnaireId: questionnaire?.id ?? "",
    questionnaireVersion: questionnaire?.version ?? 0,
    answers: {},
    readyDocument: null,
    caseId,
    userConfirmed: false,
    lastErrorFa: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
  };

  const rows = readTable<JudicialRequest>(REQUESTS_TABLE);
  rows.push(request);
  writeTable(REQUESTS_TABLE, rows);
  syncJudicialActivity(request);
  return { request, replayed: false };
}

// ============================================================
// Patch
// ============================================================

/**
 * Internal patch shape. Deliberately NOT the public
 * `JudicialUpdateRequestInput` — status, routing and timestamps are set by the
 * server's workflow code, never by a request body.
 */
export interface RequestPatch {
  narrative?: string;
  currentStep?: JudicialRequestStep;
  caseId?: string | null;
  titleFa?: string;
  documentType?: JudicialDocumentType | null;
  status?: JudicialRequestStatus;
  routing?: JudicialRequest["routing"];
  readyDocument?: JudicialReadyDocumentRef | null;
  userConfirmed?: boolean;
  lastErrorFa?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  /** Server-maintained mirror of the answer rows, for fast visibility checks. */
  answers?: Record<string, string>;
}

/** Apply a server-authored patch to an owned request. Returns the new row. */
export function patchRequest(
  userId: string,
  requestId: string,
  patch: RequestPatch
): JudicialRequest | null {
  const rows = readTable<JudicialRequest>(REQUESTS_TABLE);
  const idx = rows.findIndex((r) => r.id === requestId && r.userId === userId);
  if (idx < 0) return null;

  const prev = normalizeRequest(rows[idx]!);
  const now = new Date().toISOString();
  const narrativeChanged =
    patch.narrative !== undefined && patch.narrative.trim() !== prev.narrative;

  const next: JudicialRequest = {
    ...prev,
    ...(patch.narrative !== undefined ? { narrative: patch.narrative.trim() } : {}),
    ...(narrativeChanged ? { narrativeUpdatedAt: now } : {}),
    ...(patch.currentStep !== undefined ? { currentStep: patch.currentStep } : {}),
    ...(patch.titleFa !== undefined
      ? { titleFa: patch.titleFa.trim().slice(0, 160) || prev.titleFa }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.routing !== undefined ? { routing: patch.routing } : {}),
    ...(patch.readyDocument !== undefined ? { readyDocument: patch.readyDocument } : {}),
    ...(patch.userConfirmed !== undefined ? { userConfirmed: patch.userConfirmed } : {}),
    ...(patch.lastErrorFa !== undefined ? { lastErrorFa: patch.lastErrorFa } : {}),
    ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
    ...(patch.archivedAt !== undefined ? { archivedAt: patch.archivedAt } : {}),
    ...(patch.answers !== undefined ? { answers: patch.answers } : {}),
    updatedAt: now,
  };

  // The case link is re-authorized on every write — a case that is not the
  // caller's is never attached, even if the client sends its id.
  if (patch.caseId !== undefined) {
    const owned = patch.caseId ? getCaseById(patch.caseId) : undefined;
    next.caseId = owned && owned.user_id === userId ? patch.caseId : null;
  }

  // Changing the family re-binds the questionnaire version. An explicit pick
  // is recorded as `user_choice`; a derived one stays a suggestion.
  if (patch.documentType !== undefined) {
    next.documentType = isDraftableType(patch.documentType) ? patch.documentType : null;
    next.routing = deriveJudicialRouting(next.narrative, next.documentType);
    next.serviceId = next.documentType
      ? serviceIdForType(next.documentType)
      : next.serviceId;
    const questionnaire = next.documentType
      ? getPublishedQuestionnaire(next.documentType)
      : null;
    next.questionnaireId = questionnaire?.id ?? "";
    next.questionnaireVersion = questionnaire?.version ?? 0;
    // Answers belong to the previous family's schema — never carry them over.
    if (questionnaire?.id !== prev.questionnaireId) next.answers = {};
  }

  // Re-deriving the route from a CHANGED narrative must not override an
  // explicit earlier choice.
  if (narrativeChanged && patch.routing === undefined && prev.routing?.basis !== "user_choice") {
    next.routing = deriveJudicialRouting(next.narrative, null);
    if (next.routing.suggested !== "undetermined" && !next.documentType) {
      next.documentType = next.routing.suggested;
      next.serviceId = serviceIdForType(next.routing.suggested);
      const questionnaire = getPublishedQuestionnaire(next.routing.suggested);
      next.questionnaireId = questionnaire.id;
      next.questionnaireVersion = questionnaire.version;
    }
  }

  rows[idx] = next;
  writeTable(REQUESTS_TABLE, rows);
  syncJudicialActivity(next);
  return next;
}

/** Set the workflow status. Transition validity is the caller's responsibility. */
export function setStatus(
  userId: string,
  requestId: string,
  status: JudicialRequestStatus
): JudicialRequest | null {
  return patchRequest(userId, requestId, {
    status,
    completedAt:
      status === "approved" ? new Date().toISOString() : undefined,
  });
}

/** Permanently delete a request and every row private to it. Owner-scoped. */
export function deleteRequest(userId: string, requestId: string): boolean {
  const rows = readTable<JudicialRequest>(REQUESTS_TABLE);
  const idx = rows.findIndex((r) => r.id === requestId && r.userId === userId);
  if (idx < 0) return false;
  rows.splice(idx, 1);
  writeTable(REQUESTS_TABLE, rows);

  writeTable(
    ANSWERS_TABLE,
    readTable<JudicialQuestionnaireResponse>(ANSWERS_TABLE).filter(
      (r) => !(r.requestId === requestId && r.userId === userId)
    )
  );
  writeTable(
    ATTACHMENTS_TABLE,
    readTable<JudicialAttachment>(ATTACHMENTS_TABLE).filter(
      (a) => !(a.requestId === requestId && a.userId === userId)
    )
  );
  // Draft text is the most sensitive artefact here — removed with the request.
  writeTable(
    DRAFTS_TABLE,
    readTable<JudicialDraftVersion>(DRAFTS_TABLE).filter(
      (d) => !(d.requestId === requestId && d.userId === userId)
    )
  );
  removeActivity(userId, requestId);
  return true;
}

// ============================================================
// Answers
// ============================================================

/** Every stored answer row of an owned request, oldest first. */
export function listAnswers(userId: string, requestId: string): JudicialQuestionnaireResponse[] {
  return readTable<JudicialQuestionnaireResponse>(ANSWERS_TABLE)
    .filter((r) => r.requestId === requestId && r.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Save ONE questionnaire step wholesale.
 *
 * `answers` contains every currently visible question of that step; a question
 * omitted from the map is removed from storage (it was hidden by a controller
 * answer, or the user cleared it). Other steps are untouched, so editing one
 * section never erases another.
 *
 * Guards:
 *   • the request must belong to the caller;
 *   • `questionnaireVersion` must match the version stored on the request
 *     (optimistic concurrency — a stale form writes nothing);
 *   • every question id must exist in THAT version's schema.
 *
 * Returns the request's full flat answer map, or an error code.
 */
export function saveAnswers(params: {
  userId: string;
  requestId: string;
  questionnaireVersion: number;
  stepId: string;
  answers: Record<string, string>;
}): {
  ok: boolean;
  code: "OK" | "NOT_FOUND" | "VERSION_MISMATCH" | "UNKNOWN_QUESTION";
  answers?: Record<string, string>;
  fieldErrors?: Record<string, string>;
} {
  const request = getOwnedRequest(params.userId, params.requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };
  if (request.questionnaireVersion !== params.questionnaireVersion) {
    return { ok: false, code: "VERSION_MISMATCH" };
  }
  const questionnaire =
    request.documentType && request.questionnaireVersion > 0
      ? getQuestionnaireVersion(request.documentType, request.questionnaireVersion)
      : undefined;
  if (!questionnaire) return { ok: false, code: "VERSION_MISMATCH" };

  const known = new Set(questionnaire.steps.flatMap((s) => s.fields.map((f) => f.id)));
  const fieldErrors: Record<string, string> = {};
  const incoming = new Map<string, string>();
  for (const [questionId, raw] of Object.entries(params.answers ?? {})) {
    if (!known.has(questionId)) {
      fieldErrors[questionId] = "این پرسش در نسخهٔ فعلی پرسش‌نامه وجود ندارد.";
      continue;
    }
    const value = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
    if (value) incoming.set(questionId, value);
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, code: "UNKNOWN_QUESTION", fieldErrors };
  }

  const rows = readTable<JudicialQuestionnaireResponse>(ANSWERS_TABLE);
  const now = new Date().toISOString();

  for (const [questionId, value] of incoming) {
    const existing = rows.find(
      (r) =>
        r.requestId === params.requestId &&
        r.questionId === questionId &&
        r.questionnaireVersion === params.questionnaireVersion
    );
    if (existing) {
      if (existing.value !== value) {
        existing.value = value;
        existing.updatedAt = now;
      }
    } else {
      rows.push({
        id: crypto.randomUUID(),
        requestId: params.requestId,
        userId: params.userId,
        questionnaireId: questionnaire.id,
        questionnaireVersion: params.questionnaireVersion,
        stepId: params.stepId,
        questionId,
        value,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Drop answers of THIS step that were not submitted (cleared or hidden).
  const kept = rows.filter(
    (r) =>
      r.userId === params.userId &&
      !(
        r.requestId === params.requestId &&
        r.questionnaireVersion === params.questionnaireVersion &&
        r.stepId === params.stepId &&
        !incoming.has(r.questionId)
      )
  );
  writeTable(ANSWERS_TABLE, kept);

  const flat: Record<string, string> = {};
  for (const row of kept) {
    if (
      row.requestId === params.requestId &&
      row.userId === params.userId &&
      row.questionnaireVersion === params.questionnaireVersion
    ) {
      flat[row.questionId] = row.value;
    }
  }

  const requestRows = readTable<JudicialRequest>(REQUESTS_TABLE);
  const idx = requestRows.findIndex(
    (r) => r.id === params.requestId && r.userId === params.userId
  );
  if (idx >= 0) {
    const next: JudicialRequest = {
      ...normalizeRequest(requestRows[idx]!),
      answers: flat,
      updatedAt: now,
    };
    requestRows[idx] = next;
    writeTable(REQUESTS_TABLE, requestRows);
    syncJudicialActivity(next);
  }

  return { ok: true, code: "OK", answers: flat };
}

// ============================================================
// Attachments (links to existing documents — never copies)
// ============================================================

/**
 * Link one of the caller's OWN documents to the request.
 *
 * The document is resolved through the owner-scoped `getDemoDocument`, so a
 * document id is never permission and the client never supplies the file's
 * name/mime/size. Re-linking a previously removed document revives its row
 * instead of stacking duplicates.
 */
export function linkAttachment(params: {
  userId: string;
  requestId: string;
  documentId: string;
  role: JudicialAttachmentRole;
}):
  | { ok: true; attachment: JudicialAttachment }
  | {
      ok: false;
      code: "NOT_FOUND" | "DOCUMENT_NOT_FOUND" | "DOCUMENT_NOT_READY";
    } {
  if (!getOwnedRequest(params.userId, params.requestId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const doc = getDemoDocument(params.userId, params.documentId);
  if (!doc) return { ok: false, code: "DOCUMENT_NOT_FOUND" };
  if (doc.status !== "ready") return { ok: false, code: "DOCUMENT_NOT_READY" };

  const rows = readTable<JudicialAttachment>(ATTACHMENTS_TABLE);
  const now = new Date().toISOString();
  const existing = rows.find(
    (r) =>
      r.requestId === params.requestId &&
      r.userId === params.userId &&
      r.documentId === params.documentId
  );

  if (existing) {
    existing.removedAt = null;
    existing.role = params.role;
    existing.name = doc.name;
    existing.mime = doc.mime;
    existing.sizeBytes = doc.sizeBytes;
    existing.linkedAt = now;
    writeTable(ATTACHMENTS_TABLE, rows);
    return { ok: true, attachment: existing };
  }

  const created: JudicialAttachment = {
    id: crypto.randomUUID(),
    requestId: params.requestId,
    userId: params.userId,
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    role: params.role,
    linkedAt: now,
    removedAt: null,
  };
  rows.push(created);
  writeTable(ATTACHMENTS_TABLE, rows);
  return { ok: true, attachment: created };
}

/** Active (not removed) attachments of an owned request. */
export function listAttachments(userId: string, requestId: string): JudicialAttachment[] {
  return readTable<JudicialAttachment>(ATTACHMENTS_TABLE)
    .filter((r) => r.requestId === requestId && r.userId === userId && r.removedAt === null)
    .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
}

/** Soft-remove an attachment. Owner-scoped; returns false when not found. */
export function unlinkAttachment(
  userId: string,
  requestId: string,
  attachmentId: string
): boolean {
  if (!getOwnedRequest(userId, requestId)) return false;
  const rows = readTable<JudicialAttachment>(ATTACHMENTS_TABLE);
  const row = rows.find(
    (r) => r.id === attachmentId && r.requestId === requestId && r.userId === userId
  );
  if (!row || row.removedAt !== null) return false;
  row.removedAt = new Date().toISOString();
  writeTable(ATTACHMENTS_TABLE, rows);
  return true;
}

/** The "ready document" path: store the reference on the request itself. */
export function setReadyDocument(
  userId: string,
  requestId: string,
  documentId: string
): JudicialRequest | null {
  if (!getOwnedRequest(userId, requestId)) return null;
  const doc = getDemoDocument(userId, documentId);
  if (!doc || doc.status !== "ready") return null;

  const readyDocument: JudicialReadyDocumentRef = {
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: doc.sizeBytes,
    textReviewed: false,
  };
  return patchRequest(userId, requestId, { readyDocument });
}

// ============================================================
// Draft versions (append-only)
// ============================================================

/** Every draft version of an owned request, newest version first. */
export function listDrafts(userId: string, requestId: string): JudicialDraftVersion[] {
  return readTable<JudicialDraftVersion>(DRAFTS_TABLE)
    .filter((d) => d.requestId === requestId && d.userId === userId)
    .sort((a, b) => b.version - a.version);
}

export function latestDraft(userId: string, requestId: string): JudicialDraftVersion | null {
  return listDrafts(userId, requestId)[0] ?? null;
}

/** Identical inputs never cost twice — the generation route checks this. */
export function findDraftByInputHash(
  userId: string,
  requestId: string,
  inputHash: string
): JudicialDraftVersion | null {
  return (
    readTable<JudicialDraftVersion>(DRAFTS_TABLE).find(
      (d) =>
        d.requestId === requestId && d.userId === userId && d.inputHash === inputHash
    ) ?? null
  );
}

export interface AppendDraftInput {
  requestId: string;
  userId: string;
  text: string;
  inputHash: string;
  inputSnapshot: JudicialDraftInputSnapshot;
  references: JudicialDraftReference[];
  warnings: string[];
  ambiguitiesFa: string[];
  generator: JudicialDraftGenerator;
  provider: string;
  providerConfigured: boolean;
  model: string;
}

/**
 * Append one immutable draft version. The previous working draft is marked
 * `superseded` — its text is kept byte-for-byte so the user can always go
 * back. Returns the new version.
 */
export function appendDraft(input: AppendDraftInput): JudicialDraftVersion | null {
  if (!getOwnedRequest(input.userId, input.requestId)) return null;

  const rows = readTable<JudicialDraftVersion>(DRAFTS_TABLE);
  const now = new Date().toISOString();
  const versions = rows.filter(
    (d) => d.requestId === input.requestId && d.userId === input.userId
  );
  const nextVersion = versions.reduce((max, d) => Math.max(max, d.version), 0) + 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (
      row.requestId === input.requestId &&
      row.userId === input.userId &&
      row.status === "draft"
    ) {
      rows[i] = { ...row, status: "superseded", updatedAt: now };
    }
  }

  const created: JudicialDraftVersion = {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    userId: input.userId,
    version: nextVersion,
    status: "draft",
    generator: input.generator,
    text: input.text,
    inputHash: input.inputHash,
    inputSnapshot: input.inputSnapshot,
    references: input.references,
    warnings: input.warnings,
    ambiguitiesFa: input.ambiguitiesFa,
    provider: input.provider,
    providerConfigured: input.providerConfigured,
    model: input.model,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
  };
  rows.push(created);
  writeTable(DRAFTS_TABLE, rows);
  return created;
}

/**
 * Append the owner's own edit of an existing version as a NEW version.
 *
 * The original text is never overwritten: an edit is a new immutable version
 * with `generator: "user_edited"`, and the prior working draft is superseded.
 * The input hash records the edited text so an identical re-save is a no-op
 * rather than a third copy.
 */
export function reviseDraft(params: {
  userId: string;
  requestId: string;
  draftId: string;
  text: string;
}): JudicialDraftVersion | null {
  if (!getOwnedRequest(params.userId, params.requestId)) return null;

  const source = readTable<JudicialDraftVersion>(DRAFTS_TABLE).find(
    (d) =>
      d.id === params.draftId &&
      d.requestId === params.requestId &&
      d.userId === params.userId
  );
  if (!source) return null;
  // An approved version is a signed statement of what the user read; it is
  // never silently rewritten. Editing it starts from the text but lands as a
  // new, unapproved version.
  const text = params.text.trim();
  if (!text) return null;

  const editedHash = createHash("sha256")
    .update(`user_edited:${params.requestId}:${text}`)
    .digest("hex");

  const prior = readTable<JudicialDraftVersion>(DRAFTS_TABLE).find(
    (d) =>
      d.requestId === params.requestId &&
      d.userId === params.userId &&
      d.inputHash === editedHash
  );
  if (prior) return prior;

  return appendDraft({
    requestId: params.requestId,
    userId: params.userId,
    text,
    inputHash: editedHash,
    inputSnapshot: source.inputSnapshot,
    references: source.references,
    warnings: source.warnings,
    ambiguitiesFa: source.ambiguitiesFa,
    generator: "user_edited",
    provider: source.provider,
    providerConfigured: source.providerConfigured,
    model: source.model,
  });
}

/** Record the user's explicit approval of one version. */
export function approveDraft(
  userId: string,
  requestId: string,
  draftId: string
): JudicialDraftVersion | null {
  if (!getOwnedRequest(userId, requestId)) return null;
  const rows = readTable<JudicialDraftVersion>(DRAFTS_TABLE);
  const idx = rows.findIndex(
    (d) => d.id === draftId && d.requestId === requestId && d.userId === userId
  );
  if (idx < 0) return null;
  const now = new Date().toISOString();
  rows[idx] = { ...rows[idx]!, status: "approved", approvedAt: now, updatedAt: now };
  writeTable(DRAFTS_TABLE, rows);
  return rows[idx]!;
}

// ============================================================
// Counts (card + list projections)
// ============================================================

export function requestCounts(userId: string, requestId: string): {
  documentCount: number;
  draftCount: number;
  latestDraftVersion: number | null;
  hasApprovedDraft: boolean;
} {
  const documents = listAttachments(userId, requestId).length;
  const drafts = listDrafts(userId, requestId);
  return {
    documentCount: documents,
    draftCount: drafts.length,
    latestDraftVersion: drafts[0]?.version ?? null,
    hasApprovedDraft: drafts.some((d) => d.status === "approved"),
  };
}

/** Start mode helper used by the ready-document path. */
export function startModeFor(hasReadyDocument: boolean): JudicialStartMode {
  return hasReadyDocument ? "ready_document" : "ai_draft";
}

export { CONFIG_TABLE };
