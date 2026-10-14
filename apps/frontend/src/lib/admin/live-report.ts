// ============================================================
// LEGALIR — Admin live report (server-only, read-only)
// ============================================================
// A compact, self-contained snapshot of the SAME real tables the overview and
// reports read. It exists so the «گزارش زنده» block can refresh on its own
// cadence with a small payload — without re-pulling the whole overview.
//
// Everything here is a REAL sum or count from the persisted store:
//   • the monetary split comes from the unified sales ledger (never summed
//     twice — a checkout order and the subscription it created are reconciled);
//   • "unpaid" counts real orders that are awaiting payment / failed / cancelled;
//   • refunds are completed rows in `financial_adjustments`.
//
// Nothing is derived, estimated or fabricated. Every field of `AdminLiveReport`
// is a real sum or count.
// ============================================================

import { readTable } from "@/lib/db";
import { ACTIVE_LEGAL_REQUEST_STATES } from "@legalir/types";
import type { AdminLiveReport, AdminLivePoint, StoredOrder } from "@legalir/types";
import { resolveWindow } from "./metrics";
import {
  isEarningOrderStatus,
  salesInWindow,
  summarizeSales,
  type SaleRecord,
} from "./sales-report";

const TIMEZONE = "Asia/Tehran";
const CURRENCY = "IRT";
const DAY_MS = 86_400_000;

interface UserRow {
  id: string;
  createdAt: string;
}

interface RequestRow {
  id: string;
  state: string;
  createdAt: string;
}

interface AdjustmentRow {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  /** ISO instant the adjustment was recorded. */
  createdAt: string;
}

/** Count rows whose ISO timestamp falls inside `[from, to)`. */
function countInWindow<T>(rows: T[], from: string, to: string, get: (r: T) => string): number {
  return rows.reduce((n, r) => {
    const ts = get(r);
    return ts >= from && ts < to ? n + 1 : n;
  }, 0);
}

/**
 * Completed-refund sum, keyed by the id a `FinancialAdjustment` references.
 *
 * A refund is created against the ADMIN order id — `subscriptionId ?? order.id`
 * (see lib/admin/orders.ts) — while the sales ledger keys a checkout order by its
 * OWN id. This map is therefore keyed by that same admin id, and `refundKeyFor`
 * translates a ledger sale id into it so a checkout order's refund is matched.
 */
function completedRefundsByAdjustmentKey(adjustments: AdjustmentRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of adjustments) {
    if (a.status !== "completed") continue;
    m.set(a.orderId, (m.get(a.orderId) ?? 0) + a.amount);
  }
  return m;
}

/** The admin-order id a sale's refunds are recorded against. */
function refundKeyForSale(
  saleId: string,
  refundKeyByOrderId: Map<string, string>
): string {
  return refundKeyByOrderId.get(saleId) ?? saleId;
}

/** Collected amount per day over the window, oldest first. */
function dailyCollected(records: SaleRecord[], fromIso: string, toIso: string): AdminLivePoint[] {
  const byDay = new Map<string, number>();
  for (const r of records) {
    const day = r.purchasedAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + r.collectedAmount);
  }
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const points: AdminLivePoint[] = [];
  for (let t = startDay; t <= end.getTime(); t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    points.push({ date: day, value: byDay.get(day) ?? 0 });
  }
  return points;
}

/**
 * Build the live report for a rolling window (or an explicit date range). The
 * window geometry is `resolveWindow` — the same one `buildOverview` uses — so
 * the two surfaces always agree on the range and the boundary instant.
 */
export function buildLiveReport(
  rangeDays = 30,
  explicit?: { from: string; to: string } | null
): AdminLiveReport {
  const window = resolveWindow(rangeDays, explicit);
  const { fromIso, toIso } = window;

  const users = readTable<UserRow>("users");
  const requests = readTable<RequestRow>("legal_requests");
  const adjustments = readTable<AdjustmentRow>("financial_adjustments");
  const orders = readTable<StoredOrder>("orders");

  // --- Sales: the SAME unified ledger the overview/reports KPIs read ---
  const sales = salesInWindow(fromIso, toIso);
  const totals = summarizeSales(sales);
  // Map every checkout order's OWN id to the admin id its refunds reference, so
  // a refund recorded against `subscriptionId ?? id` matches the ledger sale.
  const refundKeyByOrderId = new Map<string, string>();
  for (const o of orders) refundKeyByOrderId.set(o.id, o.subscriptionId ?? o.id);
  const refunds = completedRefundsByAdjustmentKey(adjustments);
  let refundedAmount = 0;
  let paidCount = 0;
  let freeCount = 0;
  for (const s of sales) {
    refundedAmount += refunds.get(refundKeyForSale(s.id, refundKeyByOrderId)) ?? 0;
    if (s.collectedAmount > 0) paidCount += 1;
    else freeCount += 1;
  }

  // Orders that did NOT become a sale in the window — awaiting / failed /
  // cancelled. Counted by their own purchase instant (paidAt || createdAt),
  // matching the ledger's window rule.
  const unpaidCount = orders.reduce((n, o) => {
    if (isEarningOrderStatus(o.status)) return n;
    const ts = o.paidAt || o.createdAt;
    return ts >= fromIso && ts < toIso ? n + 1 : n;
  }, 0);

  // --- Real live snapshot counts ---
  const activeSet = new Set<string>(ACTIVE_LEGAL_REQUEST_STATES);
  const openRequests = requests.filter((r) => activeSet.has(r.state)).length;
  const refundPending = adjustments.filter((a) => a.status === "pending").length;

  return {
    generatedAt: new Date().toISOString(),
    rangeDays: window.rangeDays,
    timezone: TIMEZONE,
    currency: CURRENCY,
    sales: {
      count: totals.count,
      baseAmount: totals.baseAmount,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      finalAmount: totals.finalAmount,
      collectedAmount: totals.collectedAmount,
      refundedAmount,
      netAmount: totals.collectedAmount - refundedAmount,
      paidCount,
      freeCount,
      unpaidCount,
      currency: CURRENCY,
    },
    newUsers: countInWindow(users, fromIso, toIso, (u) => u.createdAt),
    newRequests: countInWindow(requests, fromIso, toIso, (r) => r.createdAt),
    openRequests,
    refundPending,
    dailyCollected: dailyCollected(sales, fromIso, toIso),
  };
}
