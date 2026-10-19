// ============================================================
// LEGALIR — Stamp eligibility evaluator
// ============================================================
// The evaluator is the ONE place that decides which stamp action is
// meaningful right now. These tests pin the four things the admin drawer
// depends on:
//
//   1. «ثبت درخواست مهر» is enabled EXACTLY when the real preconditions
//      hold — the request path never requires signatures (the seal does);
//   2. an unmet precondition always yields a Persian reason, in a stable
//      order, so the UI never shows a dead un-explained button;
//   3. a missing permission is the LAST explanation, never a cover for a
//      real condition;
//   4. a stale open request can still be rejected/cancelled — that is the
//      only route back to a fresh request.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  evaluateStampEligibility,
  primaryStampBlocker,
  type StampFacts,
} from "../stamp-eligibility";

/** Every precondition satisfied, by a manager, with nothing pending. */
function base(overrides: Partial<StampFacts> = {}): StampFacts {
  return {
    featureEnabled: true,
    assetAvailable: true,
    hasCurrentVersion: true,
    reviewed: true,
    signatures: "required",
    signaturesReasonFa: null,
    applied: false,
    pending: false,
    pendingMatchesCurrent: false,
    canManage: true,
    ...overrides,
  };
}

describe("stamp eligibility — requesting the seal", () => {
  it("allows a request on a reviewed, unsealed version without signatures", () => {
    // The request records INTENT and has no legal effect. Waiting for the
    // parties to sign is the seal's gate, not the request's — the server's
    // `handleRequest` has never required signatures, and the UI must agree.
    const e = evaluateStampEligibility(base({ signatures: "required" }));
    expect(e.canRequest).toBe(true);
    expect(e.canApply).toBe(false);
    expect(e.nextAction).toBe("request");
    expect(e.blockers).toEqual([]);
  });

  it("refuses when the current version has no valid review", () => {
    const e = evaluateStampEligibility(base({ reviewed: false }));
    expect(e.canRequest).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["NOT_REVIEWED"]);
    expect(primaryStampBlocker(e)?.messageFa).toContain("تأیید بررسی داخلی");
  });

  it("refuses when the feature or the stamp master is unavailable", () => {
    const disabled = evaluateStampEligibility(base({ featureEnabled: false }));
    expect(disabled.blockers.map((b) => b.code)).toEqual(["FEATURE_DISABLED"]);

    const noAsset = evaluateStampEligibility(base({ assetAvailable: false }));
    expect(noAsset.blockers.map((b) => b.code)).toEqual(["STAMP_ASSET_MISSING"]);
  });

  it("refuses when the version is already sealed on the current hash", () => {
    const e = evaluateStampEligibility(base({ applied: true }));
    expect(e.canRequest).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["ALREADY_STAMPED"]);
    expect(e.nextAction).toBe("none");
  });

  it("does not offer a second request while one is open on the same hash", () => {
    const e = evaluateStampEligibility(base({ pending: true, pendingMatchesCurrent: true }));
    expect(e.canRequest).toBe(false);
    // No decision is possible: the signature gate is still unmet.
    expect(e.canApply).toBe(false);
    expect(e.canReject).toBe(true);
    expect(e.blockers.map((b) => b.code)).toEqual(["SIGNATURES_REQUIRED"]);
  });

  it("reports a stale open request as something to clear, not as a seal", () => {
    const e = evaluateStampEligibility(base({ pending: true, pendingMatchesCurrent: false }));
    expect(e.canApply).toBe(false);
    expect(e.canReject).toBe(true);
    expect(e.blockers.map((b) => b.code)).toEqual(["PENDING_REQUEST"]);
    expect(primaryStampBlocker(e)?.messageFa).toContain("نسخهٔ دیگری");
  });

  it("stops early once a contract has no frozen version", () => {
    const e = evaluateStampEligibility(
      base({ hasCurrentVersion: false, reviewed: false, assetAvailable: false })
    );
    // Only the blocking cause is shown — a version-less contract cannot be
    // reviewed or stamped, so those checks would be noise.
    expect(e.blockers.map((b) => b.code)).toEqual(["NO_VERSION"]);
  });
});

