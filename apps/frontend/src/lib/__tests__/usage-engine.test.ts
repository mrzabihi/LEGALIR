// ============================================================
// LEGALIR — Entitlement & Usage Engine tests
// ============================================================
// Pins the business rules the engine must never violate:
//
//   1. Plan matrix — each plan grants exactly its configured daily
//      requests / points and period quotas.
//   2. Daily credit resets at Tehran midnight and NEVER carries over.
//   3. Reward points are a SEPARATE asset — the daily rollover must not
//      touch them.
//   4. Service quotas are checked IN ADDITION to the daily credit.
//   5. Idempotency — a repeated reservation never double-charges.
//   6. Reverse refunds the daily credit and the period quota.
//   7. Expiry — an "active" row past its end_at grants no quota.
//
// `@/lib/db` is mocked with an in-memory table store so the tests are
// deterministic and independent of the on-disk JSON DB.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- In-memory table store backing the mocked db ---
const tables = new Map<string, unknown[]>();

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => tables.get(name) ?? [],
  writeTable: (name: string, data: unknown[]) => {
    tables.set(name, data);
  },
  getRewardBalance: (userId: string) => {
    const rows = (tables.get("reward_ledger") ?? []) as {
      user_id: string;
      points_delta: number;
    }[];
    return rows
      .filter((r) => r.user_id === userId)
      .reduce((sum, r) => sum + r.points_delta, 0);
  },
  spendRewardPoints: (params: {
    userId: string;
    points: number;
    sourceType: string;
    sourceId: string;
  }) => {
    const rows = (tables.get("reward_ledger") ?? []) as unknown[];
    rows.push({
      id: `rl-${rows.length}`,
      user_id: params.userId,
      event_type: "REQUEST_CONSUMED",
      points_delta: -params.points,
      source_type: params.sourceType,
      source_id: params.sourceId,
      idempotency_key: `reward-spend:${params.sourceType}:${params.sourceId}`,
      description: "",
      metadata: {},
      created_at: new Date().toISOString(),
    });
    tables.set("reward_ledger", rows);
    return { spent: true, points: params.points, balance: 0 };
  },
  nextTehranMidnight: () => "2026-09-21T20:30:00.000Z",
}));

// --- Tehran date is controllable so the midnight rollover can be tested ---
let currentTehranDate = "2026-09-20";
vi.mock("@/lib/rewards", () => ({
  tehranDateString: () => currentTehranDate,
}));

import {
  reserveUsage,
  completeUsage,
  reverseUsage,
  getUsageSummary,
  checkEntitlement,
  setPlatformSetting,
} from "../usage/engine";
import { readPlans, dailyPointsFor, snapshotFor } from "../usage/plans";

const USER = "user-1";

/** Seed an active subscription for USER with the given plan code. */
function seedSubscription(
  planCode: "silver" | "gold" | "diamond",
  opts: { endAt?: string; status?: string } = {}
) {
  const plan = readPlans().find((p) => p.code === planCode)!;
  const rows = (tables.get("subscriptions") ?? []) as unknown[];
  rows.push({
    id: `sub-${planCode}`,
    user_id: USER,
    plan_code: plan.code,
    plan_name_fa: plan.nameFa,
    amount: plan.salePrice,
    currency: "IRT",
    status: opts.status ?? "active",
    status_fa: "فعال",
    start_at: "2026-09-01T00:00:00.000Z",
    end_at: opts.endAt ?? "2026-10-02T00:00:00.000Z",
    purchased_at: "2026-09-01T00:00:00.000Z",
    auto_renew: 0,
    plan_snapshot: snapshotFor(plan),
  });
  tables.set("subscriptions", rows);
}

/** Grant reward points to USER via the ledger. */
function grantRewardPoints(points: number) {
  const rows = (tables.get("reward_ledger") ?? []) as unknown[];
  rows.push({
    id: `rl-grant-${rows.length}`,
    user_id: USER,
    event_type: "DAILY_VISIT",
    points_delta: points,
    source_type: "test",
    source_id: `grant-${rows.length}`,
    idempotency_key: `grant-${rows.length}`,
    description: "",
    metadata: {},
    created_at: new Date().toISOString(),
  });
  tables.set("reward_ledger", rows);
}

beforeEach(() => {
  tables.clear();
  currentTehranDate = "2026-09-20";
});

// ============================================================
// 1. Plan matrix
// ============================================================

