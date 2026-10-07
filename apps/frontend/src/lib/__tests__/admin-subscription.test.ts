// ============================================================
// LEGALIR — Admin subscription & energy management (isolated temp DB)
// ============================================================
// The admin surface must reuse the SAME lifecycle module the payment flow
// uses, so an operator can never create a second active subscription or
// bypass the state machine. Grants are audited and can never drive the
// reward balance negative.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "../db";
import type * as adminModule from "../admin/subscription";
import type * as auditModule from "../admin/audit";
import type * as lifecycleModule from "../subscription/lifecycle";
import type * as paymentsModule from "../payments";
import type { RewardLedgerEntry } from "../db";

type Db = typeof dbModule;
type Admin = typeof adminModule;
type Audit = typeof auditModule;
type Lifecycle = typeof lifecycleModule;
type Payments = typeof paymentsModule;

let db: Db;
let admin: Admin;
let audit: Audit;
let lifecycle: Lifecycle;
let payments: Payments;
let tmpDir: string;
let originalCwd: string;

// The admin actions resolve the active subscription against the REAL clock
// (`resolveActiveSubscription(userId)` defaults to `Date.now()`), so the seed
// must sit in the present — a fixed past instant would already be expired.
const NOW = new Date();

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-admin-sub-"));
  process.chdir(tmpDir);
  db = await import("../db");
  admin = await import("../admin/subscription");
  audit = await import("../admin/audit");
  lifecycle = await import("../subscription/lifecycle");
  payments = await import("../payments");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let seq = 0;
function freshUser(): string {
  seq += 1;
  return db.createUser({
    mobile: `0913000${String(1000 + seq).padStart(4, "0")}`,
    passwordHash: "x",
    displayName: `کاربر ${seq}`,
  }).id;
}

/** Give a user an active Gold plan through the real payment flow. */
function activateGold(userId: string) {
  const intent = payments.createPaymentIntent({ userId, planCode: "gold", now: NOW })!;
  payments.confirmPayment({ paymentId: intent.payment.id, userId, now: NOW });
}

// ============================================================
// The read-side dossier
// ============================================================

describe("getAdminUserSubscriptionView", () => {
  it("showcases the active plan, masked mobile and history", () => {
    const user = freshUser();
    activateGold(user);

    const view = admin.getAdminUserSubscriptionView(user)!;
    expect(view.current.isFree).toBe(false);
    expect(view.current.planCode).toBe("gold");
    expect(view.current.status).toBe("active");
    expect(view.history).toHaveLength(1);
    expect(view.mobileMasked).toContain("•");
    expect(view.mobileMasked).not.toMatch(/\d{11}/); // never the full number
  });

  it("falls back to the free tier (never an error) when the user has no plan", () => {
    const user = freshUser();
    const view = admin.getAdminUserSubscriptionView(user)!;
    expect(view.current.isFree).toBe(true);
    expect(view.current.planCode).toBeNull();
    expect(view.history).toHaveLength(0);
  });

  it("returns null for an unknown user", () => {
    expect(admin.getAdminUserSubscriptionView("nope")).toBeNull();
  });
});

// ============================================================
// Subscription actions — must respect the one-active invariant
// ============================================================

describe("applyAdminSubscriptionAction", () => {
  it("requires a reason", () => {
    const user = freshUser();
    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "activate", planCode: "gold", reason: "  " },
    });
    expect("error" in res && res.error).toBe("REASON_REQUIRED");
  });

  it("reports USER_NOT_FOUND for an unknown user", () => {
    const res = admin.applyAdminSubscriptionAction({
      userId: "ghost",
      input: { action: "deactivate", reason: "test" },
    });
    expect("error" in res && res.error).toBe("USER_NOT_FOUND");
  });

  it("activate requires a plan", () => {
    const user = freshUser();
    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "activate", reason: "test" },
    });
    expect("error" in res && res.error).toBe("PLAN_REQUIRED");
  });

  it("change_plan SUPERSEDES the current plan (never leaves two active)", () => {
    const user = freshUser();
    activateGold(user);

    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "change_plan", planCode: "diamond", reason: "upgrade by support" },
    });
    expect("ok" in res && res.ok).toBe(true);

    const activeRows = lifecycle.listSubscriptions(user).filter((s) => s.status === "active");
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]!.plan_code).toBe("diamond");
  });

  it("extend without an active subscription is rejected", () => {
    const user = freshUser();
    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "extend", days: 10, reason: "test" },
    });
    expect("error" in res && res.error).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  it("extend with a non-positive day count is rejected", () => {
    const user = freshUser();
    activateGold(user);
    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "extend", days: 0, reason: "test" },
    });
    expect("error" in res && res.error).toBe("INVALID_DAYS");
  });

  it("extend pushes the active term out by whole days", () => {
    const user = freshUser();
    activateGold(user);
    const before = lifecycle.resolveActiveSubscription(user)!.end_at;

    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "extend", days: 5, reason: "goodwill" },
    });
    expect("ok" in res && res.ok).toBe(true);

    const after = lifecycle.resolveActiveSubscription(user)!.end_at;
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(5 * 86_400_000);
  });

  it("deactivate cancels the active subscription", () => {
    const user = freshUser();
    activateGold(user);

    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "deactivate", reason: "fraud" },
    });
    expect("ok" in res && res.ok).toBe(true);
    expect(lifecycle.resolveActiveSubscription(user)).toBeNull();
    expect(admin.hasActiveSubscription(user)).toBe(false);
  });

  it("rejects an unknown action", () => {
    const user = freshUser();
    const res = admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "explode" as never, reason: "test" },
    });
    expect("error" in res && res.error).toBe("UNKNOWN_ACTION");
  });
});

