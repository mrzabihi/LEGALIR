// ============================================================
// LEGALIR — Energy & token settlement, tariffs and reporting
// ============================================================
// Pins the acceptance contract for the «مصرف انرژی و توکن» work:
//
//   1. A successful operation records BOTH the real token figures and the
//      final energy, and marks the token figure honestly (ACTUAL / ESTIMATED /
//      UNAVAILABLE).
//   2. A service that never calls a model still records energy, with tokens
//      explicitly UNAVAILABLE.
//   3. A FREE tariff deducts zero energy — and is not blocked by an exhausted
//      balance (price is resolved before the entitlement check).
//   4. The chat tariff is configurable: first message 100, later messages 1/2/3
//      by message-index bands, with PER_MESSAGE vs PER_CONVERSATION basis.
//   5. A resent request never double-charges or double-records.
//   6. An error or cancellation releases the reservation in full.
//   7. Editing a tariff after a reservation cannot rewrite that charge.
//   8. The report keeps energy and tokens in separate aggregates and filters.
//   9. The per-subscription card matches the main report for the same rows.
//  10. Reading another user's data is refused by the permission model.
//
// `@/lib/db` is mocked with an in-memory table store so every test is
// deterministic and never touches the on-disk JSON DB.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- In-memory table store backing the mocked db ---
const tables = new Map<string, unknown[]>();

function table<T>(name: string): T[] {
  return (tables.get(name) ?? []) as T[];
}
function setTable(name: string, rows: unknown[]): void {
  tables.set(name, rows);
}

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
  nextTehranMidnight: () => "2026-10-19T20:30:00.000Z",
}));

let currentTehranDate = "2026-10-18";
vi.mock("@/lib/rewards", () => ({
  tehranDateString: () => currentTehranDate,
}));

import {
  reserveUsage,
  completeUsage,
  completeUsageByKey,
  releaseReservedByKey,
  reverseUsage,
  failUsage,
  getUsageSummary,
} from "../usage/engine";
import { readPlans, snapshotFor } from "../usage/plans";
import {
  saveCostProfile,
  saveCostRule,
  listCostProfiles,
  listTariffHistory,
} from "../usage/energy";
import { buildUsageReport, buildSubscriptionUsageCard } from "../usage/report";
import type { ServiceCostProfile, UsageTransaction } from "@legalir/types";
import { roleHasPermission } from "@legalir/types";

const USER = "user-1";
const OTHER_USER = "user-2";
const SUB_ID = "sub-gold";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function seedSubscription(planCode: "silver" | "gold" | "diamond" = "gold") {
  const plan = readPlans().find((p) => p.code === planCode)!;
  const rows = table<Record<string, unknown>>("subscriptions");
  rows.push({
    id: SUB_ID,
    user_id: USER,
    plan_code: plan.code,
    plan_name_fa: plan.nameFa,
    amount: plan.salePrice,
    currency: "IRT",
    status: "active",
    status_fa: "فعال",
    start_at: "2026-09-01T00:00:00.000Z",
    end_at: "2027-10-02T00:00:00.000Z",
    purchased_at: "2026-09-01T00:00:00.000Z",
    auto_renew: 0,
    plan_snapshot: snapshotFor(plan),
  });
  setTable("subscriptions", rows);
}

/** Enable a tariff for one activity in the real (mocked) store. */
function enableTariff(
  activity: ServiceCostProfile["activity"],
  patch: Partial<ServiceCostProfile>
): ServiceCostProfile {
  const seeded = listCostProfiles().find((p) => p.activity === activity)!;
  const saved = saveCostProfile({
    id: seeded.id,
    serviceKey: seeded.serviceKey,
    nameFa: seeded.nameFa,
    descriptionFa: seeded.descriptionFa,
    activity: seeded.activity,
    enabled: true,
    baseRequestCost: 0,
    inputTokenPer1k: 0,
    outputTokenPer1k: 0,
    contextTokenPer1k: 0,
    unitCosts: {},
    modelMultipliers: {},
    ...patch,
    updatedBy: "test-admin",
  });
  if ("error" in saved) throw new Error(saved.error);
  return saved;
}

