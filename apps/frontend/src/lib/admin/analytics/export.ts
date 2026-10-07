// ============================================================
// LEGALIR — Admin analytics Excel export (server-only)
// ============================================================
// Server-side XLSX export for the analytics reports. Exports read the SAME
// server-side aggregates the tables read (not the current UI page), so a
// filtered/paginated screen still exports the complete dataset. Headers and
// cell text are Persian; dates are Jalali; numbers use Persian grouping.
// ============================================================

import type { SheetSpec } from "@/lib/excel/xlsx";
import { buildXlsx, exportFilename } from "@/lib/excel/xlsx";
import { toPersianDate } from "@/lib/persian-utils";
import { buildSubscriptionSalesReport } from "./subscription-analytics";
import { listLrfmRows, buildCustomerAnalytics } from "./customer-analytics";
import { allEnergyUsers } from "./energy-analytics";
import { buildFinanceAnalytics } from "./finance-analytics";
import type { ResolveRangeInput } from "./range";

/** The exportable analytics surfaces. */
export const ANALYTICS_EXPORT_KINDS = ["subscriptions", "customers", "energy", "finance"] as const;
export type AnalyticsExportKind = (typeof ANALYTICS_EXPORT_KINDS)[number];

const KIND_FA: Record<AnalyticsExportKind, string> = {
  subscriptions: "فروش اشتراک به تفکیک پلن",
  customers: "تحلیل مشتریان (LRFM)",
  energy: "انرژی کاربران",
  finance: "تطبیق مالی",
};

const FILE_BASE: Record<AnalyticsExportKind, string> = {
  subscriptions: "analytics-subscriptions",
  customers: "analytics-customers",
  energy: "analytics-energy",
  finance: "analytics-finance",
};

export function isAnalyticsExportKind(k: string): k is AnalyticsExportKind {
  return (ANALYTICS_EXPORT_KINDS as readonly string[]).includes(k);
}

/** Jalali date, or an em-dash for a missing timestamp. */
function faDate(iso: string | null): string {
  return iso ? toPersianDate(iso) : "—";
}

/** Persian segment label (mirrors the report's SEGMENT_FA). */
function segmentFa(segment: string): string {
  const map: Record<string, string> = {
    champions: "قهرمانان",
    loyal: "وفادار",
    potential_loyalist: "در معرض وفاداری",
    promising: "تازه‌وارد ارزشمند",
    needs_attention: "نیازمند توجه",
    at_risk: "در معرض ریزش",
    hibernating: "رو به خاموشی",
    lost: "ازدست‌رفته",
    new: "تازه",
    unclassified: "نامشخص",
    no_purchase: "بدون خرید",
  };
  return map[segment] ?? segment;
}

/** Sales-by-plan sheet (Report 1). */
function subscriptionsSheet(input: ResolveRangeInput): SheetSpec {
  const report = buildSubscriptionSalesReport(input);
  return {
    name: "فروش به تفکیک پلن",
    columns: [
      { key: "planNameFa", header: "پلن", width: 16 },
      { key: "planCode", header: "کد پلن", width: 12 },
      { key: "count", header: "تعداد فروش", width: 14 },
      { key: "gross", header: "ناخالص (تومان)", width: 18 },
      { key: "refunded", header: "بازگشتی (تومان)", width: 18 },
      { key: "net", header: "خالص (تومان)", width: 18 },
      { key: "share", header: "سهم از خالص (٪)", width: 16 },
    ],
    rows: report.byPlan.map((r) => ({
      planNameFa: r.planNameFa,
      planCode: r.planCode,
      count: r.count,
      gross: r.gross,
      refunded: r.refunded,
      net: r.net,
      share: r.revenueSharePct,
    })),
  };
}

/** Customer sheets (Report 4 detail + segment summary). */
function customersSheets(input: ResolveRangeInput): SheetSpec[] {
  const rows = listLrfmRows(input);
  const report = buildCustomerAnalytics(input);

  const detail: SheetSpec = {
    name: "مشتریان (LRFM)",
    columns: [
      { key: "name", header: "نام", width: 20 },
      { key: "mobile", header: "موبایل", width: 16 },
      { key: "userId", header: "شناسه", width: 34 },
      { key: "segment", header: "بخش", width: 18 },
      { key: "l", header: "L (روز)", width: 10 },
      { key: "r", header: "R (روز)", width: 10 },
      { key: "f", header: "F (خرید)", width: 10 },
      { key: "m", header: "M (تومان)", width: 18 },
      { key: "lScore", header: "امتیاز L", width: 10 },
      { key: "rScore", header: "امتیاز R", width: 10 },
      { key: "fScore", header: "امتیاز F", width: 10 },
      { key: "mScore", header: "امتیاز M", width: 10 },
      { key: "isNew", header: "تازه", width: 8 },
    ],
    rows: rows.map((r) => ({
      name: r.displayName ?? "—",
      mobile: r.mobileMasked,
      userId: r.userId,
      segment: segmentFa(r.segment),
      l: r.l,
      r: r.r,
      f: r.f,
      m: r.m,
      lScore: r.lScore,
      rScore: r.rScore,
      fScore: r.fScore,
      mScore: r.mScore,
      isNew: r.isNew ? "بله" : "خیر",
    })),
  };

  const summary: SheetSpec = {
    name: "خلاصهٔ بخش‌ها",
    columns: [
      { key: "labelFa", header: "بخش", width: 20 },
      { key: "count", header: "تعداد", width: 12 },
      { key: "sharePct", header: "سهم (٪)", width: 12 },
      { key: "net", header: "خالص (تومان)", width: 18 },
    ],
    rows: report.segments.map((s) => ({
      labelFa: s.labelFa,
      count: s.count,
      sharePct: s.sharePct,
      net: s.net,
    })),
  };

  return [summary, detail];
}

