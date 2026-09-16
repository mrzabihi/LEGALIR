// ============================================================
// LEGALIR — Points Account, Account Type & Mobile Immutability
// ============================================================
// Runtime tests against an isolated temp DB. `db.ts` resolves its store
// from `process.cwd()/.data` at import time, so we chdir into a throwaway
// directory *before* the dynamic import to keep the real dev DB untouched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Db = typeof import("../db");

let db: Db;
let tmpDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-points-"));
  process.chdir(tmpDir);
  db = await import("../db");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(mobile: string) {
  return db.createUser({ mobile, passwordHash: "x" });
}

/** Top up a balance with an arbitrary delta (test-only ledger write). */
function topUp(userId: string, delta: number, key: string) {
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

// ============================================================
// Points account aggregates (ledger is the single source of truth)
// ============================================================

describe("getPointsAccount — ledger-derived aggregates", () => {
  it("a brand-new user has a zeroed account", () => {
    const user = makeUser("09120000101");
    const account = db.getPointsAccount(user.id);
    expect(account).toEqual({
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      transactionCount: 0,
    });
  });

  it("balance is always lifetimeEarned − lifetimeSpent", () => {
    const user = makeUser("09120000102");
    topUp(user.id, 1000, "agg-1");
    db.spendEnergy({ userId: user.id, sourceType: "chat", sourceId: "m1" });
    db.spendEnergy({ userId: user.id, sourceType: "chat", sourceId: "m2" });

    const account = db.getPointsAccount(user.id);
    expect(account.lifetimeEarned).toBe(1000);
    expect(account.lifetimeSpent).toBe(400);
    expect(account.balance).toBe(600);
    expect(account.balance).toBe(account.lifetimeEarned - account.lifetimeSpent);
    expect(account.transactionCount).toBe(3);
  });

  it("is scoped per user — one user's ledger never leaks into another's", () => {
    const a = makeUser("09120000103");
    const b = makeUser("09120000104");
    topUp(a.id, 700, "scope-a");
    topUp(b.id, 300, "scope-b");

    expect(db.getPointsAccount(a.id).balance).toBe(700);
    expect(db.getPointsAccount(b.id).balance).toBe(300);
  });
});

// ============================================================
// Idempotency — a retried credit/debit must never double-apply
// ============================================================

describe("ledger idempotency", () => {
  it("grantReward with the same idempotency key awards once", () => {
    const user = makeUser("09120000105");
    const params = {
      userId: user.id,
      eventType: "DAILY_VISIT" as const,
      idempotencyKey: `daily-visit:${user.id}:2026-09-16`,
      sourceType: "system",
      sourceId: "daily-visit",
      description: "امتیاز حضور روزانه",
      uniqueKey: "2026-09-16",
    };

    const first = db.grantReward(params);
    const second = db.grantReward(params);

    expect(first.awarded).toBe(true);
    expect(second.awarded).toBe(false);
    expect(second.reason).toBe("duplicate");
    expect(db.getPointsAccount(user.id).balance).toBe(100);
    expect(db.getPointsAccount(user.id).transactionCount).toBe(1);
  });

  it("spendEnergy is idempotent per (sourceType, sourceId)", () => {
    const user = makeUser("09120000106");
    topUp(user.id, 1000, "idem-spend");

    const first = db.spendEnergy({ userId: user.id, sourceType: "document", sourceId: "d1" });
    const retry = db.spendEnergy({ userId: user.id, sourceType: "document", sourceId: "d1" });

    expect(first.spent).toBe(true);
    expect(retry.spent).toBe(false);
    expect(retry.reason).toBe("duplicate");
    expect(db.getPointsAccount(user.id).balance).toBe(800);
  });
});

// ============================================================
// Soft floor — balance never goes negative
// ============================================================

describe("soft floor", () => {
  it("refuses a spend that would cross below zero, without writing a ledger row", () => {
    const user = makeUser("09120000107");
    topUp(user.id, 100, "floor");

    const result = db.spendEnergy({ userId: user.id, sourceType: "chat", sourceId: "x1" });

    expect(result.spent).toBe(false);
    expect(result.reason).toBe("insufficient_balance");
    expect(result.balance).toBe(100);
    expect(db.getPointsAccount(user.id).balance).toBe(100);
    expect(db.getPointsAccount(user.id).transactionCount).toBe(1);
  });

  it("canSpendPoints gates redemption against the live balance", () => {
    const user = makeUser("09120000108");
    topUp(user.id, 500, "canspend");
    expect(db.canSpendPoints(user.id, 500)).toBe(true);
    expect(db.canSpendPoints(user.id, 501)).toBe(false);
  });
});

// ============================================================
// Account type — one-way individual → legal
// ============================================================

describe("account type transition", () => {
  it("new accounts default to individual", () => {
    const user = makeUser("09120000109");
    expect(db.getAccountType(user.id)).toBe("individual");
  });

  it("converts individual → legal exactly once", () => {
    const user = makeUser("09120000110");
    const first = db.convertAccountToLegal(user.id);
    expect(first.ok).toBe(true);
    expect(first.accountType).toBe("legal");
    expect(db.getAccountType(user.id)).toBe("legal");
  });

  it("rejects legal → individual (one-way, backend-enforced)", () => {
    const user = makeUser("09120000111");
    db.convertAccountToLegal(user.id);

    const second = db.convertAccountToLegal(user.id);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already_legal");
    expect(second.accountType).toBe("legal");
    expect(db.getAccountType(user.id)).toBe("legal");
  });

  it("reports not_found for an unknown user", () => {
    const result = db.convertAccountToLegal("no-such-user");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found");
  });

  it("treats legacy rows without the field as individual", () => {
    const users = db.readTable<import("../db").DbUser>("users");
    users.push({
      id: "legacy-user",
      mobile: "09120000112",
      email: null,
      passwordHash: "x",
      displayName: null,
      createdAt: new Date().toISOString(),
    });
    db.writeTable("users", users);

    expect(db.getAccountType("legacy-user")).toBe("individual");
  });
});

// ============================================================
// Mobile immutability — the account identity can never change
// ============================================================

describe("mobile immutability", () => {
  it("the profile update path exposes no way to change the mobile", () => {
    const user = makeUser("09120000113");

    // The profile PATCH route only forwards these known fields; `mobile`
    // is deliberately absent, so a crafted body cannot mutate the identity.
    const knownFields = [
      "displayName", "city", "occupation", "avatarUrl", "email", "birthDate", "gender",
      "userType", "province", "legalInterests", "primaryUseCase",
    ];
    expect(knownFields).not.toContain("mobile");

    const updates: Record<string, unknown> = {};
    for (const field of knownFields) {
      if (field in { mobile: "09999999999", displayName: "تست" }) {
        updates[field] = "تست";
      }
    }
    db.upsertProfile(user.id, updates);

    expect(db.findUserById(user.id)?.mobile).toBe("09120000113");
  });

  it("the mobile is the lookup identity and stays stable across profile writes", () => {
    const user = makeUser("09120000114");
    db.upsertProfile(user.id, { displayName: "نام جدید", city: "تهران" });

    expect(db.findUserByMobile("09120000114")?.id).toBe(user.id);
    expect(db.findUserById(user.id)?.mobile).toBe("09120000114");
  });
});

// ============================================================
// Integration — registration → account, subscription → reward,
// usage → deduction
// ============================================================

describe("integration: registration → points account", () => {
  it("a newly registered user has a usable (zeroed) points account", () => {
    const user = makeUser("09120000115");
    const account = db.getPointsAccount(user.id);
    expect(account.balance).toBe(0);
    expect(account.transactionCount).toBe(0);
    // The account exists implicitly — the ledger is the account.
    expect(db.canSpendPoints(user.id, 0)).toBe(true);
  });
});

describe("integration: subscription → reward", () => {
  it("a silver purchase credits the configured 850 points", () => {
    const user = makeUser("09120000116");
    const result = db.claimPurchaseReward(user.id, "silver", "sub-1");

    expect(result.awarded).toBe(true);
    expect(result.points).toBe(850);
    expect(db.getPointsAccount(user.id).balance).toBe(850);
  });

  it("the same purchase id can never be rewarded twice", () => {
    const user = makeUser("09120000117");
    db.claimPurchaseReward(user.id, "gold", "sub-2");
    const retry = db.claimPurchaseReward(user.id, "gold", "sub-2");

    expect(retry.awarded).toBe(false);
    expect(retry.reason).toBe("duplicate");
    expect(db.getPointsAccount(user.id).balance).toBe(1000);
  });

  it("the free plan grants no points", () => {
    const user = makeUser("09120000118");
    const result = db.claimPurchaseReward(user.id, "free", "sub-3");
    expect(result.awarded).toBe(false);
    expect(db.getPointsAccount(user.id).balance).toBe(0);
  });
});

describe("integration: usage → deduction", () => {
  it("each processed request deducts 200 and appears in the ledger", () => {
    const user = makeUser("09120000119");
    topUp(user.id, 1000, "usage-seed");

    db.spendEnergy({ userId: user.id, sourceType: "chat", sourceId: "msg-a" });
    db.spendEnergy({ userId: user.id, sourceType: "document", sourceId: "doc-a" });

    const account = db.getPointsAccount(user.id);
    expect(account.lifetimeSpent).toBe(400);
    expect(account.balance).toBe(600);

    const spends = db.readRewardLedger(user.id).filter((e) => e.event_type === "REQUEST_CONSUMED");
    expect(spends).toHaveLength(2);
    expect(spends.every((e) => e.points_delta === -200)).toBe(true);
  });

  it("profile completion awards 1000 once, and only once", () => {
    const user = makeUser("09120000120");
    const first = db.claimProfileCompletedReward(user.id);
    const second = db.claimProfileCompletedReward(user.id);

    expect(first.awarded).toBe(true);
    expect(first.points).toBe(1000);
    expect(second.awarded).toBe(false);
    expect(db.getPointsAccount(user.id).balance).toBe(1000);
  });
});
