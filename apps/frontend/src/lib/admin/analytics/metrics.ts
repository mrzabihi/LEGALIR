// ============================================================
// LEGALIR — Analytics: shared KPI builders + Executive Overview
// ============================================================
// Reusable, honest KPI constructors plus the overview aggregator. A KPI is
// either real (a value derived from a table) or explicitly `unavailable`
// with a reason — there is no third, "estimated" state.
// ============================================================

import type {
  AnalyticsKpiCard,
  AnalyticsOverview,
  AnalyticsComparison,
} from "@legalir/types";
import {
  readSubscriptions,
  readUsers,
  readRewardLedger,
  readUsageTransactions,
  readPlans,
  readAdjustments,
  earliestDataIso,
} from "./sources";
import { resolveRange, toWindowInfo, withinWindow, changePct, type ResolveRangeInput } from "./range";
import { analyticsDataQuality } from "./quality";

const TIMEZONE = "Asia/Tehran";
const CURRENCY = "IRT";

/** Destination pages a KPI can open, carrying the exact window it reported on. */
const DRILL_ORDERS = "/admin/orders";
const DRILL_USERS = "/admin/users";

/**
 * Append the resolved window to a drill link as ISO instants. The destination
 * page scopes its list to this window, so what the operator opens reconciles
 * to the KPI value they clicked — the whole point of "preserve the range".
 */
function drillHrefWithWindow(href: string, fromIso: string, toIso: string): string {
  return `${href}?fromIso=${encodeURIComponent(fromIso)}&toIso=${encodeURIComponent(toIso)}`;
}

/** A real KPI card. */
export function kpi(
  key: string,
  labelFa: string,
  value: number,
  formulaFa: string,
  opts: { drillHref?: string; unitFa?: string; trend?: "neutral" | "inverse" } = {}
): AnalyticsKpiCard {
  return {
    key,
    labelFa,
    value,
    formulaFa,
    ...(opts.drillHref ? { drillHref: opts.drillHref } : {}),
    ...(opts.unitFa ? { unitFa: opts.unitFa } : {}),
    ...(opts.trend ? { trend: opts.trend } : {}),
  };
}

/** A card that cannot be derived from available data — never faked. */
export function unavailableKpi(key: string, labelFa: string, reasonFa: string): AnalyticsKpiCard {
  return {
    key,
    labelFa,
    value: 0,
    formulaFa: "—",
    unavailable: true,
    unavailableReasonFa: reasonFa,
  };
}

/** A KPI carrying a real previous-period value (or `null` when not comparable). */
export function comparableKpi(
  key: string,
  labelFa: string,
  value: number,
  previous: number | null,
  formulaFa: string,
  opts: { drillHref?: string; unitFa?: string; trend?: "neutral" | "inverse" } = {}
): AnalyticsKpiCard {
  return {
    key,
    labelFa,
    value,
    formulaFa,
    previousValue: previous,
    changePct: changePct(value, previous),
    ...(opts.drillHref ? { drillHref: opts.drillHref } : {}),
    ...(opts.unitFa ? { unitFa: opts.unitFa } : {}),
    ...(opts.trend ? { trend: opts.trend } : {}),
  };
}

/** Build a comparison cell from a current/previous pair. */
export function comparison(current: number, previous: number | null): AnalyticsComparison {
  return { current, previous, changePct: changePct(current, previous) };
}

/** Sum of completed refunds referencing orders purchased in a window. */
export function refundsInWindow(fromIso: string, toIso: string): number {
  const subs = new Map(readSubscriptions().map((s) => [s.id, s]));
  let total = 0;
  for (const a of readAdjustments()) {
    if (a.status !== "completed") continue;
    const sub = subs.get(a.orderId);
    if (sub && withinWindow(sub.purchased_at, fromIso, toIso)) total += a.amount;
  }
  return total;
}

/** Subscription purchases in a window: count + gross amount. */
export function salesInWindow(fromIso: string, toIso: string): { count: number; gross: number } {
  const subs = readSubscriptions().filter((s) => withinWindow(s.purchased_at, fromIso, toIso));
  return {
    count: subs.length,
    gross: subs.reduce((sum, s) => sum + (s.amount || 0), 0),
  };
}

/** Distinct users who purchased in a window. */
export function buyersInWindow(fromIso: string, toIso: string): number {
  const set = new Set<string>();
  for (const s of readSubscriptions()) {
    if (withinWindow(s.purchased_at, fromIso, toIso)) set.add(s.user_id);
  }
  return set.size;
}

/** Positive reward points issued in a window. */
export function pointsIssuedInWindow(fromIso: string, toIso: string): number {
  return readRewardLedger().reduce(
    (sum, r) =>
      withinWindow(r.created_at, fromIso, toIso) && r.points_delta > 0 ? sum + r.points_delta : sum,
    0
  );
}

/** Energy consumed (points) in a window, from real usage transactions. */
export function energyConsumedInWindow(fromIso: string, toIso: string): number {
  return readUsageTransactions().reduce(
    (sum, u) =>
      withinWindow(u.createdAt, fromIso, toIso) && u.status !== "FAILED" ? sum + (u.pointsCost || 0) : sum,
    0
  );
}

