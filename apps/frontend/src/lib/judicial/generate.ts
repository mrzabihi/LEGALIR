// ============================================================
// LEGALIR — Judicial draft generation (server-only)
// ============================================================
// The ONLY path that produces a draft version. It is deliberately synchronous
// and sequentially guarded so that a failure at any stage leaves the previous
// state intact:
//
//   1. resolve the request + the EXACT questionnaire version it was filled
//      against (never the latest);
//   2. refuse when the inputs are incomplete — the caller gets the follow-up
//      questions instead of a fabricated document;
//   3. hash the inputs; the same inputs return the same version and cost
//      NOTHING (no duplicate charge on refresh / double-click);
//   4. retrieve legal sources from the real knowledge base (or none — the
//      no-citation rule then holds);
//   5. compose the deterministic draft from the user's own confirmed facts;
//   6. optionally reword with a CONFIGURED provider (the mock never writes);
//   7. reserve the energy charge, append the immutable version, settle it.
//
// Every failure AFTER a reservation reverses it, so a provider error never
// burns the user's quota, and no draft row exists without a completed charge.
// ============================================================

import type {
  JudicialAttachment,
  JudicialCompleteness,
  JudicialDocumentType,
  JudicialDraftReference,
  JudicialDraftVersion,
  JudicialMissingField,
  JudicialQuestionnaire,
  JudicialRequest,
  JudicialRequestStatus,
} from "@legalir/types";
import { JUDICIAL_TRANSITIONS } from "@legalir/types";
import { retrieveGroundedSources } from "@/lib/ai/grounding";
import {
  createAiProvider,
  readAiProviderConfig,
  type AiUsage,
} from "@/lib/ai/provider";
import { completeUsage, reserveUsage, reverseUsage } from "@/lib/usage/engine";
import { JUDICIAL_SERVICE_FA } from "@legalir/types";
import {
  appendDraft,
  findDraftByInputHash,
  getOwnedRequest,
  listAttachments,
  patchRequest,
} from "./db";
import { getQuestionnaireVersion } from "./questionnaires";
import { computeCompleteness } from "./completeness";
import {
  buildInputSnapshot,
  composeStructuredDraft,
  hashInputSnapshot,
  refineWithModel,
} from "./compose";
import { transitionRequest } from "./workflow";

export type GenerateOutcome =
  | {
      ok: true;
      draft: JudicialDraftVersion;
      replayed: boolean;
      completeness: JudicialCompleteness;
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "QUESTIONNAIRE_UNAVAILABLE"
        | "READY_DOCUMENT_PATH"
        | "INCOMPLETE_INPUTS"
        | "USAGE_DENIED";
      messageFa: string;
      completeness?: JudicialCompleteness;
      missing?: JudicialMissingField[];
    };

/**
 * The retrieval query — the user's own words, never a model paraphrase.
 * Field ids come from the shipped questionnaires, so every family actually
 * contributes a subject instead of an empty string.
 */
function retrievalQuery(request: JudicialRequest, questionnaire: JudicialQuestionnaire): string {
  const a = request.answers;
  const subject = [
    a["claimKind"],
    a["caseSubject"],
    a["offenseTitle"],
    a["claimBasis"],
    a["demandText"],
    a["briefPurpose"],
  ]
    .map((v) => v?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const parts = [
    JUDICIAL_SERVICE_FA[request.serviceId],
    questionnaire.titleFa,
    subject,
    request.narrative,
  ];
  return parts.map((p) => p.trim()).filter(Boolean).join(" — ").slice(0, 1200);
}

/** Adapt the grounded sources to the persisted reference shape. */
function toDraftReferences(
  sources: ReturnType<typeof retrieveGroundedSources>["sources"]
): JudicialDraftReference[] {
  return sources.map((s) => ({
    sourceId: s.id,
    title: s.title,
    locator: s.locator,
    tierFa: s.tierFa,
  }));
}

function attachmentLabelFactory() {
  return (role: JudicialAttachment["role"]) =>
    role === "evidence" ? "دلیل و مستند" : "مدرک پیوست";
}

/**
 * The legal path from the request's CURRENT status to `draft_ready`, taken
 * from the shared transition table. Regenerating from `approved` therefore
 * goes approved → generating → draft_ready, exactly as the table permits —
 * the generation route never writes a status the table forbids.
 */
function pathToDraftReady(
  from: JudicialRequestStatus
): JudicialRequestStatus[] | null {
  if (from === "draft_ready") return [];
  const seen = new Set<JudicialRequestStatus>();
  const queue: { status: JudicialRequestStatus; path: JudicialRequestStatus[] }[] = [
    { status: from, path: [] },
  ];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.status)) continue;
    seen.add(current.status);
    for (const next of JUDICIAL_TRANSITIONS[current.status] ?? []) {
      if (next === "cancelled" || next === "archived") continue;
      const path = [...current.path, next];
      if (next === "draft_ready") return path;
      queue.push({ status: next, path });
    }
  }
  return null;
}

