// ============================================================
// LEGALIR — Admin metrics & reporting (server-only, read-only)
// ============================================================
// The overview KPIs and revenue reports are computed from the REAL
// tables — nothing is invented. When a figure cannot be derived from
// available data (e.g. AI error rate without provider telemetry), the
// KPI is returned with `unavailable: true` and a reason, never a fake
// zero that could be mistaken for a real measurement.
//
// Amounts are integers in Toman (IRT). All date windows are evaluated
// against ISO timestamps stored on each row; the display timezone is
// Asia/Tehran but the arithmetic is UTC-safe (ISO string compare).
// ============================================================

import { readTable } from "@/lib/db";
import {
  LEGAL_CATEGORY_FA,
  LEGAL_REQUEST_STATE_FA,
  ACTIVE_LEGAL_REQUEST_STATES,
} from "@legalir/types";
import type {
  AdminKpi,
  AdminOverview,
  AdminAttentionItem,
  AdminBreakdownItem,
  AdminDailyPoint,
  AdminOverviewComparison,
  AdminRecentRequest,
  LegalRequestState,
} from "@legalir/types";
import { supportCounts } from "./support";
import { ragReviewCounts } from "./rag";
import { listAiProviders } from "./ai-providers";

const TIMEZONE = "Asia/Tehran";
const CURRENCY = "IRT";

interface StoredSubscription {
  id: string;
  plan_code: string;
  plan_name_fa: string;
  amount: number;
  currency: string;
  status: string;
  status_fa: string;
  purchased_at: string;
}

interface LawyerProfileRow {
  id: string;
  verificationStatus: string;
  isDemo?: boolean;
  createdAt: string;
}

interface LegalRequestRow {
  id: string;
  title: string;
  category: string;
  state: LegalRequestState;
  createdAt: string;
  updatedAt: string;
}

interface RewardLedgerRow {
  id: string;
  points_delta: number;
  created_at: string;
}

interface AdjustmentRow {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
}

/** ISO cutoff for a rolling window of `days` back from now. */
function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Count rows whose timestamp (from `get`) is at/after the cutoff. */
function countSince<T>(rows: T[], sinceIso: string, get: (r: T) => string | undefined): number {
  return rows.reduce((n, r) => {
    const ts = get(r);
    return ts && ts >= sinceIso ? n + 1 : n;
  }, 0);
}

function sumSince<T>(rows: T[], sinceIso: string, getTs: (r: T) => string | undefined, getValue: (r: T) => number): number {
  return rows.reduce((sum, r) => {
    const ts = getTs(r);
    return ts && ts >= sinceIso ? sum + getValue(r) : sum;
  }, 0);
}

/** A real KPI card. */
function kpi(
  key: string,
  labelFa: string,
  value: number,
  formulaFa: string,
  drillHref?: string
): AdminKpi {
  return { key, labelFa, value, formulaFa, ...(drillHref ? { drillHref } : {}) };
}

/** A KPI that cannot be derived from available data — never faked. */
function unavailableKpi(key: string, labelFa: string, reasonFa: string): AdminKpi {
  return { key, labelFa, value: 0, formulaFa: "—", unavailable: true, unavailableReasonFa: reasonFa };
}

/**
 * Percent change of `current` vs `previous`, or `null` when there is no
 * honest comparison. A previous window with no activity (0) cannot produce
 * a percentage, so we return null rather than a meaningless "+∞".
 */
