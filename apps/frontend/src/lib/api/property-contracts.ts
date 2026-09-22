// ============================================================
// LEGALIR — Property Contract Builder API client
// ============================================================
// Thin wrappers over the `/api/v1/property-contracts/**` lifecycle
// routes. Everything goes through the shared `apiClient`, so
// correlation ids, idempotency keys, cookie auth and error mapping
// are handled in one place.
// ============================================================

import { apiClient } from "./client";
import type {
  ContractCompleteness,
  ContractDocument,
  ContractDocumentCategory,
  ContractParty,
  ContractPayment,
  ContractVerificationInfo,
  PropertyContract,
  PropertyContractCreateRequest,
  PropertyContractDetail,
  PropertyContractListItem,
  PropertyContractListResponse,
  PropertyContractVersion,
  PropertyKind,
  ContractTypeId,
} from "@legalir/types";

/** A contract detail plus the server-computed completeness. */
export type PropertyContractDetailWithCompleteness = PropertyContractDetail & {
  completeness: ContractCompleteness;
};

export interface PropertyContractListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: ContractTypeId | "";
  state?: string;
}

// ------------------------------------------------------------
// Collection
// ------------------------------------------------------------

export function fetchPropertyContracts(
  params: PropertyContractListParams = {}
): Promise<PropertyContractListResponse> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.search) search.set("search", params.search);
  if (params.type) search.set("type", params.type);
  if (params.state) search.set("state", params.state);
  const qs = search.toString();
  return apiClient.get<PropertyContractListResponse>(
    `/api/v1/property-contracts${qs ? `?${qs}` : ""}`
  );
}

export function createPropertyContract(
  data: PropertyContractCreateRequest
): Promise<{
  id: string;
  referenceCode: string;
  type: ContractTypeId;
  state: PropertyContract["state"];
  currentStep: string;
  createdAt: string;
  progress: number;
}> {
  return apiClient.post("/api/v1/property-contracts", data);
}

// ------------------------------------------------------------
// Detail
// ------------------------------------------------------------

export function fetchPropertyContract(
  id: string
): Promise<PropertyContractDetailWithCompleteness> {
  return apiClient.get(`/api/v1/property-contracts/${id}`);
}

export function updatePropertyContract(
  id: string,
  patch: {
    title?: string;
    currentStep?: string;
    state?: PropertyContract["state"];
    data?: Record<string, unknown>;
  }
): Promise<PropertyContractDetailWithCompleteness> {
  return apiClient.patch(`/api/v1/property-contracts/${id}`, patch);
}

export function deletePropertyContract(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiClient.delete(`/api/v1/property-contracts/${id}`);
}

// ------------------------------------------------------------
// Parties
// ------------------------------------------------------------

export function fetchParties(id: string): Promise<ContractParty[]> {
  return apiClient.get(`/api/v1/property-contracts/${id}/parties`);
}

export function saveParty(
  id: string,
  party: {
    role: ContractParty["role"];
    capacity?: ContractParty["capacity"];
    identity?: Partial<ContractParty["identity"]>;
    ownershipShare?: ContractParty["ownershipShare"];
    powerOfAttorney?: ContractParty["powerOfAttorney"];
  }
): Promise<ContractParty> {
  return apiClient.put(`/api/v1/property-contracts/${id}/parties`, party);
}

// ------------------------------------------------------------
// Documents
// ------------------------------------------------------------

export function fetchContractDocuments(id: string): Promise<ContractDocument[]> {
  return apiClient.get(`/api/v1/property-contracts/${id}/documents`);
}

export async function uploadContractDocument(
  id: string,
  params: {
    file: File;
    category: ContractDocumentCategory;
    description?: string;
    photoCategory?: string;
  }
): Promise<ContractDocument> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("category", params.category);
  if (params.description) form.append("description", params.description);
  if (params.photoCategory) form.append("photoCategory", params.photoCategory);

  const response = await fetch(`/api/v1/property-contracts/${id}/documents`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "بارگذاری سند ناموفق بود");
  }
  const json = (await response.json()) as { data: ContractDocument };
  return json.data;
}

export function deleteContractDocument(
  id: string,
  documentId: string
): Promise<{ id: string; deleted: boolean }> {
  return apiClient.delete(`/api/v1/property-contracts/${id}/documents/${documentId}`);
}

