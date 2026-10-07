// ============================================================
// LEGALIR — Analytics: Finance reconciliation
// ============================================================
// The money view, and — more importantly — the PROOF that the analytics layer
// and the orders panel agree. Gross sales come from the authoritative
// `subscriptions` table; refunds are completed `financial_adjustments`; net is
// gross − refunds. The orders model is re-read INDEPENDENTLY
// (via `listOrders`, the same module `/admin/orders` uses) and its summed
// `netAmount` must equal this net — that equality is what `reconcile.matches`
// asserts, so a drift between the two surfaces is loudly visible.
//
// Simulated payments are counted and labelled, never presented as real money.
// ============================================================

import type { FinanceAnalytics } from "@legalir/types";
import { listOrders } from "@/lib/admin/orders";
import { readSubscriptions, readAdjustments, readPayments, earliestDataIso } from "./sources";
import { resolveRange, toWindowInfo, withinWindow, type ResolveRangeInput } from "./range";
import { analyticsDataQuality } from "./quality";

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Completed refunds keyed by the order they reference. */
function completedRefunds(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of readAdjustments()) {
    if (a.status !== "completed") continue;
    m.set(a.orderId, (m.get(a.orderId) ?? 0) + a.amount);
  }
  return m;
}

/**
 * Sum the net amount of orders purchased in the window, using the orders
 * module itself (`listOrders`) so this is a genuine cross-check rather than a
 * re-derivation of the same formula.
 */
function ordersNetInWindow(fromIso: string, toIso: string): number {
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  let sum = 0;
  // pageSize is capped at 100 by the orders module; page until covered.
  while ((page - 1) * 100 < total && page <= 1000) {
    const res = listOrders({ page, pageSize: 100 });
    total = res.total;
    for (const o of res.items) {
      if (withinWindow(o.purchasedAt, fromIso, toIso)) sum += o.netAmount;
    }
    page += 1;
  }
  return sum;
}

/** Share of the positive net revenue held by the top `pct`% of buyers. */
function topShare(netsDesc: number[], totalPositive: number, pct: number): number {
  if (totalPositive <= 0 || netsDesc.length === 0) return 0;
  const k = Math.max(1, Math.round(netsDesc.length * pct));
  const top = netsDesc.slice(0, k).reduce((s, n) => s + n, 0);
  return round1((top / totalPositive) * 100);
}

/** Build the finance report for a resolved range, with the orders cross-check. */
export function buildFinanceAnalytics(input: ResolveRangeInput): FinanceAnalytics {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());
  const { fromIso, toIso } = resolved;

  const refunds = completedRefunds();

  // Gross + gross-derived refunds + per-buyer net (for concentration).
  let gross = 0;
  let refundsInWindow = 0;
  const netByBuyer = new Map<string, number>();
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    const r = refunds.get(s.id) ?? 0;
    const net = (s.amount || 0) - r;
    gross += s.amount || 0;
    refundsInWindow += r;
    netByBuyer.set(s.user_id, (netByBuyer.get(s.user_id) ?? 0) + net);
  }
  const net = gross - refundsInWindow;

  const ordersNet = ordersNetInWindow(fromIso, toIso);

  // Concentration over window buyers' net contribution.
  const netsDesc = [...netByBuyer.values()].sort((a, b) => b - a);
  const totalPositive = netsDesc.reduce((s, n) => s + (n > 0 ? n : 0), 0);
  const concentration = {
    buyers: netByBuyer.size,
    top1Pct: topShare(netsDesc, totalPositive, 0.01),
    top5Pct: topShare(netsDesc, totalPositive, 0.05),
    top10Pct: topShare(netsDesc, totalPositive, 0.1),
    top20Pct: topShare(netsDesc, totalPositive, 0.2),
  };

  // Pending refunds (awaiting a second approver) — a liability in flight.
  let refundPendingCount = 0;
  let refundPendingAmount = 0;
  for (const a of readAdjustments()) {
    if (a.status !== "pending") continue;
    refundPendingCount += 1;
    refundPendingAmount += a.amount;
  }

  // Payment health, window-scoped, with honest coverage vs subscriptions.
  const payments = readPayments();
  let paid = 0;
  let pending = 0;
  let failed = 0;
  let mock = 0;
  let windowCount = 0;
  const paidSubscriptionIds = new Set<string>();
  for (const p of payments) {
    const at = p.paidAt ?? p.createdAt;
    if (!withinWindow(at, fromIso, toIso)) continue;
    windowCount += 1;
    if (p.method === "mock") mock += 1;
    if (p.status === "paid") {
      paid += 1;
      if (p.subscriptionId) paidSubscriptionIds.add(p.subscriptionId);
    } else if (p.status === "pending") pending += 1;
    else if (p.status === "failed") failed += 1;
  }
  let windowSubscriptions = 0;
  let coveredSubscriptions = 0;
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    windowSubscriptions += 1;
    if (paidSubscriptionIds.has(s.id)) coveredSubscriptions += 1;
  }
  const coveragePct =
    windowSubscriptions === 0 ? null : round1((coveredSubscriptions / windowSubscriptions) * 100);

  return {
    window,
    gross,
    refunds: refundsInWindow,
    net,
    ordersNet,
    reconcile: {
      subscriptionGross: gross,
      net,
      matches: net === ordersNet,
    },
    refundPendingCount,
    refundPendingAmount,
    concentration,
    payments: { windowCount, paid, pending, failed, mock, coveragePct },
    quality: analyticsDataQuality(),
  };
}
