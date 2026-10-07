// ============================================================
// LEGALIR — Analytics: Report 1 — subscription sales by plan
// ============================================================
// The authoritative sales source is the `subscriptions` table (every row is
// a real purchase). Refunds arrive as `financial_adjustments` rows that
// reference an order id; they are attributed to the plan/period of the
// ORIGINAL purchase, so a net figure never drifts from the order it refunds.
// ============================================================

import type {
  SubscriptionSalesReport,
  PlanSalesRow,
  PlanDailyBucket,
  AnalyticsComparison,
} from "@legalir/types";
import { readSubscriptions, readPlans, readAdjustments, earliestDataIso } from "./sources";
import {
  resolveRange,
  toWindowInfo,
  withinWindow,
  tehranDayBuckets,
  tehranDayKey,
  shiftDayKey,
  changePct,
  type ResolveRangeInput,
} from "./range";
import { analyticsDataQuality } from "./quality";

/** Completed refunds keyed by the order they reference. */
function refundMap(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of readAdjustments()) {
    if (a.status !== "completed") continue;
    m.set(a.orderId, (m.get(a.orderId) ?? 0) + a.amount);
  }
  return m;
}

/** Aggregate purchases in [fromIso,toIso) into per-plan totals. */
function planTotals(fromIso: string, toIso: string): Map<string, PlanSalesRow> {
  const refunds = refundMap();
  const byCode = new Map<string, PlanSalesRow>();
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    const refunded = refunds.get(s.id) ?? 0;
    const row = byCode.get(s.plan_code) ?? {
      planCode: s.plan_code,
      planNameFa: s.plan_name_fa,
      count: 0,
      gross: 0,
      refunded: 0,
      net: 0,
      revenueSharePct: 0,
    };
    row.count += 1;
    row.gross += s.amount || 0;
    row.refunded += refunded;
    row.net += (s.amount || 0) - refunded;
    byCode.set(s.plan_code, row);
  }
  return byCode;
}

/** Total count/gross/refund/net for a whole window. */
function windowTotals(fromIso: string, toIso: string): {
  count: number;
  gross: number;
  refunded: number;
  net: number;
} {
  const refunds = refundMap();
  let count = 0;
  let gross = 0;
  let refunded = 0;
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    const r = refunds.get(s.id) ?? 0;
    count += 1;
    gross += s.amount || 0;
    refunded += r;
  }
  return { count, gross, refunded, net: gross - refunded };
}

/** One bucket per Tehran day, with a per-plan breakdown (zero-filled). */
function dailyBuckets(fromIso: string, toIso: string): PlanDailyBucket[] {
  const refunds = refundMap();
  // Pre-index purchases by Tehran day to avoid an O(days × rows) scan.
  const dayPlan = new Map<string, Map<string, { count: number; gross: number; net: number }>>();
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    const day = tehranDayKey(s.purchased_at);
    const inner = dayPlan.get(day) ?? new Map();
    const cell = inner.get(s.plan_code) ?? { count: 0, gross: 0, net: 0 };
    const r = refunds.get(s.id) ?? 0;
    cell.count += 1;
    cell.gross += s.amount || 0;
    cell.net += (s.amount || 0) - r;
    inner.set(s.plan_code, cell);
    dayPlan.set(day, inner);
  }
  return tehranDayBuckets(fromIso, toIso).map((date) => {
    const inner = dayPlan.get(date);
    const plans = inner ? [...inner.entries()].map(([planCode, v]) => ({ planCode, ...v })) : [];
    return { date, plans };
  });
}

/**
 * The equal-length PREVIOUS window's net per Tehran day, aligned by index to
 * `days` (the current window's day list): entry i is the net on the day exactly
 * `days.length` earlier than `days[i]`. Computed ONLY when the previous window
 * is genuinely covered — otherwise the caller gets `null` and draws no overlay,
 * because a comparison against data that does not exist would be a fabrication.
 */
function previousDailyNet(
  days: string[],
  fromIso: string,
  toIso: string,
  rangeDays: number,
  comparable: boolean
): { date: string; net: number }[] | null {
  if (!comparable || days.length === 0) return null;
  const refunds = refundMap();
  const byDay = new Map<string, number>();
  for (const s of readSubscriptions()) {
    if (!withinWindow(s.purchased_at, fromIso, toIso)) continue;
    const day = tehranDayKey(s.purchased_at);
    byDay.set(day, (byDay.get(day) ?? 0) + (s.amount || 0) - (refunds.get(s.id) ?? 0));
  }
  return days.map((day) => {
    const prevDay = shiftDayKey(day, -rangeDays);
    return { date: prevDay, net: byDay.get(prevDay) ?? 0 };
  });
}

/** Build the full subscriptions report for a resolved range. */
export function buildSubscriptionSalesReport(input: ResolveRangeInput): SubscriptionSalesReport {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());
  const { fromIso, toIso, prevFromIso, prevToIso } = resolved;

  const cur = windowTotals(fromIso, toIso);
  const prev = windowTotals(prevFromIso, prevToIso);
  const comparable = window.comparable;

  const countCmp: AnalyticsComparison = {
    current: cur.count,
    previous: comparable ? prev.count : null,
    changePct: comparable ? changePct(cur.count, prev.count) : null,
  };
  const grossCmp: AnalyticsComparison = {
    current: cur.gross,
    previous: comparable ? prev.gross : null,
    changePct: comparable ? changePct(cur.gross, prev.gross) : null,
  };
  const netCmp: AnalyticsComparison = {
    current: cur.net,
    previous: comparable ? prev.net : null,
    changePct: comparable ? changePct(cur.net, prev.net) : null,
  };

  const byCode = planTotals(fromIso, toIso);
  const catalog = readPlans();
  // Include every plan in the legend even with zero sales, ordered by the real
  // catalog, then append any sold plan not present in the catalog.
  const orderedCodes: string[] = [];
  for (const p of catalog) if (!orderedCodes.includes(p.code)) orderedCodes.push(p.code);
  for (const code of byCode.keys()) if (!orderedCodes.includes(code)) orderedCodes.push(code);

  const totalNet = [...byCode.values()].reduce((sum, r) => sum + r.net, 0);
  const byPlan: PlanSalesRow[] = orderedCodes.map((code) => {
    const row =
      byCode.get(code) ??
      ({
        planCode: code,
        planNameFa: catalog.find((p) => p.code === code)?.nameFa ?? code,
        count: 0,
        gross: 0,
        refunded: 0,
        net: 0,
        revenueSharePct: 0,
      } satisfies PlanSalesRow);
    row.revenueSharePct = totalNet === 0 ? 0 : Math.round((row.net / totalNet) * 1000) / 10;
    return row;
  });
  // Sort by gross descending for the table; zero-sales plans fall to the tail.
  byPlan.sort((a, b) => b.gross - a.gross || a.planNameFa.localeCompare(b.planNameFa, "fa"));

  const daily = dailyBuckets(fromIso, toIso);

  return {
    window,
    totals: { count: countCmp, gross: grossCmp, net: netCmp },
    byPlan,
    daily,
    previousDaily: previousDailyNet(
      daily.map((d) => d.date),
      prevFromIso,
      prevToIso,
      window.rangeDays,
      comparable
    ),
    planCatalog: catalog.map((p) => ({
      planCode: p.code,
      planNameFa: p.nameFa,
      salePrice: p.salePrice,
    })),
    quality: analyticsDataQuality(),
  };
}
