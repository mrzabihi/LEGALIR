// ============================================================
// LEGALIR — Judicial services API client
// ============================================================
// Thin wrappers over the `/api/v1/judicial/**` routes. The client carries no
// authorization or availability logic: the server re-checks both on every
// call, and the UI only renders what the server reports.
// ============================================================

import { apiClient } from "./client";
import type {
  JudicialAttachment,
  JudicialAttachmentRole,
  JudicialCapabilities,
  JudicialDraftVersion,
  JudicialListResponse,
  JudicialOrder,
  JudicialOrderAnswer,
  JudicialRequestDetail,
  JudicialRequestSummary,
  JudicialRequestStep,
  JudicialReviewDetail,
  JudicialServiceSummary,
  JudicialServiceView,
  JudicialSubmitReviewInput,
} from "@legalir/types";

const J = "/api/v1/judicial";

// ---------------------------------------------------------------------------
// Catalog + entry card
// ---------------------------------------------------------------------------

export function fetchJudicialServices(): Promise<{ items: JudicialServiceView[] }> {
  return apiClient.get<{ items: JudicialServiceView[] }>(`${J}/services`);
}

export function fetchJudicialCard(): Promise<{
  summary: JudicialServiceSummary;
  capabilities: JudicialCapabilities;
}> {
  return apiClient.get<{
    summary: JudicialServiceSummary;
    capabilities: JudicialCapabilities;
  }>(`${J}/card`);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export function fetchJudicialRequests(
  includeArchived = false
): Promise<JudicialListResponse<JudicialRequestSummary>> {
  return apiClient.get<JudicialListResponse<JudicialRequestSummary>>(
    `${J}/requests${includeArchived ? "?includeArchived=1" : ""}`
  );
}

export interface CreateJudicialRequestInput {
  serviceId: string;
  startMode: "ai_draft" | "ready_document";
  documentType?: string | null;
  narrative?: string;
  titleFa?: string;
  caseId?: string | null;
  narrativeFromCase?: boolean;
  idempotencyKey: string;
}

export function createJudicialRequest(
  input: CreateJudicialRequestInput
): Promise<{ request: JudicialRequestSummary; replayed: boolean }> {
  return apiClient.post<{ request: JudicialRequestSummary; replayed: boolean }>(
    `${J}/requests`,
    input
  );
}

export function fetchJudicialRequest(id: string): Promise<JudicialRequestDetail> {
  return apiClient.get<JudicialRequestDetail>(`${J}/requests/${encodeURIComponent(id)}`);
}

export interface UpdateJudicialRequestInput {
  narrative?: string;
  currentStep?: JudicialRequestStep;
  caseId?: string | null;
  titleFa?: string;
  documentType?: string | null;
}

export function updateJudicialRequest(
  id: string,
  input: UpdateJudicialRequestInput
): Promise<JudicialRequestDetail> {
  return apiClient.patch<JudicialRequestDetail>(
    `${J}/requests/${encodeURIComponent(id)}`,
    input
  );
}

export function deleteJudicialRequest(id: string): Promise<{ deleted: true }> {
  return apiClient.delete<{ deleted: true }>(`${J}/requests/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Answers / analysis
// ---------------------------------------------------------------------------

export interface SaveAnswersResult {
  answers: Record<string, string>;
  request: JudicialRequestDetail["request"];
  completeness: JudicialRequestDetail["completeness"];
}

export function saveJudicialAnswers(
  id: string,
  input: {
    /** The questionnaire step being saved — the route replaces only its rows. */
    stepId: string;
    answers: Record<string, string>;
    questionnaireVersion: number;
  }
): Promise<SaveAnswersResult> {
  return apiClient.post<SaveAnswersResult>(
    `${J}/requests/${encodeURIComponent(id)}/answers`,
    input
  );
}

export interface AnalyzeResult {
  analysis: JudicialRequestDetail["analysis"];
  completeness: JudicialRequestDetail["completeness"];
  detail: JudicialRequestDetail;
}

export function analyzeJudicialRequest(id: string): Promise<AnalyzeResult> {
  return apiClient.post<AnalyzeResult>(
    `${J}/requests/${encodeURIComponent(id)}/analysis`,
    {}
  );
}

// ---------------------------------------------------------------------------
// Documents / attachments
// ---------------------------------------------------------------------------

export interface JudicialAvailableDocument {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: string;
  updatedAt: string;
  alreadyLinked: boolean;
}

export interface JudicialDocumentPicker {
  linked: JudicialAttachment[];
  available: JudicialAvailableDocument[];
  roles: Record<JudicialAttachmentRole, string>;
  readyDocument: JudicialRequestDetail["request"]["readyDocument"];
}

export function fetchJudicialDocuments(id: string): Promise<JudicialDocumentPicker> {
  return apiClient.get<JudicialDocumentPicker>(
    `${J}/requests/${encodeURIComponent(id)}/documents`
  );
}

export function linkJudicialDocument(
  id: string,
  input: { documentId: string; role: JudicialAttachmentRole }
): Promise<{ attachment: JudicialAttachment; linked: JudicialAttachment[] }> {
  return apiClient.post<{ attachment: JudicialAttachment; linked: JudicialAttachment[] }>(
    `${J}/requests/${encodeURIComponent(id)}/documents`,
    input
  );
}

export function unlinkJudicialDocument(
  id: string,
  attachmentId: string
): Promise<{ items: JudicialAttachment[] }> {
  return apiClient.delete<{ items: JudicialAttachment[] }>(
    `${J}/requests/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}

export function setJudicialReadyDocument(
  id: string,
  documentId: string
): Promise<{ request: JudicialRequestDetail["request"] }> {
  return apiClient.post<{ request: JudicialRequestDetail["request"] }>(
    `${J}/requests/${encodeURIComponent(id)}/ready-document`,
    { documentId }
  );
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export interface GenerateJudicialDraftResult {
  draft: JudicialDraftVersion;
  replayed: boolean;
  completeness: JudicialRequestDetail["completeness"];
}

export function generateJudicialDraft(
  id: string,
  idempotencyKey: string
): Promise<GenerateJudicialDraftResult> {
  return apiClient.post<GenerateJudicialDraftResult>(
    `${J}/requests/${encodeURIComponent(id)}/draft`,
    { idempotencyKey }
  );
}

export function fetchJudicialDrafts(
  id: string
): Promise<{ items: JudicialDraftVersion[] }> {
  return apiClient.get<{ items: JudicialDraftVersion[] }>(
    `${J}/requests/${encodeURIComponent(id)}/drafts`
  );
}

export interface ReviseDraftResult {
  draft: JudicialDraftVersion;
  drafts: JudicialDraftVersion[];
}

export function reviseJudicialDraft(
  requestId: string,
  draftId: string,
  text: string
): Promise<ReviseDraftResult> {
  return apiClient.patch<ReviseDraftResult>(
    `${J}/requests/${encodeURIComponent(requestId)}/drafts/${encodeURIComponent(draftId)}`,
    { text }
  );
}

export interface ApproveDraftResult {
  draft: JudicialDraftVersion;
  drafts: JudicialDraftVersion[];
  request: JudicialRequestDetail["request"] | null;
}

export function approveJudicialDraft(
  requestId: string,
  draftId: string
): Promise<ApproveDraftResult> {
  return apiClient.post<ApproveDraftResult>(
    `${J}/requests/${encodeURIComponent(requestId)}/drafts/${encodeURIComponent(draftId)}/approve`,
    {}
  );
}

export function approveJudicialReadyDocument(
  requestId: string
): Promise<{ request: JudicialRequestDetail["request"] }> {
  return apiClient.post<{ request: JudicialRequestDetail["request"] }>(
    `${J}/requests/${encodeURIComponent(requestId)}/approve`,
    {}
  );
}

export function transitionJudicialRequest(
  id: string,
  to: string
): Promise<{ request: JudicialRequestDetail["request"] }> {
  return apiClient.post<{ request: JudicialRequestDetail["request"] }>(
    `${J}/requests/${encodeURIComponent(id)}/transition`,
    { to }
  );
}

// ---------------------------------------------------------------------------
// Review lane (owner side)
// ---------------------------------------------------------------------------

/**
 * The owner's reviews for one request. Each review already carries the
 * OWNER-VISIBLE event timeline — internal operator notes are filtered in the
 * persistence layer, never here.
 */
export function fetchJudicialReviews(
  id: string
): Promise<{ items: JudicialReviewDetail[]; total: number }> {
  return apiClient.get<{ items: JudicialReviewDetail[]; total: number }>(
    `${J}/requests/${encodeURIComponent(id)}/review`
  );
}

export interface SubmitReviewResult {
  review: JudicialReviewDetail;
  replayed: boolean;
}

export function submitJudicialReview(
  id: string,
  input: JudicialSubmitReviewInput
): Promise<SubmitReviewResult> {
  return apiClient.post<SubmitReviewResult>(
    `${J}/requests/${encodeURIComponent(id)}/review`,
    input
  );
}

export function fetchJudicialReview(
  requestId: string,
  reviewId: string
): Promise<{ review: JudicialReviewDetail }> {
  return apiClient.get<{ review: JudicialReviewDetail }>(
    `${J}/requests/${encodeURIComponent(requestId)}/review/${encodeURIComponent(reviewId)}`
  );
}

/** `reply` / `resubmit` / `cancel` — every one of them appends history. */
export function actOnJudicialReview(
  requestId: string,
  reviewId: string,
  input: { action: "reply" | "resubmit" | "cancel"; bodyFa?: string; versionId?: string }
): Promise<{ review: JudicialReviewDetail | null }> {
  return apiClient.patch<{ review: JudicialReviewDetail | null }>(
    `${J}/requests/${encodeURIComponent(requestId)}/review/${encodeURIComponent(reviewId)}`,
    input
  );
}

/** The owner's issued artifact (inline preview by default, `?download=1` forces save). */
export function judicialFinalDocumentUrl(requestId: string, download = false): string {
  return `${J}/requests/${encodeURIComponent(requestId)}/final-document${
    download ? "?download=1" : ""
  }`;
}

// ---------------------------------------------------------------------------
// Tracked orders (the two provider services)
// ---------------------------------------------------------------------------

export function fetchJudicialOrders(): Promise<{
  items: JudicialOrder[];
  total: number;
}> {
  return apiClient.get<{ items: JudicialOrder[]; total: number }>(`${J}/orders`);
}

export function fetchJudicialOrder(orderId: string): Promise<{ order: JudicialOrder }> {
  return apiClient.get<{ order: JudicialOrder }>(
    `${J}/orders/${encodeURIComponent(orderId)}`
  );
}

export interface CreateJudicialOrderInput {
  serviceId: string;
  titleFa: string;
  answers: JudicialOrderAnswer[];
  noteFa?: string | null;
  purposeFa?: string | null;
  attachmentIds?: string[];
  submit?: boolean;
  /** One key per logical attempt; a retried POST replays the same order. */
  idempotencyKey: string;
}

export function createJudicialOrder(
  input: CreateJudicialOrderInput
): Promise<{ order: JudicialOrder; replayed: boolean }> {
  return apiClient.post<{ order: JudicialOrder; replayed: boolean }>(
    `${J}/orders`,
    input
  );
}

export interface UpdateJudicialOrderInput {
  titleFa?: string;
  answers?: JudicialOrderAnswer[];
  noteFa?: string | null;
  purposeFa?: string | null;
  attachmentIds?: string[];
}

export function updateJudicialOrder(
  orderId: string,
  input: UpdateJudicialOrderInput
): Promise<{ order: JudicialOrder }> {
  return apiClient.patch<{ order: JudicialOrder }>(
    `${J}/orders/${encodeURIComponent(orderId)}`,
    input
  );
}

/**
 * Hand a draft to the operator. The server re-validates the intake fields and
 * re-checks that the service still accepts requests.
 */
export function submitJudicialOrder(orderId: string): Promise<{ order: JudicialOrder }> {
  return apiClient.post<{ order: JudicialOrder }>(
    `${J}/orders/${encodeURIComponent(orderId)}/submit`,
    {}
  );
}

/** A withdrawal, not a data deletion: the row stays `cancelled` with its history. */
export function cancelJudicialOrder(orderId: string): Promise<{ cancelled: true }> {
  return apiClient.delete<{ cancelled: true }>(
    `${J}/orders/${encodeURIComponent(orderId)}`
  );
}
