// ============================================================
// LEGALIR — Unified Energy Ledger projection (isolated temp DB)
// ============================================================
// `getEnergyLedger` is a READ-TIME projection over three real sources:
//   subscriptions → SUBSCRIPTION_GRANT, reward_ledger → reward movements,
//   usage_transactions → USAGE / REFUND.
// These tests lock in: per-source running balances, the strict separation of
// the two assets (§19), and the REQUEST_CONSUMED skip that prevents a single
// consumption from appearing twice.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as ledgerModule from "../energy/ledger";
import type { RewardLedgerEntry } from "../db";
import type { UsageTransaction, PlanEntitlementSnapshot } from "@legalir/types";

type Db = typeof dbModule;
type Ledger = typeof ledgerModule;

let db: Db;
let ledger: Ledger;
let tmpDir: string;
let originalCwd: string;

const DAY = 86_400_000;
const REAL_NOW = Date.now();

/** ISO string `n` days before now. */
function ago(days: number): string {
  return new Date(REAL_NOW - days * DAY).toISOString();
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-ledger-"));
  process.chdir(tmpDir);
  db = await import("../db");
  ledger = await import("../energy/ledger");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let seq = 0;
function user(): string {
  seq += 1;
  return `user-ledger-${seq}`;
}

const GOLD_SNAPSHOT: PlanEntitlementSnapshot = {
  dailyRequestLimit: 150,
  activityCostPoints: 100,
  tokenLimit: 4_500_000,
  aiMessageLimit: 4_500,
  documentAnalysisLimit: 15,
  contractDraftLimit: 10,
  contractCreationLimit: 10,
};

/** Seed an ACTIVE subscription (so entitlement resolves) with a known term. */
function seedSubscription(userId: string, snapshot: PlanEntitlementSnapshot): string {
  const id = `sub-${crypto.randomUUID()}`;
  const rows = db.readTable<Record<string, unknown>>("subscriptions");
  rows.push({
    id,
    user_id: userId,
    plan_code: "gold",
    plan_name_fa: "طلا",
    amount: 3_500_000,
    currency: "IRT",
    status: "active",
    status_fa: "فعال",
    start_at: ago(10),
    end_at: new Date(REAL_NOW + 21 * DAY).toISOString(),
    purchased_at: ago(10),
    auto_renew: 1,
    plan_snapshot: snapshot,
    payment_id: null,
  });
  db.writeTable("subscriptions", rows);
  return id;
}

function seedReward(userId: string, eventType: RewardLedgerEntry["event_type"], delta: number, at: string) {
  const rows = db.readTable<RewardLedgerEntry>("reward_ledger");
  rows.push({
    id: `rl-${crypto.randomUUID()}`,
    user_id: userId,
    event_type: eventType,
    points_delta: delta,
    source_type: "test",
    source_id: crypto.randomUUID(),
    idempotency_key: `test:${crypto.randomUUID()}`,
    description: "test movement",
    metadata: {},
    created_at: at,
  });
  db.writeTable("reward_ledger", rows);
}

function seedUsage(
  userId: string,
  subscriptionId: string | null,
  params: {
    pointsCost: number;
    creditSource: UsageTransaction["creditSource"];
    status: UsageTransaction["status"];
    at: string;
  }
): string {
  const id = `ut-${crypto.randomUUID()}`;
  const rows = db.readTable<UsageTransaction>("usage_transactions");
  rows.push({
    id,
    userId,
    subscriptionId,
    activityType: "AI_MESSAGE",
    pointsCost: params.pointsCost,
    requestCost: 1,
    tokenCost: 100,
    serviceQuotaType: "AI_MESSAGES",
    serviceQuotaCost: 1,
    creditSource: params.creditSource,
    source: "chat",
    relatedEntityId: "msg-1",
    status: params.status,
    idempotencyKey: `ut:${crypto.randomUUID()}`,
    createdAt: params.at,
    updatedAt: params.at,
  });
  db.writeTable("usage_transactions", rows);
  return id;
}

// ============================================================
// Per-source running balances
// ============================================================

describe("getEnergyLedger — running balances", () => {
  it("computes balanceBefore/balanceAfter per source, walking time order", () => {
    const u = user();
    const subId = seedSubscription(u, GOLD_SNAPSHOT);

    seedReward(u, "DAILY_VISIT", 100, ago(9));
    seedUsage(u, subId, { pointsCost: 200, creditSource: "SUBSCRIPTION", status: "COMPLETED", at: ago(8) });
    seedUsage(u, subId, { pointsCost: 200, creditSource: "SUBSCRIPTION", status: "REVERSED", at: ago(7) });
    seedReward(u, "DAILY_VISIT", 100, ago(5));

    const { entries, summary } = ledger.getEnergyLedger(u);

    // SUBSCRIPTION stream: grant 15000 (0→15000), usage -200 (15000→14800),
    // refund +200 (14800→15000).
    const grant = entries.find((e) => e.type === "SUBSCRIPTION_GRANT")!;
    expect(grant.source).toBe("SUBSCRIPTION");
    expect(grant.amount).toBe(15_000);
    expect(grant.balanceBefore).toBe(0);
    expect(grant.balanceAfter).toBe(15_000);
    expect(grant.subscriptionId).toBe(subId);

    const usage = entries.find((e) => e.type === "USAGE")!;
    expect(usage.source).toBe("SUBSCRIPTION");
    expect(usage.amount).toBe(-200);
    expect(usage.balanceBefore).toBe(15_000);
    expect(usage.balanceAfter).toBe(14_800);

    const refund = entries.find((e) => e.type === "REFUND")!;
    expect(refund.source).toBe("SUBSCRIPTION");
    expect(refund.amount).toBe(200);
    expect(refund.balanceBefore).toBe(14_800);
    expect(refund.balanceAfter).toBe(15_000);

    // REWARD stream is independent: 0→100 then 100→200.
    const rewards = entries
      .filter((e) => e.source === "REWARD")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(rewards).toHaveLength(2);
    expect(rewards[0]!.balanceBefore).toBe(0);
    expect(rewards[0]!.balanceAfter).toBe(100);
    expect(rewards[1]!.balanceBefore).toBe(100);
    expect(rewards[1]!.balanceAfter).toBe(200);
    expect(rewards[0]!.subscriptionId).toBeNull();

    // Lifetimes aggregate across both sources.
    expect(summary.lifetimeEarned).toBe(15_000 + 200 + 100 + 100);
    expect(summary.lifetimeSpent).toBe(200);
    expect(summary.entryCount).toBe(entries.length);
  });

  it("returns entries newest-first", () => {
    const u = user();
    const subId = seedSubscription(u, GOLD_SNAPSHOT);
    seedUsage(u, subId, { pointsCost: 200, creditSource: "SUBSCRIPTION", status: "COMPLETED", at: ago(3) });
    seedReward(u, "DAILY_VISIT", 100, ago(1));

    const { entries } = ledger.getEnergyLedger(u);
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i - 1]!.createdAt >= entries[i]!.createdAt).toBe(true);
    }
  });
});