// ============================================================
// Energy actions
// ============================================================

describe("grantAdminEnergy", () => {
  it("grants reward energy and writes an ADMIN_GRANT ledger row", () => {
    const user = freshUser();
    const res = admin.grantAdminEnergy(user, { action: "grant", amount: 1000, reason: "compensation" }, "actor-1");
    expect("ok" in res && res.ok).toBe(true);
    expect(db.getRewardBalance(user)).toBe(1000);

    const row = db
      .readTable<RewardLedgerEntry>("reward_ledger")
      .find((e) => e.user_id === user)!;
    expect(row.event_type).toBe("ADMIN_GRANT");
    expect(row.points_delta).toBe(1000);
    expect(row.source_id).toBe("actor-1");
  });

  it("adjusts down and writes an ADMIN_ADJUSTMENT row", () => {
    const user = freshUser();
    admin.grantAdminEnergy(user, { action: "grant", amount: 1000, reason: "seed" }, "actor-1");

    const res = admin.grantAdminEnergy(user, { action: "adjust", amount: -400, reason: "clawback" }, "actor-1");
    expect("ok" in res && res.ok).toBe(true);
    expect(db.getRewardBalance(user)).toBe(600);

    const adjustment = db
      .readTable<RewardLedgerEntry>("reward_ledger")
      .find((e) => e.user_id === user && e.event_type === "ADMIN_ADJUSTMENT")!;
    expect(adjustment.points_delta).toBe(-400);
  });

  it("never lets the balance go negative", () => {
    const user = freshUser();
    admin.grantAdminEnergy(user, { action: "grant", amount: 100, reason: "seed" }, "actor-1");

    const res = admin.grantAdminEnergy(user, { action: "adjust", amount: -500, reason: "too much" }, "actor-1");
    expect("error" in res && res.error).toBe("INSUFFICIENT_BALANCE");
    expect(db.getRewardBalance(user)).toBe(100);
  });

  it("requires a reason and a non-zero amount", () => {
    const user = freshUser();
    const noReason = admin.grantAdminEnergy(user, { action: "grant", amount: 10, reason: "" }, "actor-1");
    expect("error" in noReason && noReason.error).toBe("REASON_REQUIRED");

    const zero = admin.grantAdminEnergy(user, { action: "grant", amount: 0, reason: "test" }, "actor-1");
    expect("error" in zero && zero.error).toBe("INVALID_AMOUNT");
  });

  it("reports USER_NOT_FOUND for an unknown user", () => {
    const res = admin.grantAdminEnergy("ghost", { action: "grant", amount: 10, reason: "test" }, "actor-1");
    expect("error" in res && res.error).toBe("USER_NOT_FOUND");
  });
});

// ============================================================
// Audit trail
// ============================================================

describe("admin action audit", () => {
  it("records each action with the same identifiers the route uses, and is queryable", () => {
    const user = freshUser();
    activateGold(user);
    admin.applyAdminSubscriptionAction({
      userId: user,
      input: { action: "change_plan", planCode: "diamond", reason: "upgrade" },
    });
    admin.grantAdminEnergy(user, { action: "grant", amount: 300, reason: "goodwill" }, "actor-1");

    // The route writes these rows with the same action/resource identifiers.
    audit.recordAudit({
      actorUserId: "actor-1",
      actorRole: "SUPER_ADMIN",
      action: "subscription.admin.action",
      resourceType: "user",
      resourceId: user,
      reason: "upgrade",
    });
    audit.recordAudit({
      actorUserId: "actor-1",
      actorRole: "SUPER_ADMIN",
      action: "energy.admin.adjust",
      resourceType: "user",
      resourceId: user,
      reason: "goodwill",
    });

    const subAudit = audit.listAudit({ action: "subscription.admin.action", resourceId: user });
    expect(subAudit.total).toBe(1);
    expect(subAudit.items[0]!.actorUserId).toBe("actor-1");

    const energyAudit = audit.listAudit({ action: "energy.admin.adjust", resourceId: user });
    expect(energyAudit.total).toBe(1);
  });

  it("redacts secrets before they reach the trail", () => {
    audit.recordAudit({
      actorUserId: "actor-1",
      actorRole: "SUPER_ADMIN",
      action: "energy.admin.adjust",
      resourceType: "user",
      resourceId: "u-x",
      after: { password: "hunter2", token: "abc", note: "ok" },
    });
    const entry = audit.listAudit({ resourceId: "u-x" }).items[0]!;
    expect(entry.after).toMatchObject({ password: "[redacted]", token: "[redacted]", note: "ok" });
  });
});
