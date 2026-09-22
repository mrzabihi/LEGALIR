// ============================================================
// LEGALIR — Contract lifecycle API client
// ============================================================
// Thin wrappers over the lifecycle routes. Everything goes through the
// shared `apiClient`, so correlation ids, cookie auth and error
// mapping are handled in one place.
//
// The lifecycle view is the single read the workspace needs; every
// action returns the updated slice so the caller can write it straight
// into the cache.
// ============================================================

import { apiClient } from "./client";
import type { ContractFeatureFlags } from "@/lib/contracts/feature-flags";
import type {
  AiContractReview,
  ContractLifecycleView,
  ContractReviewComment,
  LawyerReviewFinding,
  LawyerReviewRequestDetail,
  PartyRole,
  PropertyContract,
  PropertyContractVersion,
  SignatureInvitation,
  SignatureParticipant,
  SignatureRequestDetail,
} from "@legalir/types";

/** The lifecycle view plus the feature flags the UI renders from. */
export type ContractLifecyclePayload = ContractLifecycleView & {
  flags: ContractFeatureFlags;
};

// ------------------------------------------------------------
// Read
// ------------------------------------------------------------

export function fetchContractLifecycle(id: string): Promise<ContractLifecyclePayload> {
  return apiClient.get(`/api/v1/property-contracts/${id}/lifecycle`);
}

// ------------------------------------------------------------
// Signature
// ------------------------------------------------------------

export function createSignatureRequest(
  id: string,
  params: {
    partyId?: string;
    guests?: { roleFa: string; mobile: string }[];
    expiresInHours?: number;
  } = {}
): Promise<{ request: SignatureRequestDetail; version: PropertyContractVersion }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "create_request",
    ...params,
  });
}

export function requestSignatureOtp(
  id: string,
  params: { participantId?: string; partyId?: string }
): Promise<{
  sent: boolean;
  mobileMasked: string;
  expiresAt: string;
  remainingAttempts: number;
}> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "request_otp",
    ...params,
  });
}

export function verifySignatureOtp(
  id: string,
  params: {
    participantId?: string;
    partyId?: string;
    code: string;
    consentGiven: boolean;
    consentVersion: string;
    idempotencyKey?: string;
  }
): Promise<{
  participant: SignatureParticipant;
  request: SignatureRequestDetail;
  contract?: PropertyContract;
  allSigned: boolean;
  assuranceLevel: string;
}> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "verify_otp",
    ...params,
  });
}

export function declineSignature(
  id: string,
  params: { participantId?: string; partyId?: string; reason?: string }
): Promise<{ participant: SignatureParticipant; request: SignatureRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/sign`, {
    action: "decline",
    ...params,
  });
}

// ------------------------------------------------------------
// Invitations
// ------------------------------------------------------------

export function issueInvitations(
  id: string,
  params: { participantIds?: string[]; expiresInHours?: number; verifyBeforeView?: boolean } = {}
): Promise<{
  invitations: { participantId: string; token: string; expiresAt: string }[];
  expiresAt: string;
}> {
  return apiClient.post(`/api/v1/property-contracts/${id}/invitations`, params);
}

export function fetchInvitations(id: string): Promise<{ invitations: SignatureInvitation[] }> {
  return apiClient.get(`/api/v1/property-contracts/${id}/invitations`);
}

export function revokeInvitation(
  id: string,
  invitationId: string
): Promise<{ invitation: SignatureInvitation }> {
  return apiClient.delete(
    `/api/v1/property-contracts/${id}/invitations?invitationId=${encodeURIComponent(invitationId)}`
  );
}

// ------------------------------------------------------------
// Lawyer review
// ------------------------------------------------------------

export function createLawyerReview(
  id: string,
  params: {
    mode?: "BLOCKING" | "NON_BLOCKING";
    category?: string;
    slaHours?: number;
    note?: string;
  } = {}
): Promise<{ review: LawyerReviewRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/lawyer-review`, {
    action: "create",
    ...params,
  });
}

export function acceptLawyerReview(
  id: string,
  reviewId?: string
): Promise<{ review: LawyerReviewRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/lawyer-review`, {
    action: "accept",
    reviewId,
  });
}

export function completeLawyerReview(
  id: string,
  params: {
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
  }
): Promise<{ review: LawyerReviewRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/lawyer-review`, {
    action: "complete",
    ...params,
  });
}

export function decideLawyerFinding(
  id: string,
  params: { findingId: string; decision: "accepted" | "rejected"; reviewId?: string }
): Promise<{ finding: LawyerReviewFinding; review: LawyerReviewRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/lawyer-review`, {
    action: "decide_finding",
    ...params,
  });
}

export function cancelLawyerReview(
  id: string,
  reviewId?: string
): Promise<{ review: LawyerReviewRequestDetail }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/lawyer-review`, {
    action: "cancel",
    reviewId,
  });
}

// ------------------------------------------------------------
// AI review
// ------------------------------------------------------------

export function createAiReview(
  id: string,
  params: { perspectiveRole?: PartyRole; conversationId?: string; question?: string } = {}
): Promise<{ review: AiContractReview; conversationId: string }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/ai-review`, params);
}

export function fetchAiReview(id: string): Promise<{ review: AiContractReview | null }> {
  return apiClient.get(`/api/v1/property-contracts/${id}/ai-review`);
}

// ------------------------------------------------------------
// Review comments
// ------------------------------------------------------------

export function addReviewComment(
  id: string,
  params: {
    body: string;
    partyId?: string;
    clauseRef?: string | null;
    kind?: "comment" | "change_request" | "approval_note";
  }
): Promise<{ comment: ContractReviewComment }> {
  return apiClient.post(`/api/v1/property-contracts/${id}/review`, {
    action: "comment",
    ...params,
  });
}
