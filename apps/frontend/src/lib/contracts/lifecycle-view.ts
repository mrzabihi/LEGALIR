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
import { latestSignatureRequestDetail } from "./signature/db";
import { activeLawyerReviewDetail, latestAiReview, listReviewComments } from "./review-db";
import {
  buildLifecycleSteps,
  deriveLifecycleStage,
  deriveRegistrationStatus,
  isAtSignatureStage,
  registrationStatusFa,
} from "./lifecycle";
import { isEditable, isSignable } from "./state-machine";
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
  const lawyerReview = activeLawyerReviewDetail(contract.id);
  const aiReview = latestAiReview(contract.id);
  const comments = listReviewComments(contract.id);

  const policy = evaluateRegistrationPolicy(contract.type);
  const registrationStatus = deriveRegistrationStatus(
    contract.state,
    policy.policy.officialRegistrationRequired
  );

  // A contract may be prepared for signature once its content is frozen
  // and it is not already in flight. The version is created by the
  // prepare step, so this is a read of the same truth the state machine
  // enforces.
  const canPrepareForSignature =
    !signatureRequest &&
    (contract.state === "READY_FOR_REVIEW" ||
      contract.state === "COUNTERPARTY_REVIEW" ||
      contract.state === "READY_TO_SIGN") &&
    !isEditable(contract.state);

  // A signature may be given only while the contract is signable and a
  // request is in flight. A BLOCKING lawyer review that is not complete
  // holds the signature back.
  const lawyerBlocks = !!lawyerReview && lawyerReview.blocksSigning;
  const canSign = isSignable(contract.state) && !!signatureRequest && !lawyerBlocks;

  // Finalization is the last step: every party has signed the current
  // version and the contract has reached SIGNED. SIGNED is the only
  // state the finalize route accepts, so this is a read of the same
  // truth the route enforces.
  const canFinalize = contract.state === "SIGNED";

  return {
    stage,
    steps: buildLifecycleSteps(stage),
    registrationStatus,
    registrationStatusFa: registrationStatusFa(registrationStatus),
    signatureRequest,
    lawyerReview,
    aiReview,
    comments,
    canPrepareForSignature,
    canSign,
    canFinalize,
  };
}

/** True when the contract is at the signature stage right now. */
export function isContractAtSignatureStage(contract: PropertyContract): boolean {
  return isAtSignatureStage(contract.state);
}
