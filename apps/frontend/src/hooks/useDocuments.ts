// ============================================================
// LEGALIR — Document Upload & Analysis Hooks (Phase 9)
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDocuments,
  fetchDocumentDetail,
  fetchDocumentPreview,
  fetchRecentDocuments,
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

// --- Recent Documents (chat attach picker) ---

export function useRecentDocuments(limit = 12) {
  return useQuery({
    queryKey: ["documents", "recent", limit],
    queryFn: () => fetchRecentDocuments(limit),
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

// --- Document Preview ---

export function useDocumentPreview(id: string | undefined) {
  return useQuery({
    queryKey: ["documents", "preview", id],
    queryFn: () => fetchDocumentPreview(id!),
    enabled: !!id,
    staleTime: 60_000,
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
    mutationFn: ({ id, file }: { id: string; file: File }) => completeUpload(id, file),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
      // The bytes now exist, so the preview descriptor flips from
      // "unavailable" to a real file URL.
      qc.invalidateQueries({ queryKey: ["documents", "preview", id] });
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
    onSuccess: (_data, id) => {
      // Drop the deleted document's own cache entries so nothing can
      // re-render stale data, then refresh the list and the activity
      // history (the row is mirrored there too).
      qc.removeQueries({ queryKey: ["documents", "detail", id] });
      qc.removeQueries({ queryKey: ["documents", "status", id] });
      qc.removeQueries({ queryKey: ["documents", "analysis", id] });
      qc.removeQueries({ queryKey: ["documents", "preview", id] });
      qc.invalidateQueries({ queryKey: ["documents", "list"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
