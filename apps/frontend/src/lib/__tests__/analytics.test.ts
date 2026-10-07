// ============================================================
// LEGALIR — Analytics core (isolated temp DB)
// ============================================================
// Verifies the analytics reports against a SMALL, KNOWN dataset so every
// number is hand-checkable. Covers the mission's required scenarios:
//   • a day with no sales (zero-filled bucket)
//   • a user with no purchase (LRFM «بدون خرید»)
//   • a completed refund (net ≠ gross)
//   • an energy transaction that must be ignored (FAILED) / reversed
//   • an empty range
// Plus the LRFM scores/segments, repurchase avg+median, and the finance
// reconciliation against the orders model.
//
// `db.ts` resolves `.data` from `process.cwd()` at import time, so the analytics
// modules are dynamically imported AFTER chdir into a throwaway dir — the real
// dev database is never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as metricsModule from "../admin/analytics/metrics";
import type * as subsModule from "../admin/analytics/subscription-analytics";
import type * as energyModule from "../admin/analytics/energy-analytics";
import type * as custModule from "../admin/analytics/customer-analytics";
import type * as financeModule from "../admin/analytics/finance-analytics";

let db: typeof dbModule;
let metrics: typeof metricsModule;
let subs: typeof subsModule;
let energy: typeof energyModule;
let cust: typeof custModule;
let finance: typeof financeModule;
let tmpDir: string;
let originalCwd: string;

/** Fixed instant — no assertion depends on the wall clock (date-bomb safe). */
const NOW = new Date("2026-06-15T12:00:00.000Z");
const RANGE = { preset: "30d" as const, now: NOW };

// ---------------------------------------------------------------------------
// The known dataset
// ---------------------------------------------------------------------------