function reserveChat(key: string, costContext: Record<string, unknown> = {}) {
  return reserveUsage({
    userId: USER,
    activity: "AI_MESSAGE",
    source: "chat",
    idempotencyKey: key,
    costContext,
  });
}

/** The real transaction row after a settle step. */
function txById(id: string): UsageTransaction {
  return table<UsageTransaction>("usage_transactions").find((t) => t.id === id)!;
}

const FIXED_NOW = new Date("2026-10-18T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  tables.clear();
  currentTehranDate = "2026-10-18";
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// 1. Success records real tokens AND the final energy
// ===========================================================================

describe("successful operation", () => {
  it("records the provider's real token figures and the settled energy", () => {
    seedSubscription("gold");
    enableTariff("AI_MESSAGE", {
      baseRequestCost: 100,
      inputTokenPer1k: 10,
      outputTokenPer1k: 20,
    });

    const reserved = reserveChat("chat:m1", { messageIndex: 1 });
    expect(reserved.ok).toBe(true);
    expect(reserved.transaction!.pointsCost).toBe(100);

    const done = completeUsage(reserved.transaction!.id, {
      inputTokens: 1_500,
      outputTokens: 500,
      tokens: 2_000,
      model: "gpt-4o",
      provider: "openai-compatible",
      tokenUsageStatus: "ACTUAL",
    })!;

    expect(done.status).toBe("COMPLETED");
    expect(done.inputTokens).toBe(1_500);
    expect(done.outputTokens).toBe(500);
    // 1.5K input @10 = 15 + 0.5K output @20 = 10 → 100 + 25 = 125
    expect(done.energyFinal).toBe(125);
    expect(done.tokenUsageStatus).toBe("ACTUAL");
    expect(done.provider).toBe("openai-compatible");
    expect(done.model).toBe("gpt-4o");
    expect(done.trackingId).toMatch(/^UT-/);

    // The extra 25 was debited from the same daily credit.
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(125);
  });

  it("labels an estimated token figure as ESTIMATED, never ACTUAL", () => {
    seedSubscription("gold");
    const reserved = reserveChat("chat:est", {});
    const done = completeUsage(reserved.transaction!.id, {
      inputTokens: 400,
      outputTokens: 100,
      tokens: 500,
      tokenUsageStatus: "ESTIMATED",
    })!;
    expect(done.tokenUsageStatus).toBe("ESTIMATED");
    expect(done.tokenUsageNoteFa).toMatch(/تخمین/);
  });

  it("defaults a settled row with no usable token figure to UNAVAILABLE", () => {
    seedSubscription("gold");
    const reserved = reserveChat("chat:none", {});
    const done = completeUsage(reserved.transaction!.id, {})!;
    expect(done.tokenUsageStatus).toBe("UNAVAILABLE");
    expect(done.tokenUsageNoteFa).toBeTruthy();
  });
});

// ===========================================================================
// 2. A token-free business action still records energy
// ===========================================================================

describe("business action without a model", () => {
  it("records energy for a document analysis and says tokens are unavailable", () => {
    seedSubscription("gold");
    const reserved = reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "document:doc-1",
      overridePoints: 1_000,
    });
    expect(reserved.ok).toBe(true);
    expect(reserved.transaction!.pointsCost).toBe(1_000);

    const done = completeUsageByKey("document:doc-1", {
      tokenUsageStatus: "UNAVAILABLE",
      tokenUsageNoteFa: "تحلیل ساختاری سند بدون فراخوانی مدل زبانی انجام شد.",
    })!;

    expect(done.status).toBe("COMPLETED");
    expect(done.energyFinal).toBe(1_000);
    expect(done.tokenUsageStatus).toBe("UNAVAILABLE");
    expect(done.inputTokens).toBe(0);
    expect(done.outputTokens).toBe(0);
  });
});

