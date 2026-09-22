// ============================================================
// LEGALIR — Contract lifecycle hooks
// ============================================================
// React Query bindings for the lifecycle engine. The workspace reads
// the whole lifecycle view from ONE query and every action invalidates
// that same key, so the stepper, the signature panel and the review
// panels can never disagree with each other.
//
// The lifecycle key is nested under the contract detail key, so
// invalidating a contract's detail also refreshes its lifecycle.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LawyerReviewFinding, PartyRole } from "@legalir/types";
import {
  acceptLawyerReview,
  addReviewComment,
  cancelLawyerReview,
  completeLawyerReview,
  createAiReview,
  createLawyerReview,
  createSignatureRequest,
  decideLawyerFinding,
  declineSignature,
  fetchContractLifecycle,
  issueInvitations,
  requestSignatureOtp,
  revokeInvitation,
  verifySignatureOtp,
} from "@/lib/api/contract-lifecycle";
import { propertyContractKeys } from "./usePropertyContracts";

// ------------------------------------------------------------
// Query keys
// ------------------------------------------------------------

export const contractLifecycleKeys = {
  lifecycle: (id: string) => [...propertyContractKeys.detail(id), "lifecycle"] as const,
};

// ------------------------------------------------------------
// Query
// ------------------------------------------------------------

export function useContractLifecycle(id: string | undefined) {
  return useQuery({
    queryKey: contractLifecycleKeys.lifecycle(id ?? ""),
    queryFn: () => fetchContractLifecycle(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ------------------------------------------------------------
// Cache helpers
// ------------------------------------------------------------

type QueryClient = ReturnType<typeof useQueryClient>;

/** Invalidate the lifecycle view plus the contract detail it derives from. */
function invalidateLifecycle(queryClient: QueryClient, id: string): void {
  queryClient.invalidateQueries({ queryKey: contractLifecycleKeys.lifecycle(id) });
  queryClient.invalidateQueries({ queryKey: propertyContractKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: propertyContractKeys.lists() });
}

// ------------------------------------------------------------
// Signature
// ------------------------------------------------------------

export function useCreateSignatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      partyId?: string;
      guests?: { roleFa: string; mobile: string }[];
      expiresInHours?: number;
    }) => createSignatureRequest(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useRequestSignatureOtp() {
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      participantId?: string;
      partyId?: string;
    }) => requestSignatureOtp(id, params),
  });
}

export function useVerifySignatureOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      participantId?: string;
      partyId?: string;
      code: string;
      consentGiven: boolean;
      consentVersion: string;
      idempotencyKey?: string;
    }) => verifySignatureOtp(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useDeclineSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      participantId?: string;
      partyId?: string;
      reason?: string;
    }) => declineSignature(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

// ------------------------------------------------------------
// Invitations
// ------------------------------------------------------------

export function useIssueInvitations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      participantIds?: string[];
      expiresInHours?: number;
      verifyBeforeView?: boolean;
    }) => issueInvitations(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, invitationId }: { id: string; invitationId: string }) =>
      revokeInvitation(id, invitationId),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

// ------------------------------------------------------------
// Lawyer review
// ------------------------------------------------------------

export function useCreateLawyerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      mode?: "BLOCKING" | "NON_BLOCKING";
      category?: string;
      slaHours?: number;
      note?: string;
    }) => createLawyerReview(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useAcceptLawyerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewId }: { id: string; reviewId?: string }) =>
      acceptLawyerReview(id, reviewId),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useCompleteLawyerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      reviewId?: string;
      summaryFa?: string;
      findings?: {
        kind: LawyerReviewFinding["kind"];
        severity: LawyerReviewFinding["severity"];
        titleFa: string;
        bodyFa: string;
        clauseRef?: string | null;
        proposedText?: string | null;
      }[];
    }) => completeLawyerReview(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useDecideLawyerFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      findingId: string;
      decision: "accepted" | "rejected";
      reviewId?: string;
    }) => decideLawyerFinding(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

export function useCancelLawyerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewId }: { id: string; reviewId?: string }) =>
      cancelLawyerReview(id, reviewId),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

// ------------------------------------------------------------
// AI review
// ------------------------------------------------------------

export function useCreateAiReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      perspectiveRole?: PartyRole;
      conversationId?: string;
      question?: string;
    }) => createAiReview(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}

// ------------------------------------------------------------
// Review comments
// ------------------------------------------------------------

export function useAddReviewComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      body: string;
      partyId?: string;
      clauseRef?: string | null;
      kind?: "comment" | "change_request" | "approval_note";
    }) => addReviewComment(id, params),
    onSuccess: (_res, variables) => invalidateLifecycle(queryClient, variables.id),
  });
}
