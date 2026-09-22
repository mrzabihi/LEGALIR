// ============================================================
// LEGALIR — Lifecycle engine tests (§122–126)
// ============================================================
// These tests pin the rules the whole lifecycle rests on:
//
//   • the stage is DERIVED from state + completeness, never stored
//   • a signature binds to a version and its hash, and a tampered
//     snapshot is refused
//   • the OTP provider never stores the raw code, is single-use,
//     rate-limited and attempt-limited
//   • the assurance wording is «تأیید و امضای الکترونیکی» — never
//     «امضای الکترونیکی مطمئن» or «امضای دیجیتال رسمی»
//   • signature status and registration status never collapse
//   • a feature flag removes an option, never grants permission
// ============================================================

import { describe, it, expect } from "vitest";
import type { ContractCompleteness, PropertyContractVersion } from "@legalir/types";
import {
  buildLifecycleSteps,
  deriveLifecycleStage,
  deriveRegistrationStatus,
  isAtCompleteStage,
  isAtSignatureStage,
  lifecycleStageIndex,
} from "../lifecycle";
import { verifyVersionIntegrity } from "../signature/integrity";
import { otpSignatureProvider } from "../signature/otp-provider";
import {
  activeSignatureProvider,
  signatureAssuranceLabelFa,
  signatureProviderFor,
} from "../signature";
import { contractFeatureFlags, isContractFeatureEnabled } from "../feature-flags";
import { hashSnapshot } from "../snapshot";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function completeness(overall: number): ContractCompleteness {
  return { overall, sections: [], blockers: [] } as unknown as ContractCompleteness;
}

function version(overrides: Partial<PropertyContractVersion> = {}): PropertyContractVersion {
  const snapshot = {
    data: { schemaVersion: 1, area: 90 },
    parties: [],
    payments: [],
    documentsManifest: [],
  } as unknown as PropertyContractVersion["snapshot"];
  return {
    id: "ver-1",
    contractId: "ctr-1",
    versionNumber: 1,
    documentHash: hashSnapshot(snapshot),
    snapshot,
    createdBy: "usr-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as unknown as PropertyContractVersion;
}

// ------------------------------------------------------------
// §122 — stage derivation
// ------------------------------------------------------------

describe("lifecycle — stage derivation", () => {
  it("maps the data-entry states to INFO", () => {
    for (const state of [
      "DRAFT",
      "PARTIES_PENDING",
      "PROPERTY_PENDING",
      "DOCUMENTS_PENDING",
      "TERMS_PENDING",
    ] as const) {
      expect(deriveLifecycleStage(state)).toBe("INFO");
    }
  });

  it("promotes a fully-complete contract to PREVIEW, not REVIEW", () => {
    expect(deriveLifecycleStage("DRAFT", completeness(100))).toBe("PREVIEW");
    expect(deriveLifecycleStage("DRAFT", completeness(99))).toBe("INFO");
  });

  it("maps the review states to REVIEW", () => {
    for (const state of [
      "READY_FOR_REVIEW",
      "COUNTERPARTY_REVIEW",
      "CHANGES_REQUESTED",
    ] as const) {
      expect(deriveLifecycleStage(state)).toBe("REVIEW");
    }
  });

  it("maps the signature states to SIGNATURE", () => {
    expect(deriveLifecycleStage("READY_TO_SIGN")).toBe("SIGNATURE");
    expect(deriveLifecycleStage("PARTIALLY_SIGNED")).toBe("SIGNATURE");
  });

  it("maps the terminal states to COMPLETE", () => {
    for (const state of [
      "SIGNED",
      "READY_FOR_OFFICIAL_REGISTRATION",
      "FINALIZED",
      "ARCHIVED",
    ] as const) {
      expect(deriveLifecycleStage(state)).toBe("COMPLETE");
    }
  });

  it("never lets completeness promote a contract past PREVIEW", () => {
    expect(deriveLifecycleStage("READY_FOR_REVIEW", completeness(100))).toBe("REVIEW");
  });
});

// ------------------------------------------------------------
// §122 — stepper
// ------------------------------------------------------------

describe("lifecycle — stepper", () => {
  it("marks earlier stages done, the current one active, later ones pending", () => {
    const steps = buildLifecycleSteps("REVIEW");
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "active", "pending", "pending"]);
  });

  it("labels the five stages in order", () => {
    const steps = buildLifecycleSteps("INFO");
    expect(steps.map((s) => s.labelFa)).toEqual([
      "اطلاعات",
      "پیش‌نمایش",
      "بررسی",
      "امضا",
      "تکمیل",
    ]);
  });

  it("only lets the user reach stages at or before the current one", () => {
    const steps = buildLifecycleSteps("SIGNATURE");
    expect(steps.map((s) => s.reachable)).toEqual([true, true, true, true, false]);
  });

  it("orders the stages INFO < PREVIEW < REVIEW < SIGNATURE < COMPLETE", () => {
    expect(lifecycleStageIndex("INFO")).toBeLessThan(lifecycleStageIndex("PREVIEW"));
    expect(lifecycleStageIndex("PREVIEW")).toBeLessThan(lifecycleStageIndex("REVIEW"));
    expect(lifecycleStageIndex("REVIEW")).toBeLessThan(lifecycleStageIndex("SIGNATURE"));
    expect(lifecycleStageIndex("SIGNATURE")).toBeLessThan(lifecycleStageIndex("COMPLETE"));
  });

  it("recognises the signature and complete stages", () => {
    expect(isAtSignatureStage("READY_TO_SIGN")).toBe(true);
    expect(isAtSignatureStage("SIGNED")).toBe(false);
    expect(isAtCompleteStage("SIGNED")).toBe(true);
    expect(isAtCompleteStage("READY_TO_SIGN")).toBe(false);
  });
});