// ============================================================
// The two assets stay separate
// ============================================================

describe("getEnergyLedger — subscription energy ≠ reward energy", () => {
  it("attributes reward-source consumption to the REWARD stream", () => {
    const u = user();
    seedReward(u, "DAILY_VISIT", 500, ago(6));
    // The engine mirrors a reward-wallet spend into a REQUEST_CONSUMED row AND a
    // usage transaction. The projection SKIPS the former but the balance counts it.
    seedReward(u, "REQUEST_CONSUMED", -200, ago(4));
    seedUsage(u, null, { pointsCost: 200, creditSource: "REWARD", status: "COMPLETED", at: ago(4) });

    const { entries, summary } = ledger.getEnergyLedger(u);

    const usage = entries.find((e) => e.type === "USAGE")!;
    expect(usage.source).toBe("REWARD");
    expect(usage.amount).toBe(-200);
    expect(usage.balanceBefore).toBe(500);
    expect(usage.balanceAfter).toBe(300);

    // Subscription summary stays untouched — no subscription exists.
    expect(summary.rewardBalance).toBe(300);
    expect(summary.subscriptionGrantedToday).toBeGreaterThanOrEqual(0);
  });

  it("skips REQUEST_CONSUMED reward rows (consumption lives in usage_transactions)", () => {
    const u = user();
    seedReward(u, "DAILY_VISIT", 300, ago(3));
    seedReward(u, "REQUEST_CONSUMED", -200, ago(2));

    const { entries, summary } = ledger.getEnergyLedger(u);

    // Only the award is projected as a ledger entry…
    const rewardEntries = entries.filter((e) => e.source === "REWARD");
    expect(rewardEntries).toHaveLength(1);
    expect(rewardEntries[0]!.type).toBe("DAILY_REWARD");
    expect(rewardEntries[0]!.amount).toBe(300);

    // …but the reward BALANCE still reflects every movement (300 − 200).
    expect(summary.rewardBalance).toBe(100);
  });

  it("ignores FAILED usage transactions (nothing was charged)", () => {
    const u = user();
    const subId = seedSubscription(u, GOLD_SNAPSHOT);
    seedUsage(u, subId, { pointsCost: 200, creditSource: "SUBSCRIPTION", status: "FAILED", at: ago(2) });

    const { entries } = ledger.getEnergyLedger(u);
    expect(entries.filter((e) => e.type === "USAGE")).toHaveLength(0);
  });
});

// ============================================================
// Summary
// ============================================================

describe("getEnergyLedger — summary", () => {
  it("reports daily subscription credit and persistent reward balance", () => {
    const u = user();
    seedSubscription(u, GOLD_SNAPSHOT);
    seedReward(u, "DAILY_VISIT", 250, ago(1));

    const { summary } = ledger.getEnergyLedger(u);

    // Gold grants 150 requests × 100 = 15,000 points/day.
    expect(summary.subscriptionGrantedToday).toBe(15_000);
    expect(summary.subscriptionRemaining).toBe(15_000);
    expect(summary.subscriptionUsedToday).toBe(0);
    expect(summary.rewardBalance).toBe(250);
  });
});
