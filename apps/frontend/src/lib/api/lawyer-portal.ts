// ============================================================
// LEGALIR — Lawyer portal API client
// ============================================================
// Thin typed wrappers over `/api/v1/lawyer/**`. Every call is authorized by
// the session cookie and re-checked server-side; nothing here decides access.
// ============================================================

import type {
  CaseDetailResponseV2,
  CaseTaskStatusV2,
  LawyerBankRecord,
  LawyerCaseFilters,
  LawyerCaseListResponse,
  LawyerDashboard,
  LawyerProfile,
  LawyerProfileCompleteness,
  LawyerRateChange,
  LawyerRateUnit,
  LawyerReferralDetail,
  LawyerReferralFilters,
  LawyerReferralListResponse,
  LawyerServiceRate,
  ServiceSlaPolicy,
} from "@legalir/types";
import { apiClient } from "./client";

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function fetchLawyerDashboard(): Promise<LawyerDashboard> {
  return apiClient.get<LawyerDashboard>("/api/v1/lawyer/dashboard");
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

/** Serialize the filter bag, dropping empty values so URLs stay stable. */
function referralQuery(filters: LawyerReferralFilters): string {
  const params = new URLSearchParams();
  const entries: [string, unknown][] = [
    ["serviceKey", filters.serviceKey],
    ["state", filters.state],
    ["perspective", filters.perspective],
    ["slaHealth", filters.slaHealth],
    ["priority", filters.priority],
    // These names must match what the route reads — a mismatched key silently
    // drops the filter server-side.
    ["fromIso", filters.fromIso],
    ["toIso", filters.toIso],
    ["search", filters.search],
    ["bucket", filters.bucket],
    ["page", filters.page],
    ["pageSize", filters.pageSize],
    ["sort", filters.sort],
  ];
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchLawyerReferrals(
  filters: LawyerReferralFilters = {}
): Promise<LawyerReferralListResponse> {
  return apiClient.get<LawyerReferralListResponse>(
    `/api/v1/lawyer/referrals${referralQuery(filters)}`
  );
}

export function fetchLawyerReferral(id: string): Promise<LawyerReferralDetail> {
  return apiClient.get<LawyerReferralDetail>(`/api/v1/lawyer/referrals/${id}`);
}

export type LawyerReferralActionPayload =
  | { action: "ACCEPT" }
  | { action: "DECLINE"; reason: string }
  | { action: "START"; note?: string }
  | { action: "REQUEST_INFO"; note: string }
  | { action: "COMPLETE"; summary: string; documentIds?: string[] }
  | { action: "SEND_MESSAGE"; body: string }
  | { action: "ADD_NOTE"; note: string; internal?: boolean }
  | { action: "RESUME_CLOCK"; reason?: string };

export function runLawyerReferralAction(
  id: string,
  payload: LawyerReferralActionPayload
): Promise<{ requestId: string; state: string; actionId: string | null }> {
  return apiClient.post(`/api/v1/lawyer/referrals/${id}/actions`, payload);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface LawyerProfileResponse {
  profile: LawyerProfile;
  completeness: LawyerProfileCompleteness;
}

export function fetchLawyerProfile(): Promise<LawyerProfileResponse> {
  return apiClient.get<LawyerProfileResponse>("/api/v1/lawyer/profile");
}

export interface LawyerProfilePatch {
  fullName?: string;
  bio?: string;
  professionalTitle?: string | null;
  licenseNumber?: string | null;
  licenseAuthority?: string | null;
  licenseYear?: number | null;
  specializations?: { category: string; yearsExperience: number }[];
  locations?: { province: string; city: string; remote: boolean }[];
  acceptingRequests?: boolean;
  acceptingClients?: boolean;
  avatarUrl?: string | null;
}

export function updateLawyerProfile(patch: LawyerProfilePatch): Promise<LawyerProfileResponse> {
  return apiClient.patch<LawyerProfileResponse>("/api/v1/lawyer/profile", patch);
}

/**
 * The lawyer's own portrait. The server resolves the profile from the session,
 * so this can only ever edit the caller's own row.
 */
export type LawyerAvatarPatch =
  | { avatarData: string; avatarFileName?: string; avatarFormat: string }
  | { regenerate: true }
  | { avatarUrl: string | null; avatarType?: "demo" | "real" };

export function updateLawyerAvatar(
  input: LawyerAvatarPatch
): Promise<{ id: string; avatarUrl: string | null; avatarType: "demo" | "real" }> {
  return apiClient.patch("/api/v1/lawyer/avatar", input);
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export interface LawyerServiceRow {
  id: string;
  nameFa: string;
  descriptionFa: string;
  onlineCapable: boolean;
  rate: LawyerServiceRate | null;
  sla: Pick<
    ServiceSlaPolicy,
    "responseHours" | "completionHours" | "clock" | "pauseBehavior" | "warnBeforeHours" | "audience"
  > & {
    /** True only for an `active` policy — an inactive/archived one is not in force. */
    active: boolean;
  };
}

export function fetchLawyerServices(): Promise<{ services: LawyerServiceRow[] }> {
  return apiClient.get<{ services: LawyerServiceRow[] }>("/api/v1/lawyer/services");
}

export function fetchLawyerRates(): Promise<{
  rates: LawyerServiceRate[];
  changes: LawyerRateChange[];
}> {
  return apiClient.get("/api/v1/lawyer/rates");
}

export function setLawyerRate(input: {
  serviceKey: string;
  amountToman: number;
  unit: LawyerRateUnit;
  noteFa?: string | null;
}): Promise<{ rate: LawyerServiceRate }> {
  return apiClient.put("/api/v1/lawyer/rates", input);
}

export function clearLawyerRate(serviceKey: string): Promise<unknown> {
  return apiClient.delete(
    `/api/v1/lawyer/rates?serviceKey=${encodeURIComponent(serviceKey)}`
  );
}

// ---------------------------------------------------------------------------
// Settlement account
// ---------------------------------------------------------------------------

export interface LawyerBankResponse extends LawyerBankRecord {
  events: {
    id: string;
    action: "SUBMITTED" | "VERIFIED" | "CORRECTION_REQUESTED" | "ADMIN_UPDATED";
    reason: string | null;
    destinationMasked: string | null;
    createdAt: string;
  }[];
}

export function fetchLawyerBank(): Promise<LawyerBankResponse> {
  return apiClient.get<LawyerBankResponse>("/api/v1/lawyer/bank");
}

export function submitLawyerBank(input: {
  holderName: string;
  bankName: string;
  iban: string;
  accountNumber?: string | null;
  cardLast4?: string | null;
  /** The full 16-digit card; the server keeps only BIN + last four. */
  cardNumber?: string | null;
}): Promise<LawyerBankRecord> {
  return apiClient.put<LawyerBankRecord>("/api/v1/lawyer/bank", input);
}

// ---------------------------------------------------------------------------
// Caseload
// ---------------------------------------------------------------------------

/** Mirrors the route's query names — a mismatch drops the filter silently. */
function caseQuery(filters: LawyerCaseFilters): string {
  const params = new URLSearchParams();
  if (filters.lifecycle) params.set("lifecycle", filters.lifecycle);
  if (filters.search) params.set("search", filters.search);
  if (filters.overdueOnly) params.set("overdueOnly", "1");
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sort) params.set("sort", filters.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchLawyerCases(
  filters: LawyerCaseFilters = {}
): Promise<LawyerCaseListResponse> {
  return apiClient.get<LawyerCaseListResponse>(`/api/v1/lawyer/cases${caseQuery(filters)}`);
}

/**
 * The case itself. This is the SAME `/api/v1/cases/[id]` endpoint the client
 * portal uses — authorization runs through `resolveCaseAccess`, so a lawyer
 * sees it only because accepting the referral granted them a membership.
 */
export function fetchLawyerCase(id: string): Promise<CaseDetailResponseV2> {
  return apiClient.get<CaseDetailResponseV2>(`/api/v1/cases/${id}`);
}

export type LawyerTaskStatus = CaseTaskStatusV2;

/** Move one task on a case the lawyer can write to. */
export function updateLawyerCaseTask(
  caseId: string,
  taskId: string,
  status: LawyerTaskStatus
): Promise<unknown> {
  return apiClient.patch(`/api/v1/cases/${caseId}/tasks/${taskId}`, { status });
}
