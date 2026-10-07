// ============================================================
// LEGALIR — Superadmin plan create/manage (isolated temp DB)
// ============================================================
// Locks in the six required behaviors of the plan-building surface:
//   1. a superadmin creates + activates a valid plan (purchasable);
//   2. only the super-admin may create/edit/publish (permission gate);
//   3. invalid inputs and out-of-range discounts are rejected, nothing persists;
//   4. deactivating a plan stops NEW purchases but never rewrites history;
//   5. a price change updates the catalog but never a past order's frozen amount;
//   6. a persistence fault surfaces as an error, never a fake success.
//
// `db.ts` resolves `.data` from `process.cwd()` at import time, so every module
// is dynamically imported AFTER chdir into a throwaway directory — the real dev
// database is never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { roleHasPermission } from "@legalir/types";
import type * as dbModule from "../db";
import type * as plansModule from "../usage/plans";
import type * as paymentsModule from "../payments";
import type * as lifecycleModule from "../subscription/lifecycle";
import type * as pricingModule from "../usage/plan-pricing";

type Db = typeof dbModule;
type Plans = typeof plansModule;
type Payments = typeof paymentsModule;
type Lifecycle = typeof lifecycleModule;
type Pricing = typeof pricingModule;

let db: Db;
let plans: Plans;
let payments: Payments;
let lifecycle: Lifecycle;
let pricing: Pricing;
let tmpDir: string;
let originalCwd: string;

/** A fixed instant so no assertion depends on the wall clock (date-bomb safe). */
const NOW = new Date("2026-06-01T00:00:00.000Z");

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-admin-plans-"));
  process.chdir(tmpDir);
  db = await import("../db");
  plans = await import("../usage/plans");
  payments = await import("../payments");
  lifecycle = await import("../subscription/lifecycle");
  pricing = await import("../usage/plan-pricing");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Every test gets its own user so ordering can never couple assertions. */
let seq = 0;
function freshUser(): string {
  seq += 1;
  return db.createUser({
    mobile: `0913000${String(1000 + seq).padStart(4, "0")}`,
    passwordHash: "x",
    displayName: `کاربر ${seq}`,
  }).id;
}

/** A fully-valid create payload, overridable per test. */
function validInput(overrides: Partial<Parameters<Plans["createPlan"]>[0]> = {}) {
  return {
    code: "starter",
    nameFa: "پلن آزمون",
    descriptionFa: "توضیح کوتاه",
    shortDescriptionFa: "توضیح",
    durationDays: 31,
    activityCostPoints: 100,
    dailyRequestLimit: 20,
    tokenLimit: 1_000_000,
    aiMessageLimit: 500,
    documentAnalysisLimit: 5,
    contractDraftLimit: 3,
    contractCreationLimit: 3,
    contractCreationUnlimited: false,
    listPrice: 2_000_000,
    salePrice: 1_000_000,
    currency: "IRT",
    features: ["۲۰ درخواست روزانه", "۱٬۰۰۰٬۰۰۰ توکن"],
    status: "active" as const,
    displayOrder: 5,
    tags: ["پیشنهادی"],
    ...overrides,
  };
}

// ============================================================
// 1 — a superadmin creates + activates a valid plan
// ============================================================

describe("createPlan — a valid plan lands and is purchasable", () => {
  it("creates an active plan that appears in the catalog and can be bought", () => {
    const res = plans.createPlan(validInput({ code: "starter", status: "active" }));
    expect("ok" in res).toBe(true);
    if (!("ok" in res)) return;

    // The row is real: an id derived from the code, and it is active.
    expect(res.plan.id).toBe("plan-starter");
    expect(res.plan.code).toBe("starter");
    expect(res.plan.status).toBe("active");
    expect(res.plan.isActive).toBe(true);
    expect(plans.planStatus(res.plan)).toBe("active");
    expect(plans.isPurchasable(res.plan)).toBe(true);

    // It is persisted — a fresh read (the admin table's source) sees it.
    expect(plans.readPlans().some((p) => p.code === "starter")).toBe(true);

    // The public projection carries the derived discount (50%).
    const pub = plans.planToPublic(res.plan);
    expect(pub.discountPercent).toBe(50);
    expect(pub.totalTokenLimit).toBe(1_000_000);
  });

  it("a draft plan is never purchasable", () => {
    const res = plans.createPlan(validInput({ code: "someday", status: "draft" }));
    if (!("ok" in res)) throw new Error("create failed");
    expect(plans.planStatus(res.plan)).toBe("draft");
    expect(plans.isPurchasable(res.plan)).toBe(false);
  });

  it("records a creation audit row (createPlan + auditPlanCreated, as the route does)", () => {
    const res = plans.createPlan(validInput({ code: "audited", status: "active" }));
    if (!("ok" in res)) throw new Error("create failed");
    // The route records creation right after a successful write.
    plans.auditPlanCreated(res.plan, "admin-super");
    const rows = plans.readPlanAudit().filter((a) => a.planCode === "audited");
    expect(rows.some((a) => a.field === "created")).toBe(true);
  });
});