/** The authorized URL used to preview or download a stored document. */
export function contractDocumentUrl(
  id: string,
  documentId: string,
  download = false
): string {
  return `/api/v1/property-contracts/${id}/documents/${documentId}${download ? "?download=1" : ""}`;
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export function fetchPayments(id: string): Promise<ContractPayment[]> {
  return apiClient.get(`/api/v1/property-contracts/${id}/payments`);
}

export function savePayments(
  id: string,
  payments: Partial<ContractPayment>[]
): Promise<ContractPayment[]> {
  return apiClient.put(`/api/v1/property-contracts/${id}/payments`, { payments });
}

// ------------------------------------------------------------
// Versions, review, sign, finalize
// ------------------------------------------------------------

export function fetchVersions(id: string): Promise<PropertyContractVersion[]> {
  return apiClient.get(`/api/v1/property-contracts/${id}/versions`);
}

export function createVersion(
  id: string
): Promise<{ version: PropertyContractVersion; invalidatedApprovals: number }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/versions`);
}

export function submitForReview(id: string): Promise<{
  contract: PropertyContract;
  version: PropertyContractVersion;
  invalidatedApprovals: number;
}> {
  return apiClient.post(`/api/v1/property-contracts/${id}/review`, { action: "submit" });
}

export function approveContract(
  id: string,
  params: { partyId?: string; comment?: string; method?: "otp" | "explicit_consent" }
): Promise<{ approval: unknown; contract: PropertyContract; allApproved: boolean }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/review`, {
    action: "approve",
    ...params,
  });
}

export function requestChanges(
  id: string,
  params: { partyId?: string; comment?: string }
): Promise<{ contract: PropertyContract }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/review`, {
    action: "request_changes",
    ...params,
  });
}

export function requestSignOtp(
  id: string,
  partyId?: string
): Promise<{ sent: boolean; mobileMasked: string; expiresAt: string }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "request_otp",
    partyId,
  });
}

export function verifySignOtp(
  id: string,
  params: { partyId?: string; code: string }
): Promise<{ signature: unknown; contract: PropertyContract; allSigned: boolean }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "verify_otp",
    ...params,
  });
}

export function finalizeContract(id: string): Promise<{
  id: string;
  state: PropertyContract["state"];
  finalVersionId: string;
  finalizedAt: string;
  documentHash: string;
  publicVerificationId: string;
  registration: { headlineFa: string; bodyFa: string; requiresNotaryVisit: boolean };
}> {
  return apiClient.post(`/api/v1/property-contracts/${id}/finalize`);
}

export function fetchFinalizeInfo(id: string): Promise<{
  state: PropertyContract["state"];
  finalizedAt: string | null;
  finalVersionId: string;
  versionNumber: number;
  documentHash: string;
  publicVerificationId: string;
  registration: { headlineFa: string; bodyFa: string; requiresNotaryVisit: boolean };
}> {
  return apiClient.get(`/api/v1/property-contracts/${id}/finalize`);
}

export function archiveContract(id: string): Promise<PropertyContract> {
  return apiClient.post(`/api/v1/property-contracts/${id}/archive`);
}

/** The authorized URL of the immutable PDF for a version. */
export function contractPdfUrl(id: string, versionId?: string): string {
  return `/api/v1/property-contracts/${id}/pdf${versionId ? `?version=${versionId}` : ""}`;
}

/** The authorized URL of the immutable Word (.docx) for a version. */
export function contractDocxUrl(id: string, versionId?: string): string {
  return `/api/v1/property-contracts/${id}/docx${versionId ? `?version=${versionId}` : ""}`;
}

// ------------------------------------------------------------
// Public verification
// ------------------------------------------------------------

export function fetchVerification(
  publicVerificationId: string
): Promise<ContractVerificationInfo> {
  return apiClient.get(`/api/v1/property-contracts/verify/${publicVerificationId}`);
}

/** Convenience: the default property kind for a new contract. */
export const DEFAULT_PROPERTY_KIND: PropertyKind = "apartment";

/** A list item narrowed to the fields the resume card needs. */
export type PropertyContractCard = PropertyContractListItem;
