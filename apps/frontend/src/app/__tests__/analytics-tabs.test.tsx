// ============================================================
// LEGALIR — Analytics tabs · render + honesty contract
// ============================================================
// Renders each of the five BI tabs against a mocked report and asserts the
// HONESTY states render — the whole point of this surface:
//   • an unavailable KPI shows «ناموجود», never a fabricated zero
//   • a non-comparable window says so instead of drawing a trend
//   • an empty range shows the empty message, not a blank chart
//   • simulated-gateway payments are labelled (mock), never called real
//   • the finance reconciliation shows its pass/fail verdict
// The hooks are mocked (not the network) so the test targets the render
// contract of the tabs themselves.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnalyticsWindowInfo } from "@legalir/types";

const f = vi.hoisted(() => {
  const win = (comparable: boolean): AnalyticsWindowInfo => ({
    rangeDays: 30,
    fromIso: "2026-05-17T00:00:00.000Z",
    toIso: "2026-06-15T23:59:59.999Z",
    prevFromIso: "2026-04-17T00:00:00.000Z",
    prevToIso: "2026-05-16T23:59:59.999Z",
    preset: "30d",
    fromJalali: { jy: 1405, jm: 2, jd: 27 },
    toJalali: { jy: 1405, jm: 3, jd: 25 },
    comparable,
  });

  const q = <T,>(data: T) => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    data,
    refetch: vi.fn(),
  });

  return { win, q };
});

vi.mock("@/hooks/useAdmin", () => ({
  useAdminMe: () => ({ can: () => true, isStaff: true, role: "SUPER_ADMIN", data: undefined }),
}));

vi.mock("@/hooks/useAnalytics", () => {
  const overview = {
    window: f.win(false),
    generatedAt: "2026-06-15T12:00:00.000Z",
    timezone: "Asia/Tehran",
    currency: "IRT",
    kpis: [
      {
        key: "sales_count",
        labelFa: "تعداد فروش",
        value: 3,
        formulaFa: "شمارش خریدهای بازه.",
        previousValue: null,
        changePct: null,
      },
      {
        key: "ai_error_rate",
        labelFa: "نرخ خطای هوش مصنوعی",
        value: 0,
        formulaFa: "—",
        unavailable: true,
        unavailableReasonFa: "این متریک در جداول فعلی ثبت نمی‌شود.",
      },
    ],
    quality: [
      { id: "sales", labelFa: "فروش", status: "real", reasonFa: "از جدول اشتراک‌ها.", captureNeededFa: "—" },
    ],
  };

  const subscriptionsEmpty = {
    window: f.win(false),
    totals: {
      count: { current: 0, previous: null, changePct: null },
      gross: { current: 0, previous: null, changePct: null },
      net: { current: 0, previous: null, changePct: null },
    },
    byPlan: [
      { planCode: "gold", planNameFa: "طلایی", count: 0, gross: 0, refunded: 0, net: 0, revenueSharePct: 0 },
    ],
    daily: [],
    planCatalog: [{ planCode: "gold", planNameFa: "طلایی", salePrice: 0 }],
    quality: [],
  };

  const energy = {
    window: f.win(true),
    totals: {
      currentBalance: 1200,
      subscriptionBalance: 200,
      rewardBalance: 1000,
      granted: 1000,
      consumed: 300,
      remaining: 700,
      expired: null,
    },
    granted: { current: 1000, previous: 800, changePct: 25 },
    consumed: { current: 300, previous: 400, changePct: -25 },
    bySource: [{ sourceType: "reward", labelFa: "پاداش", granted: 1000 }],
    byActivity: [{ activityType: "chat", labelFa: "گفت‌وگو", consumed: 300, count: 3 }],
    distribution: [{ labelFa: "بدون موجودی (۰)", count: 1 }],
    topHolders: [],
    quality: [],
    sourceNoteFa: "موجودی = دفتر پاداش + اعتبار روزانهٔ اشتراک امروز.",
    refreshedAt: "2026-06-15T12:00:00.000Z",
  };

  const customers = {
    window: f.win(true),
    cohortSize: 10,
    buyerCount: 4,
    segments: [
      { segment: "champions", labelFa: "قهرمانان", count: 2, sharePct: 20, net: 5_000_000 },
      { segment: "no_purchase", labelFa: "بدون خرید", count: 6, sharePct: 60, net: 0 },
    ],
    repurchaseAvgDays: null,
    repurchaseMedianDays: null,
    singlePurchaseBuyers: 4,
    newVsReturning: { newCount: 3, returningCount: 1 },
    atRiskHeuristicCount: 1,
    realizedLtv: 1_250_000,
    notComputedNoteFa: "بعد «N» محاسبه نمی‌شود؛ مدل صرفاً L/R/F/M شفاف است.",
    top: [],
    quality: [],
  };

  const finance = {
    window: f.win(true),
    gross: 8_000_000,
    refunds: 500_000,
    net: 7_500_000,
    ordersNet: 7_500_000,
    reconcile: { subscriptionGross: 8_000_000, net: 7_500_000, matches: true },
    refundPendingCount: 1,
    refundPendingAmount: 200_000,
    concentration: { buyers: 4, top1Pct: 40, top5Pct: 100, top10Pct: 100, top20Pct: 100 },
    payments: { windowCount: 4, paid: 3, pending: 0, failed: 1, mock: 4, coveragePct: 75 },
    quality: [],
  };

  return {
    useAnalyticsOverview: () => f.q(overview),
    useAnalyticsSubscriptions: () => f.q(subscriptionsEmpty),
    useAnalyticsEnergy: () => f.q(energy),
    useAnalyticsEnergyUsers: () => f.q({ items: [], total: 0, page: 1, pageSize: 20 }),
    useAnalyticsCustomers: () => f.q(customers),
    useAnalyticsRanking: () => f.q({ items: [], total: 0, page: 1, pageSize: 20 }),
    useAnalyticsFinance: () => f.q(finance),
  };
});

