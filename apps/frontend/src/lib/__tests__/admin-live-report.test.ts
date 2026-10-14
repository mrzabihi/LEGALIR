// ============================================================
// LEGALIR — Admin live report (money split · free vs paid · refunds)
// ============================================================
// The live block shows money the operator acts on, so its arithmetic must be
// provable and honest:
//   • a 100%-discount (payment-free) order counts as a SALE yet adds ZERO to
//     «مبلغ وصول‌شده»;
//   • a checkout order and the subscription it created are never double-counted;
//   • only COMPLETED refunds reduce the net;
//   • an unearned order (awaiting/failed/cancelled) is counted as «بی‌پرداخت»,
//     never as a sale.
//
// `@/lib/db` is replaced with an in-memory store; nothing else is stubbed.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ tables: new Map<string, unknown[]>() }));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: () => undefined,
}));

import { buildLiveReport } from "@/lib/admin/live-report";
import type { StoredOrder } from "@legalir/types";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function seed(rows: Record<string, unknown[]>) {
  h.tables.clear();
  for (const [k, v] of Object.entries(rows)) h.tables.set(k, structuredClone(v));
}

/** A full, valid `StoredOrder` with sensible defaults the test can override. */
function order(over: Partial<StoredOrder> & { id: string }): StoredOrder {
  return {
    id: over.id,
    referenceId: over.referenceId ?? over.id,
    userId: over.userId ?? "u1",
    planCode: over.planCode ?? "gold",
    planNameFa: over.planNameFa ?? "طلایی",
    durationDays: over.durationDays ?? 30,
    currency: over.currency ?? "IRT",
    basePrice: over.basePrice ?? 0,
    listPrice: over.listPrice ?? over.basePrice ?? 0,
    couponId: over.couponId ?? null,
    couponCode: over.couponCode ?? null,
    couponKind: over.couponKind ?? null,
    couponValue: over.couponValue ?? null,
    discountAmount: over.discountAmount ?? 0,
    discountPercent: over.discountPercent ?? 0,
    taxAmount: over.taxAmount ?? 0,
    taxRatePercent: over.taxRatePercent ?? 0,
    otherAmount: over.otherAmount ?? 0,
    finalAmount: over.finalAmount ?? over.basePrice ?? 0,
    collectedAmount: over.collectedAmount ?? 0,
    status: over.status ?? "paid",
    paymentId: over.paymentId ?? null,
    subscriptionId: over.subscriptionId ?? null,
    gateway: over.gateway ?? "simulated",
    trackingId: over.trackingId ?? null,
    idempotencyKey: over.idempotencyKey ?? `k-${over.id}`,
    createdAt: over.createdAt ?? daysAgo(1),
    updatedAt: over.updatedAt ?? daysAgo(1),
    paidAt: over.paidAt ?? daysAgo(1),
  };
}