/**
 * Generate (or replay) one draft version for an owned request.
 *
 * `idempotencyKey` is the client's retry token. It is NOT used as the charge
 * key: the charge is keyed by the input hash, so two different clicks that
 * produce the same document are still one charge, and a changed input is a
 * genuinely new (and charged) version.
 */
export async function generateDraft(params: {
  userId: string;
  requestId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}): Promise<GenerateOutcome> {
  const request = getOwnedRequest(params.userId, params.requestId);
  if (!request) {
    return { ok: false, code: "NOT_FOUND", messageFa: "درخواست یافت نشد" };
  }

  if (request.startMode === "ready_document") {
    return {
      ok: false,
      code: "READY_DOCUMENT_PATH",
      messageFa:
        "این درخواست بر پایهٔ سند آمادهٔ خودتان ثبت شده و پیش‌نویس هوش مصنوعی برای آن ساخته نمی‌شود.",
    };
  }

  const documentType: JudicialDocumentType | null = request.documentType;
  if (!documentType) {
    const missing: JudicialMissingField[] = [
      {
        fieldId: "documentType",
        labelFa: "نوع سند",
        reasonFa: "برای انتخاب پرسش‌نامه و قالب سند، نوع سند باید مشخص باشد.",
      },
    ];
    return {
      ok: false,
      code: "INCOMPLETE_INPUTS",
      messageFa: "نوع سند هنوز مشخص نشده است؛ ابتدا نوع سند را انتخاب کنید.",
      // Same shape as the wizard's placeholder projection, so the review panel
      // can explain an undetermined family instead of showing "missing answers".
      completeness: {
        complete: false,
        missing,
        contradictions: [],
        routingUndetermined: true,
      },
      missing,
    };
  }

  const questionnaire = getQuestionnaireVersion(documentType, request.questionnaireVersion);
  if (!questionnaire) {
    return {
      ok: false,
      code: "QUESTIONNAIRE_UNAVAILABLE",
      messageFa:
        "نسخهٔ پرسش‌نامهٔ این درخواست در دسترس نیست. لطفاً از پشتیبانی بخواهید این درخواست را بازیابی کند.",
    };
  }

  const completeness = computeCompleteness(request, questionnaire);
  if (!completeness.complete) {
    return {
      ok: false,
      code: "INCOMPLETE_INPUTS",
      messageFa:
        "پیش از تنظیم پیش‌نویس، پاسخ چند پرسش یا اصلاح اطلاعات لازم است. موارد مشخص‌شده را تکمیل کنید.",
      completeness,
      missing: completeness.missing,
    };
  }

  const attachments = listAttachments(params.userId, params.requestId);
  const snapshot = buildInputSnapshot(request, questionnaire, attachments);
  const inputHash = hashInputSnapshot(snapshot);

  // Same inputs → the same version, no new charge. This is what makes a
  // refresh, a double-click or a network retry financially invisible.
  const existing = findDraftByInputHash(params.userId, params.requestId, inputHash);
  if (existing) {
    return { ok: true, draft: existing, replayed: true, completeness };
  }

  // Legal sources are retrieved from the real knowledge base. When none are
  // found the list stays empty and the draft states that explicitly — the
  // no-citation rule is never relaxed to fill a blank.
  const grounded = retrieveGroundedSources(retrievalQuery(request, questionnaire), 3);
  const references = toDraftReferences(grounded.sources);

  const composed = composeStructuredDraft(
    {
      request,
      questionnaire,
      attachments,
      attachmentLabel: attachmentLabelFactory(),
      references,
    },
    [...completeness.contradictions, ...completeness.missing.map((m) => m.reasonFa)]
  );

  let text = composed.text;
  let generator: JudicialDraftVersion["generator"] = "structured_composer";
  const provider = createAiProvider(readAiProviderConfig());

  let refineUsage: AiUsage | null = null;
  if (provider.configured) {
    const refined = await refineWithModel(provider, composed.text, references, params.signal);
    if (refined) {
      text = refined.text;
      refineUsage = refined.usage;
      generator = "model_refined";
    }
  }

  // Charge ONCE per distinct input set. The key is stable across retries.
  const chargeKey = `judicial-draft:${params.userId}:${params.requestId}:${inputHash}`;
  const reservation = reserveUsage({
    userId: params.userId,
    activity: "JUDICIAL_DRAFT",
    source: "judicial",
    relatedEntityId: params.requestId,
    idempotencyKey: chargeKey,
    // The model actually used for refinement — priced and recorded as such.
    costContext: {
      model: provider.model,
      ragCalls: references.length > 0 ? 1 : 0,
    },
  });

  if (!reservation.ok) {
    return {
      ok: false,
      code: "USAGE_DENIED",
      messageFa:
        reservation.messageFa ||
        "اعتبار کافی برای تنظیم این پیش‌نویس موجود نیست. طرح یا اعتبار خود را بررسی کنید.",
      completeness,
    };
  }

  const draft = appendDraft({
    requestId: params.requestId,
    userId: params.userId,
    text,
    inputHash,
    inputSnapshot: snapshot,
    references,
    warnings: composed.warnings,
    ambiguitiesFa: composed.ambiguitiesFa,
    generator,
    provider: provider.name,
    providerConfigured: provider.configured,
    model: provider.model,
  });

  if (!draft) {
    // The request vanished between the read and the write — release the
    // charge rather than leaving a paid, orphaned reservation.
    if (reservation.transaction) reverseUsage(reservation.transaction.id);
    return { ok: false, code: "NOT_FOUND", messageFa: "درخواست یافت نشد" };
  }

  if (reservation.transaction) {
    // The structured draft itself used no tokens; a model refinement did, and
    // its provider-reported usage is what gets recorded (never a guess).
    const usage = refineUsage;
    completeUsage(reservation.transaction.id, {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      tokens: usage?.totalTokens ?? 0,
      model: provider.model,
      provider: provider.configured ? provider.name : null,
      tokenUsageStatus: usage
        ? usage.estimated
          ? "ESTIMATED"
          : "ACTUAL"
        : "UNAVAILABLE",
      tokenUsageNoteFa: usage
        ? null
        : provider.configured
          ? "بازنویسی مدل انجام نشد؛ پیش‌نویس ساختاریافته بدون مصرف توکن ساخته شد."
          : "ارائه‌دهندهٔ مدل تنظیم نشده است؛ پیش‌نویس ساختاریافته بدون مصرف توکن ساخته شد.",
    });
  }

  // The workflow move is internal: only this module may enter `draft_ready`.
  // Each step is validated against the shared table, so a regenerated draft
  // from `approved` walks approved → generating → draft_ready instead of
  // forcing an illegal jump.
  const path = pathToDraftReady(request.status);
  if (path) {
    for (const step of path) {
      const moved = transitionRequest(params.userId, params.requestId, step, {
        allowInternal: true,
      });
      if (!moved.ok) break;
    }
  }
  // The user's next action is always reviewing the version they just paid for.
  patchRequest(params.userId, params.requestId, { currentStep: "review" });

  return { ok: true, draft, replayed: false, completeness };
}
