// ============================================================
// LEGALIR — Energy spend ledger (runtime, isolated temp DB)
// ============================================================
// `db.ts` resolves its store from `process.cwd()/.data` at import time,
// so we chdir into a throwaway directory *before* the dynamic import to
// keep the real dev database untouched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Db = typeof import("../db");

let db: Db;
let tmpDir: string;
let originalCwd: string;

const USER = "user-energy-test";

/** Give the user a starting balance so spends have something to draw on. */
function grant(userId: string, points: number, key: string) {
  db.grantReward({
    userId,
    eventType: "DAILY_VISIT",
    idempotencyKey: key,
    sourceType: "daily_visit",
    sourceId: key,
    description: "امتیاز حضور روزانه",
    uniqueKey: key,
  });
  // DAILY_VISIT is fixed at +100; top up the remainder directly for the test.
  const delta = points - 100;
  if (delta !== 0) {
    const rows = db.readTable<import("../db").RewardLedgerEntry>("reward_ledger");
    rows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: "PROFILE_COMPLETED",
      points_delta: delta,
      source_type: "test",
      source_id: key,
      idempotency_key: `test-topup:${key}`,
      description: "test top-up",
      metadata: {},
      created_at: new Date().toISOString(),
    });
    db.writeTable("reward_ledger", rows);
  }
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-energy-"));
  process.chdir(tmpDir);
  db = await import("../db");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("spendEnergy — 200 energy per processed request", () => {
  it("deducts 200 from the balance and returns the new balance", () => {
    grant(USER, 1000, "seed-1");
    expect(db.getRewardBalance(USER)).toBe(1000);

    const result = db.spendEnergy({
      userId: USER,
      sourceType: "chat",
      sourceId: "msg-1",
    });

    expect(result.spent).toBe(true);
    expect(result.points).toBe(-200);
    expect(result.balance).toBe(800);
    expect(db.getRewardBalance(USER)).toBe(800);
  });

  it("is idempotent per (sourceType, sourceId) — a retry never double-charges", () => {
    const retry = db.spendEnergy({
      userId: USER,
      sourceType: "chat",
      sourceId: "msg-1",
    });

    expect(retry.spent).toBe(false);
    expect(retry.reason).toBe("duplicate");
    expect(retry.points).toBe(0);
    expect(db.getRewardBalance(USER)).toBe(800);
  });

  it("charges each distinct action independently", () => {
    db.spendEnergy({ userId: USER, sourceType: "document", sourceId: "doc-1" });
    db.spendEnergy({ userId: USER, sourceType: "contract", sourceId: "con-1" });

    expect(db.getRewardBalance(USER)).toBe(400);
  });

  it("records the spend as a REQUEST_CONSUMED ledger entry", () => {
    const entry = db
      .readRewardLedger(USER)
      .find((e) => e.idempotency_key === "energy:document:doc-1");

    expect(entry?.event_type).toBe("REQUEST_CONSUMED");
    expect(entry?.points_delta).toBe(-200);
    expect(entry?.source_type).toBe("document");
    expect(entry?.source_id).toBe("doc-1");
  });

  it("never lets the balance go negative (soft floor)", () => {
    // Balance is 400; two more spends (400) are affordable, the third is not.
    db.spendEnergy({ userId: USER, sourceType: "chat", sourceId: "msg-2" });
    db.spendEnergy({ userId: USER, sourceType: "chat", sourceId: "msg-3" });
    expect(db.getRewardBalance(USER)).toBe(0);

    const blocked = db.spendEnergy({ userId: USER, sourceType: "chat", sourceId: "msg-4" });
    expect(blocked.spent).toBe(false);
    expect(blocked.reason).toBe("insufficient_balance");
    expect(blocked.balance).toBe(0);
    expect(db.getRewardBalance(USER)).toBe(0);
  });

  it("keeps the balance as the running sum of awards and spends", () => {
    grant(USER, 500, "seed-2");
    // 0 + 500 = 500
    expect(db.getRewardBalance(USER)).toBe(500);
  });
});

describe("getPointsAccount — ledger aggregates", () => {
  it("derives balance, lifetime earned and lifetime spent from the ledger", () => {
    const account = db.getPointsAccount(USER);
    // Earned: 1000 (seed-1) + 500 (seed-2) = 1500
    // Spent: 200 × 5 successful spends = 1000
    expect(account.lifetimeEarned).toBe(1500);
    expect(account.lifetimeSpent).toBe(1000);
    expect(account.balance).toBe(500);
    expect(account.balance).toBe(account.lifetimeEarned - account.lifetimeSpent);
  });

  it("canSpendPoints reflects the current balance", () => {
    expect(db.canSpendPoints(USER, 500)).toBe(true);
    expect(db.canSpendPoints(USER, 501)).toBe(false);
  });
});
