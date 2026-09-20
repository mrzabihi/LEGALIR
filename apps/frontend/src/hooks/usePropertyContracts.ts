// ============================================================
// LEGALIR — Property Contract Builder hooks
// ============================================================
// React Query bindings for the property-contract lifecycle. The
// wizard, the Contract Center, the preview and the review screens all
// read and write through these hooks so there is exactly one cache
// entry per contract — no parallel fetches, no duplicated state.
//
// Autosave writes the server's response straight back into the detail
// cache, so the wizard never has to refetch after a save.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ContractDocument,
  ContractDocumentCategory,
  ContractParty,
  ContractPayment,
  PropertyContract,
  PropertyContractCreateRequest,
  PropertyContractDetail,
  PropertyContractListItem,
  PropertyContractListResponse,
  PropertyContractVersion,
  PropertyContractState,
  PropertyRentData,
  PropertySaleData,
} from "@legalir/types";
import {
  approveContract,
  archiveContract,
  createPropertyContract,
  createVersion,
  deleteContractDocument,
  deletePropertyContract,
  fetchContractDocuments,
  fetchParties,
  fetchPayments,
  fetchPropertyContract,
  fetchPropertyContracts,
  fetchVersions,
  finalizeContract,
  requestChanges,
  requestSignOtp,
  saveParty,
  savePayments,
  submitForReview,
  updatePropertyContract,
  uploadContractDocument,
  verifySignOtp,
  type PropertyContractDetailWithCompleteness,
  type PropertyContractListParams,
} from "@/lib/api/property-contracts";

// ------------------------------------------------------------
// Query keys
// ------------------------------------------------------------

export const propertyContractKeys = {
  all: ["property-contracts"] as const,
  lists: () => [...propertyContractKeys.all, "list"] as const,
  list: (params: PropertyContractListParams) =>
    [...propertyContractKeys.lists(), params] as const,
  details: () => [...propertyContractKeys.all, "detail"] as const,
  detail: (id: string) => [...propertyContractKeys.details(), id] as const,
  parties: (id: string) => [...propertyContractKeys.detail(id), "parties"] as const,
  documents: (id: string) => [...propertyContractKeys.detail(id), "documents"] as const,
  payments: (id: string) => [...propertyContractKeys.detail(id), "payments"] as const,
  versions: (id: string) => [...propertyContractKeys.detail(id), "versions"] as const,
};

// ------------------------------------------------------------
// Queries
// ------------------------------------------------------------

export function usePropertyContracts(params: PropertyContractListParams = {}) {
  return useQuery({
    queryKey: propertyContractKeys.list(params),
    queryFn: () => fetchPropertyContracts(params),
    staleTime: 15_000,
  });
}

