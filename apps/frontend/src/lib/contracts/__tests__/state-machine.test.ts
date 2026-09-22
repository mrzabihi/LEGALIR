// ============================================================
// LEGALIR — Contract state machine tests
// ============================================================
// The transition table is the single authority on what the lifecycle
// allows. These tests pin the paths the two journeys actually take
// and the illegal jumps that must be rejected — in particular that
// signing can never skip straight to a registration state.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  IllegalTransitionError,
  isEditable,
  isSignable,
  isSigned,
  isTerminal,
  stateLabelFa,
} from "../state-machine";

describe("state machine — legal transitions", () => {
  it("allows the rent journey path", () => {
    const path = [
      "DRAFT",
      "READY_FOR_REVIEW",
      "READY_TO_SIGN",
      "PARTIALLY_SIGNED",
      "SIGNED",
      "FINALIZED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("allows the sale journey path through official registration", () => {
    expect(canTransition("SIGNED", "READY_FOR_OFFICIAL_REGISTRATION")).toBe(true);
    expect(canTransition("READY_FOR_OFFICIAL_REGISTRATION", "FINALIZED")).toBe(true);
  });

  it("treats a no-op transition as legal", () => {
    expect(canTransition("DRAFT", "DRAFT")).toBe(true);
  });

  it("rejects signing straight into a registration state", () => {
    // This is the bug that stranded contracts: READY_TO_SIGN has no
    // edge to FINALIZED or READY_FOR_OFFICIAL_REGISTRATION.
    expect(canTransition("READY_TO_SIGN", "FINALIZED")).toBe(false);
    expect(canTransition("READY_TO_SIGN", "READY_FOR_OFFICIAL_REGISTRATION")).toBe(false);
  });

  it("rejects skipping review entirely", () => {
    expect(canTransition("DRAFT", "READY_TO_SIGN")).toBe(false);
    expect(canTransition("DRAFT", "SIGNED")).toBe(false);
  });

  it("rejects editing a finalized contract", () => {
    expect(canTransition("FINALIZED", "DRAFT")).toBe(false);
  });
});

describe("state machine — assertTransition", () => {
  it("throws an IllegalTransitionError with a Persian message", () => {
    expect(() => assertTransition("DRAFT", "SIGNED")).toThrow(IllegalTransitionError);
    try {
      assertTransition("DRAFT", "SIGNED");
    } catch (err) {
      expect((err as Error).message).toContain("مجاز نیست");
    }
  });

  it("does not throw for a legal transition", () => {
    expect(() => assertTransition("DRAFT", "READY_FOR_REVIEW")).not.toThrow();
  });
});

describe("state machine — predicates", () => {
  it("marks only pre-review states as editable", () => {
    expect(isEditable("DRAFT")).toBe(true);
    expect(isEditable("CHANGES_REQUESTED")).toBe(true);
    expect(isEditable("READY_FOR_REVIEW")).toBe(false);
    expect(isEditable("SIGNED")).toBe(false);
  });

  it("marks only the signing states as signable", () => {
    expect(isSignable("READY_TO_SIGN")).toBe(true);
    expect(isSignable("PARTIALLY_SIGNED")).toBe(true);
    expect(isSignable("READY_FOR_REVIEW")).toBe(false);
    expect(isSignable("SIGNED")).toBe(false);
  });

  it("treats signed and post-sign states as signed", () => {
    expect(isSigned("SIGNED")).toBe(true);
    expect(isSigned("READY_FOR_OFFICIAL_REGISTRATION")).toBe(true);
    expect(isSigned("FINALIZED")).toBe(true);
    expect(isSigned("PARTIALLY_SIGNED")).toBe(false);
  });

  it("treats finalized/cancelled/archived as terminal", () => {
    expect(isTerminal("FINALIZED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("ARCHIVED")).toBe(true);
    expect(isTerminal("SIGNED")).toBe(false);
  });

  it("labels states in Persian", () => {
    expect(stateLabelFa("READY_FOR_OFFICIAL_REGISTRATION")).toBe("نیازمند ثبت رسمی");
    expect(stateLabelFa("FINALIZED")).toBe("نهایی‌شده");
  });
});
