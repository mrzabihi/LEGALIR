// ============================================================
// LEGALIR — Subscription lifecycle (runtime, isolated temp DB)
// ============================================================
// Verifies the invariant the reported bug violated: exactly ONE active
// subscription per user, and the newest plan always wins. A click creates a
// PENDING row that grants nothing; only activation writes a term.
//
// `db.ts` resolves `.data` from `process.cwd()` at import time, so every
// module is dynamically imported AFTER chdir into a throwaway directory —
// the real dev database is never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as lifecycleModule from "../subscription/lifecycle";
import type * as plansModule from "../usage/plans";

type Db = typeof dbModule;
type Lifecycle = typeof lifecycleModule;
type Plans = typeof plansModule;

let db: Db;
let lifecycle: Lifecycle;
let plans: Plans;
let tmpDir: string;
let originalCwd: string;

/** A fixed instant so no assertion depends on the wall clock (date-bomb safe). */
const NOW = new Date("2026-06-01T00:00:00.000Z");
const NOW_MS = NOW.getTime();
const DAY = 86_400_000;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lifecycle-"));
  process.chdir(tmpDir);
  db = await import("../db");
  lifecycle = await import("../subscription/lifecycle");
  plans = await import("../usage/plans");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Every test gets its own user so ordering can never couple assertions. */
let seq = 0;
function freshUser(): string {
  seq += 1;
  return `user-lifecycle-${seq}`;
}

// ============================================================
// Creation — a click grants nothing
// ============================================================

describe("createPendingSubscription", () => {
  it("creates a pending row with no term and grants no entitlement", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;

    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });

    expect(sub.status).toBe("pending");
    expect(sub.start_at).toBe("");
    expect(sub.end_at).toBe("");
    expect(sub.plan_code).toBe("gold");
    expect(sub.plan_snapshot?.dailyRequestLimit).toBe(150);
    // No active subscription exists yet — the plan is NOT live.
    expect(lifecycle.resolveActiveSubscription(user, NOW_MS)).toBeNull();
  });
});

// ============================================================
// Activation — the term comes from the activation instant
// ============================================================

describe("activateSubscription", () => {
  it("sets start_at = now and end_at = now + durationDays, then resolves as active", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });

    const res = lifecycle.activateSubscription({
      subscriptionId: sub.id,
      durationDays: plan.durationDays,
      now: NOW,
    })!;

    expect(res.alreadyActive).toBe(false);
    expect(res.subscription.status).toBe("active");
    expect(res.subscription.start_at).toBe(NOW.toISOString());
    expect(res.subscription.end_at).toBe(new Date(NOW_MS + plan.durationDays * DAY).toISOString());
    expect(res.supersededIds).toEqual([]);

    const active = lifecycle.resolveActiveSubscription(user, NOW_MS);
    expect(active?.id).toBe(sub.id);
  });

  it("is idempotent — replaying activation changes nothing and supersedes nothing", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("silver")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });

    const replay = lifecycle.activateSubscription({
      subscriptionId: sub.id,
      durationDays: plan.durationDays,
      now: new Date(NOW_MS + 1000),
    })!;

    expect(replay.alreadyActive).toBe(true);
    expect(replay.supersededIds).toEqual([]);
    // The term was NOT extended by the replay.
    expect(replay.subscription.end_at).toBe(new Date(NOW_MS + plan.durationDays * DAY).toISOString());
  });
});

// ============================================================
// The reported bug — a new purchase REPLACES the current plan
// ============================================================

describe("supersede on a plan change", () => {
  it("activates the new plan and marks the previous active row superseded", () => {
    const user = freshUser();

    // Gold first…
    const gold = plans.getPlanByCode("gold")!;
    const goldSub = lifecycle.createPendingSubscription({ userId: user, plan: gold, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: goldSub.id, durationDays: gold.durationDays, now: NOW });

    // …then Diamond shortly after (would previously leave BOTH active).
    const diamond = plans.getPlanByCode("diamond")!;
    const later = new Date(NOW_MS + 5000);
    const diamondSub = lifecycle.createPendingSubscription({ userId: user, plan: diamond, paymentId: null, now: later });
    const res = lifecycle.activateSubscription({
      subscriptionId: diamondSub.id,
      durationDays: diamond.durationDays,
      now: later,
    })!;

    expect(res.supersededIds).toEqual([goldSub.id]);
    expect(res.alreadyActive).toBe(false);

    // Exactly ONE row is active, and it is Diamond.
    const activeRows = lifecycle.listSubscriptions(user).filter((s) => s.status === "active");
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]!.id).toBe(diamondSub.id);

    // History is preserved: the Gold row still exists as superseded.
    const goldRow = lifecycle.getSubscriptionById(goldSub.id)!;
    expect(goldRow.status).toBe("superseded");
    expect(goldRow.superseded_at).toBe(later.toISOString());

    const active = lifecycle.resolveActiveSubscription(user, later.getTime() + 1000);
    expect(active?.plan_code).toBe("diamond");
  });
});

// ============================================================
// Terminal transitions
// ============================================================

describe("cancelSubscription", () => {
  it("cancels an active subscription and is idempotent (terminal)", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });

    lifecycle.cancelSubscription(sub.id, NOW.toISOString());
    expect(lifecycle.getSubscriptionById(sub.id)!.status).toBe("cancelled");
    expect(lifecycle.resolveActiveSubscription(user, NOW_MS)).toBeNull();

    // A second cancel must not resurrect or re-stamp the row.
    lifecycle.cancelSubscription(sub.id, new Date(NOW_MS + DAY).toISOString());
    expect(lifecycle.getSubscriptionById(sub.id)!.status).toBe("cancelled");
    expect(lifecycle.getSubscriptionById(sub.id)!.updated_at).toBe(NOW.toISOString());
  });
});

