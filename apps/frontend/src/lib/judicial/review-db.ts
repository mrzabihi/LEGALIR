// ============================================================
// LEGALIR — Judicial review, service-order and final-document persistence
// ============================================================
// Five ADDITIVE tables sit next to the drafting tables in `./db`:
//
//   judicial_reviews            — one row per submitted review request
//   judicial_review_events      — append-only timeline (owner + internal notes)
//   judicial_status_events      — append-only owner-facing status history
//   judicial_orders             — tracked requests for the provider services
//   judicial_final_documents    — issued artifacts, one per approved request
//
// The load-bearing invariants of this module:
//
//   • A review is bound to ONE immutable draft version. `submittedTextHash`
//     and `submittedVersionId` record what the owner actually sent; approval
//     re-verifies that the version still exists and its text still hashes to
//     the same value. A newer draft voids the approval — it can never attach
//     to text the reviewer did not read.
//   • `visibleToOwner: false` events are internal operator notes. They are
//     filtered out of every owner projection HERE (not in the UI) and are
//     never handed to the PDF renderer.
//   • Every owner function is scoped on `userId`; a foreign id is
//     indistinguishable from a missing one.
//   • Nothing is hard-deleted: a cancelled review keeps its rows and a
//     rejected order keeps its history.
//   • The order status vocabulary never claims Ligalir issued a document.
// ============================================================

import { createHash } from "node:crypto";
import { findUserById, readTable, writeTable } from "@/lib/db";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import { isoToJalaliParts, toPersianDigits } from "@/lib/persian-utils";
import {
  JUDICIAL_REVIEW_TERMINAL,
  JUDICIAL_REQUEST_STATUS_FA,
} from "@legalir/types";
import type {
  JudicialFinalDocument,
  JudicialOrder,
  JudicialOrderAnswer,
  JudicialOrderStatus,
  JudicialRequestStatus,
  JudicialReview,
  JudicialReviewEvent,
  JudicialReviewEventKind,
  JudicialReviewKind,
  JudicialReviewStatus,
  JudicialServiceId,
  JudicialStatusEvent,
} from "@legalir/types";
import { getOwnedRequest, listDrafts, patchRequest } from "./db";

const T_REVIEWS = "judicial_reviews";
const T_EVENTS = "judicial_review_events";
const T_STATUS = "judicial_status_events";
const T_ORDERS = "judicial_orders";
const T_FINAL = "judicial_final_documents";

/** The office credited on every review and final artifact. */
export const REVIEWING_OFFICE_FA = "واحد بررسی حقوقی لیگالیر";

const MAX_BODY = 8000;

// ============================================================
// Identity / hashing helpers
// ============================================================

/** sha256 of a draft's exact text — the binding an approval carries. */
export function textHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** A public-safe operator/user label. Never returns a raw user id. */
export function actorLabelFa(userId: string | null | undefined): string {
  if (!userId) return REVIEWING_OFFICE_FA;
  const user = findUserById(userId);
  if (!user) return REVIEWING_OFFICE_FA;
  return user.displayName?.trim() || maskMobileMiddle(user.mobile);
}

function initialsOf(label: string): string | null {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const letters = words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("");
  return letters || null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, MAX_BODY) : null;
}

// ============================================================
// Status history (append-only, owner-visible)
// ============================================================

