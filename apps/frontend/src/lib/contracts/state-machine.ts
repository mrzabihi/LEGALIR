// ============================================================
// LEGALIR — Contract state machine
// ============================================================
// The lifecycle of a property contract is explicit and enforced
// server-side. This module is the single authority on which
// transitions are legal; the API routes call `assertTransition`
// before persisting a state change, and the UI calls
// `canTransition` to decide which actions to offer.
//
// The transition table itself lives in `@legalir/types` so both the
// client and the server read the same source of truth.
// ============================================================

import {
  CONTRACT_STATE_TRANSITIONS,
  PROPERTY_CONTRACT_STATE_LABELS,
  type PropertyContractState,
} from "@legalir/types";

/** True when `from → to` is a declared legal transition. */
export function canTransition(
  from: PropertyContractState,
  to: PropertyContractState
): boolean {
  if (from === to) return true;
  return (CONTRACT_STATE_TRANSITIONS[from] ?? []).includes(to);
}

/** The states reachable from `from`. */
export function nextStates(from: PropertyContractState): PropertyContractState[] {
  return CONTRACT_STATE_TRANSITIONS[from] ?? [];
}

/** Persian label for a state. */
export function stateLabelFa(state: PropertyContractState): string {
  return PROPERTY_CONTRACT_STATE_LABELS[state] ?? state;
}

/** Thrown when an illegal transition is attempted. */
export class IllegalTransitionError extends Error {
  readonly code = "ILLEGAL_TRANSITION";
  constructor(
    readonly from: PropertyContractState,
    readonly to: PropertyContractState
  ) {
    super(`انتقال وضعیت از «${stateLabelFa(from)}» به «${stateLabelFa(to)}» مجاز نیست.`);
    this.name = "IllegalTransitionError";
  }
}

/** Throw when `from → to` is not a legal transition. */
export function assertTransition(
  from: PropertyContractState,
  to: PropertyContractState
): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

/** States in which the contract data may still be edited. */
const EDITABLE_STATES: PropertyContractState[] = [
  "DRAFT",
  "PARTIES_PENDING",
  "PROPERTY_PENDING",
  "DOCUMENTS_PENDING",
  "TERMS_PENDING",
  "CHANGES_REQUESTED",
];

/** True when the working data may be modified in this state. */
export function isEditable(state: PropertyContractState): boolean {
  return EDITABLE_STATES.includes(state);
}

/** True when the contract is awaiting the counterparty. */
export function isAwaitingCounterparty(state: PropertyContractState): boolean {
  return state === "COUNTERPARTY_REVIEW";
}

/** True when the contract can be signed by a party. */
export function isSignable(state: PropertyContractState): boolean {
  return state === "READY_TO_SIGN" || state === "PARTIALLY_SIGNED";
}

/** True when the contract is fully signed. */
export function isSigned(state: PropertyContractState): boolean {
  return state === "SIGNED" || state === "READY_FOR_OFFICIAL_REGISTRATION" || state === "FINALIZED";
}

/** True when the contract is in a terminal state. */
export function isTerminal(state: PropertyContractState): boolean {
  return state === "FINALIZED" || state === "CANCELLED" || state === "ARCHIVED";
}

/**
 * The state a contract should be in given its completeness. Used by
 * the API when the user advances the wizard: the state tracks the
 * furthest incomplete section rather than being set by hand.
 */
export function derivePendingState(
  missingSectionKeys: string[],
  sectionStepMap: Record<string, string>
): PropertyContractState {
  const order: { section: string; state: PropertyContractState }[] = [
    { section: "parties", state: "PARTIES_PENDING" },
    { section: "property", state: "PROPERTY_PENDING" },
    { section: "ownership", state: "PROPERTY_PENDING" },
    { section: "financial", state: "TERMS_PENDING" },
    { section: "registration", state: "TERMS_PENDING" },
    { section: "obligations", state: "TERMS_PENDING" },
    { section: "handover", state: "TERMS_PENDING" },
    { section: "documents", state: "DOCUMENTS_PENDING" },
  ];
  for (const entry of order) {
    if (missingSectionKeys.includes(entry.section) && sectionStepMap[entry.section]) {
      return entry.state;
    }
  }
  return "READY_FOR_REVIEW";
}
