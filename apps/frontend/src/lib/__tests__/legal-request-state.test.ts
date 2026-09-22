// ============================================================
// LEGALIR — Legal Request state machine tests (PART 7)
// ============================================================
// The state machine is the authoritative gate for request transitions.
// These tests pin the adjacency map so no UI or handler can drift from it.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  LEGAL_REQUEST_TRANSITIONS,
  LEGAL_REQUEST_STATE_FA,
  ACTIVE_LEGAL_REQUEST_STATES,
  canTransitionLegalRequest,
  type LegalRequestState,
} from "@legalir/types";

const ALL_STATES = Object.keys(LEGAL_REQUEST_STATE_FA) as LegalRequestState[];

describe("legal request state machine", () => {
  it("covers every state in the transition map", () => {
    for (const state of ALL_STATES) {
      expect(LEGAL_REQUEST_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("only references known states as targets", () => {
    for (const state of ALL_STATES) {
      for (const to of LEGAL_REQUEST_TRANSITIONS[state]) {
        expect(ALL_STATES).toContain(to);
      }
    }
  });

  it("allows the happy-path first move", () => {
    expect(canTransitionLegalRequest("DRAFT", "AI_INTAKE")).toBe(true);
  });

  it("rejects skipping straight to ACCEPTED", () => {
    expect(canTransitionLegalRequest("DRAFT", "ACCEPTED")).toBe(false);
  });

  it("treats CLOSED as terminal", () => {
    expect(LEGAL_REQUEST_TRANSITIONS.CLOSED).toEqual([]);
    for (const to of ALL_STATES) {
      expect(canTransitionLegalRequest("CLOSED", to)).toBe(false);
    }
  });

  it("makes CANCELLED reachable from every active state", () => {
    for (const state of ACTIVE_LEGAL_REQUEST_STATES) {
      expect(canTransitionLegalRequest(state, "CANCELLED")).toBe(true);
    }
  });

  it("never lists a state as its own successor", () => {
    for (const state of ALL_STATES) {
      expect(LEGAL_REQUEST_TRANSITIONS[state]).not.toContain(state);
    }
  });

  it("reaches ACCEPTED only through WAITING_FOR_ACCEPTANCE", () => {
    const sources = ALL_STATES.filter((s) =>
      LEGAL_REQUEST_TRANSITIONS[s].includes("ACCEPTED")
    );
    expect(sources).toEqual(["WAITING_FOR_ACCEPTANCE"]);
  });
});
