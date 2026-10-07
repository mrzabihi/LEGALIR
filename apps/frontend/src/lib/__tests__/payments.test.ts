// ============================================================
// LEGALIR — Payments: intent → confirm → activation (isolated temp DB)
// ============================================================
// The activation trigger is a CONFIRMED payment, never a click. These tests
// lock in the §7/§32 contract: an intent grants nothing, confirmation
// activates exactly once, and a replayed confirmation is a no-op.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as paymentsModule from "../payments";
import type * as lifecycleModule from "../subscription/lifecycle";

type Db = typeof dbModule;
type Payments = typeof paymentsModule;
type Lifecycle = typeof lifecycleModule;

let db: Db;
let payments: Payments;
let lifecycle: Lifecycle;
let tmpDir: string;
let originalCwd: string;

const NOW = new Date("2026-06-01T00:00:00.000Z");
const NOW_MS = NOW.getTime();
const DAY = 86_400_000;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-payments-"));
  process.chdir(tmpDir);
  db = await import("../db");
  payments = await import("../payments");
  lifecycle = await import("../subscription/lifecycle");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let seq = 0;
function freshUser(): string {
  seq += 1;
  return db.createUser({
    mobile: `0912000${String(1000 + seq).padStart(4, "0")}`,
    passwordHash: "x",
    displayName: `کاربر ${seq}`,
  }).id;
}

function rewardRows(user: string) {
  return db.readTable<dbModule.RewardLedgerEntry>("reward_ledger").filter((e) => e.user_id === user);
}
function activityRows(user: string) {
  return db.readTable<dbModule.ActivityRow>("activities").filter((a) => a.user_id === user);
}

// ============================================================
// Intent — pending only
// ============================================================

describe("createPaymentIntent", () => {
  it("creates a pending payment + pending subscription and activates nothing", () => {
    const user = freshUser();
    const intent = payments.createPaymentIntent({ userId: user, planCode: "diamond", now: NOW })!;

    expect(intent.reused).toBe(false);
    expect(intent.payment.status).toBe("pending");
    expect(intent.payment.planCode).toBe("diamond");
    expect(intent.payment.amount).toBe(4_860_000); // resolved server-side
    expect(intent.payment.subscriptionId).toBe(intent.subscription.id);
    expect(intent.subscription.status).toBe("pending");

    // No active subscription, no reward, no activity from an intent alone.
    expect(lifecycle.resolveActiveSubscription(user, NOW_MS)).toBeNull();
    expect(rewardRows(user)).toHaveLength(0);
    expect(activityRows(user)).toHaveLength(0);
  });

  it("reuses an existing pending intent for the same plan (double-click safe)", () => {
    const user = freshUser();
    const first = payments.createPaymentIntent({ userId: user, planCode: "gold", now: NOW })!;
    const second = payments.createPaymentIntent({ userId: user, planCode: "gold", now: NOW })!;

    expect(second.reused).toBe(true);
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.subscription.id).toBe(first.subscription.id);
  });

  it("returns null for an unknown plan", () => {
    const user = freshUser();
    expect(payments.createPaymentIntent({ userId: user, planCode: "platinum" as never, now: NOW })).toBeNull();
  });
});

// ============================================================
// Confirmation — the ONLY activation path, idempotent
// ============================================================

describe("confirmPayment", () => {
  it("activates the subscription and records exactly one reward + activity", () => {
    const user = freshUser();
    const intent = payments.createPaymentIntent({ userId: user, planCode: "gold", now: NOW })!;

    const res = payments.confirmPayment({ paymentId: intent.payment.id, userId: user, method: "mock", now: NOW })!;

    expect(res.alreadyPaid).toBe(false);
    expect(res.payment.status).toBe("paid");
    expect(res.payment.transactionId).toBe(`mock-txn-${intent.payment.id}`);
    expect(res.payment.paidAt).toBe(NOW.toISOString());
    expect(res.subscription?.status).toBe("active");
    expect(res.subscription?.start_at).toBe(NOW.toISOString());
    expect(res.subscription?.end_at).toBe(new Date(NOW_MS + 31 * DAY).toISOString());

    expect(rewardRows(user)).toHaveLength(1);
    expect(activityRows(user)).toHaveLength(1);
  });

  it("is IDEMPOTENT — a replayed confirmation grants nothing twice", () => {
    const user = freshUser();
    const intent = payments.createPaymentIntent({ userId: user, planCode: "diamond", now: NOW })!;
    payments.confirmPayment({ paymentId: intent.payment.id, userId: user, method: "mock", now: NOW });

    const earnedAfterFirst = rewardRows(user).length;
    const activitiesAfterFirst = activityRows(user).length;

    const replay = payments.confirmPayment({
      paymentId: intent.payment.id,
      userId: user,
      method: "mock",
      now: new Date(NOW_MS + 5000),
    })!;

    expect(replay.alreadyPaid).toBe(true);
    expect(replay.payment.status).toBe("paid");
    // No second reward row, no second activity row, no second subscription.
    expect(rewardRows(user)).toHaveLength(earnedAfterFirst);
    expect(activityRows(user)).toHaveLength(activitiesAfterFirst);
    expect(lifecycle.listSubscriptions(user)).toHaveLength(1);

    // The paid term is unchanged by the replay.
    expect(replay.subscription?.end_at).toBe(new Date(NOW_MS + 31 * DAY).toISOString());
  });

  it("refuses to confirm a payment that belongs to another user", () => {
    const owner = freshUser();
    const attacker = freshUser();
    const intent = payments.createPaymentIntent({ userId: owner, planCode: "silver", now: NOW })!;

    const res = payments.confirmPayment({ paymentId: intent.payment.id, userId: attacker, now: NOW });
    expect(res).toBeNull();
    expect(payments.getPayment(intent.payment.id)!.status).toBe("pending");
  });

  it("returns null for an unknown payment id", () => {
    expect(payments.confirmPayment({ paymentId: "does-not-exist", now: NOW })).toBeNull();
  });
});

