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
  JudicialQuestionnaire,
  JudicialQuestionnaireResponse,
  JudicialRequest,
  JudicialRequestDetail,
  JudicialRequestSummary,
} from "@legalir/types";
import { listCases } from "@/lib/case-db";
import {
  getOwnedRequest,
  listAnswers,
  listAttachments,
  listDrafts,
  requestCounts,
} from "./db";
import { getQuestionnaireVersion } from "./questionnaires";
import { computeCompleteness } from "./completeness";
import { buildAnalysis } from "./analysis";
import { availableTransitions } from "./workflow";

export function toRequestSummary(request: JudicialRequest): JudicialRequestSummary {
  const counts = requestCounts(request.userId, request.id);
  return {
    id: request.id,
    serviceId: request.serviceId,
    documentType: request.documentType,
    status: request.status,
    currentStep: request.currentStep,
    titleFa: request.titleFa,
    updatedAt: request.updatedAt,
    documentCount: counts.documentCount,
    draftCount: counts.draftCount,
    latestDraftVersion: counts.latestDraftVersion,
    hasApprovedDraft: counts.hasApprovedDraft,
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
