// ============================================================
// LEGALIR — Judicial drafting hooks
// ============================================================
// Query/mutation wrappers for the `/judicial` wizard. They carry NO
// authorization or availability logic — the server re-checks both on every
// call, and the UI renders only what the server reports.
//
// Cache keys are the single source of truth for this feature: every surface
// (the /cases card, the launcher, the wizard) reads them, so one save updates
// all three without a parallel fetch.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeJudicialRequest,
  approveJudicialDraft,
  approveJudicialReadyDocument,
  createJudicialRequest,
  deleteJudicialRequest,
  fetchJudicialCard,
  fetchJudicialDocuments,
  fetchJudicialDrafts,
  fetchJudicialRequest,
  fetchJudicialRequests,
  fetchJudicialServices,
  generateJudicialDraft,
  linkJudicialDocument,
  reviseJudicialDraft,
  saveJudicialAnswers,
  setJudicialReadyDocument,
  transitionJudicialRequest,
  unlinkJudicialDocument,
  updateJudicialRequest,
  type CreateJudicialRequestInput,
  type UpdateJudicialRequestInput,
} from "@/lib/api/judicial";
import type { JudicialAttachmentRole } from "@legalir/types";

export const judicialKeys = {
  card: ["judicial", "card"] as const,
  services: ["judicial", "services"] as const,
  list: ["judicial", "requests"] as const,
  detail: (id: string) => ["judicial", "requests", id] as const,
  documents: (id: string) => ["judicial", "requests", id, "documents"] as const,
  drafts: (id: string) => ["judicial", "requests", id, "drafts"] as const,
};

/** Invalidate everything that shows this request's state. */
function invalidateRequest(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: judicialKeys.list });
  void qc.invalidateQueries({ queryKey: judicialKeys.card });
  if (id) {
    void qc.invalidateQueries({ queryKey: judicialKeys.detail(id) });
    void qc.invalidateQueries({ queryKey: judicialKeys.drafts(id) });
    void qc.invalidateQueries({ queryKey: judicialKeys.documents(id) });
  }
}

// ---------------------------------------------------------------------------
// Catalog + /cases card
// ---------------------------------------------------------------------------

export function useJudicialServices() {
  return useQuery({
    queryKey: judicialKeys.services,
    queryFn: fetchJudicialServices,
    staleTime: 60_000,
  });
}

export function useJudicialCard() {
  return useQuery({
    queryKey: judicialKeys.card,
    queryFn: fetchJudicialCard,
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export function useJudicialRequests(includeArchived = false) {
  return useQuery({
    queryKey: [...judicialKeys.list, includeArchived],
    queryFn: () => fetchJudicialRequests(includeArchived),
    staleTime: 15_000,
  });
}

export function useJudicialRequest(id: string | undefined) {
  return useQuery({
    queryKey: judicialKeys.detail(id ?? ""),
    queryFn: () => fetchJudicialRequest(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Start a request. The caller mints ONE idempotency key per logical attempt
 * and reuses it across retries, so a double-click returns the original row.
 */
export function useCreateJudicialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJudicialRequestInput) => createJudicialRequest(input),
    onSuccess: () => invalidateRequest(qc),
  });
}

export function useUpdateJudicialRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJudicialRequestInput) => updateJudicialRequest(id, input),
    onSuccess: (detail) => {
      qc.setQueryData(judicialKeys.detail(id), detail);
      void qc.invalidateQueries({ queryKey: judicialKeys.list });
      void qc.invalidateQueries({ queryKey: judicialKeys.card });
    },
  });
}

export function useDeleteJudicialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJudicialRequest(id),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: judicialKeys.detail(id) });
      invalidateRequest(qc);
    },
  });
}

// ---------------------------------------------------------------------------
// Answers / analysis
// ---------------------------------------------------------------------------

export function useSaveJudicialAnswers(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      stepId: string;
      answers: Record<string, string>;
      questionnaireVersion: number;
    }) => saveJudicialAnswers(id, input),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useAnalyzeJudicialRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => analyzeJudicialRequest(id),
    onSuccess: (result) => {
      qc.setQueryData(judicialKeys.detail(id), result.detail);
      void qc.invalidateQueries({ queryKey: judicialKeys.card });
      void qc.invalidateQueries({ queryKey: judicialKeys.list });
    },
  });
}

// ---------------------------------------------------------------------------
// Documents / attachments
// ---------------------------------------------------------------------------

export function useJudicialDocuments(id: string | undefined) {
  return useQuery({
    queryKey: judicialKeys.documents(id ?? ""),
    queryFn: () => fetchJudicialDocuments(id!),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useLinkJudicialDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentId: string; role: JudicialAttachmentRole }) =>
      linkJudicialDocument(id, input),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useUnlinkJudicialDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => unlinkJudicialDocument(id, attachmentId),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useSetJudicialReadyDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => setJudicialReadyDocument(id, documentId),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export function useJudicialDrafts(id: string | undefined) {
  return useQuery({
    queryKey: judicialKeys.drafts(id ?? ""),
    queryFn: () => fetchJudicialDrafts(id!),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useGenerateJudicialDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idempotencyKey: string) => generateJudicialDraft(id, idempotencyKey),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useReviseJudicialDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, text }: { draftId: string; text: string }) =>
      reviseJudicialDraft(id, draftId, text),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useApproveJudicialDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => approveJudicialDraft(id, draftId),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

/**
 * Final confirmation on the READY-DOCUMENT path — the user brought a finished
 * document, so there is no AI draft to approve. The server refuses unless that
 * document is actually attached.
 */
export function useApproveJudicialReadyDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => approveJudicialReadyDocument(id),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export function useTransitionJudicialRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: string) => transitionJudicialRequest(id, to),
    onSuccess: () => invalidateRequest(qc, id),
  });
}