// ============================================================
// The reported flow — Gold subscriber buys Diamond
// ============================================================

describe("upgrade via payment (the reported bug)", () => {
  it("replaces the active plan end-to-end: Gold active → buy Diamond → Diamond active", () => {
    const user = freshUser();

    // 1) First purchase: Gold.
    const g = payments.createPaymentIntent({ userId: user, planCode: "gold", now: NOW })!;
    payments.confirmPayment({ paymentId: g.payment.id, userId: user, now: NOW });
    expect(lifecycle.resolveActiveSubscription(user, NOW_MS)?.plan_code).toBe("gold");

    // 2) Up to Diamond a day later.
    const later = new Date(NOW_MS + DAY);
    const d = payments.createPaymentIntent({ userId: user, planCode: "diamond", now: later })!;
    const res = payments.confirmPayment({ paymentId: d.payment.id, userId: user, now: later })!;

    expect(res.alreadyPaid).toBe(false);

    // 3) Exactly one active subscription, and it is Diamond.
    const active = lifecycle.resolveActiveSubscription(user, later.getTime() + 1000);
    expect(active?.plan_code).toBe("diamond");
    const activeRows = lifecycle.listSubscriptions(user).filter((s) => s.status === "active");
    expect(activeRows).toHaveLength(1);

    // 4) The Gold row survives as history.
    const goldRow = lifecycle.getSubscriptionById(g.subscription.id)!;
    expect(goldRow.status).toBe("superseded");
  });
});

// ============================================================
// Failure is terminal and grants nothing
// ============================================================

describe("failPayment", () => {
  it("marks a pending payment failed and leaves no entitlement", () => {
    const user = freshUser();
    const intent = payments.createPaymentIntent({ userId: user, planCode: "silver", now: NOW })!;

    const failed = payments.failPayment(intent.payment.id, "failed", NOW)!;
    expect(failed.status).toBe("failed");

    // A later confirmation of a failed payment does not activate anything.
    const res = payments.confirmPayment({ paymentId: intent.payment.id, userId: user, now: NOW })!;
    expect(res.alreadyPaid).toBe(false);
    expect(res.subscription).toBeNull();
    expect(lifecycle.resolveActiveSubscription(user, NOW_MS)).toBeNull();
    expect(rewardRows(user)).toHaveLength(0);
  });

  it("never overrides a paid payment", () => {
    const user = freshUser();
    const intent = payments.createPaymentIntent({ userId: user, planCode: "gold", now: NOW })!;
    payments.confirmPayment({ paymentId: intent.payment.id, userId: user, now: NOW });

    const after = payments.failPayment(intent.payment.id, "failed", NOW)!;
    expect(after.status).toBe("paid");
  });
});

// ============================================================
// Reads
// ============================================================

describe("listPayments / subscriptionForPayment", () => {
  it("returns a user's payments newest-first and traces the subscription", () => {
    const user = freshUser();
    const older = payments.createPaymentIntent({ userId: user, planCode: "silver", now: NOW })!;
    payments.confirmPayment({ paymentId: older.payment.id, userId: user, now: NOW });
    const newer = payments.createPaymentIntent({ userId: user, planCode: "gold", now: new Date(NOW_MS + DAY) })!;
    payments.confirmPayment({ paymentId: newer.payment.id, userId: user, now: new Date(NOW_MS + DAY) });

    const list = payments.listPayments(user);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(newer.payment.id); // newest first

    const sub = payments.subscriptionForPayment(newer.payment);
    expect(sub?.id).toBe(newer.subscription.id);
  });
});