const PLAN = {
  id: "plan-test",
  code: "test",
  nameFa: "پلن آزمایشی",
  descriptionFa: "—",
  durationDays: 31,
  activityCostPoints: 5,
  dailyRequestLimit: 10, // → 50 points/day granted
  tokenLimit: 0,
  aiMessageLimit: 0,
  documentAnalysisLimit: 0,
  contractDraftLimit: 0,
  contractCreationLimit: 0,
  contractCreationUnlimited: false,
  listPrice: 5_000_000,
  salePrice: 3_000_000,
  currency: "IRT",
  features: [],
  isActive: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const USERS = [
  { id: "u1", mobile: "09121110001", email: null, displayName: "خریدار چندباره", role: "USER", platformAccountType: "PERSONAL", orgId: null, createdAt: "2025-01-01T00:00:00.000Z" },
  { id: "u2", mobile: "09121110002", email: null, displayName: "خریدار یک‌باره", role: "USER", platformAccountType: "PERSONAL", orgId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "u3", mobile: "09121110003", email: null, displayName: "بدون خرید", role: "USER", platformAccountType: "PERSONAL", orgId: null, createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "u4", mobile: "09121110004", email: null, displayName: "کارمند", role: "ANALYST", platformAccountType: "PERSONAL", orgId: null, createdAt: "2025-02-01T00:00:00.000Z" },
];

/** id, user, amount, purchased_at — 3 rows fall inside the 30d window. */
const SUB_SEED: [string, string, number, string][] = [
  ["s-u1-1", "u1", 3_000_000, "2025-12-01T10:00:00.000Z"],
  ["s-u1-2", "u1", 3_000_000, "2026-01-15T10:00:00.000Z"],
  ["s-u1-3", "u1", 3_000_000, "2026-05-20T10:00:00.000Z"], // in window
  ["s-u1-4", "u1", 3_000_000, "2026-06-12T10:00:00.000Z"], // in window
  ["s-u2-1", "u2", 2_000_000, "2026-06-12T09:00:00.000Z"], // in window (refunded)
];

function stubSub([id, userId, amount, purchased]: [string, string, number, string]) {
  return {
    id,
    user_id: userId,
    plan_code: "test",
    plan_name_fa: PLAN.nameFa,
    amount,
    currency: "IRT",
    status: "active",
    status_fa: "فعال",
    start_at: purchased,
    end_at: "2026-12-31T00:00:00.000Z",
    purchased_at: purchased,
    auto_renew: 0,
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-analytics-"));
  process.chdir(tmpDir);

  db = await import("../db");
  metrics = await import("../admin/analytics/metrics");
  subs = await import("../admin/analytics/subscription-analytics");
  energy = await import("../admin/analytics/energy-analytics");
  cust = await import("../admin/analytics/customer-analytics");
  finance = await import("../admin/analytics/finance-analytics");

  const w = <T>(name: string, rows: T[]) => db.writeTable(name, rows);

  w("subscription_plans", [PLAN]);
  w("users", USERS);
  w("subscriptions", SUB_SEED.map(stubSub));

  // One completed refund on u2's single order → net ≠ gross.
  w("financial_adjustments", [
    { id: "adj-1", orderId: "s-u2-1", kind: "refund_partial", amount: 500_000, currency: "IRT", status: "completed", createdAt: "2026-06-13T00:00:00.000Z", decidedAt: "2026-06-13T00:00:00.000Z" },
    { id: "adj-2", orderId: "s-u1-4", kind: "refund_partial", amount: 200_000, currency: "IRT", status: "pending", createdAt: "2026-06-14T00:00:00.000Z", decidedAt: null },
  ]);

  // Reward ledger: two grants + one REQUEST_CONSUMED mirror (skipped as a grant).
  w("reward_ledger", [
    { id: "r1", user_id: "u1", event_type: "PURCHASE_BONUS", points_delta: 1000, source_type: "system", source_id: "x", description: "", created_at: "2026-06-10T00:00:00.000Z" },
    { id: "r2", user_id: "u1", event_type: "REFERRAL", points_delta: 500, source_type: "system", source_id: "x", description: "", created_at: "2026-06-12T00:00:00.000Z" },
    { id: "r3", user_id: "u1", event_type: "REQUEST_CONSUMED", points_delta: -200, source_type: "usage", source_id: "t1", description: "", created_at: "2026-06-11T00:00:00.000Z" },
  ]);

  // Usage: one success, one FAILED (ignored), one REVERSED (subtracts).
  w("usage_transactions", [
    { id: "t1", userId: "u1", subscriptionId: "s-u1-4", activityType: "chat", pointsCost: 300, requestCost: 1, tokenCost: 0, status: "SUCCESS", source: "app", createdAt: "2026-06-12T00:00:00.000Z" },
    { id: "t2", userId: "u1", subscriptionId: "s-u1-4", activityType: "chat", pointsCost: 999, requestCost: 1, tokenCost: 0, status: "FAILED", source: "app", createdAt: "2026-06-12T01:00:00.000Z" },
    { id: "t3", userId: "u1", subscriptionId: "s-u1-4", activityType: "chat", pointsCost: 100, requestCost: 1, tokenCost: 0, status: "REVERSED", source: "app", createdAt: "2026-06-12T02:00:00.000Z" },
  ]);

  w("sessions", [
    { id: "sess1", userId: "u1", createdAt: "2026-06-13T00:00:00.000Z", expiresAt: "2026-06-20T00:00:00.000Z", lastActiveAt: "2026-06-13T00:00:00.000Z" },
  ]);

  // A STALE daily-usage day (not today) — must contribute 0 (the day resets).
  w("subscription_daily_usage", [
    { userId: "u1", subscriptionId: "s-u1-4", usageDate: "2026-06-12", pointsTotal: 50, pointsUsed: 10 },
  ]);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Report 1 — subscriptions (incl. a zero-sales day + empty range)
// ============================================================

describe("buildSubscriptionSalesReport", () => {
  it("counts only in-window purchases and nets out completed refunds", () => {
    const r = subs.buildSubscriptionSalesReport(RANGE);
    expect(r.totals.count.current).toBe(3); // s-u1-3, s-u1-4, s-u2-1
    expect(r.totals.gross.current).toBe(8_000_000);
    expect(r.totals.net.current).toBe(7_500_000); // 8M − 500k completed refund
  });

  it("zero-fills a day with no sales (empty-plans bucket)", () => {
    const r = subs.buildSubscriptionSalesReport(RANGE);
    const noSaleDay = r.daily.find((d) => d.date === "2026-06-01");
    expect(noSaleDay).toBeDefined();
    expect(noSaleDay!.plans).toHaveLength(0);
    const saleDay = r.daily.find((d) => d.date === "2026-06-12");
    expect(saleDay!.plans.length).toBeGreaterThan(0);
  });

  it("returns zero totals for an empty range, with no invented comparison", () => {
    const r = subs.buildSubscriptionSalesReport({
      preset: "custom",
      from: "2026-08-01",
      to: "2026-08-07",
      now: NOW,
    });
    expect(r.totals.count.current).toBe(0);
    expect(r.totals.gross.current).toBe(0);
    expect(r.totals.net.current).toBe(0);
    // Previous window is genuinely covered (data starts 2025-12), so prev = 0
    // and changePct is null (no honest % over a zero base).
    expect(r.totals.count.previous).toBe(0);
    expect(r.totals.count.changePct).toBeNull();
  });
});

// ============================================================
// Report 2 — energy (FAILED ignored, REVERSED refunds, expired unavailable)
// ============================================================

describe("buildEnergyReport", () => {
  it("ignores FAILED usage, refunds REVERSED, and never invents expired energy", () => {
    const r = energy.buildEnergyReport(RANGE);
    expect(r.consumed.current).toBe(200); // 300 − 100 (FAILED 999 excluded)
    expect(r.totals.expired).toBeNull(); // not derivable → unavailable, not 0
  });

  it("counts a stale daily-usage day as zero (the daily credit resets)", () => {
    const r = energy.buildEnergyReport(RANGE);
    // reward balance = 1000 + 500 − 200 = 1300; stale subscription day = 0.
    expect(r.totals.rewardBalance).toBe(1300);
    expect(r.totals.subscriptionBalance).toBe(0);
    expect(r.totals.currentBalance).toBe(1300);
  });

  it("lists users with an in-range energy signal, sorted by balance", () => {
    const page = energy.listEnergyUsers(RANGE, {});
    // u1 (reward balance 1300) then u2 (in-window grant, balance 0).
    expect(page.items.map((i) => i.userId)).toEqual(["u1", "u2"]);
    expect(page.items[0]!.balance).toBe(1300);
    expect(page.items[0]!.consumed).toBe(200);
    expect(page.items[1]!.granted).toBe(50); // one in-window subscription grant
  });
});

// ============================================================
// Report 4 — LRFM (scores, segments, repurchase, new vs returning)
// ============================================================

describe("buildCustomerAnalytics", () => {
  it("excludes staff from the cohort but keeps every customer", () => {
    const r = cust.buildCustomerAnalytics(RANGE);
    expect(r.cohortSize).toBe(3); // u1, u2, u3 — u4 (ANALYST) excluded
    expect(r.buyerCount).toBe(2);
  });

  it("places a user with no purchase in the explicit no_purchase bucket", () => {
    const rows = cust.listLrfmRows(RANGE);
    const u3 = rows.find((x) => x.userId === "u3")!;
    expect(u3.f).toBe(0);
    expect(u3.segment).toBe("no_purchase");
    expect(u3.mScore).toBeNull(); // unscored, never a fake 0-buyer score
    expect(u3.isNew).toBe(false);
  });

  it("scores a multi-buyer as champions and a single-buyer as potential_loyalist", () => {
    const rows = cust.listLrfmRows(RANGE);
    const u1 = rows.find((x) => x.userId === "u1")!;
    expect([u1.rScore, u1.fScore, u1.mScore]).toEqual([5, 4, 4]);
    expect(u1.segment).toBe("champions");

    const u2 = rows.find((x) => x.userId === "u2")!;
    expect(u2.f).toBe(1);
    expect(u2.m).toBe(1_500_000); // net of the 500k refund
    expect(u2.segment).toBe("potential_loyalist");
    expect(u2.isNew).toBe(true);
  });

  it("reports average AND median repurchase interval, excluding single buyers", () => {
    const r = cust.buildCustomerAnalytics(RANGE);
    // u1 gaps: 45, 125, 23 days → avg 64.3, median 45.
    expect(r.repurchaseAvgDays).toBe(64.3);
    expect(r.repurchaseMedianDays).toBe(45);
    expect(r.singlePurchaseBuyers).toBe(1);
    expect(r.newVsReturning).toEqual({ newCount: 1, returningCount: 1 });
  });

  it("computes realized LTV only from real net revenue", () => {
    const r = cust.buildCustomerAnalytics(RANGE);
    expect(r.realizedLtv).toBe(6_750_000); // (12M + 1.5M) / 2
  });
});

// ============================================================
// Report 3 — ranking (window-scoped, net of refunds)
// ============================================================

describe("listPurchaseRanking", () => {
  it("ranks buyers by net within the window", () => {
    const page = cust.listPurchaseRanking(RANGE, {});
    expect(page.total).toBe(2);
    expect(page.items[0]!.userId).toBe("u1");
    expect(page.items[0]!.net).toBe(6_000_000); // 3M + 3M in-window
    expect(page.items.find((i) => i.userId === "u2")!.net).toBe(1_500_000);
  });

  it("excludes a user with no in-window purchase", () => {
    const page = cust.listPurchaseRanking(RANGE, {});
    expect(page.items.find((i) => i.userId === "u3")).toBeUndefined();
  });
});

// ============================================================
// Finance — reconcile against the orders model
// ============================================================

describe("buildFinanceAnalytics", () => {
  it("nets refunds and reconciles against the orders model exactly", () => {
    const r = finance.buildFinanceAnalytics(RANGE);
    expect(r.gross).toBe(8_000_000);
    expect(r.refunds).toBe(500_000);
    expect(r.net).toBe(7_500_000);
    expect(r.ordersNet).toBe(7_500_000);
    expect(r.reconcile.matches).toBe(true);
  });

  it("separates pending refunds (a liability) from settled ones", () => {
    const r = finance.buildFinanceAnalytics(RANGE);
    expect(r.refundPendingCount).toBe(1);
    expect(r.refundPendingAmount).toBe(200_000);
  });
});

// ============================================================
// Overview — KPI wiring
// ============================================================

describe("buildAnalyticsOverview", () => {
  it("reports real KPIs and no fabricated AI-error metric", () => {
    const r = metrics.buildAnalyticsOverview(RANGE);
    const byKey = new Map(r.kpis.map((k) => [k.key, k]));
    expect(byKey.get("sales_count")!.value).toBe(3);
    expect(byKey.get("gross_revenue")!.value).toBe(8_000_000);
    expect(byKey.get("net_revenue")!.value).toBe(7_500_000);
    const aiErr = byKey.get("ai_error_rate")!;
    expect(aiErr.unavailable).toBe(true);
    expect(aiErr.value).toBe(0);
  });
});