function changePctOf(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Build a KPI that carries a real previous-period value when it is
 * comparable. `previous` is `null` for lifetime metrics and for metrics whose
 * source window cannot be reconstructed — the UI then shows «—».
 */
function comparableKpi(
  key: string,
  labelFa: string,
  value: number,
  previous: number | null,
  formulaFa: string,
  opts: { drillHref?: string; trend?: "neutral" | "inverse"; unitFa?: string } = {}
): AdminKpi {
  return {
    key,
    labelFa,
    value,
    formulaFa,
    previousValue: previous,
    changePct: changePctOf(value, previous),
    ...(opts.trend ? { trend: opts.trend } : {}),
    ...(opts.unitFa ? { unitFa: opts.unitFa } : {}),
    ...(opts.drillHref ? { drillHref: opts.drillHref } : {}),
  };
}

/** Rows grouped by a key, ordered by descending count. */
function groupCount<T>(rows: T[], keyOf: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Requests registered per day across [fromIso, toIso), oldest first. */
function dailyRequestSeries(
  requests: LegalRequestRow[],
  fromIso: string,
  toIso: string
): AdminDailyPoint[] {
  const start = new Date(fromIso).getTime();
  const end = new Date(toIso).getTime();
  const DAY = 86_400_000;
  const span = Math.max(1, Math.ceil((end - start) / DAY));
  const points: AdminDailyPoint[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const day = new Date(end - i * DAY).toISOString().slice(0, 10);
    points.push({ date: day, count: requests.filter((r) => r.createdAt.slice(0, 10) === day).length });
  }
  return points;
}

/**
 * Real counts that may require an operator decision. Every entry is derived
 * from a real table; a category with a zero count is omitted rather than
 * shown as an empty warning, and the section as a whole disappears when
 * nothing needs attention.
 */
function buildAttention(
  pendingLawyers: number,
  refundPending: number,
  requestsAwaitingLawyer: number,
  supportOverdue: number,
  ragUnderReview: number,
  aiTestFailures: number
): AdminAttentionItem[] {
  const items: AdminAttentionItem[] = [
    {
      key: "lawyers_pending",
      labelFa: "وکلای در انتظار تأیید",
      count: pendingLawyers,
      hintFa: "پروفایل‌های واقعی که وضعیت آن‌ها «در انتظار بررسی» یا «در حال بررسی» است.",
      href: "/admin/lawyers",
      severity: "warning",
    },
    {
      key: "refunds_pending",
      labelFa: "بازگشت وجه در انتظار تصمیم",
      count: refundPending,
      hintFa: "تعدیل‌های مالی در وضعیت «در انتظار» که نیاز به تأیید یا رد دارند.",
      href: "/admin/orders",
      severity: "warning",
    },
    {
      key: "requests_waiting_lawyer",
      labelFa: "درخواست‌های منتظر پذیرش وکیل",
      count: requestsAwaitingLawyer,
      hintFa: "درخواست‌هایی که وکیل انتخاب شده‌اند و منتظر پذیرش یا پاسخ او هستند.",
      href: "/admin/requests",
      severity: "info",
    },
    {
      key: "support_overdue",
      labelFa: "تیکت‌های پشتیبانی خارج از SLA",
      count: supportOverdue,
      hintFa: "تیکت‌های باز که از مهلت پاسخ (SLA) عبور کرده‌اند.",
      href: "/admin/support",
      severity: "error",
    },
    {
      key: "rag_under_review",
      labelFa: "منابع دانش در انتظار بازبینی",
      count: ragUnderReview,
      hintFa: "منابعی که در وضعیت «در حال بررسی» هستند و هنوز در بازیابی فعال نشده‌اند.",
      href: "/admin/rag",
      severity: "info",
    },
    {
      key: "ai_test_failures",
      labelFa: "اتصال‌های ناموفق هوش مصنوعی",
      count: aiTestFailures,
      hintFa: "ارائه‌دهندگانی که آخرین آزمون اتصال آن‌ها ناموفق بوده است.",
      href: "/admin/ai",
      severity: "error",
    },
  ];
  return items.filter((i) => i.count > 0);
}

/** Total sales (completed subscription purchases) in a rolling window. */
export function salesInRange(days = 30): { count: number; amount: number } {
  const since = cutoffIso(days);
  const subs = readTable<StoredSubscription>("subscriptions");
  const inRange = subs.filter((s) => s.purchased_at >= since);
  return {
    count: inRange.length,
    amount: inRange.reduce((sum, s) => sum + (s.amount || 0), 0),
  };
}

/** Resolve the effective window length (days) for a request, or the rolling default. */
export function resolvedRangeDays(
  rangeDays: number,
  explicit?: { from: string; to: string } | null
): number {
  const w = (explicit ? absoluteWindow(explicit.from, explicit.to) : null) ?? rollingWindow(rangeDays);
  return w.rangeDays;
}

/** Resolved reporting window with its immediately-preceding comparison window. */
interface OverviewWindow {
  rangeDays: number;
  fromIso: string;
  toIso: string;
  prevFromIso: string;
  prevToIso: string;
}

const DAY_MS = 86_400_000;

/** Rolling window ending "now": [now − days, now]. */
function rollingWindow(days: number): OverviewWindow {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - days * DAY_MS).toISOString();
  return {
    rangeDays: days,
    fromIso: from,
    toIso: to,
    prevFromIso: new Date(now.getTime() - 2 * days * DAY_MS).toISOString(),
    prevToIso: from,
  };
}

/**
 * Absolute window from two calendar dates. `to` is INCLUSIVE as a calendar
 * day, so the window actually extends to the end of that day. The comparison
 * window is the equal-length span immediately before `from`.
 */
function absoluteWindow(fromDate: string, toDate: string): OverviewWindow | null {
  const from = new Date(fromDate);
  const toEnd = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toEnd.getTime())) return null;
  // Treat `to` as the end of its day so a same-day range is a full day.
  toEnd.setUTCHours(23, 59, 59, 999);
  if (toEnd.getTime() <= from.getTime()) return null;
  const spanMs = toEnd.getTime() - from.getTime();
  const rangeDays = Math.max(1, Math.round(spanMs / DAY_MS));
  return {
    rangeDays,
    fromIso: from.toISOString(),
    toIso: toEnd.toISOString(),
    prevFromIso: new Date(from.getTime() - spanMs).toISOString(),
    prevToIso: from.toISOString(),
  };
}

