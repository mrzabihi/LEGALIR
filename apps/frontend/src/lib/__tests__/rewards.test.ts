import { describe, it, expect } from "vitest";
import {
  REWARD_RULES,
  getRewardRule,
  pointsForEvent,
  purchaseEventForPlan,
  tehranDateString,
} from "../rewards";

describe("REWARD_RULES — typed domain configuration", () => {
  it("has the six approved rules with correct point values", () => {
    const rule = (eventType: string) => REWARD_RULES.find((r) => r.eventType === eventType);
    expect(rule("PROFILE_COMPLETED")?.points).toBe(1000);
    expect(rule("PROFILE_COMPLETED")?.frequency).toBe("once_per_account");
    expect(rule("DAILY_VISIT")?.points).toBe(100);
    expect(rule("DAILY_VISIT")?.frequency).toBe("once_per_day");
    expect(rule("REFERRAL_COMPLETED")?.points).toBe(500);
    expect(rule("REFERRAL_COMPLETED")?.enabled).toBe(false);
    expect(rule("SUBSCRIPTION_SILVER_PURCHASED")?.points).toBe(850);
    expect(rule("SUBSCRIPTION_GOLD_PURCHASED")?.points).toBe(1000);
    expect(rule("SUBSCRIPTION_DIAMOND_PURCHASED")?.points).toBe(1500);
  });

  it("the referral rule is the only disabled (feature-flagged) rule", () => {
    const disabled = REWARD_RULES.filter((r) => !r.enabled).map((r) => r.eventType);
    expect(disabled).toEqual(["REFERRAL_COMPLETED"]);
  });

  it("getRewardRule / pointsForEvent resolve configured values", () => {
    expect(getRewardRule("DAILY_VISIT")?.points).toBe(100);
    expect(pointsForEvent("SUBSCRIPTION_DIAMOND_PURCHASED")).toBe(1500);
    // Unknown events resolve to 0, never a guessed amount.
    expect(pointsForEvent("UNKNOWN" as never)).toBe(0);
  });

  it("purchaseEventForPlan maps plan codes to purchase events", () => {
    expect(purchaseEventForPlan("silver")).toBe("SUBSCRIPTION_SILVER_PURCHASED");
    expect(purchaseEventForPlan("gold")).toBe("SUBSCRIPTION_GOLD_PURCHASED");
    expect(purchaseEventForPlan("diamond")).toBe("SUBSCRIPTION_DIAMOND_PURCHASED");
    expect(purchaseEventForPlan("free")).toBeNull();
  });
});

describe("tehranDateString — Asia/Tehran business day", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(tehranDateString(new Date("2026-08-16T00:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is stable for the same instant", () => {
    const d = new Date("2026-08-16T12:00:00Z");
    expect(tehranDateString(d)).toBe(tehranDateString(d));
  });
});
