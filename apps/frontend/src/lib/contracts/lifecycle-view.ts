// ============================================================
// LEGALIR — Lifecycle aggregate assembly
// ============================================================
// One function that turns a contract row plus its completeness into
// the `ContractLifecycleView` the workspace renders. It is the single
// place the "can I do X right now?" questions are answered, so the UI
// never re-derives them and can never disagree with the server.
//
// The view is DERIVED, never stored: every field is read from the real
// state of the contract, its version, its signature request and its
// reviews.
// ============================================================

import type {
  ContractCompleteness,
  ContractLifecycleView,
  PropertyContract,
} from "@legalir/types";
import { latestSignatureRequest, latestSignatureRequestDetail, listInvitations } from "./signature/db";
import { activeLawyerReviewDetail, latestAiReview, listReviewComments } from "./review-db";
import { currentVersionApproval, latestAdminReview } from "./admin-review";
import { currentVersionStamp } from "./stamp-review";
import { getVersion } from "./db";
import {
  buildLifecycleSteps,
  deriveLifecycleStage,
  deriveRegistrationStatus,
  isAtSignatureStage,
  registrationStatusFa,
} from "./lifecycle";
import { canTransition, isEditable, isSignable } from "./state-machine";
import { evaluateRegistrationPolicy } from "./registration-policy";

/**
 * Assemble the lifecycle view for a contract.
 *
 * `completeness` is optional so a caller that only has the row (e.g. a
 * list projection) still gets a coherent view; without it the INFO
 * stage is never promoted to PREVIEW.
 */
export function buildLifecycleView(
  contract: PropertyContract,
  completeness?: ContractCompleteness
): ContractLifecycleView {
  const stage = deriveLifecycleStage(contract.state, completeness);
  // The LATEST request, not only an in-flight one: after the last
  // signature the request is COMPLETED, and the participant list plus
  // the event trail must stay visible as the record of what happened.
  const signatureRequest = latestSignatureRequestDetail(contract.id);
  // Invitations belong to the request, not to the contract: an invitation
  // for an older request must never surface under a newer one.
  const latestRequest = latestSignatureRequest(contract.id);
  const invitations = latestRequest ? listInvitations(latestRequest.id) : [];
  const lawyerReview = activeLawyerReviewDetail(contract.id);
  const aiReview = latestAiReview(contract.id);
  const comments = listReviewComments(contract.id);

  const policy = evaluateRegistrationPolicy(contract.type);
  const registrationStatus = deriveRegistrationStatus(
    contract.state,
    policy.policy.officialRegistrationRequired
  );

  // The admin-review axis. `adminReview` is the newest review of any
  // status (so a decision stays visible); `adminApproved` is true only
  // when the CURRENT version still carries a valid, bound approval.
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const adminReview = latestAdminReview(contract.id);
  const approved = currentVersionApproval(contract, currentVersion?.documentHash ?? null);

  // The official seal is the SECOND, stronger gate: a Super-Admin stamp
  // request applied to the current version hash whose stamp master is still
  // byte-identical. A content change or a swapped asset voids it here too.
  const seal = currentVersionStamp(contract, currentVersion?.documentHash ?? null);

  // A contract may be submitted to the admin queue once its content is
  // frozen as a version and it is not already in flight, in the queue,
  // or freshly approved. The legal-transition table is the SAME source
  // the submit route asserts against, so the UI can never offer a call
  // the server would reject — and can never hide one it would allow.
  const canSubmitForAdminReview =
    !!contract.currentVersionId &&
    !approved &&
    !signatureRequest &&
    canTransition(contract.state, "PENDING_ADMIN_REVIEW");

  // The compulsory gate: a signature may only be PREPARED once the
  // current version carries an admin approval. This is the UI's read of
  // the same invariant the sign route enforces server-side.
  const canPrepareForSignature =
    !signatureRequest &&
    !!approved &&
    (contract.state === "ADMIN_APPROVED" ||
      contract.state === "READY_FOR_REVIEW" ||
      contract.state === "COUNTERPARTY_REVIEW" ||
      contract.state === "READY_TO_SIGN") &&
    !isEditable(contract.state);

  // A signature may be given only while the contract is signable and a
  // request is in flight. A BLOCKING lawyer review that is not complete
  // holds the signature back.
  const lawyerBlocks = !!lawyerReview && lawyerReview.blocksSigning;
  const canSign = isSignable(contract.state) && !!signatureRequest && !lawyerBlocks;

  // Finalization is the last step: every party has signed the current
  // version, the contract has reached SIGNED, AND the signed version
  // carries a valid admin approval. The finalize route enforces the same
  // two conditions, so the UI never offers a call the server would reject.
  const canFinalize = contract.state === "SIGNED" && approved !== null;

  return {
    stage,
    steps: buildLifecycleSteps(stage),
    registrationStatus,
    registrationStatusFa: registrationStatusFa(registrationStatus),
    signatureRequest,
    invitations,
    lawyerReview,
    aiReview,
    adminReview,
    adminApproved: approved !== null,
    stamped: seal !== null,
    officialStamp: seal
      ? {
          approvedByLabelFa: seal.approvedByLabelFa,
          approvedAt: seal.appliedAt,
          reasonFa: seal.reasonFa,
          documentHash: seal.documentHash,
        }
      : null,
    comments,
    canPrepareForSignature,
    canSign,
    canFinalize,
    canSubmitForAdminReview,
  };
}

/** True when the contract is at the signature stage right now. */
export function isContractAtSignatureStage(contract: PropertyContract): boolean {
  return isAtSignatureStage(contract.state);
}
