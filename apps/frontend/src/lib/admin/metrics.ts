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
import type { AdminKpi, AdminOverview } from "@legalir/types";

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
  createdAt: string;
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

/** Build the admin overview: a set of real KPIs over a rolling window. */
export function buildOverview(rangeDays = 30): AdminOverview {
  const since = cutoffIso(rangeDays);

  const users = readTable<{ id: string; createdAt: string }>("users");
  const subs = readTable<StoredSubscription>("subscriptions");
  const lawyers = readTable<LawyerProfileRow>("lawyer_profiles");
  const requests = readTable<LegalRequestRow>("legal_requests");
  const ledger = readTable<RewardLedgerRow>("reward_ledger");
  const adjustments = readTable<AdjustmentRow>("financial_adjustments");

  const activeSubs = subs.filter((s) => s.status_fa === "فعال" || s.status === "active").length;
  const salesCount = countSince(subs, since, (s) => s.purchased_at);
  const salesAmount = sumSince(subs, since, (s) => s.purchased_at, (s) => s.amount || 0);

  const refundedAmount = sumSince(
    adjustments,
    since,
    (a) => a.createdAt,
    (a) => (a.status === "completed" ? a.amount : 0)
  );
  const refundPending = adjustments.filter(
    (a) => a.status === "pending"
  ).length;

  const realLawyers = lawyers.filter((l) => !l.isDemo);
  const verifiedLawyers = realLawyers.filter((l) => l.verificationStatus === "verified").length;
  const pendingLawyers = realLawyers.filter(
    (l) => l.verificationStatus === "pending" || l.verificationStatus === "under_review"
  ).length;

  const pointsIssued = sumSince(
    ledger,
    since,
    (r) => r.created_at,
    (r) => (r.points_delta > 0 ? r.points_delta : 0)
  );

  const kpis: AdminKpi[] = [
    kpi("total_users", "کل کاربران", users.length, "تعداد ردیف‌های جدول کاربران", "/admin/users"),
    kpi(
      "new_users",
      `کاربران جدید (${rangeDays} روز)`,
      countSince(users, since, (u) => u.createdAt),
      `کاربران با تاریخ عضویت در ${rangeDays} روز گذشته`,
      "/admin/users"
    ),
    kpi("active_subscriptions", "اشتراک‌های فعال", activeSubs, "اشتراک با وضعیت «فعال»", "/admin/plans"),
    kpi("sales_count", `تعداد فروش (${rangeDays} روز)`, salesCount, `خریدهای ${rangeDays} روز گذشته`, "/admin/orders"),
    kpi("sales_amount", `درآمد فروش (${rangeDays} روز، تومان)`, salesAmount, `مجموع مبلغ خریدها در ${rangeDays} روز گذشته`, "/admin/orders"),
    kpi("refunded_amount", `مبلغ بازگشتی (${rangeDays} روز، تومان)`, refundedAmount, "مجموع تعدیل‌های تکمیل‌شده", "/admin/orders"),
    kpi("refund_pending", "بازگشت در انتظار تأیید", refundPending, "تعدیل‌های در وضعیت «در انتظار»", "/admin/orders"),
    kpi("lawyers_total", "وکلای ثبت‌شده", realLawyers.length, "پروفایل‌های واقعی (بدون دمو)", "/admin/lawyers"),
    kpi("lawyers_verified", "وکلای تأییدشده", verifiedLawyers, "پروفایل با وضعیت «تأییدشده»", "/admin/lawyers"),
    kpi("lawyers_pending", "وکلای در انتظار بررسی", pendingLawyers, "پروفایل در انتظار/در حال بررسی", "/admin/lawyers"),
    kpi("requests_total", "کل درخواست‌ها", requests.length, "تعداد ردیف‌های درخواست حقوقی", "/admin/requests"),
    kpi("requests_in_range", `درخواست‌های جدید (${rangeDays} روز)`, countSince(requests, since, (r) => r.createdAt), `درخواست‌های ${rangeDays} روز گذشته`, "/admin/requests"),
    kpi("points_issued", `امتیاز صادرشده (${rangeDays} روز)`, pointsIssued, "مجموع امتیازهای مثبت دفتر پاداش", "/admin/users"),
    unavailableKpi(
      "ai_error_rate",
      "نرخ خطای هوش مصنوعی",
      "داده تلهمتری ارائه‌دهنده هوش مصنوعی در دسترس نیست؛ پس از پیکربندی و اتصال ارائه‌دهنده قابل محاسبه است"
    ),
  ];

  return {
    rangeDays,
    generatedAt: new Date().toISOString(),
    timezone: TIMEZONE,
    currency: CURRENCY,
    kpis,
  };
}

export interface RevenueByPlanRow {
  planCode: string;
  planNameFa: string;
  count: number;
  amount: number;
}

/** Revenue grouped by plan over a rolling window (real subscriptions only). */
export function revenueByPlan(rangeDays = 30): RevenueByPlanRow[] {
  const since = cutoffIso(rangeDays);
  const subs = readTable<StoredSubscription>("subscriptions").filter((s) => s.purchased_at >= since);
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

/** Daily sales totals for a trailing window — one point per day. */
export function dailySales(rangeDays = 30): DailySalesPoint[] {
  const subs = readTable<StoredSubscription>("subscriptions");
  const points: DailySalesPoint[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const daySubs = subs.filter((s) => s.purchased_at.slice(0, 10) === day);
    points.push({
      date: day,
      count: daySubs.length,
      amount: daySubs.reduce((sum, s) => sum + (s.amount || 0), 0),
    });
  }
  return points;
}