// ------------------------------------------------------------
// §87–90 — signature status vs registration status
// ------------------------------------------------------------

describe("lifecycle — registration status is separate from signature status", () => {
  it("a fully-signed sale contract is PENDING registration, not registered", () => {
    expect(deriveRegistrationStatus("SIGNED", true)).toBe("PENDING");
    expect(deriveRegistrationStatus("READY_FOR_OFFICIAL_REGISTRATION", true)).toBe("PENDING");
  });

  it("a finalized contract that needs registration is REGISTERED", () => {
    expect(deriveRegistrationStatus("FINALIZED", true)).toBe("REGISTERED");
  });

  it("a contract that needs no registration is NOT_REQUIRED", () => {
    expect(deriveRegistrationStatus("SIGNED", false)).toBe("NOT_REQUIRED");
    expect(deriveRegistrationStatus("FINALIZED", false)).toBe("NOT_REQUIRED");
  });

  it("a cancelled or archived contract has no registration meaning", () => {
    expect(deriveRegistrationStatus("CANCELLED", true)).toBe("NOT_APPLICABLE");
    expect(deriveRegistrationStatus("ARCHIVED", true)).toBe("NOT_APPLICABLE");
  });
});

// ------------------------------------------------------------
// §14–16 — version integrity
// ------------------------------------------------------------

describe("lifecycle — version integrity", () => {
  it("accepts an untouched version", () => {
    const result = verifyVersionIntegrity(version());
    expect(result.ok).toBe(true);
    expect(result.recomputed).toBe(result.recorded);
  });

  it("refuses a version whose snapshot was altered after the fact", () => {
    const v = version();
    const tampered = {
      ...v,
      snapshot: { ...v.snapshot, data: { schemaVersion: 1, area: 999 } },
    } as unknown as PropertyContractVersion;
    const result = verifyVersionIntegrity(tampered);
    expect(result.ok).toBe(false);
    expect(result.recomputed).not.toBe(result.recorded);
  });

  it("refuses a version whose recorded hash was swapped", () => {
    const v = version({ documentHash: "0".repeat(64) });
    expect(verifyVersionIntegrity(v).ok).toBe(false);
  });
});

// ------------------------------------------------------------
// §21 — assurance wording
// ------------------------------------------------------------