describe("plan matrix", () => {
  it("seeds the three plans with the configured numbers", () => {
    const plans = readPlans();
    const byCode = Object.fromEntries(plans.map((p) => [p.code, p])) as Record<
      string,
      (typeof plans)[number]
    >;

    expect(byCode["silver"]).toMatchObject({
      dailyRequestLimit: 50,
      tokenLimit: 3_000_000,
      aiMessageLimit: 3_000,
      documentAnalysisLimit: 5,
      contractDraftLimit: 3,
      contractCreationLimit: 3,
      durationDays: 31,
    });
    expect(byCode["gold"]).toMatchObject({
      dailyRequestLimit: 150,
      tokenLimit: 4_500_000,
      aiMessageLimit: 4_500,
      documentAnalysisLimit: 15,
      contractDraftLimit: 10,
      contractCreationLimit: 10,
    });
    expect(byCode["diamond"]).toMatchObject({
      dailyRequestLimit: 300,
      tokenLimit: 9_000_000,
      aiMessageLimit: 9_000,
      documentAnalysisLimit: 50,
      contractDraftLimit: 30,
      contractCreationLimit: 30,
    });
  });

  it("derives daily points as requests × activity cost", () => {
    const plans = readPlans();
    const byCode = Object.fromEntries(plans.map((p) => [p.code, p])) as Record<
      string,
      (typeof plans)[number]
    >;
    expect(dailyPointsFor(byCode["silver"]!)).toBe(5_000);
    expect(dailyPointsFor(byCode["gold"]!)).toBe(15_000);
    expect(dailyPointsFor(byCode["diamond"]!)).toBe(30_000);
  });
});

// ============================================================
// 2. Daily credit
// ============================================================

describe("daily credit", () => {
  it("starts at the plan's full daily points", () => {
    seedSubscription("gold");
    const summary = getUsageSummary(USER);
    expect(summary.daily.pointsTotal).toBe(15_000);
    expect(summary.daily.pointsUsed).toBe(0);
    expect(summary.daily.pointsRemaining).toBe(15_000);
    expect(summary.daily.requestLimit).toBe(150);
  });

  it("debits points and one request per AI message", () => {
    seedSubscription("gold");
    const r = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });
    expect(r.ok).toBe(true);

    const summary = getUsageSummary(USER);
    expect(summary.daily.pointsUsed).toBe(100);
    expect(summary.daily.requestUsed).toBe(1);
    expect(summary.daily.requestsRemaining).toBe(149);
  });

  it("resets at Tehran midnight and does NOT carry over", () => {
    seedSubscription("gold");
    reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);

    // Roll the local day forward — a fresh bucket is created.
    currentTehranDate = "2026-09-21";
    const next = getUsageSummary(USER);
    expect(next.daily.pointsUsed).toBe(0);
    expect(next.daily.pointsRemaining).toBe(15_000);

    // The previous day's bucket is preserved for audit.
    const buckets = tables.get("subscription_daily_usage") as { usageDate: string }[];
    expect(buckets.some((b) => b.usageDate === "2026-09-20")).toBe(true);
    expect(buckets.some((b) => b.usageDate === "2026-09-21")).toBe(true);
  });

  it("blocks when the daily request allowance is exhausted", () => {
    seedSubscription("silver"); // 50 requests/day
    for (let i = 0; i < 50; i++) {
      const r = reserveUsage({
        userId: USER,
        activity: "AI_MESSAGE",
        source: "chat",
        idempotencyKey: `chat:m${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const blocked = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m-over",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("DAILY_REQUEST_LIMIT_EXCEEDED");
  });
});

// ============================================================
// 3. Reward points are a separate asset
// ============================================================

describe("reward points", () => {
  it("are NOT reset by the daily rollover", () => {
    seedSubscription("gold");
    grantRewardPoints(850);
    expect(getUsageSummary(USER).rewardPoints).toBe(850);

    currentTehranDate = "2026-09-21";
    expect(getUsageSummary(USER).rewardPoints).toBe(850);
  });

  it("are not spent while the daily credit still covers the activity", () => {
    seedSubscription("gold");
    grantRewardPoints(850);
    reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });
    // The daily credit paid — the reward wallet is untouched.
    expect(getUsageSummary(USER).rewardPoints).toBe(850);
  });

  it("are only used after the daily credit when the setting is enabled", () => {
    seedSubscription("silver"); // 5,000 daily points
    grantRewardPoints(850);

    // Exhaust the daily credit (50 requests × 100 = 5,000 points).
    for (let i = 0; i < 50; i++) {
      reserveUsage({
        userId: USER,
        activity: "AI_MESSAGE",
        source: "chat",
        idempotencyKey: `chat:m${i}`,
      });
    }

    // Default: reward points may NOT be spent after the limit.
    const blocked = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m-over",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("DAILY_REQUEST_LIMIT_EXCEEDED");

    // Enable the fallback — the same activity now draws on reward points.
    setPlatformSetting("allow_reward_points_after_subscription_limit", true);
    const allowed = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m-over-2",
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.transaction?.creditSource).toBe("REWARD");
    expect(getUsageSummary(USER).rewardPoints).toBe(750);
  });
});

// ============================================================
// 4. Service quotas are separate from the daily credit
// ============================================================

describe("service quotas", () => {
  it("blocks document analysis once the period quota is exhausted, even with daily credit left", () => {
    seedSubscription("silver"); // 5 document analyses per period
    for (let i = 0; i < 5; i++) {
      const r = reserveUsage({
        userId: USER,
        activity: "DOCUMENT_ANALYSIS",
        source: "document",
        idempotencyKey: `document:d${i}`,
      });
      expect(r.ok).toBe(true);
    }

    const blocked = reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "document:d-over",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("DOCUMENT_ANALYSIS_LIMIT_EXCEEDED");

    // The daily credit is still available — only the service quota is spent.
    const summary = getUsageSummary(USER);
    expect(summary.daily.requestsRemaining).toBeGreaterThan(0);
    const docQuota = summary.period.find((q) => q.quotaType === "DOCUMENT_ANALYSIS")!;
    expect(docQuota.used).toBe(5);
    expect(docQuota.remaining).toBe(0);
  });

  it("does NOT reset the period quota at midnight", () => {
    seedSubscription("silver");
    reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "document:d1",
    });

    currentTehranDate = "2026-09-21";
    const summary = getUsageSummary(USER);
    const docQuota = summary.period.find((q) => q.quotaType === "DOCUMENT_ANALYSIS")!;
    expect(docQuota.used).toBe(1); // unchanged by the daily rollover
  });

  it("enforces the contract creation quota", () => {
    seedSubscription("silver"); // 3 contracts
    for (let i = 0; i < 3; i++) {
      const r = reserveUsage({
        userId: USER,
        activity: "CONTRACT_CREATE",
        source: "contract",
        idempotencyKey: `contract:c${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const blocked = reserveUsage({
      userId: USER,
      activity: "CONTRACT_CREATE",
      source: "contract",
      idempotencyKey: "contract:c-over",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("CONTRACT_LIMIT_EXCEEDED");
  });
});

// ============================================================
// 5. Idempotency
// ============================================================

describe("idempotency", () => {
  it("never double-charges on a repeated idempotency key", () => {
    seedSubscription("gold");
    const first = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });
    const second = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.replayed).toBe(true);
    expect(second.transaction?.id).toBe(first.transaction?.id);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100); // charged once
  });
});