// ===========================================================================
// 3. Free action — zero energy, and never blocked by an empty balance
// ===========================================================================

describe("free actions", () => {
  it("charges zero energy for a FREE tariff while still recording the operation", () => {
    seedSubscription("gold");
    enableTariff("LEGAL_CALCULATION", { billingMode: "FREE", baseRequestCost: 1_000 });

    const r = reserveUsage({
      userId: USER,
      activity: "LEGAL_CALCULATION",
      source: "calculator",
      idempotencyKey: "calc:free-1",
      costContext: {},
    });
    expect(r.ok).toBe(true);
    expect(r.transaction!.pointsCost).toBe(0);
    expect(r.transaction!.energyFinal).toBe(0);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(0);
  });

  it("does not block a free action when the daily credit is exhausted", () => {
    seedSubscription("gold");
    enableTariff("LEGAL_CALCULATION", { billingMode: "FREE", baseRequestCost: 1_000 });

    // Exhaust the daily ENERGY budget (the engine stores `SubscriptionDailyUsage`
    // in camelCase). The request allowance is left intact so this asserts the
    // documented rule — a zero-cost action is never blocked by an empty balance
    // — rather than the separate daily-request cap.
    const bucket = table<Record<string, unknown>>("subscription_daily_usage");
    bucket.push({
      id: "sdu-exhausted",
      userId: USER,
      subscriptionId: SUB_ID,
      usageDate: currentTehranDate,
      requestLimit: 150,
      requestUsed: 0,
      pointsTotal: 15_000,
      pointsUsed: 15_000,
      createdAt: FIXED_NOW.toISOString(),
      updatedAt: FIXED_NOW.toISOString(),
    });
    setTable("subscription_daily_usage", bucket);

    const paid = reserveChat("chat:blocked");
    expect(paid.ok).toBe(false);
    expect(paid.code).toBe("DAILY_POINTS_EXCEEDED");

    const free = reserveUsage({
      userId: USER,
      activity: "LEGAL_CALCULATION",
      source: "calculator",
      idempotencyKey: "calc:free-2",
      costContext: {},
    });
    expect(free.ok).toBe(true);
    expect(free.transaction!.pointsCost).toBe(0);
  });
});

// ===========================================================================
// 4. Configurable chat tariff — the documented 100 / 1,2,3 example
// ===========================================================================

describe("configurable chat tariff", () => {
  function seedChatTariff(chargeBasis: "PER_MESSAGE" | "PER_CONVERSATION" = "PER_MESSAGE") {
    const profile = enableTariff("AI_MESSAGE", {
      baseRequestCost: 100,
      chargeBasis,
    });
    // Bands: first message 100 (base only), messages 2-5 +100, 6+ +200.
    saveCostRule({
      profileId: profile.id,
      activity: "AI_MESSAGE",
      labelFa: "پیام ۲ تا ۵",
      enabled: true,
      priority: 10,
      condition: "MESSAGE_INDEX_RANGE",
      min: 2,
      max: 5,
      models: [],
      addEnergy: 100,
      multiply: null,
    });
    saveCostRule({
      profileId: profile.id,
      activity: "AI_MESSAGE",
      labelFa: "پیام ۶ به بعد",
      enabled: true,
      priority: 20,
      condition: "MESSAGE_INDEX_RANGE",
      min: 6,
      max: null,
      models: [],
      addEnergy: 200,
      multiply: null,
    });
    return profile;
  }

  it("prices messages 1, 3 and 7 as 100, 200 and 300", () => {
    seedSubscription("gold");
    seedChatTariff();

    const first = reserveChat("c:1", { messageIndex: 1, firstInConversation: true });
    const third = reserveChat("c:3", { messageIndex: 3, firstInConversation: false });
    const seventh = reserveChat("c:7", { messageIndex: 7, firstInConversation: false });

    expect(first.transaction!.pointsCost).toBe(100);
    expect(third.transaction!.pointsCost).toBe(200);
    expect(seventh.transaction!.pointsCost).toBe(300);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(600);
  });

  it("charges nothing for a follow-up message under PER_CONVERSATION", () => {
    seedSubscription("gold");
    seedChatTariff("PER_CONVERSATION");

    const first = reserveChat("c:conv-1", { messageIndex: 1, firstInConversation: true });
    const followUp = reserveChat("c:conv-2", { messageIndex: 2, firstInConversation: false });

    expect(first.transaction!.pointsCost).toBe(100);
    expect(followUp.transaction!.pointsCost).toBe(0);
    expect(followUp.transaction!.tariffSnapshot!.chargeBasis).toBe("PER_CONVERSATION");
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);
  });
});

