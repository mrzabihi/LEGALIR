// ============================================================
// LEGALIR — Contract Workspace Hooks (Phase 10)
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchContractTypes,
  fetchContractQuestions,
  fetchContracts,
  createContract,
  fetchContract,
  updateContract,
  generateContract,
  fetchContractVersions,
  fetchContractAnalysis,
  archiveContract,
  createContractDraft,
  fetchContractDraft,
  saveContractDraft,
  deleteContractDraft,
} from "@/lib/api/v1";
import type {
  V1ContractType,
  V1ContractListParams,
  V1ContractCreateRequest,
  V1ContractUpdateRequest,
} from "@legalir/types";

// --- Contract Types ---

export function useContractTypes() {
  return useQuery({
    queryKey: ["contract-types"],
    queryFn: fetchContractTypes,
    staleTime: 300_000, // 5 minutes
  });
}

// --- Contract Questions ---

export function useContractQuestions(typeId: V1ContractType | undefined) {
  return useQuery({
    queryKey: ["contract-questions", typeId],
    queryFn: () => fetchContractQuestions(typeId!),
    enabled: !!typeId,
    staleTime: 300_000,
  });
}

// --- Contract List ---

export function useContracts(params: V1ContractListParams = {}) {
  return useQuery({
    queryKey: ["contracts", "list", params],
    queryFn: () => fetchContracts(params),
    staleTime: 30_000,
  });
}

// --- Contract Detail ---

export function useContractDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", "detail", id],
    queryFn: () => fetchContract(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// --- Contract Versions ---

export function useContractVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", "versions", id],
    queryFn: () => fetchContractVersions(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// --- Contract Analysis ---

export function useContractAnalysis(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", "analysis", id],
    queryFn: () => fetchContractAnalysis(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// --- Create Contract ---

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: V1ContractCreateRequest) => createContract(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", "list"] });
    },
  });
}

// --- Update Contract ---

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & V1ContractUpdateRequest) =>
      updateContract(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["contracts", "list"] });
    },
  });
}

// --- Generate Contract ---

export function useGenerateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => generateContract(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts", "versions", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts", "list"] });
    },
  });
}

// --- Archive Contract ---

export function useArchiveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", "list"] });
    },
  });
}

// --- Draft Hooks ---

export function useContractDraft(typeId: V1ContractType | undefined) {
  return useQuery({
    queryKey: ["contract-draft", typeId],
    queryFn: () => fetchContractDraft(typeId!),
    enabled: !!typeId,
    staleTime: 0, // Always fresh for auto-save
  });
}

export function useCreateContractDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (typeId: V1ContractType) => createContractDraft(typeId),
    onSuccess: (_data, typeId) => {
      queryClient.invalidateQueries({ queryKey: ["contract-draft", typeId] });
    },
  });
}

export function useSaveContractDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      typeId,
      currentStep,
      answers,
    }: {
      typeId: V1ContractType;
      currentStep: number;
      answers: Record<string, string>;
    }) => saveContractDraft(typeId, currentStep, answers),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract-draft", variables.typeId] });
    },
  });
}

export function useDeleteContractDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (typeId: V1ContractType) => deleteContractDraft(typeId),
    onSuccess: (_data, typeId) => {
      queryClient.invalidateQueries({ queryKey: ["contract-draft", typeId] });
    },
  });
}