/** Energy-per-user sheet (Report 2). */
function energySheet(input: ResolveRangeInput): SheetSpec {
  const rows = allEnergyUsers(input);
  return {
    name: "انرژی کاربران",
    columns: [
      { key: "name", header: "نام", width: 20 },
      { key: "mobile", header: "موبایل", width: 16 },
      { key: "userId", header: "شناسه", width: 34 },
      { key: "balance", header: "موجودی", width: 14 },
      { key: "granted", header: "دریافتی بازه", width: 16 },
      { key: "consumed", header: "مصرف بازه", width: 14 },
      { key: "lastChange", header: "آخرین تغییر", width: 16 },
    ],
    rows: rows.map((r) => ({
      name: r.displayName ?? "—",
      mobile: r.mobileMasked,
      userId: r.userId,
      balance: r.balance,
      granted: r.granted,
      consumed: r.consumed,
      lastChange: faDate(r.lastChangeAt),
    })),
  };
}

/** Finance summary + payment-health sheets (reconciliation view). */
function financeSheets(input: ResolveRangeInput): SheetSpec[] {
  const rep = buildFinanceAnalytics(input);

  const summary: SheetSpec = {
    name: "خلاصهٔ مالی",
    columns: [
      { key: "metric", header: "شاخص", width: 30 },
      { key: "value", header: "مقدار", width: 22 },
    ],
    rows: [
      { metric: "درآمد ناخالص (تومان)", value: rep.gross },
      { metric: "بازگشت وجه تکمیل‌شده (تومان)", value: rep.refunds },
      { metric: "درآمد خالص (تومان)", value: rep.net },
      { metric: "خالص سفارش‌ها (تومان)", value: rep.ordersNet },
      { metric: "تطبیق دو منبع", value: rep.reconcile.matches ? "برقرار" : "نابرابر" },
      { metric: "خریداران بازه", value: rep.concentration.buyers },
      { metric: "سهم ۱٪ بالا (٪)", value: rep.concentration.top1Pct },
      { metric: "سهم ۵٪ بالا (٪)", value: rep.concentration.top5Pct },
      { metric: "سهم ۱۰٪ بالا (٪)", value: rep.concentration.top10Pct },
      { metric: "سهم ۲۰٪ بالا (٪)", value: rep.concentration.top20Pct },
      { metric: "بازگشت در انتظار (تعداد)", value: rep.refundPendingCount },
      { metric: "مبلغ بازگشت در انتظار (تومان)", value: rep.refundPendingAmount },
    ],
  };

  const payments: SheetSpec = {
    name: "وضعیت پرداخت‌ها",
    columns: [
      { key: "status", header: "وضعیت", width: 28 },
      { key: "count", header: "تعداد", width: 14 },
    ],
    rows: [
      { status: "پرداخت‌شده", count: rep.payments.paid },
      { status: "در انتظار", count: rep.payments.pending },
      { status: "ناموفق", count: rep.payments.failed },
      { status: "از درگاه شبیه‌سازی‌شده (mock)", count: rep.payments.mock },
      { status: "کل ردیف‌های پرداخت بازه", count: rep.payments.windowCount },
    ],
  };

  return [summary, payments];
}

export interface AnalyticsExportResult {
  bytes: Buffer;
  fileName: string;
  rowCount: number;
}

/**
 * Build a complete workbook for one analytics surface. Returns `{ error }`
 * only when the kind is unknown — callers gate the kind first anyway.
 */
export function buildAnalyticsExport(
  kind: AnalyticsExportKind,
  input: ResolveRangeInput
): AnalyticsExportResult | { error: string } {
  let sheets: SheetSpec[];
  switch (kind) {
    case "subscriptions":
      sheets = [subscriptionsSheet(input)];
      break;
    case "customers":
      sheets = customersSheets(input);
      break;
    case "energy":
      sheets = [energySheet(input)];
      break;
    case "finance":
      sheets = financeSheets(input);
      break;
    default:
      return { error: "UNKNOWN_KIND" };
  }

  const rowCount = sheets.reduce((n, s) => n + s.rows.length, 0);
  const bytes = buildXlsx(sheets);
  return { bytes, fileName: exportFilename(FILE_BASE[kind]), rowCount };
}

export { KIND_FA as ANALYTICS_EXPORT_KIND_FA };
