// ============================================================
// LEGALIR — Usage surfaces (shared report panel + subscription banner)
// ============================================================
// These two components are the only places energy/token consumption is shown to
// a human. The tests pin the four states of each surface (loading / error /
// empty / populated) and — most importantly — that ENERGY and TOKENS are
// rendered as two separate blocks with their own labels and hints. A future
// refactor that re-merges them into one number fails here.
//
// Acceptance points covered:
//   (7) the same breakdown renders on the user page and the admin user tab
//   (10) loading / error / empty states render Persian copy, no crash
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  UsageReportPanel,
  type UsageReportFilters,
} from "@/components/usage/usage-report-panel";
import { SubscriptionUsageBanners } from "@/components/subscription/subscription-usage-banner";
import type {
  SubscriptionUsageCard,
  UsageActionBreakdown,
  UsageReportItem,
  UsageReportResponse,
  UsageServiceBreakdown,
} from "@legalir/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Fixtures — one billed AI operation + one free business action
// ---------------------------------------------------------------------------

const row1: UsageReportItem = {
  id: "row-1",
  trackingId: "UT-row-1",
  activityType: "AI_MESSAGE",
  serviceKey: "ai-legal-assistant",
  serviceNameFa: "دستیار حقوقی هوشمند",
  actionNameFa: "پیام هوش مصنوعی",
  model: "gpt-4o",
  createdAt: "2026-10-18T08:30:00.000Z",
  energyReserved: 1_150,
  energyFinal: 1_150,
  energyRefunded: 0,
  inputTokens: 1_200,
  outputTokens: 300,
  totalTokens: 1_500,
  tokenStatus: "ACTUAL",
  tokenStatusReasonFa: null,
  status: "COMPLETED",
  settlement: "CHARGED",
  settlementLabelFa: "کسر شده",
  creditSource: "SUBSCRIPTION",
  isFree: false,
  subscriptionId: "sub-active",
  relatedEntityId: null,
  tariffVersion: 2,
  breakdown: null,
};

const row2: UsageReportItem = {
  id: "row-2",
  trackingId: "UT-row-2",
  activityType: "DOCUMENT_ANALYSIS",
  serviceKey: "document-analysis",
  serviceNameFa: "تحلیل سند",
  actionNameFa: "تحلیل سند",
  model: null,
  createdAt: "2026-10-17T14:00:00.000Z",
  energyReserved: 0,
  energyFinal: 0,
  energyRefunded: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  tokenStatus: "UNAVAILABLE",
  tokenStatusReasonFa: "مدلی اجرا نشد",
  status: "COMPLETED",
  settlement: "FREE",
  settlementLabelFa: "رایگان",
  creditSource: "NONE",
  isFree: true,
  subscriptionId: "sub-active",
  relatedEntityId: "doc-1",
  tariffVersion: null,
  breakdown: null,
};