describe("lifecycle — signature assurance wording", () => {
  it("labels an OTP signature «تأیید و امضای الکترونیکی»", () => {
    expect(signatureAssuranceLabelFa("ELECTRONIC_CONFIRMATION")).toBe("تأیید و امضای الکترونیکی");
  });

  it("never labels an OTP signature as secure or official", () => {
    const label = signatureAssuranceLabelFa(otpSignatureProvider.assuranceLevel());
    expect(label).not.toContain("مطمئن");
    expect(label).not.toContain("رسمی");
    expect(label).not.toContain("دیجیتال");
  });

  it("resolves the OTP provider by id and as the active provider", () => {
    expect(signatureProviderFor("OTP_SIGNATURE").id).toBe("OTP_SIGNATURE");
    expect(activeSignatureProvider().id).toBe("OTP_SIGNATURE");
    expect(activeSignatureProvider().assuranceLevel()).toBe("ELECTRONIC_CONFIRMATION");
  });
});

// ------------------------------------------------------------
// §80–86 — OTP provider security
// ------------------------------------------------------------

describe("lifecycle — OTP provider", () => {
  it("issues a challenge and accepts the development code", () => {
    const subject = `t-${Math.random()}`;
    const issued = otpSignatureProvider.requestChallenge({ subject, mobile: "09120000003" });
    expect(issued.sent).toBe(true);
    expect(issued.destinationMasked).toBe("0912***0003");
    expect(otpSignatureProvider.verifyChallenge({ subject, code: "405405" }).ok).toBe(true);
  });

  it("rejects a wrong code", () => {
    const subject = `t-${Math.random()}`;
    otpSignatureProvider.requestChallenge({ subject, mobile: "09120000003" });
    const result = otpSignatureProvider.verifyChallenge({ subject, code: "000000" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_CODE");
  });

  it("is single-use — a verified challenge cannot be replayed", () => {
    const subject = `t-${Math.random()}`;
    otpSignatureProvider.requestChallenge({ subject, mobile: "09120000003" });
    expect(otpSignatureProvider.verifyChallenge({ subject, code: "405405" }).ok).toBe(true);
    const replay = otpSignatureProvider.verifyChallenge({ subject, code: "405405" });
    expect(replay.ok).toBe(false);
    expect(replay.code).toBe("NO_CHALLENGE");
  });

  it("refuses verification without a challenge", () => {
    const result = otpSignatureProvider.verifyChallenge({
      subject: `t-${Math.random()}`,
      code: "405405",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NO_CHALLENGE");
  });

  it("destroys the challenge after too many failed attempts", () => {
    const subject = `t-${Math.random()}`;
    otpSignatureProvider.requestChallenge({ subject, mobile: "09120000003" });
    for (let i = 0; i < 5; i += 1) {
      otpSignatureProvider.verifyChallenge({ subject, code: "000000" });
    }
    const result = otpSignatureProvider.verifyChallenge({ subject, code: "405405" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("rate-limits repeated challenge requests for one subject", () => {
    const subject = `t-${Math.random()}`;
    const results = [0, 1, 2, 3].map(() =>
      otpSignatureProvider.requestChallenge({ subject, mobile: "09120000003" })
    );
    expect(results.slice(0, 3).every((r) => r.sent)).toBe(true);
    expect(results[3]!.sent).toBe(false);
  });

  it("scopes challenges per subject so two signers never share one", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    otpSignatureProvider.requestChallenge({ subject: a, mobile: "09120000003" });
    expect(otpSignatureProvider.verifyChallenge({ subject: b, code: "405405" }).ok).toBe(false);
  });
});

// ------------------------------------------------------------
// §116 — feature flags
// ------------------------------------------------------------

describe("lifecycle — feature flags", () => {
  it("defaults the three lifecycle capabilities on and certified signatures off", () => {
    const flags = contractFeatureFlags();
    expect(flags.CONTRACT_SIGNING_ENABLED).toBe(true);
    expect(flags.LAWYER_REVIEW_ENABLED).toBe(true);
    expect(flags.AI_CONTRACT_REVIEW_ENABLED).toBe(true);
    expect(flags.CERTIFIED_SIGNATURE_ENABLED).toBe(false);
  });

  it("reads a flag from the environment", () => {
    const previous = process.env["LAWYER_REVIEW_ENABLED"];
    process.env["LAWYER_REVIEW_ENABLED"] = "0";
    try {
      expect(isContractFeatureEnabled("LAWYER_REVIEW_ENABLED")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env["LAWYER_REVIEW_ENABLED"];
      else process.env["LAWYER_REVIEW_ENABLED"] = previous;
    }
  });
});
