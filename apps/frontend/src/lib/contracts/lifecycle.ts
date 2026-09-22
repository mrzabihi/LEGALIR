// ============================================================
// LEGALIR — Contract lifecycle stage derivation
// ============================================================
// The five-step stepper the user sees:
//
//   اطلاعات ✓ → پیش‌نمایش ✓ → بررسی ● → امضا ○ → تکمیل ○
//
// The stage is DERIVED from the contract's real state and its real
// completeness — never from "which button did the user click". A
// contract whose data is complete but which was never submitted for
// review sits at PREVIEW, not REVIEW.
//
// This module is pure and domain-agnostic: it never branches on the
// contract type and never names a party role.
// ============================================================

import {
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABELS_FA,
  REGISTRATION_STATUS_FA,
  type ContractCompleteness,
  type ContractLifecycleStage,
  type ContractRegistrationStatus,
  type LifecycleStepView,
  type PropertyContract,
  type PropertyContractState,
} from "@legalir/types";

/** The states that belong to each stage. */
const STAGE_STATES: Record<ContractLifecycleStage, PropertyContractState[]> = {
  INFO: ["DRAFT", "PARTIES_PENDING", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING"],
  PREVIEW: [],
  REVIEW: ["READY_FOR_REVIEW", "COUNTERPARTY_REVIEW", "CHANGES_REQUESTED"],
  SIGNATURE: ["READY_TO_SIGN", "PARTIALLY_SIGNED"],
  COMPLETE: [
    "SIGNED",
    "READY_FOR_OFFICIAL_REGISTRATION",
    "FINALIZED",
    "CANCELLED",
    "ARCHIVED",
  ],
};

/**
 * The lifecycle stage a contract is in right now.
 *
 * `completeness` is optional so callers that only have the state (e.g.
 * a list row) still get a sensible answer; without it the INFO stage
 * is never promoted to PREVIEW.
 */
export function deriveLifecycleStage(
  state: PropertyContractState,
  completeness?: ContractCompleteness
): ContractLifecycleStage {
  for (const stage of LIFECYCLE_STAGES) {
    if (STAGE_STATES[stage].includes(state)) {
      // A fully-complete contract that has not been submitted yet is
      // at PREVIEW, not INFO — the user has finished the data entry.
      if (stage === "INFO" && completeness && completeness.overall === 100) {
        return "PREVIEW";
      }
      return stage;
    }
  }
  return "INFO";
}

/** The index of a stage in the ordered list. */
export function lifecycleStageIndex(stage: ContractLifecycleStage): number {
  return LIFECYCLE_STAGES.indexOf(stage);
}

/**
 * The stepper view: every stage with its status and whether the user
 * may jump to it. A stage is reachable when it is at or before the
 * current stage.
 */
export function buildLifecycleSteps(current: ContractLifecycleStage): LifecycleStepView[] {
  const currentIndex = lifecycleStageIndex(current);
  return LIFECYCLE_STAGES.map((stage, index) => ({
    stage,
    labelFa: LIFECYCLE_STAGE_LABELS_FA[stage],
    status: index < currentIndex ? "done" : index === currentIndex ? "active" : "pending",
    reachable: index <= currentIndex,
  }));
}

/**
 * The registration status, derived from the contract state and the
 * registration policy. This is DELIBERATELY separate from the
 * signature status: a fully-signed sale contract is PENDING
 * registration, never "ownership transferred".
 */
export function deriveRegistrationStatus(
  state: PropertyContractState,
  officialRegistrationRequired: boolean
): ContractRegistrationStatus {
  if (state === "CANCELLED" || state === "ARCHIVED") return "NOT_APPLICABLE";
  if (state === "READY_FOR_OFFICIAL_REGISTRATION") return "PENDING";
  if (state === "FINALIZED") {
    return officialRegistrationRequired ? "REGISTERED" : "NOT_REQUIRED";
  }
  return officialRegistrationRequired ? "PENDING" : "NOT_REQUIRED";
}

/** The Persian label for a registration status. */
export function registrationStatusFa(status: ContractRegistrationStatus): string {
  return REGISTRATION_STATUS_FA[status];
}

/**
 * True when the contract's content is frozen and may be signed. A
 * contract is signable only in the signature states — the version is
 * locked by the state machine, so this is a read of the same truth.
 */
export function isAtSignatureStage(state: PropertyContractState): boolean {
  return STAGE_STATES.SIGNATURE.includes(state);
}

/** True when the contract has reached the final stage. */
export function isAtCompleteStage(state: PropertyContractState): boolean {
  return STAGE_STATES.COMPLETE.includes(state);
}

/**
 * The stage a contract should be shown at, given its row and its
 * completeness. Convenience wrapper so callers do not have to import
 * both helpers.
 */
export function lifecycleStageFor(
  contract: PropertyContract,
  completeness?: ContractCompleteness
): ContractLifecycleStage {
  return deriveLifecycleStage(contract.state, completeness);
}
