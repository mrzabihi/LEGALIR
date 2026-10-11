// ============================================================
// LEGALIR — Unified sales ledger (free vs paid · no double-count · split)
// ============================================================
// Proves the reporting invariants the purchase redesign depends on:
//   • a payment-free order counts as a SALE with ZERO revenue;
//   • a settled order reports only the money actually COLLECTED;
//   • awaiting-payment / failed / cancelled orders are NOT sales;
//   • a checkout order and the subscription it created are never double-counted;
//   • a legacy subscription with no checkout order still reports;
//   • the base / discount / tax / final / collected split is preserved.
//
// `@/lib/db` is replaced with an in-memory store (same pattern as the other
// admin suites) so nothing touches the live `.data` directory.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: (id: string) =>
    (h.tables.get("users") as Record<string, unknown>[] | undefined)?.find((u) => u["id"] === id),
  normalizeStoredMobile: (m: string) => m,
}));

import {
  salesLedger,
  salesInWindow,
  summarizeSales,
  isEarningOrderStatus,
  EARNING_ORDER_STATUSES,
} from "@/lib/admin/sales-report";
import { listOrders } from "@/lib/admin/orders";
import type { CheckoutOrderStatus, StoredOrder, StoredSubscription } from "@legalir/types";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** A complete checkout order with defaults; override any field. */
function order(over: Partial<StoredOrder>): StoredOrder {
  return {
    id: "ord-1",
    referenceId: "ORD-1",
    userId: "u1",
    planCode: "gold",
    planNameFa: "طلایی",
    durationDays: 31,
    currency: "IRT",
    basePrice: 1_000_000,
    listPrice: 1_200_000,
    couponId: null,
    couponCode: null,
    couponKind: null,
    couponValue: null,
    discountAmount: 0,
    discountPercent: 0,
    taxAmount: 0,
    taxRatePercent: 0,
    otherAmount: 0,
    finalAmount: 1_000_000,
    collectedAmount: 0,
    status: "awaiting_payment",
    paymentId: null,
    subscriptionId: null,
    gateway: "mock",
    trackingId: null,
    idempotencyKey: "k1",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
    paidAt: null,
    ...over,
  };
}

/** A legacy subscription row (the old shape). */
function sub(over: Partial<StoredSubscription>): StoredSubscription {
  return {
    id: "sub-legacy",
    user_id: "u1",
    plan_code: "silver",
    plan_name_fa: "نقره‌ای",
    amount: 500_000,
    currency: "IRT",
    status: "active",
    status_fa: "فعال",
    start_at: daysAgo(5),
    end_at: daysAgo(-25),
    purchased_at: daysAgo(5),
    auto_renew: 0,
    payment_id: null,
    superseded_at: null,
    updated_at: daysAgo(5),
    ...over,
  } as StoredSubscription;
}

describe("sales-report — earning statuses", () => {
  it("treats only no_payment_required and paid as earned sales", () => {
    expect(EARNING_ORDER_STATUSES).toEqual(["no_payment_required", "paid"]);
    const all: CheckoutOrderStatus[] = [
      "awaiting_payment",
      "paid",
      "failed",
      "cancelled",
      "no_payment_required",
      "refunded",
    ];
    const earned = all.filter(isEarningOrderStatus);
    expect(earned).toEqual(["paid", "no_payment_required"]);
  });
});

describe("sales-report — free vs paid vs pending", () => {
  beforeEach(() => h.tables.clear());

  it("counts a free order as a sale with ZERO revenue", () => {
    h.tables.set("orders", [
      order({
        id: "ord-free",
        status: "no_payment_required",
        basePrice: 1_000_000,
        discountAmount: 1_000_000,
        finalAmount: 0,
        collectedAmount: 0,
        subscriptionId: "sub-free",
        paidAt: daysAgo(3),
      }),
    ]);
    // The subscription the free order created must NOT be double-counted.
    h.tables.set("subscriptions", [
      sub({ id: "sub-free", amount: 1_000_000, purchased_at: daysAgo(3) }),
    ]);
    const totals = summarizeSales(salesLedger());
    expect(totals.count).toBe(1); // the free order is a sale…
    expect(totals.finalAmount).toBe(0);
    expect(totals.collectedAmount).toBe(0); // …but brings in no money
    expect(totals.discountAmount).toBe(1_000_000);
  });

  it("reports only the collected amount for a settled order", () => {
    h.tables.set("orders", [
      order({
        id: "ord-paid",
        status: "paid",
        basePrice: 1_000_000,
        discountAmount: 100_000,
        taxAmount: 0,
        finalAmount: 900_000,
        collectedAmount: 900_000,
        subscriptionId: "sub-paid",
        paidAt: daysAgo(2),
      }),
    ]);
    h.tables.set("subscriptions", [
      sub({ id: "sub-paid", amount: 1_000_000, purchased_at: daysAgo(2) }),
    ]);
    const totals = summarizeSales(salesLedger());
    expect(totals.count).toBe(1);
    expect(totals.baseAmount).toBe(1_000_000);
    expect(totals.discountAmount).toBe(100_000);
    expect(totals.finalAmount).toBe(900_000);
    expect(totals.collectedAmount).toBe(900_000);
  });

  it("excludes awaiting-payment / failed / cancelled orders entirely", () => {
    h.tables.set("orders", [
      order({ id: "ord-await", status: "awaiting_payment", subscriptionId: "sub-await" }),
      order({ id: "ord-fail", status: "failed", subscriptionId: null }),
      order({ id: "ord-cancel", status: "cancelled", subscriptionId: null }),
    ]);
    // The pending subscription backing the unpaid order must be deduped against
    // its order even though that order is not itself a sale.
    h.tables.set("subscriptions", [
      sub({ id: "sub-await", amount: 1_000_000, status: "pending", status_fa: "در انتظار پرداخت" }),
    ]);
    expect(salesLedger()).toEqual([]);
    expect(summarizeSales(salesLedger()).count).toBe(0);
  });

  it("includes the unpaid orders only when explicitly asked", () => {
    h.tables.set("orders", [
      order({ id: "ord-await", status: "awaiting_payment", collectedAmount: 0, subscriptionId: "sub-await" }),
    ]);
    h.tables.set("subscriptions", [
      sub({ id: "sub-await", status: "pending", status_fa: "در انتظار پرداخت" }),
    ]);
    const withUnearned = salesLedger({ includeUnearned: true });
    expect(withUnearned.length).toBe(1);
    expect(withUnearned[0]!.collectedAmount).toBe(0);
    expect(withUnearned[0]!.orderStatus).toBe("awaiting_payment");
  });
});

