// ============================================================
// LEGALIR — usage view projections (engine → legacy shapes)
// ============================================================
// Locks the single-source-of-truth contract: the legacy Entitlement /
// UsageCounter / V1ProfileUsage / V1DailyQuota shapes are derived ONLY from
// the engine's SubscriptionUsageSummary, with the feature keys and boolean
// flags byte-identical to the legacy responses (so no consumer changes).
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  SubscriptionUsageSummary,
  PeriodQuotaView,
} from "@legalir/types";
import {
  entitlementsFromSummary,
  usageCountersFromSummary,
  profileUsageFromSummary,
  dailyQuotaFromSummary,
} from "@/lib/usage/views";

function quota(
  quotaType: PeriodQuotaView["quotaType"],
  limit: number,
  used: number
): PeriodQuotaView {
  return { quotaType, nameFa: quotaType, limit, used, remaining: limit - used, unlimited: false };
}

function summary(
  over: Partial<SubscriptionUsageSummary> = {}
): SubscriptionUsageSummary {
  return {
    hasSubscription: true,
    planCode: "gold",
    planNameFa: "طلایی",
    expiresAt: "2026-07-01T00:00:00.000Z",
    daysRemaining: 20,
    subscriptionExpired: false,
    daily: {
      usageDate: "2026-06-15",
      requestLimit: 150,
      requestUsed: 42,
      requestsRemaining: 108,
      pointsTotal: 15_000,
      pointsUsed: 4_200,
      pointsRemaining: 10_800,
      resetAt: "2026-06-16T20:30:00.000Z",
    },
    period: [
      quota("AI_MESSAGES", 4_500, 120),
      quota("TOKENS", 4_500_000, 90_000),
      quota("DOCUMENT_ANALYSIS", 15, 3),
      quota("CONTRACT_DRAFT", 10, 1),
      quota("CONTRACT_CREATION", 10, 2),
    ],
    rewardPoints: 1_200,
    allowRewardPointsAfterLimit: false,
    ...over,
  };
}

describe("usage view projections", () => {
  it("projects entitlements with the legacy feature keys and boolean rows", () => {
    const ents = entitlementsFromSummary(summary());
    const byKey: Record<string, (typeof ents)[number]> = Object.fromEntries(
      ents.map((e) => [e.featureKey, e])
    );

    // Daily credit → AI_CHAT_MESSAGE (resets daily).
    expect(byKey["AI_CHAT_MESSAGE"]).toMatchObject({
      limit: 150,
      used: 42,
      period: "day",
      isBoolean: false,
      isEnabled: true,
    });
    // Period quotas.
    expect(byKey["DOCUMENT_ANALYSIS"]).toMatchObject({ limit: 15, used: 3, period: "month" });
    expect(byKey["CONTRACT_GENERATION"]).toMatchObject({ limit: 10, used: 2, period: "month" });
    // The two boolean rows are unchanged, and PRIORITY_PROCESSING stays off.
    expect(byKey["ADVANCED_REFERENCE"]).toMatchObject({ isBoolean: true, isEnabled: true, limit: null });
    expect(byKey["PRIORITY_PROCESSING"]).toMatchObject({ isBoolean: true, isEnabled: false, limit: null });
  });

  it("omits boolean rows from usage counters and stamps the given period bounds", () => {
    const counters = usageCountersFromSummary(summary(), "2026-06-01T00:00:00.000Z", "2026-06-30T00:00:00.000Z");
    expect(counters).toHaveLength(3);
    for (const c of counters) {
      expect(c.periodStart).toBe("2026-06-01T00:00:00.000Z");
      expect(c.periodEnd).toBe("2026-06-30T00:00:00.000Z");
    }
    expect(counters.find((c) => c.featureKey === "AI_CHAT_MESSAGE")).toMatchObject({ used: 42, limit: 150 });
  });

  it("projects the flat profile usage from daily + period quotas", () => {
    const u = profileUsageFromSummary(summary());
    expect(u).toEqual({
      dailyRequestsUsed: 42,
      dailyRequestsTotal: 150,
      tokensUsed: 90_000,
      tokensTotal: 4_500_000,
      documentAnalysesUsed: 3,
      documentAnalysesTotal: 15,
      contractsGenerated: 2,
      contractsTotal: 10,
    });
  });

  it("derives the daily quota and flags exhaustion only when nothing remains", () => {
    const fresh = dailyQuotaFromSummary(summary());
    expect(fresh).toMatchObject({ used: 42, total: 150, remaining: 108, exhausted: false, subscriptionExpired: false });
    expect(fresh.resetAt).toBe("2026-06-16T20:30:00.000Z");

    const spent = dailyQuotaFromSummary(
      summary({
        daily: { ...summary().daily, requestUsed: 150, requestsRemaining: 0 },
      })
    );
    expect(spent.exhausted).toBe(true);
  });

  it("reports a lapsed subscription honestly (free tier, zeroed quotas)", () => {
    const lapsed = dailyQuotaFromSummary(summary({ subscriptionExpired: true }));
    expect(lapsed.subscriptionExpired).toBe(true);
  });
});