describe("expireSubscription", () => {
  it("marks a row expired and refuses to touch a terminal row", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("silver")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });

    lifecycle.expireSubscription(sub.id, new Date(NOW_MS + 32 * DAY).toISOString());
    expect(lifecycle.getSubscriptionById(sub.id)!.status).toBe("expired");

    // Already terminal → no further transition.
    lifecycle.expireSubscription(sub.id, new Date(NOW_MS + 60 * DAY).toISOString());
    expect(lifecycle.getSubscriptionById(sub.id)!.status).toBe("expired");
  });
});

describe("extendSubscription", () => {
  it("adds whole days to a non-terminal subscription's term", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });

    const originalEnd = lifecycle.getSubscriptionById(sub.id)!.end_at;
    const extended = lifecycle.extendSubscription(sub.id, 10, NOW)!;

    expect(new Date(extended.end_at).getTime()).toBe(
      new Date(originalEnd).getTime() + 10 * DAY
    );
    expect(extended.status).toBe("active");
  });

  it("returns null for a terminal subscription", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });
    lifecycle.cancelSubscription(sub.id, NOW.toISOString());

    expect(lifecycle.extendSubscription(sub.id, 10, NOW)).toBeNull();
  });
});

// ============================================================
// Resolution + reconciliation (legacy data)
// ============================================================

describe("resolveActiveSubscription", () => {
  it("ignores an active row whose end_at has passed", () => {
    const user = freshUser();
    const plan = plans.getPlanByCode("gold")!;
    const sub = lifecycle.createPendingSubscription({ userId: user, plan, paymentId: null, now: NOW });
    lifecycle.activateSubscription({ subscriptionId: sub.id, durationDays: plan.durationDays, now: NOW });

    const afterTerm = NOW_MS + 32 * DAY;
    expect(lifecycle.resolveActiveSubscription(user, afterTerm)).toBeNull();
  });

  it("returns the newest active row when multiple exist", () => {
    const user = freshUser();
    // Seed two legacy `active` rows directly (the pre-fix corruption shape).
    const rows = db.readTable<lifecycleModule.StoredSubscription>("subscriptions");
    rows.push(
      {
        id: "sub-legacy-old",
        user_id: user,
        plan_code: "gold",
        plan_name_fa: "طلا",
        amount: 3_500_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: new Date(NOW_MS).toISOString(),
        end_at: new Date(NOW_MS + 31 * DAY).toISOString(),
        purchased_at: new Date(NOW_MS).toISOString(),
        auto_renew: 1,
        payment_id: null,
      },
      {
        id: "sub-legacy-new",
        user_id: user,
        plan_code: "diamond",
        plan_name_fa: "الماس",
        amount: 4_860_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: new Date(NOW_MS + DAY).toISOString(),
        end_at: new Date(NOW_MS + 32 * DAY).toISOString(),
        purchased_at: new Date(NOW_MS + DAY).toISOString(),
        auto_renew: 1,
        payment_id: null,
      }
    );
    db.writeTable("subscriptions", rows);

    const active = lifecycle.resolveActiveSubscription(user, NOW_MS + 2 * DAY);
    expect(active?.id).toBe("sub-legacy-new");
    expect(active?.plan_code).toBe("diamond");
  });
});

describe("reconcileSubscriptionStatuses", () => {
  it("expires past-term rows and supersedes all but the newest active row", () => {
    const user = freshUser();
    const rows = db.readTable<lifecycleModule.StoredSubscription>("subscriptions");
    rows.push(
      {
        id: "sub-rec-old",
        user_id: user,
        plan_code: "gold",
        plan_name_fa: "طلا",
        amount: 3_500_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: new Date(NOW_MS).toISOString(),
        end_at: new Date(NOW_MS + 31 * DAY).toISOString(),
        purchased_at: new Date(NOW_MS).toISOString(),
        auto_renew: 1,
        payment_id: null,
      },
      {
        id: "sub-rec-new",
        user_id: user,
        plan_code: "diamond",
        plan_name_fa: "الماس",
        amount: 4_860_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: new Date(NOW_MS + DAY).toISOString(),
        end_at: new Date(NOW_MS + 32 * DAY).toISOString(),
        purchased_at: new Date(NOW_MS + DAY).toISOString(),
        auto_renew: 1,
        payment_id: null,
      },
      {
        id: "sub-rec-expired",
        user_id: user,
        plan_code: "silver",
        plan_name_fa: "نقره",
        amount: 2_500_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: new Date(NOW_MS - 60 * DAY).toISOString(),
        end_at: new Date(NOW_MS - 29 * DAY).toISOString(),
        purchased_at: new Date(NOW_MS - 60 * DAY).toISOString(),
        auto_renew: 1,
        payment_id: null,
      }
    );
    db.writeTable("subscriptions", rows);

    // The sweep is global, so sibling tests may also leave reconcilable rows;
    // assert the exact rows this test seeded rather than a total count.
    const changed = lifecycle.reconcileSubscriptionStatuses(NOW_MS + 2 * DAY);

    expect(changed).toBeGreaterThanOrEqual(2);
    expect(lifecycle.getSubscriptionById("sub-rec-expired")!.status).toBe("expired");
    expect(lifecycle.getSubscriptionById("sub-rec-old")!.status).toBe("superseded");
    expect(lifecycle.getSubscriptionById("sub-rec-new")!.status).toBe("active");

    // Idempotent: a second sweep changes nothing.
    expect(lifecycle.reconcileSubscriptionStatuses(NOW_MS + 2 * DAY)).toBe(0);
  });
});
