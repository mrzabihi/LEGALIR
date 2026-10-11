// ============================================================
// LEGALIR — Coupon store (catalog + usage ledger, in-memory DB)
// ============================================================
// Locks in the admin-coupon invariants the purchase redesign requires:
//   • a code is NORMALIZED (trim + upper-case) on every write AND lookup, so
//     `sale10`, ` SALE10 ` and `Sale10` are the same coupon and can never
//     coexist as duplicates;
//   • a used coupon is never physically deleted — archiving keeps the row;
//   • editing a coupon NEVER rewrites past orders or past usage rows (they hold
//     their own snapshot), so a historical sale stays honest;
//   • a definitive consumption is idempotent per order and keeps the
//     denormalised `usedCount` in step.
//
// `@/lib/db` is replaced with an in-memory store (the same pattern the other
// admin suites use) so nothing touches the live `.data` directory.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
}));

import {
  normalizeCode,
  getCouponByCode,
  getCouponById,
  codeExists,
  listCoupons,
  countUsages,
  countUserUsages,
  usageExistsForOrder,
  recordUsage,
  createCoupon,
  updateCoupon,
  setCouponStatus,
  validateDraft,
  type CouponDraft,
} from "@/lib/coupons/store";
import type { Coupon } from "@legalir/types";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function draft(over: Partial<CouponDraft> = {}): CouponDraft {
  return {
    title: "کمپین نوروز",
    code: "SALE10",
    kind: "percent",
    value: 10,
    percentCap: 100,
    eligiblePlans: [],
    startsAt: daysAgo(1),
    endsAt: daysAgo(-30),
    minOrderAmount: 0,
    totalUses: 0,
    perUserLimit: 0,
    status: "active",
    internalNotes: "یادداشت داخلی",
    currency: "IRT",
    ...over,
  };
}

function create(over: Partial<CouponDraft> = {}): Coupon {
  const res = createCoupon(draft(over), "admin-1");
  if (!res.ok) throw new Error(`createCoupon failed: ${res.error}`);
  return res.coupon;
}

describe("coupon store — code normalization & uniqueness", () => {
  beforeEach(() => h.tables.clear());

  it("normalizes a code to trimmed upper-case", () => {
    expect(normalizeCode("  sale10 ")).toBe("SALE10");
    expect(normalizeCode("Sale10")).toBe("SALE10");
    expect(normalizeCode("")).toBe("");
  });

  it("stores a normalized code and resolves it case- and space-insensitively", () => {
    create({ code: "sale10" });
    expect(getCouponByCode("SALE10")?.code).toBe("SALE10");
    expect(getCouponByCode(" sAlE10 ")?.code).toBe("SALE10");
    expect(getCouponByCode("nope")).toBeNull();
  });

  it("refuses to create a duplicate code, regardless of case", () => {
    create({ code: "SALE10" });
    expect(codeExists("sale10")).toBe(true);
    const dup = createCoupon(draft({ code: "Sale10" }), "admin-1");
    expect("error" in dup && dup.error).toBe("CODE_EXISTS");
  });

  it("stamps createdBy/updatedBy and starts usedCount at zero", () => {
    const c = create();
    expect(c.createdBy).toBe("admin-1");
    expect(c.updatedBy).toBe("admin-1");
    expect(c.usedCount).toBe(0);
    expect(c.archivedAt).toBeNull();
  });
});

describe("coupon store — draft validation", () => {
  beforeEach(() => h.tables.clear());

  it("rejects a blank / malformed code", () => {
    expect(validateDraft(draft({ code: "  " }))).toBe("CODE_REQUIRED");
    expect(validateDraft(draft({ code: "ab" }))).toBe("INVALID_CODE");
    expect(validateDraft(draft({ code: "has space" }))).toBe("INVALID_CODE");
  });

  it("rejects an empty title", () => {
    expect(validateDraft(draft({ title: "  " }))).toBe("COUPON_TITLE_REQUIRED");
  });

  it("rejects a percent value above 100 and a percentCap out of range", () => {
    expect(validateDraft(draft({ kind: "percent", value: 150 }))).toBe("INVALID_VALUE");
    expect(validateDraft(draft({ percentCap: 0 }))).toBe("INVALID_PERCENT_CAP");
    expect(validateDraft(draft({ percentCap: 200 }))).toBe("INVALID_PERCENT_CAP");
  });

  it("rejects an end date before the start date", () => {
    expect(validateDraft(draft({ startsAt: daysAgo(-10), endsAt: daysAgo(1) }))).toBe(
      "END_BEFORE_START"
    );
  });

  it("accepts a well-formed draft", () => {
    expect(validateDraft(draft())).toBeNull();
  });
});