// ============================================================
// 2 — only the super-admin may create/edit/publish
// ============================================================

describe("permission gate — admin:system:manage is SUPER_ADMIN-only", () => {
  it("grants the mutation permission to SUPER_ADMIN only", () => {
    expect(roleHasPermission("SUPER_ADMIN", "admin:system:manage")).toBe(true);
    for (const role of ["ADMIN", "ADMIN_FINANCE", "ADMIN_OPS", "ADMIN_LAWYERS", "SUPPORT", "USER"] as const) {
      expect(roleHasPermission(role, "admin:system:manage")).toBe(false);
    }
  });

  it("still lets finance/ops READ the catalog without being able to change it", () => {
    // Reading is a distinct, broader capability — the mutation stays locked.
    expect(roleHasPermission("ADMIN_FINANCE", "admin:plans:read")).toBe(true);
    expect(roleHasPermission("ADMIN_OPS", "admin:plans:read")).toBe(true);
    expect(roleHasPermission("ADMIN_FINANCE", "admin:system:manage")).toBe(false);
  });
});

// ============================================================
// 3 — invalid inputs / out-of-range discount are rejected
// ============================================================

describe("createPlan — validation rejects bad input and persists nothing", () => {
  it("rejects a negative price", () => {
    const res = plans.createPlan(validInput({ code: "neg", listPrice: -1, salePrice: 0 }));
    expect(res).toEqual({ error: "INVALID_PRICE" });
    expect(plans.readPlans().some((p) => p.code === "neg")).toBe(false);
  });

  it("rejects a sale price above the list price (a negative discount)", () => {
    const res = plans.createPlan(validInput({ code: "up", listPrice: 100, salePrice: 200 }));
    expect(res).toEqual({ error: "SALE_ABOVE_LIST" });
    expect(plans.readPlans().some((p) => p.code === "up")).toBe(false);
  });

  it("rejects a zero duration", () => {
    const res = plans.createPlan(validInput({ code: "zero", durationDays: 0 }));
    expect(res).toEqual({ error: "INVALID_DURATION" });
  });

  it("rejects an empty name and an invalid (non-slug) code", () => {
    expect(plans.createPlan(validInput({ code: "validcode", nameFa: "  " }))).toEqual({ error: "NAME_REQUIRED" });
    expect(plans.createPlan(validInput({ code: "Bad Code!", nameFa: "x" }))).toEqual({ error: "INVALID_CODE" });
  });

  it("rejects a duplicate code", () => {
    plans.createPlan(validInput({ code: "dup", status: "active" }));
    const again = plans.createPlan(validInput({ code: "dup", status: "active" }));
    expect(again).toEqual({ error: "CODE_EXISTS" });
    // Exactly one row with that code survives.
    expect(plans.readPlans().filter((p) => p.code === "dup")).toHaveLength(1);
  });

  it("rejects a non-integer limit and an invalid status", () => {
    expect(plans.createPlan(validInput({ code: "frac", tokenLimit: 1.5 }))).toEqual({ error: "INVALID_LIMIT" });
    expect(plans.createPlan(validInput({ code: "stat", status: "live" as never }))).toEqual({
      error: "INVALID_STATUS",
    });
  });
});

// ============================================================
// 4 — deactivation stops new purchases, history is untouched
// ============================================================