export function usePropertyContract(id: string | undefined) {
  return useQuery({
    queryKey: propertyContractKeys.detail(id ?? ""),
    queryFn: () => fetchPropertyContract(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useContractParties(id: string | undefined) {
  return useQuery({
    queryKey: propertyContractKeys.parties(id ?? ""),
    queryFn: () => fetchParties(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useContractDocuments(id: string | undefined) {
  return useQuery({
    queryKey: propertyContractKeys.documents(id ?? ""),
    queryFn: () => fetchContractDocuments(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useContractPayments(id: string | undefined) {
  return useQuery({
    queryKey: propertyContractKeys.payments(id ?? ""),
    queryFn: () => fetchPayments(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useContractVersions(id: string | undefined) {
  return useQuery({
    queryKey: propertyContractKeys.versions(id ?? ""),
    queryFn: () => fetchVersions(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ------------------------------------------------------------
// Cache helpers
// ------------------------------------------------------------

/** Write a fresh detail payload into the cache without a refetch. */
function writeDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  detail: PropertyContractDetailWithCompleteness
): void {
  queryClient.setQueryData(propertyContractKeys.detail(detail.id), detail);
}

/** Invalidate the list plus one contract's detail and sub-collections. */
function invalidateContract(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string
): void {
  queryClient.invalidateQueries({ queryKey: propertyContractKeys.lists() });
  queryClient.invalidateQueries({ queryKey: propertyContractKeys.detail(id) });
}

// ------------------------------------------------------------
// Create / delete
// ------------------------------------------------------------

export function useCreatePropertyContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PropertyContractCreateRequest) => createPropertyContract(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyContractKeys.lists() });
    },
  });
}

export function useDeletePropertyContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePropertyContract(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: propertyContractKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: propertyContractKeys.lists() });
      // The contract is mirrored into the activity history, so refresh it.
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

// ------------------------------------------------------------
// Autosave
// ------------------------------------------------------------

export interface AutosaveVariables {
  id: string;
  patch: {
    title?: string;
    currentStep?: string;
    state?: PropertyContractState;
    data?: Partial<PropertyRentData> | Partial<PropertySaleData>;
  };
}

/**
 * Persist a wizard patch. The server returns the recomputed detail
 * (including completeness), which is written straight back into the
 * cache so progress updates in the same frame as the save.
 */
export function useAutosaveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: AutosaveVariables) => updatePropertyContract(id, patch),
    onSuccess: (detail) => {
      writeDetail(queryClient, detail);
    },
  });
}

// ------------------------------------------------------------
// Parties
// ------------------------------------------------------------

export function useSaveParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      party,
    }: {
      id: string;
      party: Parameters<typeof saveParty>[1];
    }) => saveParty(id, party),
    onSuccess: (_party, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

// ------------------------------------------------------------
// Documents
// ------------------------------------------------------------

export function useUploadContractDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      category,
      description,
      photoCategory,
    }: {
      id: string;
      file: File;
      category: ContractDocumentCategory;
      description?: string;
      photoCategory?: string;
    }) => uploadContractDocument(id, { file, category, description, photoCategory }),
    onSuccess: (_doc, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

export function useDeleteContractDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) =>
      deleteContractDocument(id, documentId),
    onSuccess: (_res, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export function useSavePayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payments }: { id: string; payments: Partial<ContractPayment>[] }) =>
      savePayments(id, payments),
    onSuccess: (_payments, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

// ------------------------------------------------------------
// Versions
// ------------------------------------------------------------

export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => createVersion(id),
    onSuccess: (_res, id) => {
      invalidateContract(queryClient, id);
    },
  });
}

// ------------------------------------------------------------
// Review / approval
// ------------------------------------------------------------

export function useSubmitForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submitForReview(id),
    onSuccess: (_res, id) => {
      invalidateContract(queryClient, id);
    },
  });
}

export function useApproveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      partyId?: string;
      comment?: string;
      method?: "otp" | "explicit_consent";
    }) => approveContract(id, params),
    onSuccess: (_res, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

export function useRequestChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...params }: { id: string; partyId?: string; comment?: string }) =>
      requestChanges(id, params),
    onSuccess: (_res, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

// ------------------------------------------------------------
// Signature
// ------------------------------------------------------------

export function useRequestSignOtp() {
  return useMutation({
    mutationFn: ({ id, partyId }: { id: string; partyId?: string }) =>
      requestSignOtp(id, partyId),
  });
}

export function useVerifySignOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, partyId, code }: { id: string; partyId?: string; code: string }) =>
      verifySignOtp(id, { partyId, code }),
    onSuccess: (_res, variables) => {
      invalidateContract(queryClient, variables.id);
    },
  });
}

// ------------------------------------------------------------
// Finalize / archive
// ------------------------------------------------------------

export function useFinalizeContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => finalizeContract(id),
    onSuccess: (_res, id) => {
      invalidateContract(queryClient, id);
    },
  });
}

export function useArchiveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveContract(id),
    onSuccess: (_res, id) => {
      invalidateContract(queryClient, id);
    },
  });
}

// ------------------------------------------------------------
// Derived helpers
// ------------------------------------------------------------

/** The party row for a role, or undefined. */
export function partyForRole(
  parties: ContractParty[] | undefined,
  role: ContractParty["role"]
): ContractParty | undefined {
  return parties?.find((p) => p.role === role);
}

/** The first uploaded document in a category, or undefined. */
export function documentForCategory(
  documents: ContractDocument[] | undefined,
  category: ContractDocumentCategory
): ContractDocument | undefined {
  return documents?.find((d) => d.category === category);
}

/** A sensible default title for a new contract. */
export function defaultTitleFor(
  typeFa: string,
  locationFa: string | undefined
): string {
  return locationFa ? `${typeFa} — ${locationFa}` : typeFa;
}

export type {
  PropertyContract,
  PropertyContractDetail,
  PropertyContractListItem,
  PropertyContractListResponse,
  PropertyContractVersion,
};