import { OverviewTab } from "@/components/admin/analytics/overview-tab";
import { SubscriptionsTab } from "@/components/admin/analytics/subscriptions-tab";
import { EnergyTab } from "@/components/admin/analytics/energy-tab";
import { CustomersTab } from "@/components/admin/analytics/customers-tab";
import { FinanceTab } from "@/components/admin/analytics/finance-tab";

const RANGE = { preset: "30d" as const };

describe("analytics tabs — honest render", () => {
  it("overview shows a real KPI and «ناموجود» for an unavailable one", () => {
    render(<OverviewTab range={RANGE} />);
    expect(screen.getByText("تعداد فروش")).toBeInTheDocument();
    expect(screen.getByText("ناموجود")).toBeInTheDocument();
  });

  it("overview states the window is not comparable instead of drawing a trend", () => {
    render(<OverviewTab range={RANGE} />);
    expect(
      screen.getByText(/دادهٔ کافی برای مقایسه با بازهٔ قبل وجود ندارد/)
    ).toBeInTheDocument();
  });

  it("subscriptions shows the empty-range message when nothing sold", () => {
    render(<SubscriptionsTab range={RANGE} />);
    expect(screen.getByText("در این بازه فروشی ثبت نشده است.")).toBeInTheDocument();
  });

  it("energy labels expired energy as «ناموجود», never zero", () => {
    render(<EnergyTab range={RANGE} />);
    expect(screen.getByText(/انرژی منقضی‌شده/)).toBeInTheDocument();
    expect(screen.getByText("ناموجود")).toBeInTheDocument();
  });

  it("customers states what is NOT computed (no invented N dimension)", () => {
    render(<CustomersTab range={RANGE} />);
    expect(screen.getByText(/بعد «N» محاسبه نمی‌شود/)).toBeInTheDocument();
  });

  it("finance shows the reconciliation verdict and labels mock payments", () => {
    render(<FinanceTab range={RANGE} />);
    expect(screen.getByText("تطبیق برقرار است")).toBeInTheDocument();
    // The mock-gateway row is the unique "(mock)" marker in the payment table.
    expect(screen.getByText(/\(mock\)/)).toBeInTheDocument();
  });
});