describe("setPlanStatus — deactivate stops sales without harming history", () => {
  it("blocks new purchases but leaves existing subscriptions intact", () => {
    plans.createPlan(validInput({ code: "promo", status: "active" }));

    // A purchase while active succeeds and creates a pending subscription.
    const buyer = freshUser();
    const before = payments.createPaymentIntent({ userId: buyer, planCode: "promo", now: NOW });
    expect(before).not.toBeNull();
    const subId = before!.subscription.id;

    // Superadmin deactivates the plan.
    const updated = plans.setPlanStatus("promo", "inactive", "admin-super");
    expect(updated).toBeDefined();
    expect(plans.planStatus(updated!)).toBe("inactive");
    expect(plans.isPurchasable(updated!)).toBe(false);

    // NEW purchases are now refused...
    const blocked = payments.createPaymentIntent({ userId: freshUser(), planCode: "promo", now: NOW });
    expect(blocked).toBeNull();

    // ...but the prior subscription row is untouched (history preserved).
    const row = lifecycle.getSubscriptionById(subId);
    expect(row).not.toBeNull();
    expect(row!.status).toBe("pending");

    // The status change was audited.
    const audit = plans.readPlanAudit().filter((a) => a.planCode === "promo" && a.field === "status");
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(audit[0]!.newValue).toBe("inactive");
  });
});

// ============================================================
// 5 — a price change never rewrites a past order
// ============================================================

describe("updatePlanWithAudit — editing price leaves history frozen", () => {
  it("updates the catalog but not the amount frozen on an existing order", () => {
    plans.createPlan(validInput({ code: "premium", status: "active", listPrice: 2_000_000, salePrice: 1_000_000 }));

    const buyer = freshUser();
    const intent = payments.createPaymentIntent({ userId: buyer, planCode: "premium", now: NOW })!;
    expect(intent.payment.amount).toBe(1_000_000);

    // Superadmin raises the sale price.
    const after = plans.updatePlanWithAudit("premium", { salePrice: 1_500_000 }, "admin-super");
    expect(after).toBeDefined();
    expect(plans.getPlanByCode("premium")!.salePrice).toBe(1_500_000);

    // The historical payment amount is unchanged — the snapshot holds.
    expect(payments.getPayment(intent.payment.id)!.amount).toBe(1_000_000);
    expect(lifecycle.getSubscriptionById(intent.subscription.id)!.plan_snapshot?.dailyRequestLimit).toBe(20);

    // The change is on the audit trail with a precise before → after.
    const entry = plans
      .readPlanAudit()
      .find((a) => a.planCode === "premium" && a.field === "salePrice");
    expect(entry).toBeDefined();
    expect(entry!.oldValue).toBe("1000000");
    expect(entry!.newValue).toBe("1500000");
  });
});

// ============================================================
// 6 — a persistence fault surfaces, never a fake success
// ============================================================

describe("persistence faults — the form must never report a false success", () => {
  it("propagates a DB write failure instead of returning ok", () => {
    const plansFile = path.join(tmpDir, ".data", "subscription_plans.json");
    // Replace the table file with a DIRECTORY so every write to it fails.
    fs.rmSync(plansFile, { force: true });
    fs.mkdirSync(plansFile, { recursive: true });
    try {
      // A refused write must throw (→ the route maps it to a 5xx error the
      // admin sees), and must NEVER resolve to `{ ok: true }`.
      expect(() => plans.createPlan(validInput({ code: "boom", status: "active" }))).toThrow();
    } finally {
      fs.rmSync(plansFile, { recursive: true, force: true });
    }
  });
});

// ============================================================
// Shared pricing formula — one source, front and back agree
// ============================================================

describe("shared pricing formula", () => {
  it("computes a whole-percent discount from list/sale", () => {
    expect(pricing.computeDiscountPercent(10_000_000, 4_860_000)).toBe(51);
    expect(pricing.computeDiscountPercent(2_000_000, 2_000_000)).toBe(0);
    expect(pricing.computeDiscountPercent(2_000_000, 2_500_000)).toBe(0);
    expect(pricing.computeDiscountPercent(0, 100)).toBe(0);
  });

  it("applies percent and fixed discounts and never goes negative", () => {
    expect(pricing.applyDiscount(1_000_000, "percent", 30)).toBe(700_000);
    expect(pricing.applyDiscount(1_000_000, "fixed", 250_000)).toBe(750_000);
    // Percent is clamped to 100, and an over-large fixed discount floors at 0.
    expect(pricing.applyDiscount(1_000_000, "percent", 150)).toBe(0);
    expect(pricing.applyDiscount(1_000_000, "fixed", 5_000_000)).toBe(0);
  });
});
