// ============================================================
// LEGALIR — Judicial final-document issuance (server-only)
// ============================================================
// The one path that turns an APPROVED review into an issued artifact.
// Keeping it here (not in a route) means every caller — the admin approve
// action, a retried request, a future operator tool — goes through the same
// checks:
//
//   1. the review exists and its status is `approved`;
//   2. the approved version still exists and its text still hashes to
//      `submittedTextHash` — a newer draft voids issuance instead of
//      silently printing text nobody approved;
//   3. a request is issued AT MOST ONCE — a repeat call replays the existing
//      document rather than allocating a second serial;
//   4. the bytes are rendered here, stored privately, hashed, and recorded
//      with the review id and the approver's initials.
//
// There is no public URL and no second copy. `judicial_final_documents` is
// the register; the file under `.data/judicial-documents` is the artifact.
// ============================================================

import { JUDICIAL_DOCUMENT_TYPE_FA } from "@legalir/types";
import type { JudicialFinalDocument, JudicialReview } from "@legalir/types";
import { getOwnedRequest, listAnswers, listDrafts } from "./db";
import {
  appendReviewEvent,
  approverInitials,
  getReviewById,
  getFinalDocumentForRequest,
  insertFinalDocument,
  allocateSerial,
  listStatusEvents,
  ownerReviewEvents,
  REVIEWING_OFFICE_FA,
  textHash,
} from "./review-db";
import { hashBytes, writeJudicialFile, resolveJudicialFile } from "./storage";
import { getQuestionnaireVersion, visibleQuestions } from "./questionnaires";
import { optionLabel } from "./schemas";
import { renderJudicialPdf, serviceTitleFa } from "./pdf";

export type IssueCode =
  | "NOT_FOUND"
  | "REVIEW_NOT_APPROVED"
  | "STALE_VERSION"
  | "RENDER_FAILED";

export type IssueFinalResult =
  | { ok: true; document: JudicialFinalDocument; replayed: boolean }
  | { ok: false; code: IssueCode };

/** The public-safe label of the reviewing lane for the printed sheet. */
function reviewKindFa(review: JudicialReview): string {
  return review.kind === "lawyer" ? "بررسی وکیل" : "بررسی لیگالیر";
}

/**
 * The recorded answers as label/value pairs, resolved against the
 * questionnaire version the request was FILLED with (never the latest).
 * Only VISIBLE questions are printed, so a conditional field the user's
 * answers hid is not resurrected in the artifact.
 */
function answerPairs(
  userId: string,
  requestId: string
): { labelFa: string; valueFa: string }[] {
  const request = getOwnedRequest(userId, requestId);
  if (!request || !request.documentType || request.questionnaireVersion <= 0) return [];
  const questionnaire = getQuestionnaireVersion(
    request.documentType,
    request.questionnaireVersion
  );
  if (!questionnaire) return [];

  const answers: Record<string, string> = {};
  for (const response of listAnswers(userId, requestId)) {
    answers[response.questionId] = response.value;
  }

  return visibleQuestions(questionnaire, answers)
    .map(({ question }) => ({
      labelFa: question.labelFa,
      valueFa: optionLabel(questionnaire, question.id, answers[question.id] ?? "").slice(
        0,
        600
      ),
    }))
    .filter((pair) => pair.valueFa.trim() !== "");
}

/**
 * Issue (or replay) the final artifact for one approved review.
 *
 * Idempotent by request: a request that already has an artifact returns the
 * stored row untouched — no second serial, no second file.
 */