describe("buildLiveReport — sales money split", () => {
  beforeEach(() => seed({}));

  it("counts a 100%-discount (payment-free) order as a sale with ZERO collected", () => {
    seed({
      orders: [
        order({
          id: "o1",
          basePrice: 500_000,
          discountAmount: 500_000,
          finalAmount: 0,
          collectedAmount: 0,
          status: "no_payment_required",
        }),
      ],
    });
    const r = buildLiveReport(30);
    expect(r.sales.count).toBe(1); // a sale…
    expect(r.sales.collectedAmount).toBe(0); // …with no revenue
    expect(r.sales.freeCount).toBe(1);
    expect(r.sales.paidCount).toBe(0);
    expect(r.sales.discountAmount).toBe(500_000);
    expect(r.sales.baseAmount).toBe(500_000);
  });

  it("sums the real split for a paid order and derives net after a completed refund", () => {
    seed({
      orders: [
        order({
          id: "o1",
          basePrice: 1_000_000,
          discountAmount: 200_000,
          finalAmount: 800_000,
          collectedAmount: 800_000,
          status: "paid",
          subscriptionId: "s1",
        }),
      ],
      financial_adjustments: [
        // completed → reduces net; pending → does not.
        { id: "a1", orderId: "s1", amount: 300_000, status: "completed", createdAt: daysAgo(1) },
        { id: "a2", orderId: "s1", amount: 100_000, status: "pending", createdAt: daysAgo(1) },
      ],
    });
    const r = buildLiveReport(30);
    expect(r.sales.count).toBe(1);
    expect(r.sales.baseAmount).toBe(1_000_000);
    expect(r.sales.discountAmount).toBe(200_000);
    expect(r.sales.finalAmount).toBe(800_000);
    expect(r.sales.collectedAmount).toBe(800_000);
    expect(r.sales.refundedAmount).toBe(300_000); // only the completed one
    expect(r.sales.netAmount).toBe(500_000); // 800k − 300k
    expect(r.sales.paidCount).toBe(1);
    expect(r.refundPending).toBe(1); // the pending adjustment
  });

  it("never double-counts a checkout order and the subscription it created", () => {
    seed({
      orders: [
        order({
          id: "o1",
          basePrice: 500_000,
          finalAmount: 500_000,
          collectedAmount: 500_000,
          status: "paid",
          subscriptionId: "s1",
        }),
      ],
      subscriptions: [
        {
          id: "s1",
          user_id: "u1",
          plan_code: "gold",
          plan_name_fa: "طلایی",
          amount: 500_000,
          currency: "IRT",
          status_fa: "فعال",
          purchased_at: daysAgo(1),
        },
      ],
    });
    const r = buildLiveReport(30);
    expect(r.sales.count).toBe(1);
    expect(r.sales.collectedAmount).toBe(500_000);
  });

  it("counts an unearned order as بی‌پرداخت, never as a sale", () => {
    seed({
      orders: [
        order({ id: "o1", status: "awaiting_payment", basePrice: 500_000, finalAmount: 500_000 }),
        order({
          id: "o2",
          status: "paid",
          basePrice: 300_000,
          finalAmount: 300_000,
          collectedAmount: 300_000,
        }),
      ],
    });
    const r = buildLiveReport(30);
    expect(r.sales.count).toBe(1);
    expect(r.sales.unpaidCount).toBe(1);
    expect(r.sales.collectedAmount).toBe(300_000);
  });

  it("builds a per-day collected series over the whole window", () => {
    seed({
      orders: [
        order({
          id: "o1",
          status: "paid",
          basePrice: 100,
          finalAmount: 100,
          collectedAmount: 100,
          paidAt: daysAgo(1),
        }),
        order({
          id: "o2",
          status: "paid",
          basePrice: 200,
          finalAmount: 200,
          collectedAmount: 200,
          paidAt: daysAgo(1),
        }),
      ],
    });
    const r = buildLiveReport(7);
    // One bucket per day the window spans (at most rangeDays + 1).
    expect(r.dailyCollected.length).toBeLessThanOrEqual(8);
    expect(r.dailyCollected.length).toBeGreaterThanOrEqual(7);
    // The day buckets carry exactly the collected money the sales split reports.
    const sum = r.dailyCollected.reduce((s, p) => s + p.value, 0);
    expect(sum).toBe(300);
    expect(sum).toBe(r.sales.collectedAmount);
  });

  it("reports real live snapshot counts (open requests, new users/requests)", () => {
    seed({
      users: [
        { id: "u1", createdAt: daysAgo(2) },
        { id: "u2", createdAt: daysAgo(90) }, // outside the window
      ],
      legal_requests: [
        { id: "r1", state: "IN_PROGRESS", createdAt: daysAgo(1) },
        { id: "r2", state: "COMPLETED", createdAt: daysAgo(1) }, // terminal
        { id: "r3", state: "ACCEPTED", createdAt: daysAgo(80) },
      ],
    });
    const r = buildLiveReport(30);
    expect(r.newUsers).toBe(1);
    expect(r.newRequests).toBe(2); // r1 + r2 created in-window (any state)
    expect(r.openRequests).toBe(2); // r1 (IN_PROGRESS) + r3 (ACCEPTED) are non-terminal
  });

  it("echoes the resolved range and currency, and stamps a generatedAt", () => {
    seed({});
    const r = buildLiveReport(90);
    expect(r.rangeDays).toBe(90);
    expect(r.currency).toBe("IRT");
    expect(Date.parse(r.generatedAt)).not.toBeNaN();
  });
});
