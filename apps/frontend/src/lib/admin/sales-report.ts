// ============================================================
// LEGALIR — Unified sales reporting ledger (server-only, read-only)
// ============================================================
// Two tables can describe a purchase:
//   • `orders`        — the authoritative checkout record (base / discount /
//                       tax / final / collected / status, all snapshotted).
//   • `subscriptions` — the legacy record that predates checkout and is still
//                       the storage for rows created outside the new flow.
//
// Reporting must never DOUBLE-COUNT a purchase (the checkout writes BOTH an
// order and a subscription) and must never FABRICATE revenue. This module is
// the ONE place that reconciles the two into a single ledger:
//
//   • Every checkout order enters the ledger UNLESS it is unearned (awaiting
//     payment / failed / cancelled). A payment-free (`no_payment_required`) or
//     `paid` order contributes its snapshot amounts; a free order therefore
//     contributes 1 to the sale COUNT and 0 to revenue — exactly as required.
//   • Every subscription NOT already covered by a checkout order (matched by
//     `StoredOrder.subscriptionId`) enters the ledger at its stored `amount`.
//
// The window helpers mirror the ISO half-open test used everywhere in the
// analytics layer so a KPI and the ledger it opens never disagree at a boundary.
// ============================================================

import { readTable } from "@/lib/db";
import type { CheckoutOrderStatus, StoredOrder } from "@legalir/types";

const ORDERS = "orders";
const SUBS = "subscriptions";

/**
 * Order statuses that represent an EARNED, reportable sale. `no_payment_required`
 * is a completed payment-free activation; `paid` is a settled payment. Everything
 * else (awaiting payment, failed, cancelled, refunded-only) is excluded from the
 * final sales count — a preview/attempt/pending order is never a sale.
 */
export const EARNING_ORDER_STATUSES: readonly CheckoutOrderStatus[] = [
  "no_payment_required",
  "paid",
];

export function isEarningOrderStatus(status: CheckoutOrderStatus): boolean {
  return EARNING_ORDER_STATUSES.includes(status);
}

/** Minimal shape of a legacy subscription row, for reporting only. */
interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status?: string;
  status_fa?: string;
  purchased_at: string;
}

/** One reportable purchase, with the monetary split preserved. */
export interface SaleRecord {
  id: string;
  referenceId: string;
  userId: string;
  planCode: string;
  planNameFa: string;
  currency: string;
  /** Pre-discount base (catalog sale price at purchase). */
  basePrice: number;
  discountAmount: number;
  taxAmount: number;
  /** The amount the customer owed (post-discount, post-tax). */
  finalAmount: number;
  /** Money actually received — 0 for a payment-free order. */
  collectedAmount: number;
  /** The purchase instant (paidAt for a settled order, else createdAt). */
  purchasedAt: string;
  source: "order" | "subscription";
  /** Checkout order status, or null for a legacy subscription row. */
  orderStatus: CheckoutOrderStatus | null;
}

/** Subscription ids already represented by a checkout order (dedup guard). */
function coveredSubscriptionIds(orders: StoredOrder[]): Set<string> {
  const set = new Set<string>();
  for (const o of orders) if (o.subscriptionId) set.add(o.subscriptionId);
  return set;
}

/** Project one checkout order onto a ledger record. */
function fromOrder(order: StoredOrder): SaleRecord {
  const earned = isEarningOrderStatus(order.status);
  return {
    id: order.id,
    referenceId: order.referenceId || order.id,
    userId: order.userId,
    planCode: order.planCode,
    planNameFa: order.planNameFa,
    currency: order.currency || "IRT",
    basePrice: order.basePrice || 0,
    discountAmount: order.discountAmount || 0,
    taxAmount: order.taxAmount || 0,
    finalAmount: order.finalAmount || 0,
    // Revenue is only ever money actually collected; an unearned order has none.
    collectedAmount: earned ? order.collectedAmount || 0 : 0,
    purchasedAt: order.paidAt || order.createdAt,
    source: "order",
    orderStatus: order.status,
  };
}

/** Project one legacy subscription row onto a ledger record. */
function fromSubscription(sub: SubscriptionRow): SaleRecord {
  const amount = sub.amount || 0;
  return {
    id: sub.id,
    referenceId: sub.id,
    userId: sub.user_id,
    planCode: sub.plan_code,
    planNameFa: sub.plan_name_fa,
    currency: sub.currency || "IRT",
    basePrice: amount,
    discountAmount: 0,
    taxAmount: 0,
    finalAmount: amount,
    collectedAmount: amount,
    purchasedAt: sub.purchased_at,
    source: "subscription",
    orderStatus: null,
  };
}

/**
 * The canonical sale ledger, newest first. By default it contains ONLY reportable
 * sales (earning orders + legacy subscriptions). Pass `includeUnearned` to also
 * list awaiting-payment/failed/cancelled orders — they carry `collectedAmount: 0`
 * and are for the operational view, never summed into revenue.
 */
export function salesLedger(opts: { includeUnearned?: boolean } = {}): SaleRecord[] {
  const orders = readTable<StoredOrder>(ORDERS);
  const covered = coveredSubscriptionIds(orders);

  const records: SaleRecord[] = [];
  for (const order of orders) {
    if (!isEarningOrderStatus(order.status) && !opts.includeUnearned) continue;
    records.push(fromOrder(order));
  }
  for (const sub of readTable<SubscriptionRow>(SUBS)) {
    if (covered.has(sub.id)) continue; // already represented by its order
    records.push(fromSubscription(sub));
  }

  return records.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

/** The four-way monetary split of a set of sales. */
export interface SalesTotals {
  count: number;
  baseAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  collectedAmount: number;
}

/** Sum a set of ledger records into the split (count = number of sales). */
export function summarizeSales(records: SaleRecord[]): SalesTotals {
  return records.reduce<SalesTotals>(
    (acc, r) => {
      acc.count += 1;
      acc.baseAmount += r.basePrice;
      acc.discountAmount += r.discountAmount;
      acc.taxAmount += r.taxAmount;
      acc.finalAmount += r.finalAmount;
      acc.collectedAmount += r.collectedAmount;
      return acc;
    },
    { count: 0, baseAmount: 0, discountAmount: 0, taxAmount: 0, finalAmount: 0, collectedAmount: 0 }
  );
}

/** Half-open ISO window test ([from, to)) — identical to the analytics helper. */
export function inWindow(iso: string | undefined, fromIso: string, toIso: string): boolean {
  return Boolean(iso && iso >= fromIso && iso < toIso);
}

/** Reportable sales whose purchase instant falls in `[fromIso, toIso)`. */
export function salesInWindow(fromIso: string, toIso: string): SaleRecord[] {
  return salesLedger().filter((r) => inWindow(r.purchasedAt, fromIso, toIso));
}

/**
 * The EARNING order statuses as the admin `OrderStatus` projection filters them.
 * `ordersNetInWindow` (finance reconciliation) uses this so its sum over the
 * orders panel agrees exactly with the ledger's collected revenue.
 */
export const EARNING_ADMIN_ORDER_STATUSES = ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