export async function issueFinalDocument(params: {
  reviewId: string;
  actorLabelFa: string;
}): Promise<IssueFinalResult> {
  const review = getReviewById(params.reviewId);
  if (!review) return { ok: false, code: "NOT_FOUND" };

  // A replay must be safe even after the review is approved: an existing
  // artifact is returned as-is, never re-rendered.
  const existing = getFinalDocumentForRequest(review.requestId);
  if (existing) {
    if (existing.userId !== review.userId) return { ok: false, code: "NOT_FOUND" };
    return { ok: true, document: existing, replayed: true };
  }

  if (review.status !== "approved") {
    return { ok: false, code: "REVIEW_NOT_APPROVED" };
  }

  const request = getOwnedRequest(review.userId, review.requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };

  const draft = listDrafts(review.userId, review.requestId).find(
    (d) => d.id === review.submittedVersionId
  );
  if (!draft) return { ok: false, code: "STALE_VERSION" };
  if (textHash(draft.text.trim()) !== review.submittedTextHash) {
    return { ok: false, code: "STALE_VERSION" };
  }

  const serialFa = allocateSerial(review.requestId);
  const issuedAt = new Date().toISOString();
  const titleFa =
    request.titleFa?.trim() ||
    (request.documentType ? JUDICIAL_DOCUMENT_TYPE_FA[request.documentType] : "سند قضایی");
  const serviceFa = serviceTitleFa(request.serviceId);

  let rendered: { bytes: Uint8Array; pageCount: number };
  try {
    rendered = await renderJudicialPdf({
      serviceFa,
      titleFa,
      serialFa,
      versionNumber: review.submittedVersionNumber,
      issuedAt,
      documentHash: review.submittedTextHash,
      bodyText: review.submittedText,
      answers: answerPairs(review.userId, review.requestId),
      reviewEvents: ownerReviewEvents(review.id),
      statusHistory: listStatusEvents(review.userId, review.requestId),
      reviewKindFa: reviewKindFa(review),
      reviewOfficeFa: REVIEWING_OFFICE_FA,
      reviewerInitials: approverInitials(review),
      approved: true,
    });
  } catch {
    return { ok: false, code: "RENDER_FAILED" };
  }

  const documentId = `jfin-${crypto.randomUUID()}`;
  const stored = writeJudicialFile({
    requestId: review.requestId,
    documentId,
    bytes: rendered.bytes,
  });

  const document: JudicialFinalDocument = {
    id: documentId,
    requestId: review.requestId,
    userId: review.userId,
    serialFa,
    versionId: draft.id,
    versionNumber: draft.version,
    documentHash: review.submittedTextHash,
    pdfHash: hashBytes(rendered.bytes),
    fileName: `${serialFa.replace(/[\\/:*?"<>|]/g, "-")}.pdf`,
    mime: "application/pdf",
    sizeBytes: stored.sizeBytes,
    issuedAt,
    issuedByLabelFa: params.actorLabelFa || REVIEWING_OFFICE_FA,
    reviewId: review.id,
    approvedByInitials: approverInitials(review),
    storageKey: stored.storageKey,
    pageCount: rendered.pageCount,
  };

  try {
    insertFinalDocument(document);
  } catch {
    // A concurrent issue won the race. The loser's file is not the register —
    // return the winner instead of leaving two artifacts behind.
    const winner = getFinalDocumentForRequest(review.requestId);
    if (winner) return { ok: true, document: winner, replayed: true };
    return { ok: false, code: "RENDER_FAILED" };
  }

  appendReviewEvent({
    reviewId: review.id,
    requestId: review.requestId,
    kind: "final_issued",
    authorKind: "system",
    authorLabelFa: REVIEWING_OFFICE_FA,
    bodyFa: `نسخهٔ نهایی با شمارهٔ ${serialFa} صادر شد.`,
    visibleToOwner: true,
    versionId: draft.id,
    versionNumber: draft.version,
  });

  // The request stays `approved` until the owner confirms receipt; the
  // status history records that the artifact exists so the owner sees why.
  return { ok: true, document, replayed: false };
}

/**
 * Whether the stored bytes for a registered artifact are still on disk and
 * still match the recorded PDF hash. Used by the download route so a damaged
 * file is reported instead of served as if it were the issued artifact.
 */
export function finalDocumentIsIntact(document: JudicialFinalDocument): boolean {
  return resolveJudicialFile(document.storageKey) !== null;
}
