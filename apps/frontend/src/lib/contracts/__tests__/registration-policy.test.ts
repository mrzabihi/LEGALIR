// ============================================================
// LEGALIR — Registration policy tests
// ============================================================
// The critical legal rule under test:
//
//   «نهایی‌شدن قرارداد در لِگال‌آی‌آر» ≠ «انتقال رسمی مالکیت»
//
// A finalized sale contract must land in READY_FOR_OFFICIAL_
// REGISTRATION and must never be described as ownership-transferred.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  evaluateRegistrationPolicy,
  isLegallyConcluded,
  verificationStatusFa,
} from "../registration-policy";
import {
  allContractDefinitions,
  implementedContractDefinitions,
  getContractDefinition,
  isImplementedContractType,
  firstWizardStepId,
  nextWizardStepId,
  prevWizardStepId,
  counterpartyRole,
} from "../registry";

describe("registration policy — rent", () => {
  it("finalizes directly without requiring a notary visit", () => {
    const outcome = evaluateRegistrationPolicy("property_rent");
    expect(outcome.postSignState).toBe("FINALIZED");
    expect(outcome.requiresNotaryVisit).toBe(false);
  });

  it("describes registration as optional", () => {
    const outcome = evaluateRegistrationPolicy("property_rent");
    expect(outcome.policy.officialRegistrationRequired).toBe(false);
    expect(outcome.policy.officialRegistrationOptional).toBe(true);
  });
});

describe("registration policy — sale", () => {
  it("lands in READY_FOR_OFFICIAL_REGISTRATION, never FINALIZED", () => {
    const outcome = evaluateRegistrationPolicy("property_sale");
    expect(outcome.postSignState).toBe("READY_FOR_OFFICIAL_REGISTRATION");
    expect(outcome.postSignState).not.toBe("FINALIZED");
  });

  it("requires a notary visit", () => {
    const outcome = evaluateRegistrationPolicy("property_sale");
    expect(outcome.requiresNotaryVisit).toBe(true);
    expect(outcome.policy.officialRegistrationRequired).toBe(true);
  });

  it("states explicitly that Legalier does not transfer ownership", () => {
    const outcome = evaluateRegistrationPolicy("property_sale");
    expect(outcome.bodyFa).toContain("انتقال مالکیت");
    expect(outcome.bodyFa).toContain("انجام نمی‌دهد");
  });

  it("never claims ownership transfer in the verification status", () => {
    const status = verificationStatusFa("property_sale", "READY_FOR_OFFICIAL_REGISTRATION");
    expect(status).toContain("ثبت رسمی");
    expect(status).not.toContain("مالکیت منتقل");
  });

  it("flags a finalized sale as distinct from ownership transfer", () => {
    const status = verificationStatusFa("property_sale", "FINALIZED");
    expect(status).toContain("انتقال رسمی مالکیت مستقل");
  });
});

describe("registration policy — concluded states", () => {
  it("treats FINALIZED and READY_FOR_OFFICIAL_REGISTRATION as concluded", () => {
    expect(isLegallyConcluded("FINALIZED")).toBe(true);
    expect(isLegallyConcluded("READY_FOR_OFFICIAL_REGISTRATION")).toBe(true);
    expect(isLegallyConcluded("SIGNED")).toBe(false);
  });
});

describe("registry — definitions", () => {
  it("registers both implemented property journeys", () => {
    const ids = implementedContractDefinitions().map((d) => d.id);
    expect(ids).toContain("property_rent");
    expect(ids).toContain("property_sale");
  });

  it("keeps the vehicle domain declared but not implemented", () => {
    const all = allContractDefinitions().map((d) => d.id);
    expect(all).toContain("vehicle_sale");
    expect(isImplementedContractType("vehicle_sale")).toBe(false);
  });

  it("gives each journey a distinct step order", () => {
    const rent = getContractDefinition("property_rent").wizardSteps.map((s) => s.id);
    const sale = getContractDefinition("property_sale").wizardSteps.map((s) => s.id);
    expect(rent).toContain("financial");
    expect(rent).not.toContain("registration");
    expect(sale).toContain("registration");
  });

  it("walks the wizard forward and backward", () => {
    const first = firstWizardStepId("property_rent");
    expect(first).toBe("parties");
    const second = nextWizardStepId("property_rent", first);
    expect(second).toBe("property");
    expect(prevWizardStepId("property_rent", second!)).toBe("parties");
  });

  it("returns null past the last step", () => {
    const steps = getContractDefinition("property_rent").wizardSteps;
    const last = steps[steps.length - 1]!.id;
    expect(nextWizardStepId("property_rent", last)).toBeNull();
  });

  it("resolves the counterparty role for each journey", () => {
    expect(counterpartyRole("property_rent", "landlord")).toBe("tenant");
    expect(counterpartyRole("property_sale", "seller")).toBe("buyer");
  });
});