const services: UsageServiceBreakdown[] = [
  {
    serviceKey: "ai-legal-assistant",
    serviceNameFa: "دستیار حقوقی هوشمند",
    operations: 1,
    energy: 1_150,
    inputTokens: 1_200,
    outputTokens: 300,
    totalTokens: 1_500,
  },
  {
    serviceKey: "document-analysis",
    serviceNameFa: "تحلیل سند",
    operations: 1,
    energy: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
];

const actions: UsageActionBreakdown[] = [
  {
    activityType: "AI_MESSAGE",
    actionNameFa: "پیام هوش مصنوعی",
    serviceKey: "ai-legal-assistant",
    operations: 1,
    energy: 1_150,
    inputTokens: 1_200,
    outputTokens: 300,
    totalTokens: 1_500,
  },
  {
    activityType: "DOCUMENT_ANALYSIS",
    actionNameFa: "تحلیل سند",
    serviceKey: "document-analysis",
    operations: 1,
    energy: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
];

const report: UsageReportResponse = {
  from: "2026-09-18T00:00:00.000Z",
  to: "2026-10-18T00:00:00.000Z",
  totals: {
    operations: 2,
    energy: 1_150,
    energyReserved: 1_150,
    energyRefunded: 0,
    freeOperations: 1,
    failedOperations: 0,
    refundedOperations: 0,
    inputTokens: 1_200,
    outputTokens: 300,
    totalTokens: 1_500,
    unavailableTokenOperations: 1,
    estimatedTokenOperations: 0,
  },
  byService: services,
  byAction: actions,
  items: [row1, row2],
  totalItems: 2,
  page: 1,
  pageSize: 20,
};

const emptyReport: UsageReportResponse = {
  ...report,
  totals: {
    ...report.totals,
    operations: 0,
    energy: 0,
    energyReserved: 0,
    freeOperations: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    unavailableTokenOperations: 0,
  },
  byService: [],
  byAction: [],
  items: [],
  totalItems: 0,
};

const query: UsageReportFilters = {
  from: report.from,
  to: report.to,
  page: 1,
  pageSize: 20,
};

function renderPanel(over: Partial<Parameters<typeof UsageReportPanel>[0]> = {}) {
  const onQueryChange = vi.fn();
  const onRetry = vi.fn();
  const utils = render(
    <UsageReportPanel
      data={{ report, services, actions }}
      isLoading={false}
      error={null}
      onRetry={onRetry}
      query={query}
      onQueryChange={onQueryChange}
      {...over}
    />
  );
  return { ...utils, onQueryChange, onRetry };
}

// ===========================================================================
// UsageReportPanel — states
// ===========================================================================

describe("UsageReportPanel", () => {
  it("shows a skeleton while loading and never the empty message", () => {
    const { container } = renderPanel({ data: undefined, isLoading: true });
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(8);
    expect(
      screen.queryByText("در این بازه و با این فیلترها، مصرفی ثبت نشده است.")
    ).toBeNull();
  });

  it("shows the error banner and lets the caller retry", () => {
    const { onRetry } = renderPanel({
      data: undefined,
      error: new Error("خطا در دریافت گزارش مصرف"),
    });
    expect(screen.getByText("خطا در دریافت گزارش مصرف")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تلاش مجدد/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the Persian empty state when nothing was consumed", () => {
    renderPanel({ data: { report: emptyReport, services: [], actions: [] } });
    expect(
      screen.getByText("در این بازه و با این فیلترها، مصرفی ثبت نشده است.")
    ).toBeInTheDocument();
  });

  it("renders ENERGY and TOKENS as two separate blocks, never one number", () => {
    renderPanel();

    // Energy block — its own heading, its own four stats.
    expect(screen.getByText("انرژی مصرف‌شده")).toBeInTheDocument();
    expect(screen.getByText("انرژی نهایی")).toBeInTheDocument();
    expect(screen.getByText("رزرو اولیه")).toBeInTheDocument();
    // «بازگردانده‌شده» / «عملیات» also appear as a filter option and table
    // header, so count rather than match a single node.
    expect(screen.getAllByText("بازگردانده‌شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("عملیات").length).toBeGreaterThan(0);

    // Token block — a distinct heading and the explicit "not summed" hint.
    expect(screen.getByText("مصرف توکن مدل")).toBeInTheDocument();
    expect(screen.getAllByText("توکن ورودی").length).toBeGreaterThan(0);
    expect(screen.getAllByText("توکن خروجی").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مجموع توکن").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/واحد مصرف واقعی مدل — با انرژی جمع نمی‌شود/)
    ).toBeInTheDocument();

    // Persian digits, not raw latin numerals.
    expect(screen.getAllByText(toPersianNumber(1_150)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("1150");
  });

  it("shows the per-service breakdown, the settlement pills and the tracking ids", () => {
    renderPanel();

    expect(screen.getByText("تفکیک بر اساس سرویس")).toBeInTheDocument();
    expect(screen.getAllByText("تحلیل سند").length).toBeGreaterThan(0);
    // Mobile card + desktop table both render the pill.
    expect(screen.getAllByText("کسر شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("رایگان").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UT-row-1").length).toBeGreaterThan(0);
  });

  it("marks estimated / unavailable token rows instead of showing a fake zero", () => {
    renderPanel();
    expect(screen.getByText("رکوردهای بدون توکن واقعی")).toBeInTheDocument();
    // row-2 has no model run: the row says «ناموجود», the totals hint counts it.
    expect(screen.getAllByText("ناموجود").length).toBeGreaterThan(0);
  });

  it("changes the service filter through the query callback", () => {
    const { onQueryChange } = renderPanel();
    fireEvent.change(screen.getAllByRole("combobox")[0]!, {
      target: { value: "document-analysis" },
    });
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ serviceKey: "document-analysis", page: 1 })
    );
  });

  it("hides the action filter in compact mode but keeps service and status", () => {
    renderPanel({ compact: true, hiddenActions: true });
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    // Compact mode drops the action breakdown table only.
    expect(screen.queryByText("تفکیک بر اساس نوع عملیات")).toBeNull();
  });

  it("offers a single clear-all action once a filter is active", () => {
    const { onQueryChange } = renderPanel({ query: { ...query, status: "FAILED" } });
    const clear = screen.getByRole("button", { name: "حذف همهٔ فیلترها" });
    fireEvent.click(clear);
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceKey: undefined,
        activityType: undefined,
        status: undefined,
        page: 1,
      })
    );
  });
});

// ===========================================================================
// SubscriptionUsageBanners — one card per active subscription
// ===========================================================================

const card: SubscriptionUsageCard = {
  subscriptionId: "sub-active",
  planNameFa: "طلایی",
  status: "active",
  startAt: "2026-09-21T00:00:00.000Z",
  endAt: "2026-10-25T00:00:00.000Z",
  daysRemaining: 7,
  energyUsed: 1_150,
  energyRefunded: 0,
  inputTokens: 1_200,
  outputTokens: 300,
  totalTokens: 1_500,
  operations: 2,
  energyQuota: null,
  energyRemaining: null,
};

function renderBanners(
  over: Partial<Parameters<typeof SubscriptionUsageBanners>[0]> = {}
) {
  const onRetry = vi.fn();
  const utils = render(
    <SubscriptionUsageBanners
      cards={[card]}
      isLoading={false}
      error={null}
      onRetry={onRetry}
      {...over}
    />
  );
  return { ...utils, onRetry };
}

describe("SubscriptionUsageBanners", () => {
  it("shows a skeleton while loading", () => {
    const { container } = renderBanners({ cards: undefined, isLoading: true });
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("shows the error banner with a retry action", () => {
    const { onRetry } = renderBanners({
      cards: undefined,
      error: new Error("شبکه در دسترس نیست"),
    });
    expect(screen.getByText("شبکه در دسترس نیست")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تلاش مجدد/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the no-active-subscription empty state", () => {
    renderBanners({ cards: [] });
    expect(
      screen.getByText(/اشتراک فعالی برای نمایش مصرف آن وجود ندارد/)
    ).toBeInTheDocument();
  });

  it("shows only real consumption and never invents a quota", () => {
    const { container } = renderBanners();

    expect(screen.getByText("طلایی")).toBeInTheDocument();
    expect(screen.getByText("انرژی مصرف‌شده")).toBeInTheDocument();
    expect(screen.getByText(toPersianNumber(1_150))).toBeInTheDocument();

    // No progress bar, no remaining balance — the plan defines no energy cap.
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(
      screen.getByText(/پلن فعلی سقف انرژی مخصوص اشتراک تعریف نکرده است/)
    ).toBeInTheDocument();
  });

  it("links to the caller's own usage page", () => {
    renderBanners();
    const link = screen.getByRole("link", { name: /مشاهده جزئیات مصرف/ });
    expect(link).toHaveAttribute("href", "/settings/usage");
  });

  it("renders a progress bar only when a real quota exists", () => {
    const { container } = renderBanners({
      cards: [{ ...card, energyQuota: 5_000, energyRemaining: 3_850 }],
    });
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute("aria-valuemax", "5000");
    expect(bar).toHaveAttribute("aria-valuenow", "1150");
    expect(
      screen.queryByText(/پلن فعلی سقف انرژی مخصوص اشتراک تعریف نکرده است/)
    ).toBeNull();
  });
});