export function listStatusEvents(userId: string, requestId: string): JudicialStatusEvent[] {
  return readTable<JudicialStatusEvent>(T_STATUS)
    .filter((e) => e.requestId === requestId && e.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function appendStatusEvent(params: {
  requestId: string;
  userId: string;
  fromStatus: JudicialRequestStatus | null;
  toStatus: JudicialRequestStatus;
  actorLabelFa: string;
  noteFa?: string | null;
}): JudicialStatusEvent {
  const row: JudicialStatusEvent = {
    id: `jstat-${crypto.randomUUID()}`,
    requestId: params.requestId,
    userId: params.userId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actorLabelFa: params.actorLabelFa || REVIEWING_OFFICE_FA,
    noteFa: clean(params.noteFa),
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<JudicialStatusEvent>(T_STATUS);
  rows.push(row);
  writeTable(T_STATUS, rows);
  return row;
}

/**
 * Server-internal status move. Always writes the history row, so a status
 * change and its explanation can never diverge. `patchRequest` mirrors the
 * new status into the activity feed.
 */
export function moveRequestStatus(params: {
  userId: string;
  requestId: string;
  to: JudicialRequestStatus;
  actorLabelFa: string;
  noteFa?: string | null;
  extra?: Parameters<typeof patchRequest>[2];
}): boolean {
  const request = getOwnedRequest(params.userId, params.requestId);
  if (!request) return false;
  if (request.status === params.to) return true;

  const next = patchRequest(params.userId, params.requestId, {
    ...(params.extra ?? {}),
    status: params.to,
  });
  if (!next) return false;

  appendStatusEvent({
    requestId: params.requestId,
    userId: params.userId,
    fromStatus: request.status,
    toStatus: params.to,
    actorLabelFa: params.actorLabelFa,
    noteFa: params.noteFa ?? JUDICIAL_REQUEST_STATUS_FA[params.to],
  });
  return true;
}

// ============================================================
// Reviews — reads
// ============================================================

function normalizeReview(row: JudicialReview): JudicialReview {
  return {
    ...row,
    noteFa: row.noteFa ?? null,
    assignedToUserId: row.assignedToUserId ?? null,
    assignedToLabelFa: row.assignedToLabelFa ?? null,
    decisionNoteFa: row.decisionNoteFa ?? null,
    lawyerRequestId: row.lawyerRequestId ?? null,
    decidedAt: row.decidedAt ?? null,
    decidedByLabelFa: row.decidedByLabelFa ?? null,
  };
}

/** Every review of one owned request, newest first. */
export function listReviewsForRequest(userId: string, requestId: string): JudicialReview[] {
  return readTable<JudicialReview>(T_REVIEWS)
    .filter((r) => r.requestId === requestId && r.userId === userId)
    .map(normalizeReview)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The review currently in flight, if any (a request has at most one). */
export function activeReviewForRequest(
  userId: string,
  requestId: string
): JudicialReview | null {
  return (
    listReviewsForRequest(userId, requestId).find(
      (r) => !JUDICIAL_REVIEW_TERMINAL.includes(r.status)
    ) ?? null
  );
}

export function getOwnedReview(userId: string, reviewId: string): JudicialReview | null {
  const row = readTable<JudicialReview>(T_REVIEWS).find(
    (r) => r.id === reviewId && r.userId === userId
  );
  return row ? normalizeReview(row) : null;
}

export function getReviewById(reviewId: string): JudicialReview | null {
  const row = readTable<JudicialReview>(T_REVIEWS).find((r) => r.id === reviewId);
  return row ? normalizeReview(row) : null;
}

export function listAllReviews(): JudicialReview[] {
  return readTable<JudicialReview>(T_REVIEWS)
    .map(normalizeReview)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function allEvents(reviewId: string): JudicialReviewEvent[] {
  return readTable<JudicialReviewEvent>(T_EVENTS)
    .filter((e) => e.reviewId === reviewId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The OWNER projection. Internal notes are removed here, so no client
 * component and no PDF path can accidentally surface them.
 */
export function ownerReviewEvents(reviewId: string): JudicialReviewEvent[] {
  return allEvents(reviewId).filter((e) => e.visibleToOwner);
}

export function adminReviewEvents(reviewId: string): JudicialReviewEvent[] {
  return allEvents(reviewId);
}

export function reviewEventCount(reviewId: string): number {
  return readTable<JudicialReviewEvent>(T_EVENTS).filter((e) => e.reviewId === reviewId)
    .length;
}

// ============================================================
// Reviews — lifecycle (owner)
// ============================================================

export type SubmitReviewCode =
  | "OK"
  | "NOT_FOUND"
  | "DRAFT_NOT_FOUND"
  | "ALREADY_IN_REVIEW"
  | "EMPTY_DRAFT";

export type SubmitReviewResult =
  | { ok: true; review: JudicialReview; replayed: boolean }
  | { ok: false; code: SubmitReviewCode };

/**
 * Submit ONE draft version for review. Idempotent by `idempotencyKey` — a
 * retried POST returns the original review instead of opening a second one.
 *
 * The submitted text is snapshotted: the operator reads exactly what the
 * owner sent, even if the owner keeps editing the draft afterwards.
 */
export function submitForReview(params: {
  userId: string;
  requestId: string;
  draftId: string;
  note?: string;
  kind?: JudicialReviewKind;
  idempotencyKey: string;
}): SubmitReviewResult {
  const request = getOwnedRequest(params.userId, params.requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };

  const rows = readTable<JudicialReview>(T_REVIEWS);
  const replay = rows.find(
    (r) =>
      r.userId === params.userId &&
      r.requestId === params.requestId &&
      params.idempotencyKey !== "" &&
      (r as JudicialReview & { idempotencyKey?: string }).idempotencyKey ===
        params.idempotencyKey
  );
  if (replay) return { ok: true, review: normalizeReview(replay), replayed: true };

  if (activeReviewForRequest(params.userId, params.requestId)) {
    return { ok: false, code: "ALREADY_IN_REVIEW" };
  }

  const draft = listDrafts(params.userId, params.requestId).find(
    (d) => d.id === params.draftId
  );
  if (!draft) return { ok: false, code: "DRAFT_NOT_FOUND" };
  const text = draft.text.trim();
  if (!text) return { ok: false, code: "EMPTY_DRAFT" };

  const now = new Date().toISOString();
  const review: JudicialReview & { idempotencyKey: string } = {
    id: `jrev-${crypto.randomUUID()}`,
    requestId: params.requestId,
    userId: params.userId,
    kind: params.kind === "lawyer" ? "lawyer" : "legalir",
    status: "pending",
    submittedVersionId: draft.id,
    submittedVersionNumber: draft.version,
    submittedTextHash: textHash(text),
    submittedText: text,
    serviceId: request.serviceId,
    documentType: request.documentType,
    noteFa: clean(params.note),
    assignedToUserId: null,
    assignedToLabelFa: null,
    decisionNoteFa: null,
    lawyerRequestId: null,
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    decidedByLabelFa: null,
    idempotencyKey: params.idempotencyKey,
  };

  rows.push(review);
  writeTable(T_REVIEWS, rows);

  appendReviewEvent({
    reviewId: review.id,
    requestId: params.requestId,
    kind: "submitted",
    authorKind: "owner",
    authorLabelFa: ownerLabel(params.userId),
    bodyFa: review.noteFa,
    visibleToOwner: true,
    versionId: draft.id,
    versionNumber: draft.version,
  });

  moveRequestStatus({
    userId: params.userId,
    requestId: params.requestId,
    to: "under_review",
    actorLabelFa: ownerLabel(params.userId),
    noteFa: `نسخهٔ ${toPersianDigits(draft.version)} برای بررسی ارسال شد.`,
  });

  return { ok: true, review: normalizeReview(review), replayed: false };
}

function ownerLabel(userId: string): string {
  const user = findUserById(userId);
  return user?.displayName?.trim() || "کاربر";
}

export function appendReviewEvent(params: {
  reviewId: string;
  requestId: string;
  kind: JudicialReviewEventKind;
  authorKind: JudicialReviewEvent["authorKind"];
  authorLabelFa: string;
  bodyFa?: string | null;
  visibleToOwner: boolean;
  versionId?: string | null;
  versionNumber?: number | null;
}): JudicialReviewEvent {
  const row: JudicialReviewEvent = {
    id: `jreved-${crypto.randomUUID()}`,
    reviewId: params.reviewId,
    requestId: params.requestId,
    kind: params.kind,
    authorKind: params.authorKind,
    authorLabelFa: params.authorLabelFa || REVIEWING_OFFICE_FA,
    bodyFa: clean(params.bodyFa),
    visibleToOwner: params.visibleToOwner,
    versionId: params.versionId ?? null,
    versionNumber: params.versionNumber ?? null,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<JudicialReviewEvent>(T_EVENTS);
  rows.push(row);
  writeTable(T_EVENTS, rows);
  return row;
}

/**
 * The owner replies to a review: an answer, a supplementary note, or a
 * resubmission of a newer draft after `changes_requested`.
 */
export function replyToReview(params: {
  userId: string;
  reviewId: string;
  bodyFa?: string;
  versionId?: string;
}): { ok: true; review: JudicialReview } | { ok: false; code: string } {
  const review = getOwnedReview(params.userId, params.reviewId);
  if (!review) return { ok: false, code: "NOT_FOUND" };
  if (JUDICIAL_REVIEW_TERMINAL.includes(review.status)) {
    return { ok: false, code: "REVIEW_CLOSED" };
  }

  const rows = readTable<JudicialReview>(T_REVIEWS);
  const idx = rows.findIndex((r) => r.id === review.id);
  if (idx < 0) return { ok: false, code: "NOT_FOUND" };

  const now = new Date().toISOString();
  let next: JudicialReview = { ...review, updatedAt: now };

  if (params.versionId) {
    const draft = listDrafts(params.userId, review.requestId).find(
      (d) => d.id === params.versionId
    );
    if (!draft) return { ok: false, code: "DRAFT_NOT_FOUND" };
    const text = draft.text.trim();
    if (!text) return { ok: false, code: "EMPTY_DRAFT" };
    // A resubmission rebinds the review to the new text — the previous
    // approval hash is discarded with it.
    next = {
      ...next,
      submittedVersionId: draft.id,
      submittedVersionNumber: draft.version,
      submittedTextHash: textHash(text),
      submittedText: text,
      status: "pending",
      decidedAt: null,
      decidedByLabelFa: null,
    };
    appendReviewEvent({
      reviewId: review.id,
      requestId: review.requestId,
      kind: "resubmitted",
      authorKind: "owner",
      authorLabelFa: ownerLabel(params.userId),
      bodyFa: params.bodyFa,
      visibleToOwner: true,
      versionId: draft.id,
      versionNumber: draft.version,
    });
  } else {
    appendReviewEvent({
      reviewId: review.id,
      requestId: review.requestId,
      kind: "user_reply",
      authorKind: "owner",
      authorLabelFa: ownerLabel(params.userId),
      bodyFa: params.bodyFa,
      visibleToOwner: true,
    });
  }

  // Answering a waiting review puts it back in the operator queue.
  if (next.status === "waiting_user") next = { ...next, status: "in_progress" };

  rows[idx] = next;
  writeTable(T_REVIEWS, rows);

  if (next.status === "pending" || next.status === "in_progress") {
    moveRequestStatus({
      userId: params.userId,
      requestId: review.requestId,
      to: "under_review",
      actorLabelFa: ownerLabel(params.userId),
      noteFa: params.versionId
        ? `نسخهٔ ${toPersianDigits(next.submittedVersionNumber)} دوباره برای بررسی ارسال شد.`
        : "پاسخ کاربر ثبت شد.",
    });
  }

  return { ok: true, review: normalizeReview(next) };
}

export function cancelReviewByOwner(
  userId: string,
  reviewId: string,
  note?: string
): boolean {
  const review = getOwnedReview(userId, reviewId);
  if (!review || JUDICIAL_REVIEW_TERMINAL.includes(review.status)) return false;

  const rows = readTable<JudicialReview>(T_REVIEWS);
  const idx = rows.findIndex((r) => r.id === reviewId);
  if (idx < 0) return false;
  const now = new Date().toISOString();
  rows[idx] = {
    ...rows[idx]!,
    status: "cancelled",
    decisionNoteFa: clean(note),
    decidedAt: now,
    updatedAt: now,
  };
  writeTable(T_REVIEWS, rows);

  appendReviewEvent({
    reviewId,
    requestId: review.requestId,
    kind: "cancelled",
    authorKind: "owner",
    authorLabelFa: ownerLabel(userId),
    bodyFa: note,
    visibleToOwner: true,
  });

  moveRequestStatus({
    userId,
    requestId: review.requestId,
    to: "ready_to_review",
    actorLabelFa: ownerLabel(userId),
    noteFa: "درخواست بررسی توسط کاربر لغو شد.",
  });
  return true;
}

// ============================================================
// Reviews — admin actions
// ============================================================

export interface AdminReviewActor {
  userId: string;
  labelFa: string;
}

export type AdminActionCode =
  | "OK"
  | "NOT_FOUND"
  | "REVIEW_CLOSED"
  | "STALE_VERSION"
  | "NOTE_REQUIRED"
  | "VERSION_REQUIRED";

/**
 * Apply one operator action.
 *
 * `approve` is the critical path: the client states which version it read
 * (`versionId`) and the server refuses unless that id is the review's
 * submitted version AND the version still exists with the same text hash.
 * Approval therefore can never drift onto a version the reviewer did not see.
 */
export function applyAdminReviewAction(params: {
  reviewId: string;
  actor: AdminReviewActor;
  action:
    | "assign"
    | "note"
    | "request_changes"
    | "approve"
    | "reject"
    | "cancel";
  noteFa?: string;
  assigneeUserId?: string | null;
  versionId?: string;
  revisedText?: string;
  internalNote?: boolean;
}):
  | { ok: true; review: JudicialReview }
  | { ok: false; code: AdminActionCode } {
  const rows = readTable<JudicialReview>(T_REVIEWS);
  const idx = rows.findIndex((r) => r.id === params.reviewId);
  if (idx < 0) return { ok: false, code: "NOT_FOUND" };
  const review = normalizeReview(rows[idx]!);

  const isTerminal = JUDICIAL_REVIEW_TERMINAL.includes(review.status);
  const now = new Date().toISOString();
  const actorLabel = params.actor.labelFa || REVIEWING_OFFICE_FA;

  if (isTerminal && params.action !== "note") {
    return { ok: false, code: "REVIEW_CLOSED" };
  }

  const persist = (
    next: JudicialReview,
    event: Omit<
      Parameters<typeof appendReviewEvent>[0],
      "reviewId" | "requestId"
    >
  ) => {
    rows[idx] = next;
    writeTable(T_REVIEWS, rows);
    appendReviewEvent({ reviewId: review.id, requestId: review.requestId, ...event });
  };

  switch (params.action) {
    case "assign": {
      const assigneeLabel = params.assigneeUserId
        ? actorLabelFa(params.assigneeUserId)
        : null;
      const next: JudicialReview = {
        ...review,
        assignedToUserId: params.assigneeUserId ?? null,
        assignedToLabelFa: assigneeLabel,
        status: review.status === "pending" ? "in_progress" : review.status,
        updatedAt: now,
      };
      persist(next, {
        kind: "assigned",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: assigneeLabel
          ? `بررسی به ${assigneeLabel} سپرده شد.`
          : "تخصیص بررسی برداشته شد.",
        visibleToOwner: true,
      });
      return { ok: true, review: normalizeReview(next) };
    }

    case "note": {
      const body = clean(params.noteFa);
      if (!body) return { ok: false, code: "NOTE_REQUIRED" };
      // Internal notes are excluded from every owner projection by this
      // module's own filter, never by the reading component.
      const visible = params.internalNote !== true;
      persist(
        { ...review, updatedAt: now },
        {
          kind: "note",
          authorKind: "admin",
          authorLabelFa: actorLabel,
          bodyFa: body,
          visibleToOwner: visible,
        }
      );
      return { ok: true, review };
    }

    case "request_changes": {
      const body = clean(params.noteFa);
      if (!body) return { ok: false, code: "NOTE_REQUIRED" };
      const next: JudicialReview = {
        ...review,
        status: "changes_requested",
        decisionNoteFa: body,
        updatedAt: now,
      };
      persist(next, {
        kind: "change_request",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: body,
        visibleToOwner: true,
        versionId: review.submittedVersionId,
        versionNumber: review.submittedVersionNumber,
      });
      moveRequestStatus({
        userId: review.userId,
        requestId: review.requestId,
        to: "needs_correction",
        actorLabelFa: actorLabel,
        noteFa: "اصلاحات درخواست‌شده در پنل بررسی قابل مشاهده است.",
      });
      return { ok: true, review: normalizeReview(next) };
    }

    case "reject": {
      const body = clean(params.noteFa);
      if (!body) return { ok: false, code: "NOTE_REQUIRED" };
      const next: JudicialReview = {
        ...review,
        status: "rejected",
        decisionNoteFa: body,
        decidedAt: now,
        decidedByLabelFa: actorLabel,
        updatedAt: now,
      };
      persist(next, {
        kind: "rejected",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: body,
        visibleToOwner: true,
      });
      moveRequestStatus({
        userId: review.userId,
        requestId: review.requestId,
        to: "needs_correction",
        actorLabelFa: actorLabel,
        noteFa: "درخواست بررسی رد شد؛ متن دلیل در جزئیات درخواست است.",
      });
      return { ok: true, review: normalizeReview(next) };
    }

    case "cancel": {
      const body = clean(params.noteFa);
      const next: JudicialReview = {
        ...review,
        status: "cancelled",
        decisionNoteFa: body,
        decidedAt: now,
        decidedByLabelFa: actorLabel,
        updatedAt: now,
      };
      persist(next, {
        kind: "cancelled",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: body,
        visibleToOwner: true,
      });
      moveRequestStatus({
        userId: review.userId,
        requestId: review.requestId,
        to: "ready_to_review",
        actorLabelFa: actorLabel,
        noteFa: "بررسی توسط واحد بررسی لیگالیر لغو شد.",
      });
      return { ok: true, review: normalizeReview(next) };
    }

    case "approve": {
      if (!params.versionId || params.versionId !== review.submittedVersionId) {
        return { ok: false, code: "VERSION_REQUIRED" };
      }
      // The version must still exist and still carry the submitted text.
      const draft = listDrafts(review.userId, review.requestId).find(
        (d) => d.id === review.submittedVersionId
      );
      if (!draft || textHash(draft.text.trim()) !== review.submittedTextHash) {
        return { ok: false, code: "STALE_VERSION" };
      }
      const note = clean(params.noteFa);
      const next: JudicialReview = {
        ...review,
        status: "approved",
        decisionNoteFa: note ?? review.decisionNoteFa,
        decidedAt: now,
        decidedByLabelFa: actorLabel,
        updatedAt: now,
      };
      persist(next, {
        kind: "approval_note",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: note,
        visibleToOwner: true,
        versionId: review.submittedVersionId,
        versionNumber: review.submittedVersionNumber,
      });
      appendReviewEvent({
        reviewId: review.id,
        requestId: review.requestId,
        kind: "approved",
        authorKind: "admin",
        authorLabelFa: actorLabel,
        bodyFa: null,
        visibleToOwner: true,
        versionId: review.submittedVersionId,
        versionNumber: review.submittedVersionNumber,
      });
      moveRequestStatus({
        userId: review.userId,
        requestId: review.requestId,
        to: "approved",
        actorLabelFa: actorLabel,
        noteFa: "نسخهٔ ارسال‌شده تأیید شد.",
        extra: { completedAt: now, userConfirmed: true, currentStep: "review" },
      });
      return { ok: true, review: normalizeReview(next) };
    }

    default:
      return { ok: false, code: "NOT_FOUND" };
  }
}

/** Initials of the operator that approved a review (for the artifact). */
export function approverInitials(review: JudicialReview): string | null {
  return review.decidedByLabelFa ? initialsOf(review.decidedByLabelFa) : null;
}

/** Internal helper: true when a review still governs a request's status. */
export function isReviewTerminal(status: JudicialReviewStatus): boolean {
  return JUDICIAL_REVIEW_TERMINAL.includes(status);
}

// ============================================================
// Service orders (request_only services)
// ============================================================

function normalizeOrder(row: JudicialOrder): JudicialOrder {
  return {
    ...row,
    answers: row.answers ?? [],
    noteFa: row.noteFa ?? null,
    purposeFa: row.purposeFa ?? null,
    attachmentIds: row.attachmentIds ?? [],
    assignedToUserId: row.assignedToUserId ?? null,
    assignedToLabelFa: row.assignedToLabelFa ?? null,
    operatorNoteFa: row.operatorNoteFa ?? null,
    deliveryDocumentId: row.deliveryDocumentId ?? null,
    deliveryNameFa: row.deliveryNameFa ?? null,
    submittedAt: row.submittedAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
  };
}

export function listOrdersForUser(userId: string): JudicialOrder[] {
  return readTable<JudicialOrder>(T_ORDERS)
    .filter((o) => o.userId === userId)
    .map(normalizeOrder)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getOwnedOrder(userId: string, orderId: string): JudicialOrder | null {
  const row = readTable<JudicialOrder>(T_ORDERS).find(
    (o) => o.id === orderId && o.userId === userId
  );
  return row ? normalizeOrder(row) : null;
}

export function getOrderById(orderId: string): JudicialOrder | null {
  const row = readTable<JudicialOrder>(T_ORDERS).find((o) => o.id === orderId);
  return row ? normalizeOrder(row) : null;
}

export function listAllOrders(): JudicialOrder[] {
  return readTable<JudicialOrder>(T_ORDERS)
    .map(normalizeOrder)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface OrderDraftInput {
  serviceId: JudicialServiceId;
  titleFa: string;
  answers: JudicialOrderAnswer[];
  noteFa?: string | null;
  purposeFa?: string | null;
  attachmentIds?: string[];
  /** When true the order is submitted immediately; otherwise saved as draft. */
  submit?: boolean;
  idempotencyKey: string;
}

/**
 * Create (or idempotently replay) one tracked order. An order is never
 * `delivered` at creation — the status vocabulary stays honest.
 */
export function createOrder(
  userId: string,
  input: OrderDraftInput
): { order: JudicialOrder; replayed: boolean } {
  const rows = readTable<JudicialOrder & { idempotencyKey?: string }>(T_ORDERS);
  if (input.idempotencyKey) {
    const replay = rows.find(
      (o) => o.userId === userId && o.idempotencyKey === input.idempotencyKey
    );
    if (replay) return { order: normalizeOrder(replay), replayed: true };
  }

  const now = new Date().toISOString();
  const order: JudicialOrder & { idempotencyKey: string } = {
    id: `jord-${crypto.randomUUID()}`,
    userId,
    serviceId: input.serviceId,
    status: input.submit ? "submitted" : "draft",
    // `idempotencyKey` is deliberately outside the public `JudicialOrder`
    // shape: the client never needs it back, but the row keeps it so a
    // retried POST replays instead of duplicating.
    titleFa: input.titleFa.trim().slice(0, 160),
    answers: input.answers.slice(0, 60),
    noteFa: clean(input.noteFa),
    purposeFa: clean(input.purposeFa),
    attachmentIds: (input.attachmentIds ?? []).slice(0, 30),
    assignedToUserId: null,
    assignedToLabelFa: null,
    operatorNoteFa: null,
    deliveryDocumentId: null,
    deliveryNameFa: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: input.submit ? now : null,
    deliveredAt: null,
    idempotencyKey: input.idempotencyKey,
  };
  rows.push(order);
  writeTable(T_ORDERS, rows);
  return { order: normalizeOrder(order), replayed: false };
}

/** Owner edit of a draft order. A submitted order keeps its own record. */
export function updateOrderDraft(
  userId: string,
  orderId: string,
  input: Partial<OrderDraftInput>
): JudicialOrder | null {
  const rows = readTable<JudicialOrder>(T_ORDERS);
  const idx = rows.findIndex((r) => r.id === orderId && r.userId === userId);
  if (idx < 0) return null;
  const prev = normalizeOrder(rows[idx]!);
  if (prev.status !== "draft" && prev.status !== "waiting_user") return null;

  const now = new Date().toISOString();
  const next: JudicialOrder = {
    ...prev,
    ...(input.titleFa !== undefined ? { titleFa: input.titleFa.trim().slice(0, 160) } : {}),
    ...(input.answers !== undefined ? { answers: input.answers.slice(0, 60) } : {}),
    ...(input.noteFa !== undefined ? { noteFa: clean(input.noteFa) } : {}),
    ...(input.purposeFa !== undefined ? { purposeFa: clean(input.purposeFa) } : {}),
    ...(input.attachmentIds !== undefined
      ? { attachmentIds: input.attachmentIds.slice(0, 30) }
      : {}),
    updatedAt: now,
  };
  rows[idx] = next;
  writeTable(T_ORDERS, rows);
  return next;
}

/** Owner submits a draft (or re-submits after `waiting_user`). */
export function submitOrder(userId: string, orderId: string): JudicialOrder | null {
  const rows = readTable<JudicialOrder>(T_ORDERS);
  const idx = rows.findIndex((r) => r.id === orderId && r.userId === userId);
  if (idx < 0) return null;
  const prev = normalizeOrder(rows[idx]!);
  if (prev.status !== "draft" && prev.status !== "waiting_user") return null;
  const now = new Date().toISOString();
  rows[idx] = {
    ...prev,
    status: "submitted",
    submittedAt: prev.submittedAt ?? now,
    updatedAt: now,
  };
  writeTable(T_ORDERS, rows);
  return normalizeOrder(rows[idx]!);
}

/** Owner cancels an order that has not been delivered yet. */
export function cancelOrder(userId: string, orderId: string): boolean {
  const rows = readTable<JudicialOrder>(T_ORDERS);
  const idx = rows.findIndex((r) => r.id === orderId && r.userId === userId);
  if (idx < 0) return false;
  const prev = normalizeOrder(rows[idx]!);
  if (prev.status === "delivered" || prev.status === "cancelled") return false;
  rows[idx] = { ...prev, status: "cancelled", updatedAt: new Date().toISOString() };
  writeTable(T_ORDERS, rows);
  return true;
}

export interface AdminOrderPatch {
  status?: JudicialOrderStatus;
  assignedToUserId?: string | null;
  operatorNoteFa?: string | null;
  deliveryDocumentId?: string | null;
  deliveryNameFa?: string | null;
}

/**
 * Operator update. `delivered` is only reachable with a real artifact.
 * Attribution is written by the admin route's own audit log, so the actor is
 * accepted for call-site symmetry but is not stored on the order row.
 */
export function updateOrderByAdmin(
  orderId: string,
  patch: AdminOrderPatch,
  _actor: AdminReviewActor
): JudicialOrder | null {
  const rows = readTable<JudicialOrder>(T_ORDERS);
  const idx = rows.findIndex((r) => r.id === orderId);
  if (idx < 0) return null;
  const prev = normalizeOrder(rows[idx]!);
  const now = new Date().toISOString();

  const deliveryDocumentId =
    patch.deliveryDocumentId !== undefined
      ? patch.deliveryDocumentId
      : prev.deliveryDocumentId;
  if (patch.status === "delivered" && !deliveryDocumentId) return null;

  const next: JudicialOrder = {
    ...prev,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.assignedToUserId !== undefined
      ? {
          assignedToUserId: patch.assignedToUserId,
          assignedToLabelFa: patch.assignedToUserId
            ? actorLabelFa(patch.assignedToUserId)
            : null,
        }
      : {}),
    ...(patch.operatorNoteFa !== undefined
      ? { operatorNoteFa: clean(patch.operatorNoteFa) }
      : {}),
    ...(patch.deliveryDocumentId !== undefined
      ? { deliveryDocumentId: patch.deliveryDocumentId }
      : {}),
    ...(patch.deliveryNameFa !== undefined
      ? { deliveryNameFa: patch.deliveryNameFa }
      : {}),
    ...(patch.status === "delivered" ? { deliveredAt: now } : {}),
    updatedAt: now,
  };
  rows[idx] = next;
  writeTable(T_ORDERS, rows);
  return normalizeOrder(next);
}

// ============================================================
// Final documents (issued only after approval)
// ============================================================

/**
 * «LGR-JD-۱۴۰۵-۰۰۰۱۲۳» — one per issued artifact, never reused. The request
 * id is accepted for call-site clarity; the sequence itself is year-wide so
 * two requests can never mint the same serial.
 */
export function allocateSerial(_requestId: string): string {
  const existing = readTable<JudicialFinalDocument>(T_FINAL);
  const { jy } = isoToJalaliParts(new Date());
  const yearCount = existing.filter((d) => d.serialFa.includes(`-${toPersianDigits(jy)}-`))
    .length;
  const sequence = yearCount + 1;
  return `LGR-JD-${toPersianDigits(jy)}-${toPersianDigits(String(sequence).padStart(6, "0"))}`;
}

export function getFinalDocumentForRequest(
  requestId: string
): JudicialFinalDocument | null {
  return (
    readTable<JudicialFinalDocument>(T_FINAL).find((d) => d.requestId === requestId) ?? null
  );
}

export function getOwnedFinalDocument(
  userId: string,
  requestId: string
): JudicialFinalDocument | null {
  return (
    readTable<JudicialFinalDocument>(T_FINAL).find(
      (d) => d.requestId === requestId && d.userId === userId
    ) ?? null
  );
}

export function insertFinalDocument(doc: JudicialFinalDocument): JudicialFinalDocument {
  const rows = readTable<JudicialFinalDocument>(T_FINAL);
  // One artifact per request: an approved request is issued exactly once.
  if (rows.some((d) => d.requestId === doc.requestId)) {
    throw new Error("FINAL_ALREADY_ISSUED");
  }
  rows.push(doc);
  writeTable(T_FINAL, rows);
  return doc;
}

/** Delete every review-related row of a deleted request (owner deletion). */
export function purgeReviewRows(userId: string, requestId: string): void {
  const reviewIds = new Set(
    readTable<JudicialReview>(T_REVIEWS)
      .filter((r) => r.requestId === requestId && r.userId === userId)
      .map((r) => r.id)
  );
  writeTable(
    T_REVIEWS,
    readTable<JudicialReview>(T_REVIEWS).filter((r) => !reviewIds.has(r.id))
  );
  writeTable(
    T_EVENTS,
    readTable<JudicialReviewEvent>(T_EVENTS).filter(
      (e) => !(reviewIds.has(e.reviewId) || e.requestId === requestId)
    )
  );
  writeTable(
    T_STATUS,
    readTable<JudicialStatusEvent>(T_STATUS).filter(
      (e) => !(e.requestId === requestId && e.userId === userId)
    )
  );
  writeTable(
    T_FINAL,
    readTable<JudicialFinalDocument>(T_FINAL).filter(
      (d) => !(d.requestId === requestId && d.userId === userId)
    )
  );
}

export { T_REVIEWS, T_EVENTS, T_STATUS, T_ORDERS, T_FINAL };
