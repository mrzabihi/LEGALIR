// ============================================================
// LEGALIR — Judicial projections for the API (server-only)
// ============================================================
// Routes must not each re-invent what a request "looks like". This module is
// the single place that turns stored rows into the two payloads the client
// consumes:
//
//   • JudicialRequestSummary — the list/resume projection;
//   • JudicialRequestDetail  — the full wizard payload, resolved against the
//     questionnaire version the request was FILLED with (never the latest),
//     with the server-computed completeness and the legal transitions.
//
// Nothing here decides availability or legality; it only reports it.
// ============================================================

import type {
  JudicialAnalysis,
  JudicialAttachment,
  JudicialCompleteness,
  JudicialDraftVersion,
  JudicialFinalDocument,
  JudicialQuestionnaire,
  JudicialQuestionnaireResponse,
  JudicialRequest,
  JudicialRequestDetail,
  JudicialRequestSummary,
  JudicialReviewDetail,
  JudicialStatusEvent,
} from "@legalir/types";
import { listCases } from "@/lib/case-db";
import {
  getOwnedRequest,
  listAnswers,
  listAttachments,
  listDrafts,
  requestCounts,
} from "./db";
import {
  getFinalDocumentForRequest,
  listReviewsForRequest,
  listStatusEvents,
  ownerReviewEvents,
} from "./review-db";
import { getQuestionnaireVersion } from "./questionnaires";
import { computeCompleteness } from "./completeness";
import { buildAnalysis } from "./analysis";
import { availableTransitions } from "./workflow";

/**
 * The owner-facing review projection. The ACTIVE review wins; when none is in
 * flight the newest closed one is shown so the owner can still read the
 * decision and its history. Internal operator notes are filtered out by
 * `ownerReviewEvents`, so this payload can be returned to the browser as-is.
 */
export function ownerReviewProjection(
  userId: string,
  requestId: string
): JudicialReviewDetail | null {
  const [review] = listReviewsForRequest(userId, requestId);
  if (!review) return null;
  return { ...review, events: ownerReviewEvents(review.id) };
}

/** Owner-visible status history, oldest first. */
function statusHistoryProjection(
  userId: string,
  requestId: string
): JudicialStatusEvent[] {
  return listStatusEvents(userId, requestId);
}

/** The issued artifact, only when it belongs to this owner. */
function finalDocumentProjection(
  userId: string,
  requestId: string
): JudicialFinalDocument | null {
  const doc = getFinalDocumentForRequest(requestId);
  return doc && doc.userId === userId ? doc : null;
}

export function toRequestSummary(request: JudicialRequest): JudicialRequestSummary {
  const counts = requestCounts(request.userId, request.id);
  const finalDoc = getFinalDocumentForRequest(request.id);
  return {
    id: request.id,
    serviceId: request.serviceId,
    documentType: request.documentType,
    status: request.status,
    currentStep: request.currentStep,
    titleFa: request.titleFa,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    documentCount: counts.documentCount,
    draftCount: counts.draftCount,
    latestDraftVersion: counts.latestDraftVersion,
    hasApprovedDraft: counts.hasApprovedDraft,
    // The row is reached through an owner-scoped read, so `finalDoc` can only
    // belong to this owner; the id check keeps the projection safe even if a
    // caller ever passes a foreign request.
    hasFinalDocument: finalDoc !== null && finalDoc.userId === request.userId,
  };
}

/** The caller's OWN cases, for the optional case-link picker. */
export function linkableCasesFor(
  userId: string
): { id: string; titleFa: string; internalRef: string | null }[] {
  return listCases(userId, { pageSize: 100 }).items.map((c) => ({
    id: c.id,
    titleFa: c.title,
    internalRef: c.internal_ref ?? null,
  }));
}

/**
 * Resolve the questionnaire a stored request was filled against. A request
 * whose family is still undetermined has no schema — the wizard then renders
 * the family picker instead of a form, which is an honest state, not an error.
 */
export function residentQuestionnaire(
  request: JudicialRequest
): JudicialQuestionnaire | null {
  if (!request.documentType || request.questionnaireVersion <= 0) return null;
  return getQuestionnaireVersion(request.documentType, request.questionnaireVersion) ?? null;
}

/**
 * A placeholder used ONLY while the family is undetermined. It carries no
 * steps, so the client renders the picker instead of a submit-able form.
 */
const EMPTY_QUESTIONNAIRE: JudicialQuestionnaire = {
  id: "",
  documentType: "petition",
  version: 0,
  status: "draft",
  titleFa: "",
  descriptionFa: "",
  steps: [],
  disclaimerFa: "",
  createdAt: "",
  createdBy: null,
  publishedAt: null,
  publishedBy: null,
};

export interface RequestDetailOptions {
  /** Build the step-4 analysis projection (skipped on the list route). */
  withAnalysis?: boolean;
  /** Include the caller's cases for the link picker. */
  withLinkableCases?: boolean;
  /**
   * Include the review / status-history / final-document projections. The
   * list route sets this to false: those payloads carry full draft text and
   * belong on the detail read, not in a list response.
   */
  withReview?: boolean;
  withStatusHistory?: boolean;
}

/**
 * The full wizard payload. `analysis` is derived, never stored, so it always
 * reflects the current inputs and can never drift from the stored answers.
 */
export function buildRequestDetail(
  request: JudicialRequest,
  attachments: JudicialAttachment[],
  drafts: JudicialDraftVersion[],
  responses: JudicialQuestionnaireResponse[],
  options: RequestDetailOptions = {}
): JudicialRequestDetail {
  const questionnaire = residentQuestionnaire(request);
  const completeness: JudicialCompleteness = questionnaire
    ? computeCompleteness(request, questionnaire)
    : {
        complete: false,
        missing: [
          {
            fieldId: "documentType",
            labelFa: "نوع سند",
            reasonFa: "برای ادامه، نوع سند باید مشخص شود.",
          },
        ],
        contradictions: [],
        routingUndetermined: request.documentType === null,
      };

  const analysis: JudicialAnalysis | null =
    options.withAnalysis && questionnaire
      ? buildAnalysis({
          request,
          questionnaire,
          attachments,
          completeness,
          references: drafts[0]?.references ?? [],
        })
      : null;

  return {
    request,
    questionnaire: questionnaire ?? EMPTY_QUESTIONNAIRE,
    responses,
    attachments,
    drafts,
    completeness,
    analysis,
    availableTransitions: availableTransitions(request),
    linkableCases: options.withLinkableCases ? linkableCasesFor(request.userId) : [],
    review: options.withReview === false ? null : ownerReviewProjection(request.userId, request.id),
    statusHistory:
      options.withStatusHistory === false
        ? []
        : statusHistoryProjection(request.userId, request.id),
    finalDocument:
      options.withReview === false
        ? null
        : finalDocumentProjection(request.userId, request.id),
  };
}

/** Load + project one owned request. Returns null for a foreign/missing id. */
export function getOwnedRequestDetail(
  userId: string,
  requestId: string,
  options: RequestDetailOptions = {}
): JudicialRequestDetail | null {
  const request = getOwnedRequest(userId, requestId);
  if (!request) return null;
  return buildRequestDetail(
    request,
    listAttachments(userId, requestId),
    listDrafts(userId, requestId),
    listAnswers(userId, requestId),
    options
  );
}