/** Live count of active subscriptions right now. */
function activeSubscriptions(): number {
  const nowIso = new Date().toISOString();
  return readSubscriptions().filter(
    (s) => (s.status === "active" || s.status_fa === "فعال") && s.end_at > nowIso
  ).length;
}

/**
 * The Executive Overview: a compact set of real KPIs across sales, users and
 * energy, each with an honest previous-period comparison.
 */
export function buildAnalyticsOverview(input: ResolveRangeInput): AnalyticsOverview {
  const resolved = resolveRange(input);
  const window = toWindowInfo(resolved, earliestDataIso());
  const { fromIso, toIso, prevFromIso, prevToIso } = resolved;

  const cur = salesInWindow(fromIso, toIso);
  const prev = salesInWindow(prevFromIso, prevToIso);
  const curRefund = refundsInWindow(fromIso, toIso);
  const prevRefund = refundsInWindow(prevFromIso, prevToIso);
  const curNet = cur.gross - curRefund;
  const prevNet = prev.gross - prevRefund;

  const curBuyers = buyersInWindow(fromIso, toIso);
  const prevBuyers = buyersInWindow(prevFromIso, prevToIso);

  const curNewUsers = readUsers().filter((u) => withinWindow(u.createdAt, fromIso, toIso)).length;
  const prevNewUsers = readUsers().filter((u) => withinWindow(u.createdAt, prevFromIso, prevToIso)).length;

  const curPoints = pointsIssuedInWindow(fromIso, toIso);
  const prevPoints = pointsIssuedInWindow(prevFromIso, prevToIso);

  const curConsumed = energyConsumedInWindow(fromIso, toIso);
  const prevConsumed = energyConsumedInWindow(prevFromIso, prevToIso);

  // Comparisons are only honest when the previous window is genuinely covered.
  const pSales = window.comparable ? prev.count : null;
  const pGross = window.comparable ? prev.gross : null;
  const pNet = window.comparable ? prevNet : null;
  const pRefund = window.comparable ? prevRefund : null;
  const pBuyers = window.comparable ? prevBuyers : null;
  const pNewUsers = window.comparable ? prevNewUsers : null;
  const pPoints = window.comparable ? prevPoints : null;
  const pConsumed = window.comparable ? prevConsumed : null;

  const activePlans = readPlans().filter((p) => p.isActive).length;

  const kpis: AnalyticsKpiCard[] = [
    kpi(
      "active_subscriptions",
      "اشتراک‌های فعال",
      activeSubscriptions(),
      "اشتراک‌های با وضعیت «فعال» و پایان‌نیافته (تصویر لحظه‌ای)",
      { drillHref: "/admin/plans" }
    ),
    comparableKpi("sales_count", "تعداد فروش", cur.count, pSales, "خریدهای بازهٔ انتخاب‌شده از جدول اشتراک‌ها", {
      drillHref: drillHrefWithWindow(DRILL_ORDERS, fromIso, toIso),
    }),
    comparableKpi("gross_revenue", "درآمد ناخالص", cur.gross, pGross, "مجموع مبلغ خریدها در بازه", {
      drillHref: drillHrefWithWindow(DRILL_ORDERS, fromIso, toIso),
      unitFa: "تومان",
    }),
    comparableKpi("net_revenue", "درآمد خالص", curNet, pNet, "درآمد ناخالص منهای بازگشت وجه تکمیل‌شده", {
      drillHref: drillHrefWithWindow(DRILL_ORDERS, fromIso, toIso),
      unitFa: "تومان",
    }),
    comparableKpi("refunds", "بازگشت وجه", curRefund, pRefund, "مجموع تعدیل‌های مالی «تکمیل‌شده» در بازه", {
      drillHref: drillHrefWithWindow(DRILL_ORDERS, fromIso, toIso),
      unitFa: "تومان",
      trend: "inverse",
    }),
    comparableKpi("buyers", "خریداران یکتا", curBuyers, pBuyers, "کاربران متمایزی که در بازه خرید کرده‌اند", {
      drillHref: "/admin/analytics",
    }),
    comparableKpi("new_users", "کاربران جدید", curNewUsers, pNewUsers, "کاربران با تاریخ عضویت در بازه", {
      drillHref: drillHrefWithWindow(DRILL_USERS, fromIso, toIso),
    }),
    comparableKpi("points_issued", "امتیاز صادرشده", curPoints, pPoints, "مجموع امتیازهای مثبت دفتر پاداش در بازه", {
      drillHref: "/admin/analytics",
    }),
    comparableKpi(
      "energy_consumed",
      "انرژی مصرف‌شده",
      curConsumed,
      pConsumed,
      "مجموع مصرف انرژی از تراکنش‌های استفاده در بازه",
      { drillHref: "/admin/analytics" }
    ),
    kpi("active_plans", "پلن‌های فعال", activePlans, "تعداد پلن‌های فعال در کاتالوگ", {
      drillHref: "/admin/plans",
    }),
    unavailableKpi(
      "ai_error_rate",
      "نرخ خطای هوش مصنوعی",
      "تلهمتری نتیجه/خطای فراخوانی مدل ثبت نمی‌شود؛ پس از افزودن لاگ‌گیری قابل محاسبه است."
    ),
  ];

  return {
    window,
    generatedAt: new Date().toISOString(),
    timezone: TIMEZONE,
    currency: CURRENCY,
    kpis,
    quality: analyticsDataQuality(),
  };
}