// ===========================================================================
// 5. Idempotency — resend never double-charges
// ===========================================================================

describe("idempotency", () => {
  it("returns the existing row for a repeated reservation with the same key", () => {
    seedSubscription("gold");
    const a = reserveChat("chat:same", { messageIndex: 1 });
    const b = reserveChat("chat:same", { messageIndex: 1 });

    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(true);
    expect(b.transaction!.id).toBe(a.transaction!.id);
    expect(table("usage_transactions")).toHaveLength(1);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);
  });

  it("makes a repeated completion a no-op", () => {
    seedSubscription("gold");
    const r = reserveChat("chat:twice", {});
    completeUsage(r.transaction!.id, { inputTokens: 1_000, tokens: 1_000 });
    completeUsage(r.transaction!.id, { inputTokens: 9_000, tokens: 9_000 });

    const row = txById(r.transaction!.id);
    expect(row.status).toBe("COMPLETED");
    expect(row.inputTokens).toBe(1_000); // the second call changed nothing
  });
});

// ===========================================================================
// 6. Error / cancel refunds the reservation
// ===========================================================================

describe("refund on error and cancel", () => {
  it("reverseUsage returns the full energy and the daily request", () => {
    seedSubscription("gold");
    const r = reserveChat("chat:cancel", {});
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);

    const reversed = reverseUsage(r.transaction!.id)!;
    expect(reversed.status).toBe("REVERSED");
    expect(reversed.energyFinal).toBe(0);
    expect(reversed.energyRefunded).toBe(100);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(0);
    expect(getUsageSummary(USER).daily.requestUsed).toBe(0);
  });

  it("failUsage refunds by default and can explicitly charge instead", () => {
    seedSubscription("gold");
    const refunded = reserveChat("chat:fail-1", {});
    failUsage(refunded.transaction!.id);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(0);

    const charged = reserveChat("chat:fail-2", {});
    const kept = failUsage(charged.transaction!.id, { refund: false })!;
    expect(kept.status).toBe("FAILED");
    expect(kept.energyFinal).toBe(100);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);
  });

  it("releaseReservedByKey releases a reservation but leaves a settled row alone", () => {
    seedSubscription("gold");
    reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "document:aborted",
      overridePoints: 1_000,
    });
    const released = releaseReservedByKey("document:aborted")!;
    expect(released.status).toBe("REVERSED");
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(0);

    const settled = reserveChat("chat:settled", {});
    completeUsage(settled.transaction!.id, {});
    const untouched = releaseReservedByKey("chat:settled")!;
    expect(untouched.status).toBe("COMPLETED");
  });
});

// ===========================================================================
// 7. Tariff edits never rewrite history
// ===========================================================================

