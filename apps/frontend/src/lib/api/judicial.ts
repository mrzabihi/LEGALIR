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
  JudicialRequestDetail,
  JudicialRequestSummary,
  JudicialRequestStep,
  JudicialServiceSummary,
  JudicialServiceView,
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
