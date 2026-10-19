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
  actOnJudicialReview,
  analyzeJudicialRequest,
  approveJudicialDraft,
  approveJudicialReadyDocument,
  cancelJudicialOrder,
  createJudicialOrder,
  createJudicialRequest,
  deleteJudicialRequest,
  fetchJudicialCard,
  fetchJudicialDocuments,
  fetchJudicialDrafts,
  fetchJudicialOrder,
  fetchJudicialOrders,
  fetchJudicialRequest,
  fetchJudicialRequests,
  fetchJudicialReviews,
  fetchJudicialServices,
  generateJudicialDraft,
  linkJudicialDocument,
  reviseJudicialDraft,
  saveJudicialAnswers,
  setJudicialReadyDocument,
  submitJudicialOrder,
  submitJudicialReview,
  transitionJudicialRequest,
  unlinkJudicialDocument,
  updateJudicialOrder,
  updateJudicialRequest,
  type CreateJudicialOrderInput,
  type CreateJudicialRequestInput,
  type UpdateJudicialOrderInput,
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
  reviews: (id: string) => ["judicial", "requests", id, "reviews"] as const,
  orders: ["judicial", "orders"] as const,
  order: (id: string) => ["judicial", "orders", id] as const,
};

/** Invalidate everything that shows this request's state. */
function invalidateRequest(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: judicialKeys.list });
  void qc.invalidateQueries({ queryKey: judicialKeys.card });
  if (id) {
    void qc.invalidateQueries({ queryKey: judicialKeys.detail(id) });
    void qc.invalidateQueries({ queryKey: judicialKeys.drafts(id) });
    void qc.invalidateQueries({ queryKey: judicialKeys.documents(id) });
    void qc.invalidateQueries({ queryKey: judicialKeys.reviews(id) });
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

// ---------------------------------------------------------------------------
// Review lane (owner side)
// ---------------------------------------------------------------------------

export function useJudicialReviews(id: string | undefined) {
  return useQuery({
    queryKey: judicialKeys.reviews(id ?? ""),
    queryFn: () => fetchJudicialReviews(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Send ONE draft version for review. The caller mints one key per logical
 * attempt so a double click returns the same review (no duplicate queue row).
 */
export function useSubmitJudicialReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      draftId: string;
      note?: string;
      kind?: "legalir" | "lawyer";
      idempotencyKey: string;
    }) => submitJudicialReview(id, input),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

/** The owner's answer / new version / withdrawal on an OPEN review. */
export function useActOnJudicialReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      reviewId: string;
      action: "reply" | "resubmit" | "cancel";
      bodyFa?: string;
      versionId?: string;
    }) =>
      actOnJudicialReview(id, input.reviewId, {
        action: input.action,
        bodyFa: input.bodyFa,
        versionId: input.versionId,
      }),
    onSuccess: () => invalidateRequest(qc, id),
  });
}

// ---------------------------------------------------------------------------
// Tracked orders (the two provider services)
// ---------------------------------------------------------------------------

/** The caller's own tracked requests. The server scopes them by session. */
export function useJudicialOrders() {
  return useQuery({
    queryKey: judicialKeys.orders,
    queryFn: fetchJudicialOrders,
    staleTime: 15_000,
  });
}

export function useJudicialOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: judicialKeys.order(orderId ?? ""),
    queryFn: () => fetchJudicialOrder(orderId!),
    enabled: Boolean(orderId),
    staleTime: 15_000,
    retry: 1,
  });
}

/** One invalidation path for everything that shows an order's state. */
function invalidateOrders(qc: ReturnType<typeof useQueryClient>, orderId?: string) {
  void qc.invalidateQueries({ queryKey: judicialKeys.orders });
  if (orderId) void qc.invalidateQueries({ queryKey: judicialKeys.order(orderId) });
  // The cards count open work across both lanes.
  void qc.invalidateQueries({ queryKey: judicialKeys.card });
}

export function useCreateJudicialOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJudicialOrderInput) => createJudicialOrder(input),
    onSuccess: () => invalidateOrders(qc),
  });
}

export function useUpdateJudicialOrder(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJudicialOrderInput) =>
      updateJudicialOrder(orderId, input),
    onSuccess: () => invalidateOrders(qc, orderId),
  });
}

/** Hand a completed draft to an operator. Only `draft`/`waiting_user` move. */
export function useSubmitJudicialOrder(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitJudicialOrder(orderId),
    onSuccess: (result) => {
      // The response carries the row the server actually stored — write it
      // straight into the cache so the detail page flips without a refetch.
      qc.setQueryData(judicialKeys.order(orderId), result);
      invalidateOrders(qc, orderId);
    },
  });
}

export function useCancelJudicialOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelJudicialOrder(orderId),
    onSuccess: (_res, orderId) => invalidateOrders(qc, orderId),
  });
}
