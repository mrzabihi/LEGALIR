import { describe, it, expect } from "vitest";
import {
  checkFeature,
  checkFeatures,
  hasActiveSubscription,
  getUpgradePlanForFeature,
} from "@/lib/entitlements";
import type { Entitlement } from "@legalir/types";

const mockActiveEntitlements: Entitlement[] = [
  {
    featureKey: "AI_CHAT_MESSAGE",
    nameFa: "پیام هوش مصنوعی",
    limit: 300,
    period: "month",
    used: 127,
    isBoolean: false,
    isEnabled: true,
  },
  {
    featureKey: "DOCUMENT_ANALYSIS",
    nameFa: "تحلیل سند",
    limit: 10,
    period: "month",
    used: 3,
    isBoolean: false,
    isEnabled: true,
  },
  {
    featureKey: "ADVANCED_REFERENCE",
    nameFa: "منابع پیشرفته",
    limit: null,
    period: "forever",
    used: 0,
    isBoolean: true,
    isEnabled: true,
  },
  {
    featureKey: "PRIORITY_PROCESSING",
    nameFa: "اولویت پردازش",
    limit: null,
    period: "forever",
    used: 0,
    isBoolean: true,
    isEnabled: false,
  },
];

const mockExhaustedEntitlements: Entitlement[] = [
  {
    featureKey: "AI_CHAT_MESSAGE",
    nameFa: "پیام هوش مصنوعی",
    limit: 300,
    period: "month",
    used: 300,
    isBoolean: false,
    isEnabled: true,
  },
];

describe("checkFeature", () => {
  it("returns allowed for an active numeric feature with remaining quota", () => {
    const result = checkFeature("AI_CHAT_MESSAGE", mockActiveEntitlements);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(173); // 300 - 127
    expect(result.usageFraction).toBeCloseTo(127 / 300, 2);
  });

  it("returns allowed for enabled boolean feature", () => {
    const result = checkFeature("ADVANCED_REFERENCE", mockActiveEntitlements);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeNull();
    expect(result.usageFraction).toBeNull();
  });

  it("returns not allowed for disabled boolean feature", () => {
    const result = checkFeature("PRIORITY_PROCESSING", mockActiveEntitlements);
    expect(result.allowed).toBe(false);
    expect(result.entitlement.isEnabled).toBe(false);
    expect(result.suggestedUpgrade).toBe("pro_max");
  });

  it("returns not allowed for exhausted numeric feature", () => {
    const result = checkFeature("AI_CHAT_MESSAGE", mockExhaustedEntitlements);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.usageFraction).toBe(1);
    expect(result.reason).toContain("پر شده است");
  });

  it("returns not allowed for missing feature (not in entitlements)", () => {
    const result = checkFeature("NONEXISTENT_FEATURE", mockActiveEntitlements);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("در پلن فعلی شما در دسترس نیست");
    expect(result.suggestedUpgrade).toBe("pro");
  });
});

describe("checkFeatures", () => {
  it("returns a map with results for all requested features", () => {
    const results = checkFeatures(
      ["AI_CHAT_MESSAGE", "PRIORITY_PROCESSING"],
      mockActiveEntitlements
    );

    expect(results.size).toBe(2);
    expect(results.get("AI_CHAT_MESSAGE")?.allowed).toBe(true);
    expect(results.get("PRIORITY_PROCESSING")?.allowed).toBe(false);
  });
});

describe("hasActiveSubscription", () => {
  it("returns true for active subscription", () => {
    expect(hasActiveSubscription({ status: "active" })).toBe(true);
  });

  it("returns false for expired subscription", () => {
    expect(hasActiveSubscription({ status: "expired" })).toBe(false);
  });

  it("returns false for null/undefined subscription", () => {
    expect(hasActiveSubscription(null)).toBe(false);
    expect(hasActiveSubscription(undefined)).toBe(false);
  });

  it("returns false for cancelled subscription", () => {
    expect(hasActiveSubscription({ status: "cancelled" })).toBe(false);
  });
});

describe("getUpgradePlanForFeature", () => {
  it("suggests pro_max for PRIORITY_PROCESSING", () => {
    expect(getUpgradePlanForFeature("PRIORITY_PROCESSING")).toBe("pro_max");
  });

  it("suggests pro for regular features", () => {
    expect(getUpgradePlanForFeature("AI_CHAT_MESSAGE")).toBe("pro");
    expect(getUpgradePlanForFeature("DOCUMENT_ANALYSIS")).toBe("pro");
    expect(getUpgradePlanForFeature("NONEXISTENT")).toBe("pro");
  });
});