/** Build the admin overview for a rolling window, or an explicit date range. */
export function buildOverview(
  rangeDays = 30,
  explicit?: { from: string; to: string } | null
): AdminOverview {
  const window =
    (explicit ? absoluteWindow(explicit.from, explicit.to) : null) ?? rollingWindow(rangeDays);
  const { fromIso, toIso, prevFromIso, prevToIso } = window;
  const inCurrent = (ts: string | undefined) => Boolean(ts && ts >= fromIso && ts < toIso);
  const inPrevious = (ts: string | undefined) => Boolean(ts && ts >= prevFromIso && ts < prevToIso);

  const now = new Date();

  const users = readTable<{ id: string; createdAt: string }>("users");
  const subs = readTable<StoredSubscription>("subscriptions");
  const lawyers = readTable<LawyerProfileRow>("lawyer_profiles");
  const requests = readTable<LegalRequestRow>("legal_requests");
  const ledger = readTable<RewardLedgerRow>("reward_ledger");
  const adjustments = readTable<AdjustmentRow>("financial_adjustments");

  const activeSubs = subs.filter((s) => s.status_fa === "فعال" || s.status === "active").length;
  const salesCount = countSince(subs, fromIso, (s) => (inCurrent(s.purchased_at) ? s.purchased_at : undefined));
  const salesAmount = sumSince(subs, fromIso, (s) => (inCurrent(s.purchased_at) ? s.purchased_at : undefined), (s) => s.amount || 0);

  // Previous-period equivalents (only comparable for range-scoped metrics).
  const prevSalesCount = countSince(subs, prevFromIso, (s) => (inPrevious(s.purchased_at) ? s.purchased_at : undefined));
  const prevSalesAmount = sumSince(subs, prevFromIso, (s) => (inPrevious(s.purchased_at) ? s.purchased_at : undefined), (s) => s.amount || 0);
  const prevNewUsers = countSince(users, prevFromIso, (u) => (inPrevious(u.createdAt) ? u.createdAt : undefined));
  const prevRequests = countSince(requests, prevFromIso, (r) => (inPrevious(r.createdAt) ? r.createdAt : undefined));
  const prevRefunded = sumSince(
    adjustments,
    prevFromIso,
    (a) => (inPrevious(a.createdAt) ? a.createdAt : undefined),
    (a) => (a.status === "completed" ? a.amount : 0)
  );
  const prevPoints = sumSince(
    ledger,
    prevFromIso,
    (r) => (inPrevious(r.created_at) ? r.created_at : undefined),
    (r) => (r.points_delta > 0 ? r.points_delta : 0)
  );

  const refundedAmount = sumSince(
    adjustments,
    fromIso,
    (a) => (inCurrent(a.createdAt) ? a.createdAt : undefined),
    (a) => (a.status === "completed" ? a.amount : 0)
  );
  const refundPending = adjustments.filter((a) => a.status === "pending").length;

  const realLawyers = lawyers.filter((l) => !l.isDemo);
  const verifiedLawyers = realLawyers.filter((l) => l.verificationStatus === "verified").length;
  const pendingLawyers = realLawyers.filter(
    (l) => l.verificationStatus === "pending" || l.verificationStatus === "under_review"
  ).length;

  const pointsIssued = sumSince(
    ledger,
    fromIso,
    (r) => (inCurrent(r.created_at) ? r.created_at : undefined),
    (r) => (r.points_delta > 0 ? r.points_delta : 0)
  );

  // --- Composition of ACTIVE requests by state (a live snapshot, not a window) ---
  const activeSet = new Set<string>(ACTIVE_LEGAL_REQUEST_STATES);
  const openRequests = requests.filter((r) => activeSet.has(r.state));
  const stateCounts = groupCount(openRequests, (r) => r.state);
  const requestsByState: AdminBreakdownItem[] = ACTIVE_LEGAL_REQUEST_STATES.filter((s) =>
    stateCounts.has(s)
  ).map((s) => ({
    key: s,
    labelFa: LEGAL_REQUEST_STATE_FA[s],
    count: stateCounts.get(s) ?? 0,
  }));

  // --- Requests REGISTERED in the window, by category ---
  const requestsInWindow = requests.filter((r) => inCurrent(r.createdAt));
  const categoryCounts = groupCount(requestsInWindow, (r) => r.category);
  const requestsByCategory: AdminBreakdownItem[] = [...categoryCounts.entries()]
    .map(([key, count]) => ({ key, labelFa: LEGAL_CATEGORY_FA[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);

  // --- Real "needs attention" counts ---
  const support = supportCounts();
  const ragCounts = ragReviewCounts();
  const aiTestFailures = listAiProviders().filter((p) => p.lastTestOk === false).length;
  const requestsAwaitingLawyer = requests.filter(
    (r) => r.state === "WAITING_FOR_ACCEPTANCE"
  ).length;

  const attention = buildAttention(
    pendingLawyers,
    refundPending,
    requestsAwaitingLawyer,
    support.overdue,
    ragCounts["under_review"] ?? 0,
    aiTestFailures
  );

  const kpis: AdminKpi[] = [
    kpi("total_users", "کل کاربران", users.length, "تعداد ردیف‌های جدول کاربران", "/admin/users"),
    comparableKpi(
      "new_users",
      "کاربران جدید",
      countSince(users, fromIso, (u) => (inCurrent(u.createdAt) ? u.createdAt : undefined)),
      prevNewUsers,
      `کاربران با تاریخ عضویت در بازهٔ انتخاب‌شده`,
      { drillHref: "/admin/users" }
    ),
    kpi("active_subscriptions", "اشتراک‌های فعال", activeSubs, "اشتراک با وضعیت «فعال»", "/admin/plans"),
    comparableKpi(
      "sales_count",
      "تعداد فروش",
      salesCount,
      prevSalesCount,
      `خریدهای بازهٔ انتخاب‌شده`,
      { drillHref: "/admin/orders" }
    ),
    comparableKpi(
      "sales_amount",
      "درآمد فروش",
      salesAmount,
      prevSalesAmount,
      `مجموع مبلغ خریدها در بازهٔ انتخاب‌شده`,
      { drillHref: "/admin/orders", unitFa: "تومان" }
    ),
    comparableKpi(
      "refunded_amount",
      "مبلغ بازگشتی",
      refundedAmount,
      prevRefunded,
      "مجموع تعدیل‌های تکمیل‌شده",
      { drillHref: "/admin/orders", unitFa: "تومان", trend: "inverse" }
    ),
    kpi("refund_pending", "بازگشت در انتظار تأیید", refundPending, "تعدیل‌های در وضعیت «در انتظار»", "/admin/orders"),
    kpi("lawyers_total", "وکلای ثبت‌شده", realLawyers.length, "پروفایل‌های واقعی (بدون دمو)", "/admin/lawyers"),
    kpi("lawyers_verified", "وکلای تأییدشده", verifiedLawyers, "پروفایل با وضعیت «تأییدشده»", "/admin/lawyers"),
    kpi("lawyers_pending", "وکلای در انتظار بررسی", pendingLawyers, "پروفایل در انتظار/در حال بررسی", "/admin/lawyers"),
    kpi("requests_total", "کل درخواست‌ها", requests.length, "تعداد ردیف‌های درخواست حقوقی", "/admin/requests"),
    comparableKpi(
      "requests_in_range",
      "درخواست‌های جدید",
      requestsInWindow.length,
      prevRequests,
      `درخواست‌های بازهٔ انتخاب‌شده`,
      { drillHref: "/admin/requests" }
    ),
    comparableKpi(
      "points_issued",
      "امتیاز صادرشده",
      pointsIssued,
      prevPoints,
      "مجموع امتیازهای مثبت دفتر پاداش",
      { drillHref: "/admin/users" }
    ),
    unavailableKpi(
      "ai_error_rate",
      "نرخ خطای هوش مصنوعی",
      "داده تلهمتری ارائه‌دهنده هوش مصنوعی در دسترس نیست؛ پس از پیکربندی و اتصال ارائه‌دهنده قابل محاسبه است"
    ),
  ];

  // Newest requests overall (not window-scoped) for the compact activity list.
  const recentRequests: AdminRecentRequest[] = [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      categoryFa: LEGAL_CATEGORY_FA[r.category] ?? r.category,
      state: r.state,
      stateFa: LEGAL_REQUEST_STATE_FA[r.state] ?? r.state,
      createdAt: r.createdAt,
    }));

  const comparison: AdminOverviewComparison = {
    windowDays: window.rangeDays,
    currentFrom: fromIso,
    previousFrom: prevFromIso,
    previousTo: prevToIso,
  };

  return {
    rangeDays: window.rangeDays,
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    currency: CURRENCY,
    kpis,
    attention,
    requestsByState,
    requestsByCategory,
    dailyRequests: dailyRequestSeries(requests, fromIso, toIso),
    comparison,
    openRequestsTotal: openRequests.length,
    activeRequestStates: ACTIVE_LEGAL_REQUEST_STATES,
    recentRequests,
  };
}

export interface RevenueByPlanRow {
  planCode: string;
  planNameFa: string;
  count: number;
  amount: number;
}

/** Revenue grouped by plan over a rolling window (real subscriptions only). */
export function revenueByPlan(
  rangeDays = 30,
  explicit?: { from: string; to: string } | null
): RevenueByPlanRow[] {
  const window =
    (explicit ? absoluteWindow(explicit.from, explicit.to) : null) ?? rollingWindow(rangeDays);
  const { fromIso, toIso } = window;
  const subs = readTable<StoredSubscription>("subscriptions").filter(
    (s) => s.purchased_at >= fromIso && s.purchased_at < toIso
  );
  const byCode = new Map<string, RevenueByPlanRow>();
  for (const s of subs) {
    const row = byCode.get(s.plan_code) ?? {
      planCode: s.plan_code,
      planNameFa: s.plan_name_fa,
      count: 0,
      amount: 0,
    };
    row.count += 1;
    row.amount += s.amount || 0;
    byCode.set(s.plan_code, row);
  }
  return [...byCode.values()].sort((a, b) => b.amount - a.amount);
}

export interface DailySalesPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  count: number;
  amount: number;
}

/** Daily sales totals for a window — one point per day. */
export function dailySales(
  rangeDays = 30,
  explicit?: { from: string; to: string } | null
): DailySalesPoint[] {
  const window =
    (explicit ? absoluteWindow(explicit.from, explicit.to) : null) ?? rollingWindow(rangeDays);
  const { fromIso, toIso } = window;
  const subs = readTable<StoredSubscription>("subscriptions");
  const points: DailySalesPoint[] = [];
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  for (let t = startDay.getTime(); t <= end.getTime(); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const daySubs = subs.filter(
      (s) => s.purchased_at.slice(0, 10) === day && s.purchased_at < toIso && s.purchased_at >= fromIso
    );
    points.push({
      date: day,
      count: daySubs.length,
      amount: daySubs.reduce((sum, s) => sum + (s.amount || 0), 0),
    });
  }
  return points;
}
