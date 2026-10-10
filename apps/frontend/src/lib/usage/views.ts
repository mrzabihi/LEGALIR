// ============================================================
// LEGALIR — Legacy view projections over the usage engine
// ============================================================
// Several long-lived surfaces (the subscription page, settings, the profile
// and the dashboard hero card) read three shapes that predate the usage
// engine: `Entitlement[]`, `UsageCounter[]`, and the flat `V1ProfileUsage`.
//
// Historically those routes derived every number from `usage_stats`, a table
// that is only ever written by `consumeDailyRequest` — which has no production
// caller. The counters were therefore frozen while real consumption landed in
// the engine (`usage_transactions` / `subscription_daily_usage`).
//
// These pure mappers re-project the engine's canonical `SubscriptionUsageSummary`
// into the legacy shapes so every surface reads ONE source of truth. They take
// the summary as input (no DB access) and are therefore trivially testable.
// Feature keys, labels and boolean flags are kept byte-identical to the legacy
// values so no consumer needs to change.
// ============================================================

import type {
  Entitlement,
  UsageCounter,
  V1ProfileUsage,
  V1DailyQuota,
  SubscriptionUsageSummary,
} from "@legalir/types";

/** Boolean capability rows — unchanged from the legacy response. */
const BOOLEAN_ENTITLEMENTS: Entitlement[] = [
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

/**
 * Project the engine summary into the `Entitlement[]` the subscription page
 * and the settings benefits list render.
 *
 * - AI_CHAT_MESSAGE  → today's subscription credit (resets at Tehran midnight).
 * - DOCUMENT_ANALYSIS→ the period-scoped document-analysis quota.
 * - CONTRACT_GENERATION → the period-scoped contract-creation quota.
 */
export function entitlementsFromSummary(
  summary: SubscriptionUsageSummary
): Entitlement[] {
  const doc = summary.period.find((p) => p.quotaType === "DOCUMENT_ANALYSIS");
  const contract = summary.period.find((p) => p.quotaType === "CONTRACT_CREATION");

  return [
    {
      featureKey: "AI_CHAT_MESSAGE",
      nameFa: "پیام هوش مصنوعی",
      limit: summary.daily.requestLimit,
      period: "day",
      used: summary.daily.requestUsed,
      isBoolean: false,
      isEnabled: true,
    },
    {
      featureKey: "DOCUMENT_ANALYSIS",
      nameFa: "تحلیل سند",
      limit: doc?.limit ?? 0,
      period: "month",
      used: doc?.used ?? 0,
      isBoolean: false,
      isEnabled: true,
    },
    {
      featureKey: "CONTRACT_GENERATION",
      nameFa: "ایجاد قرارداد",
      limit: contract?.limit ?? 0,
      period: "month",
      used: contract?.used ?? 0,
      isBoolean: false,
      isEnabled: true,
    },
    ...BOOLEAN_ENTITLEMENTS,
  ];
}

/** The numeric counters only, as `UsageCounter[]` for `GET /api/v1/usage`. */
export function usageCountersFromSummary(
  summary: SubscriptionUsageSummary,
  periodStart: string,
  periodEnd: string
): UsageCounter[] {
  return entitlementsFromSummary(summary)
    .filter((e) => !e.isBoolean)
    .map((e) => ({
      featureKey: e.featureKey,
      periodStart,
      periodEnd,
      used: e.used,
      limit: e.limit,
    }));
}

/** The flat profile-usage shape read by the profile page. */
export function profileUsageFromSummary(
  summary: SubscriptionUsageSummary
): V1ProfileUsage {
  const tokens = summary.period.find((p) => p.quotaType === "TOKENS");
  const doc = summary.period.find((p) => p.quotaType === "DOCUMENT_ANALYSIS");
  const contract = summary.period.find((p) => p.quotaType === "CONTRACT_CREATION");

  return {
    dailyRequestsUsed: summary.daily.requestUsed,
    dailyRequestsTotal: summary.daily.requestLimit,
    tokensUsed: tokens?.used ?? 0,
    tokensTotal: tokens?.limit ?? 0,
    documentAnalysesUsed: doc?.used ?? 0,
    documentAnalysesTotal: doc?.limit ?? 0,
    contractsGenerated: contract?.used ?? 0,
    contractsTotal: contract?.limit ?? 0,
  };
}

/** The daily-quota shape read by the chat sidebar and the dashboard hero card. */
export function dailyQuotaFromSummary(
  summary: SubscriptionUsageSummary
): V1DailyQuota {
  const d = summary.daily;
  return {
    used: d.requestUsed,
    total: d.requestLimit,
    remaining: d.requestsRemaining,
    resetAt: d.resetAt,
    exhausted: d.requestsRemaining <= 0,
    subscriptionExpired: summary.subscriptionExpired,
  };
}