describe("tariff immutability", () => {
  it("settles an in-flight reservation against the frozen version, not the new tariff", () => {
    seedSubscription("gold");
    const profile = enableTariff("AI_MESSAGE", { baseRequestCost: 100 });

    const r = reserveChat("chat:frozen", { messageIndex: 1 });
    expect(r.transaction!.tariffVersion).toBe(profile.version);

    // The operator triples the price AFTER the reservation.
    saveCostProfile({
      id: profile.id,
      serviceKey: profile.serviceKey,
      nameFa: profile.nameFa,
      descriptionFa: profile.descriptionFa,
      activity: profile.activity,
      enabled: true,
      baseRequestCost: 300,
      inputTokenPer1k: 0,
      outputTokenPer1k: 0,
      contextTokenPer1k: 0,
      unitCosts: {},
      modelMultipliers: {},
      updatedBy: "test-admin",
    });

    const done = completeUsage(r.transaction!.id, { inputTokens: 0, tokens: 0 })!;
    // The frozen snapshot (v1, base 100) still prices this request.
    expect(done.energyFinal).toBe(100);
    expect(getUsageSummary(USER).daily.pointsUsed).toBe(100);

    // A NEW reservation sees the new tariff.
    const next = reserveChat("chat:new-price", { messageIndex: 1 });
    expect(next.transaction!.pointsCost).toBe(300);
  });

  it("appends an immutable history row for every save", () => {
    const profile = enableTariff("AI_MESSAGE", { baseRequestCost: 100 });
    enableTariff("AI_MESSAGE", { baseRequestCost: 200 });

    const history = listTariffHistory(profile.id).filter((h) => h.entity === "PROFILE");
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]!.changedBy).toBe("test-admin");
    expect(history[0]!.changedAt).toBeTruthy();
  });
});

// ===========================================================================
// 8. Report — energy and tokens stay separate, filters work
// ===========================================================================

describe("usage report", () => {
  function seedMixedRows() {
    seedSubscription("gold");

    const a = reserveChat("r:1", { messageIndex: 1 });
    completeUsage(a.transaction!.id, {
      inputTokens: 1_000,
      outputTokens: 500,
      tokens: 1_500,
      tokenUsageStatus: "ACTUAL",
    });

    const b = reserveUsage({
      userId: USER,
      activity: "DOCUMENT_ANALYSIS",
      source: "document",
      idempotencyKey: "r:2",
      overridePoints: 1_000,
    });
    completeUsage(b.transaction!.id, {
      tokenUsageStatus: "UNAVAILABLE",
      tokenUsageNoteFa: "بدون فراخوانی مدل",
    });

    const c = reserveChat("r:3", {});
    reverseUsage(c.transaction!.id);

    // Another user's row must never appear.
    const others = table<UsageTransaction>("usage_transactions");
    others.push({
      ...txById(a.transaction!.id),
      id: "utx-other",
      userId: OTHER_USER,
      relatedEntityId: null,
    });
    setTable("usage_transactions", others);
  }

  it("keeps energy and token totals in separate fields", () => {
    seedMixedRows();
    const report = buildUsageReport(USER, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-31T00:00:00.000Z",
    });

    expect(report.totals.operations).toBe(3);
    expect(report.totals.energy).toBe(1_100); // 100 + 1,000 + 0 (reversed)
    expect(report.totals.energyReserved).toBe(1_200);
    expect(report.totals.energyRefunded).toBe(100);
    expect(report.totals.inputTokens).toBe(1_000);
    expect(report.totals.outputTokens).toBe(500);
    expect(report.totals.totalTokens).toBe(1_500);
    expect(report.totals.unavailableTokenOperations).toBe(2);
    expect(report.totals.refundedOperations).toBe(1);
    // Energy is never added to tokens.
    expect(report.totals.energy).not.toBe(report.totals.totalTokens);
  });

  it("filters by service, status and window, and isolates the user", () => {
    seedMixedRows();

    const docs = buildUsageReport(USER, { serviceKey: "document-analysis" });
    expect(docs.totals.operations).toBe(1);
    expect(docs.items[0]!.serviceNameFa).toBe("تحلیل سند");

    const refunded = buildUsageReport(USER, { status: "REVERSED" });
    expect(refunded.totals.operations).toBe(1);
    expect(refunded.items[0]!.settlement).toBe("REFUNDED");

    const outside = buildUsageReport(USER, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T00:00:00.000Z",
    });
    expect(outside.totals.operations).toBe(0);

    const other = buildUsageReport(OTHER_USER, {});
    expect(other.totals.operations).toBe(1);
    expect(other.items[0]!.id).toBe("utx-other");
  });

  it("labels a free row, a failed row and a charged row distinctly", () => {
    seedSubscription("gold");
    enableTariff("LEGAL_CALCULATION", { billingMode: "FREE" });

    const free = reserveUsage({
      userId: USER,
      activity: "LEGAL_CALCULATION",
      source: "calculator",
      idempotencyKey: "l:free",
      costContext: {},
    });
    completeUsage(free.transaction!.id, { tokenUsageStatus: "UNAVAILABLE" });

    const failed = reserveChat("l:failed", {});
    failUsage(failed.transaction!.id);

    const report = buildUsageReport(USER, {});
    const byTracking = Object.fromEntries(report.items.map((i) => [i.trackingId, i]));

    expect(byTracking[free.transaction!.trackingId!]!.settlement).toBe("FREE");
    expect(byTracking[failed.transaction!.trackingId!]!.settlement).toBe("FAILED");
    expect(report.totals.freeOperations).toBe(2); // both cost zero after the refund
  });
});

