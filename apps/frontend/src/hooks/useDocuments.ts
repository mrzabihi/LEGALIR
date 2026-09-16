// ============================================================
// LEGALIR — Document Upload & Analysis Hooks (Phase 9)
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDocuments,
  fetchDocumentDetail,
  initiateUpload,
  completeUpload,
  fetchDocumentStatus,
  fetchDocumentAnalysis,
  retryDocument,
  deleteDocument,
} from "@/lib/api/v1";
import type {
  V1DocumentListParams,
  V1DocumentUploadRequest,
} from "@legalir/types";

// --- Document List ---

export function useDocuments(params: V1DocumentListParams = {}) {
  return useQuery({
    queryKey: ["documents", "list", params],
    queryFn: () => fetchDocuments(params),
    staleTime: 30_000,
  });
}

// --- Document Detail ---

export function useDocumentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", "detail", id],
    queryFn: () => fetchDocumentDetail(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// --- Document Status Polling ---

export function useDocumentStatus(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", "status", id],
    queryFn: () => fetchDocumentStatus(id!),
    enabled: !!id,
    refetchInterval: 2000, // Poll every 2s while processing
    staleTime: 0,
  });
}

// --- Document Analysis ---

export function useDocumentAnalysis(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", "analysis", id],
    queryFn: () => fetchDocumentAnalysis(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// --- Initiate Upload ---

export function useInitiateUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: V1DocumentUploadRequest) => initiateUpload(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
      // Energy is deducted server-side on upload — refresh the balance badge
      // and the points-account aggregates.
      qc.invalidateQueries({ queryKey: ["rewards", "summary"] });
      qc.invalidateQueries({ queryKey: ["points", "account"] });
    },
  });
}

// --- Complete Upload ---

export function useCompleteUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeUpload(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
    },
  });
}

// --- Retry Document Processing ---

export function useRetryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryDocument(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["documents", "detail", id] });
      qc.invalidateQueries({ queryKey: ["documents", "status", id] });
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
    },
  });
}

// --- Delete Document ---

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
    },
  });
}