describe("stamp eligibility — applying the seal", () => {
  it("is enabled only when the request matches the current hash and every party signed", () => {
    const e = evaluateStampEligibility(
      base({ pending: true, pendingMatchesCurrent: true, signatures: "ready" })
    );
    expect(e.canApply).toBe(true);
    expect(e.nextAction).toBe("apply");
    expect(e.blockers).toEqual([]);
  });

  it("stays blocked while a party has not signed, and says so", () => {
    const e = evaluateStampEligibility(
      base({
        pending: true,
        pendingMatchesCurrent: true,
        signatures: "required",
        signaturesReasonFa: "طرف دوم هنوز امضا نکرده است.",
      })
    );
    expect(e.canApply).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["SIGNATURES_REQUIRED"]);
    expect(primaryStampBlocker(e)?.messageFa).toBe("طرف دوم هنوز امضا نکرده است.");
  });

  it("refuses to seal a version the parties did not sign", () => {
    const e = evaluateStampEligibility(
      base({ pending: true, pendingMatchesCurrent: true, signatures: "stale" })
    );
    expect(e.canApply).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["SIGNATURES_STALE"]);
  });

  it("refuses when the review no longer covers the current hash", () => {
    const e = evaluateStampEligibility(
      base({
        pending: true,
        pendingMatchesCurrent: true,
        signatures: "ready",
        reviewed: false,
      })
    );
    expect(e.canApply).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["NOT_REVIEWED"]);
  });
});

describe("stamp eligibility — permission is the last explanation", () => {
  it("surfaces the real unmet condition even when the caller cannot manage", () => {
    const e = evaluateStampEligibility(base({ canManage: false, reviewed: false }));
    expect(e.canRequest).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["NOT_REVIEWED"]);
    expect(e.blockers.some((b) => b.code === "NOT_MANAGER")).toBe(false);
  });

  it("reports NOT_MANAGER when permission is the ONLY thing missing", () => {
    // This is the historical defect: every condition was met but the button
    // stayed disabled with no explanation, because the panel's own
    // `canRequest` ignored the permission.
    const e = evaluateStampEligibility(
      base({ canManage: false, pending: true, pendingMatchesCurrent: true, signatures: "ready" })
    );
    expect(e.canApply).toBe(false);
    expect(e.canReject).toBe(false);
    expect(e.blockers.map((b) => b.code)).toEqual(["NOT_MANAGER"]);
    expect(primaryStampBlocker(e)?.messageFa).toContain("مدیریت مهر رسمی قراردادها");
  });

  it("never reports a missing permission for an action that is not offered", () => {
    const e = evaluateStampEligibility(base({ canManage: true }));
    expect(e.blockers.some((b) => b.code === "NOT_MANAGER")).toBe(false);
  });
});

describe("stamp eligibility — non-managers cannot act even with clean facts", () => {
  it("denies request, apply, reject and cancel", () => {
    const e = evaluateStampEligibility(
      base({ canManage: false, pending: true, pendingMatchesCurrent: true, signatures: "ready" })
    );
    expect(e.canRequest).toBe(false);
    expect(e.canApply).toBe(false);
    expect(e.canReject).toBe(false);
    expect(e.canCancel).toBe(false);
    expect(e.nextAction).toBe("none");
  });

  it("still allows a manager to reject a stale request", () => {
    const e = evaluateStampEligibility(
      base({ canManage: true, pending: true, pendingMatchesCurrent: false })
    );
    expect(e.canReject).toBe(true);
    expect(e.canCancel).toBe(true);
    expect(e.nextAction).toBe("reject");
  });

  it("denies rejecting when the feature itself is off", () => {
    const e = evaluateStampEligibility(
      base({ featureEnabled: false, pending: true, pendingMatchesCurrent: false })
    );
    expect(e.canReject).toBe(false);
  });
});
