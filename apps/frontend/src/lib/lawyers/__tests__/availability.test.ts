// ============================================================
// LEGALIR — Lawyer availability derivation (public card treatment)
// ============================================================
// The public card/CTA treatment keys off `availabilityView` + `removalReason`.
// A SUSPENDED lawyer must remain VISIBLE (unlike REJECTED) but carry the
// exact alert copy the brief mandates and a disabled booking CTA.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  availabilityView,
  removalReason,
  SUSPENDED_REASON_FA,
  REJECTED_REASON_FA,
} from "../availability";

describe("availabilityView — suspended treatment", () => {
  it("maps SUSPENDED to the terminal (rejected) tone with a disabled CTA", () => {
    const view = availabilityView("SUSPENDED", 5, false);
    expect(view.tone).toBe("rejected");
    expect(view.label).toBe("معلق");
    expect(view.canRequest).toBe(false);
    expect(view.capacityLabel).toBeNull();
  });

  it("shows the exact suspension reason the brief requires", () => {
    expect(removalReason("SUSPENDED")).toBe(SUSPENDED_REASON_FA);
    expect(SUSPENDED_REASON_FA).toBe("این وکیل توسط لیگالیر به حالت تعلیق درآمده است.");
  });

  it("distinguishes REJECTED from SUSPENDED copy", () => {
    expect(removalReason("REJECTED")).toBe(REJECTED_REASON_FA);
    expect(removalReason("REJECTED")).not.toBe(removalReason("SUSPENDED"));
  });

  it("a reachable lawyer has no removal reason", () => {
    expect(removalReason("ACTIVE")).toBeNull();
    expect(removalReason("LIMITED")).toBeNull();
    expect(availabilityView("ACTIVE", 3, true).canRequest).toBe(true);
  });
});