describe("sales-report — de-duplication and legacy fallback", () => {
  beforeEach(() => h.tables.clear());

  it("never double-counts an order and the subscription it created", () => {
    h.tables.set("orders", [
      order({ id: "ord-x", status: "paid", subscriptionId: "sub-x", collectedAmount: 800_000, finalAmount: 800_000, paidAt: daysAgo(1) }),
    ]);
    h.tables.set("subscriptions", [sub({ id: "sub-x", amount: 800_000 })]);
    const ledger = salesLedger();
    expect(ledger.length).toBe(1);
    expect(ledger[0]!.source).toBe("order");
  });

  it("still reports a legacy subscription with no checkout order", () => {
    h.tables.set("subscriptions", [sub({ id: "sub-legacy", amount: 500_000 })]);
    const ledger = salesLedger();
    expect(ledger.length).toBe(1);
    expect(ledger[0]!.source).toBe("subscription");
    expect(ledger[0]!.collectedAmount).toBe(500_000);
    expect(ledger[0]!.basePrice).toBe(500_000);
  });
});

describe("sales-report — windowing", () => {
  beforeEach(() => h.tables.clear());

  it("filters sales to a half-open ISO window", () => {
    const from = daysAgo(10);
    const to = new Date().toISOString();
    h.tables.set("orders", [
      order({ id: "ord-in", status: "paid", collectedAmount: 100, finalAmount: 100, paidAt: daysAgo(5), subscriptionId: "s-in" }),
      order({ id: "ord-out", status: "paid", collectedAmount: 100, finalAmount: 100, paidAt: daysAgo(40), subscriptionId: "s-out" }),
    ]);
    const inWin = salesInWindow(from, to);
    expect(inWin.length).toBe(1);
    expect(inWin[0]!.id).toBe("ord-in");
  });
});

describe("sales-report — admin orders panel surfaces the split", () => {
  beforeEach(() => h.tables.clear());

  it("projects a checkout order with base/discount/collected and a gateway label", () => {
    h.tables.set("users", [{ id: "u1", mobile: "09120000001", displayName: "خریدار", orgId: null }]);
    h.tables.set("orders", [
      order({
        id: "ord-a",
        status: "paid",
        listPrice: 1_000_000,
        basePrice: 1_000_000,
        discountAmount: 200_000,
        finalAmount: 800_000,
        collectedAmount: 800_000,
        subscriptionId: "sub-a",
        gateway: "mock",
        paidAt: daysAgo(2),
      }),
      order({
        id: "ord-free",
        status: "no_payment_required",
        basePrice: 500_000,
        discountAmount: 500_000,
        finalAmount: 0,
        collectedAmount: 0,
        subscriptionId: "sub-free2",
        gateway: "none",
        paidAt: daysAgo(4),
      }),
    ]);
    h.tables.set("subscriptions", [
      sub({ id: "sub-a", amount: 1_000_000 }),
      sub({ id: "sub-free2", amount: 500_000 }),
    ]);
    const res = listOrders({});
    expect(res.total).toBe(2); // no double-count from the subscriptions
    const paid = res.items.find((o) => o.id === "sub-a")!;
    expect(paid.salePrice).toBe(800_000);
    expect(paid.discountAmount).toBe(200_000);
    expect(paid.netAmount).toBe(800_000);
    expect(paid.status).toBe("SUCCESS");
    const free = res.items.find((o) => o.id === "sub-free2")!;
    expect(free.salePrice).toBe(0);
    expect(free.gateway).toBe("بدون پرداخت");
    expect(free.status).toBe("SUCCESS"); // a free activation is a completed sale
  });

  it("marks an awaiting-payment order PENDING (not a sale)", () => {
    h.tables.set("orders", [
      order({ id: "ord-p", status: "awaiting_payment", subscriptionId: "sub-p" }),
    ]);
    const res = listOrders({});
    const o = res.items.find((x) => x.id === "sub-p")!;
    expect(o.status).toBe("PENDING");
  });
});