// ============================================================
// 6. Reverse
// ============================================================

describe("reverse", () => {
  it("refunds the daily credit and the period quota", () => {
    seedSubscription("gold");
    const r = reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "document:d1",
    });
    expect(r.ok).toBe(true);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);

    reverseUsage(r.transaction!.id);

    const summary = getUsageSummary(USER);
    expect(summary.daily.pointsUsed).toBe(0);
    expect(summary.daily.requestUsed).toBe(0);
    const docQuota = summary.period.find((q) => q.quotaType === "DOCUMENT_ANALYSIS")!;
    expect(docQuota.used).toBe(0);
  });

  it("records real token usage on completion", () => {
    seedSubscription("gold");
    const r = reserveUsage({
      userId: USER,
      activity: "AI_MESSAGE",
      source: "chat",
      idempotencyKey: "chat:m1",
    });
    completeUsage(r.transaction!.id, { tokens: 1_234 });

    const summary = getUsageSummary(USER);
    const tokenQuota = summary.period.find((q) => q.quotaType === "TOKENS")!;
    expect(tokenQuota.used).toBe(1_234);
  });
});

// ============================================================
// 7. Expiry & free tier
// ============================================================

describe("expiry", () => {
  it("grants no plan quota once the subscription has lapsed", () => {
    seedSubscription("gold", { endAt: "2026-09-10T00:00:00.000Z" }); // in the past
    const summary = getUsageSummary(USER);
    expect(summary.hasSubscription).toBe(false);
    expect(summary.subscriptionExpired).toBe(true);
    // Falls back to the free-tier daily allowance.
    expect(summary.daily.requestLimit).toBe(10);
  });

  it("reports no subscription for a user with none", () => {
    const summary = getUsageSummary(USER);
    expect(summary.hasSubscription).toBe(false);
    expect(summary.subscriptionExpired).toBe(false);
    expect(summary.planCode).toBeNull();
  });

  it("checkEntitlement reports the resolved credit source", () => {
    seedSubscription("gold");
    const check = checkEntitlement(USER, "AI_MESSAGE");
    expect(check.allowed).toBe(true);
    expect(check.creditSource).toBe("SUBSCRIPTION");
  });
});