describe("coupon store — edits never rewrite history", () => {
  beforeEach(() => h.tables.clear());

  it("archiving keeps the row (no physical delete)", () => {
    const c = create({ code: "KEEP" });
    const archived = setCouponStatus(c.id, "archived", "admin-2");
    expect(archived?.status).toBe("archived");
    expect(archived?.archivedAt).toBeTruthy();
    // The row is still present and addressable.
    expect(getCouponById(c.id)).not.toBeNull();
    expect(listCoupons().some((x) => x.id === c.id)).toBe(true);
  });

  it("re-activating an archived coupon clears archivedAt", () => {
    const c = create({ code: "REVIVE" });
    setCouponStatus(c.id, "archived", "admin-2");
    const reactivated = setCouponStatus(c.id, "active", "admin-2");
    expect(reactivated?.status).toBe("active");
    expect(reactivated?.archivedAt).toBeNull();
  });

  it("disable then enable is reversible", () => {
    const c = create({ code: "TOGGLE" });
    expect(setCouponStatus(c.id, "disabled", "admin-2")?.status).toBe("disabled");
    expect(setCouponStatus(c.id, "active", "admin-2")?.status).toBe("active");
  });

  it("editing a coupon changes future validation but not a prior usage snapshot", () => {
    const c = create({ code: "SNAP", kind: "percent", value: 10 });
    // A definitive consumption is recorded with its own discount snapshot.
    recordUsage({
      couponId: c.id,
      couponCode: c.code,
      userId: "u1",
      orderId: "ord-1",
      subscriptionId: "sub-1",
      discountAmount: 250_000,
      currency: "IRT",
    });
    // The admin later edits the coupon to a different value.
    const edited = updateCoupon(c.id, draft({ code: "SNAP", kind: "percent", value: 50 }), "admin-2");
    expect(edited.ok && edited.coupon.value).toBe(50);

    // The usage row still carries the ORIGINAL snapshot — untouched by the edit.
    const usage = (h.tables.get("coupon_usages") as { discountAmount: number; couponCode: string }[])[0]!;
    expect(usage.discountAmount).toBe(250_000);
    expect(usage.couponCode).toBe("SNAP");
  });

  it("update preserves createdAt and records the editor", () => {
    const c = create({ code: "EDIT" });
    const edited = updateCoupon(c.id, draft({ code: "EDIT", title: "عنوان جدید" }), "admin-9");
    if (!edited.ok) throw new Error("update failed");
    expect(edited.coupon.createdAt).toBe(c.createdAt);
    expect(edited.coupon.updatedBy).toBe("admin-9");
    expect(edited.coupon.title).toBe("عنوان جدید");
  });

  it("update returns NOT_FOUND for an unknown id", () => {
    const res = updateCoupon("cp-missing", draft(), "admin-1");
    expect(!res.ok && res.error).toBe("NOT_FOUND");
  });
});

describe("coupon store — usage ledger", () => {
  beforeEach(() => h.tables.clear());

  it("records a usage once and keeps usedCount in step", () => {
    const c = create({ code: "COUNT", totalUses: 3 });
    recordUsage({
      couponId: c.id,
      couponCode: c.code,
      userId: "u1",
      orderId: "ord-1",
      subscriptionId: null,
      discountAmount: 100,
      currency: "IRT",
    });
    expect(countUsages(c.id)).toBe(1);
    expect(countUserUsages(c.id, "u1")).toBe(1);
    expect(usageExistsForOrder("ord-1")).toBe(true);
    expect(getCouponById(c.id)?.usedCount).toBe(1);
  });

  it("is idempotent per order — a replayed commit writes no second row", () => {
    const c = create({ code: "IDEM", totalUses: 5 });
    const input = {
      couponId: c.id,
      couponCode: c.code,
      userId: "u1",
      orderId: "ord-same",
      subscriptionId: null,
      discountAmount: 100,
      currency: "IRT",
    };
    recordUsage(input);
    recordUsage(input);
    expect(countUsages(c.id)).toBe(1);
    expect(getCouponById(c.id)?.usedCount).toBe(1);
  });

  it("counts per-user usage independently of the global count", () => {
    const c = create({ code: "MULTI", perUserLimit: 2 });
    recordUsage({ couponId: c.id, couponCode: c.code, userId: "u1", orderId: "o1", subscriptionId: null, discountAmount: 1, currency: "IRT" });
    recordUsage({ couponId: c.id, couponCode: c.code, userId: "u2", orderId: "o2", subscriptionId: null, discountAmount: 1, currency: "IRT" });
    expect(countUsages(c.id)).toBe(2);
    expect(countUserUsages(c.id, "u1")).toBe(1);
    expect(countUserUsages(c.id, "u2")).toBe(1);
  });
});