// ===========================================================================
// 9. Per-subscription card matches the main report
// ===========================================================================

describe("subscription usage card", () => {
  it("reports the same energy and tokens as the user's report", () => {
    seedSubscription("gold");

    const a = reserveChat("s:1", {});
    completeUsage(a.transaction!.id, {
      inputTokens: 800,
      outputTokens: 200,
      tokens: 1_000,
      tokenUsageStatus: "ACTUAL",
    });
    const b = reserveUsage({
      userId: USER,
      activity: "CONTRACT_DRAFT",
      source: "contract",
      idempotencyKey: "s:2",
      overridePoints: 1_000,
    });
    completeUsage(b.transaction!.id, { tokenUsageStatus: "UNAVAILABLE" });

    const card = buildSubscriptionUsageCard({
      id: SUB_ID,
      plan_name_fa: "طلایی",
      status: "active",
      start_at: "2026-09-01T00:00:00.000Z",
      end_at: "2027-10-02T00:00:00.000Z",
    });
    const report = buildUsageReport(USER, {
      subscriptionId: SUB_ID,
      from: "2026-09-01T00:00:00.000Z",
      to: "2027-10-03T00:00:00.000Z",
    });

    expect(card.energyUsed).toBe(report.totals.energy);
    expect(card.inputTokens).toBe(report.totals.inputTokens);
    expect(card.outputTokens).toBe(report.totals.outputTokens);
    expect(card.totalTokens).toBe(report.totals.totalTokens);
    expect(card.operations).toBe(report.totals.operations);

    // No quota is invented when the plan model defines none.
    expect(card.energyQuota).toBeNull();
    expect(card.energyRemaining).toBeNull();
  });
});

// ===========================================================================
// 10. Permission model — reading is gated, and a plain user is refused
// ===========================================================================

describe("permission model", () => {
  it("grants energy read to analysts but manage to administrators only", () => {
    expect(roleHasPermission("ANALYST", "admin:energy:read")).toBe(true);
    expect(roleHasPermission("ANALYST", "admin:energy:manage")).toBe(false);
    expect(roleHasPermission("SUPER_ADMIN", "admin:energy:read")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "admin:energy:manage")).toBe(true);
  });

  it("refuses a plain user any admin energy access", () => {
    expect(roleHasPermission("USER", "admin:energy:read")).toBe(false);
    expect(roleHasPermission("USER", "admin:energy:manage")).toBe(false);
  });
});
