// ============================================================
// LEGALIR — Admin · Overview (نمای کلی)
// ============================================================
// The landing surface of the admin panel. Every KPI is computed from the
// real tables (lib/admin/metrics.ts); a metric that cannot be derived is
// shown as «ناموجود» with the reason, never as a fake zero.
//
// Presentation only: the numbers, the rolling-window arithmetic and the
// data source are unchanged. The KPIs are grouped into labelled sections,
// each range-dependent figure is dated, and the sales trend / plan mix are
// drawn as dependency-free charts sourced from the SAME reports endpoint
// the «گزارشها» page uses — gated by `admin:reports:read`.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminOverview, useAdminReports, useAdminMe } from "@/hooks/useAdmin";
import {
  toPersianNumber,
  toPersianDate,
  toRelativeTime,
  toPersianCurrency,
} from "@/lib/persian-utils";
import {
  PageHeader,
  Card,
  StatCard,
  StateView,
  InfoBanner,
  FilterPills,
  ErrorBlock,
  Section,
} from "@/components/admin/ui";
import {
  ChartFrame,
  ChartEmpty,
  ChartSkeleton,
  LineChart,
  BarChart,
  type ChartPoint,
  type BarDatum,
} from "@/components/admin/charts";
import {
  IconOpenInNew,
  IconWarning,
  IconUsers,
  IconScale,
  IconFileSearch,
  IconSparkle,
  IconLawBook,
  IconShieldCheck,
  IconClock,
  IconSubscription,
  IconCoin,
  IconBalance,
  IconBolt,
  IconCalendar,
} from "@/lib/icons";
import type { AdminKpi } from "@legalir/types";

const DESCRIPTION =
  "شاخص‌های کلیدی پلتفرم بر پایه داده‌های واقعی. بازه‌های زمانی بر اساس تاریخ خرید و ثبت ردیف‌ها محاسبه می‌شود.";

const RANGES = [
  { value: "7", label: "۷ روز" },
  { value: "30", label: "۳۰ روز" },
  { value: "90", label: "۹۰ روز" },
];

// ---------------------------------------------------------------------------
// KPI grouping & iconography (presentation only — no value is altered)
// ---------------------------------------------------------------------------

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const KPI_ICONS: Record<string, IconComponent> = {
  total_users: IconUsers,
  new_users: IconUsers,
  requests_total: IconScale,
  requests_in_range: IconFileSearch,
  points_issued: IconSparkle,
  lawyers_total: IconLawBook,
  lawyers_verified: IconShieldCheck,
  lawyers_pending: IconClock,
  active_subscriptions: IconSubscription,
  sales_count: IconCoin,
  sales_amount: IconBalance,
  refunded_amount: IconBalance,
  refund_pending: IconClock,
  ai_error_rate: IconBolt,
};

interface KpiGroup {
  key: string;
  titleFa: string;
  subtitleFa: string;
  keys: string[];
}

const KPI_GROUPS: KpiGroup[] = [
  {
    key: "users",
    titleFa: "کاربران و فعالیت",
    subtitleFa: "اندازهٔ پایهٔ کاربران و درخواست‌ها؛ ارقام بازه‌ای بر اساس تاریخ ثبت محاسبه می‌شوند.",
    keys: ["total_users", "new_users", "requests_total", "requests_in_range", "points_issued"],
  },
  {
    key: "lawyers",
    titleFa: "وکلا",
    subtitleFa: "پروفایل‌های واقعی وکلا (بدون دمو) و وضعیت تأیید آن‌ها.",
    keys: ["lawyers_total", "lawyers_verified", "lawyers_pending"],
  },
  {
    key: "sales",
    titleFa: "فروش و مالی",
    subtitleFa: "اشتراک‌ها، خریدها و تعدیل‌های مالی؛ بر اساس تاریخ خرید و ثبت ردیف.",
    keys: [
      "active_subscriptions",
      "sales_count",
      "sales_amount",
      "refunded_amount",
      "refund_pending",
    ],
  },
  {
    key: "other",
    titleFa: "سایر شاخص‌ها",
    subtitleFa: "شاخص‌هایی که در حال حاضر از داده‌های موجود قابل محاسبه نیستند.",
    keys: ["ai_error_rate"],
  },
];

/**
 * Assign every KPI the server returned to exactly one group. Any key not
 * named in KPI_GROUPS is appended to «سایر شاخص‌ها» rather than dropped, so a
 * newly-added server metric can never disappear from the page.
 */
function groupKpis(kpis: AdminKpi[]): { group: KpiGroup; items: AdminKpi[] }[] {
  const used = new Set<string>();
  const result = KPI_GROUPS.map((group) => {
    const items = group.keys
      .map((k) => kpis.find((x) => x.key === k))
      .filter((x): x is AdminKpi => Boolean(x));
    items.forEach((i) => used.add(i.key));
    return { group, items };
  }).filter((g) => g.items.length > 0);

  const leftovers = kpis.filter((k) => !used.has(k.key));
  if (leftovers.length > 0) {
    const other = result.find((g) => g.group.key === "other");
    if (other) other.items.push(...leftovers);
    else
      result.push({
        group: {
          key: "other",
          titleFa: "سایر شاخص‌ها",
          subtitleFa: "شاخص‌های تکمیلی.",
          keys: [],
        },
        items: leftovers,
      });
  }
  return result;
}

// ---------------------------------------------------------------------------
// A single KPI card (real value, or an honest «ناموجود»)
// ---------------------------------------------------------------------------

function MetricCard({ kpi }: { kpi: AdminKpi }) {
  const Icon = KPI_ICONS[kpi.key];

  if (kpi.unavailable) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            {Icon ? <Icon size={16} /> : <IconWarning size={16} />}
          </span>
          <p className="min-w-0 text-caption text-muted">{kpi.labelFa}</p>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-h3 font-bold text-amber-600 dark:text-amber-400">
          <IconWarning size={18} /> ناموجود
        </p>
        <p className="mt-0.5 text-caption text-muted">{kpi.unavailableReasonFa}</p>
      </Card>
    );
  }

  return (
    <div className="relative">
      <StatCard
        label={kpi.labelFa}
        value={kpi.value}
        hint={kpi.formulaFa}
        icon={Icon ? <Icon size={16} /> : undefined}
      />
      {kpi.drillHref && (
        <Link
          href={kpi.drillHref}
          className="absolute end-2.5 top-3.5 rounded-small p-1 text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`مشاهده ${kpi.labelFa}`}
        >
          <IconOpenInNew size={14} />
        </Link>
      )}
    </div>
  );
}

const KPI_GRID =
  "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-4";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  const [range, setRange] = useState<string>("30");
  const rangeDays = Number(range);

  const query = useAdminOverview(rangeDays);
  const { can } = useAdminMe();
  const canReadReports = can("admin:reports:read");
  // The trend/plan charts reuse the reports endpoint and are gated by the
  // same permission it enforces server-side.
  const reports = useAdminReports(rangeDays, { enabled: canReadReports });

  const planBars: BarDatum[] =
    reports.data?.byPlan.map((p) => ({
      label: p.planNameFa,
      value: p.amount,
      display: toPersianCurrency(p.amount),
    })) ?? [];

  const dailyPoints: ChartPoint[] =
    reports.data?.daily.map((d) => ({
      label: toPersianDate(d.date, { dateStyle: undefined, month: "2-digit", day: "2-digit" }),
      tooltipLabel: toPersianDate(d.date),
      value: d.count,
    })) ?? [];

  const dailyCount = reports.data?.daily.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="نمای کلی"
        description={DESCRIPTION}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-caption text-muted tablet:inline">بازه زمانی</span>
            <FilterPills options={RANGES} value={range} onChange={setRange} />
          </div>
        }
      />

      <details className="mb-6 rounded-large border border-divider bg-surface px-3.5 py-2.5">
        <summary className="cursor-pointer text-caption font-medium text-on-surface-variant">
          راهنمای گزارش
        </summary>
        <p className="mt-2 text-caption leading-relaxed text-muted">
          بازه‌های زمانی به‌صورت یک پنجرهٔ لغزان از زمان تولید گزارش در نظر گرفته می‌شوند و بر اساس
          تاریخ خرید اشتراک‌ها و تاریخ ثبت ردیف‌ها محاسبه می‌شوند. مبالغ به تومان و تاریخ‌ها به تقویم
          جلالی نمایش داده می‌شوند. شاخصی که از داده‌های موجود قابل محاسبه نباشد با برچسب «ناموجود» و
          دلیل آن نمایش داده می‌شود و هیچ مقدار ساختگی جایگزین آن نمی‌شود.
        </p>
      </details>

      {query.isError ? (
        <ErrorBlock message="خطا در دریافت شاخص‌های پلتفرم" onRetry={() => query.refetch()} />
      ) : (
        <StateView query={query}>
          {(data) => {
            const unavailable = data.kpis.filter((k) => k.unavailable);
            const generatedAt = new Date(data.generatedAt);
            const windowStart = new Date(generatedAt.getTime() - data.rangeDays * 86_400_000);

            return (
              <>
                {/* Active-range summary — makes the selected window explicit */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-large border border-divider bg-surface-container-low px-3.5 py-2.5 text-caption text-muted">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <IconCalendar size={15} aria-hidden="true" />
                    <span>
                      بازه فعال:{" "}
                      <strong className="font-semibold text-on-surface-variant">
                        {toPersianNumber(data.rangeDays)} روز
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      از {toPersianDate(windowStart)} تا {toPersianDate(generatedAt)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>منطقه زمانی: {data.timezone}</span>
                    <span aria-hidden="true">·</span>
                    <span>واحد پول: {data.currency}</span>
                    <span aria-hidden="true">·</span>
                    <span>به‌روزرسانی: {toRelativeTime(data.generatedAt)}</span>
                  </span>
                </div>

                {/* Key indicators, grouped into labelled sections */}
                {groupKpis(data.kpis).map(({ group, items }) => (
                  <Section key={group.key} title={group.titleFa} subtitle={group.subtitleFa}>
                    <div className={KPI_GRID}>
                      {items.map((k) => (
                        <MetricCard key={k.key} kpi={k} />
                      ))}
                    </div>
                  </Section>
                ))}

                {unavailable.length > 0 && (
                  <InfoBanner tone="warning">
                    {toPersianNumber(unavailable.length)} شاخص از داده‌های موجود قابل محاسبه نیست و
                    به‌صورت «ناموجود» نمایش داده می‌شود؛ هیچ مقدار ساختگی جایگزین نشده است.
                  </InfoBanner>
                )}

                {/* Sales trend & plan mix — real data from the reports endpoint */}
                <Section
                  title="روند و تحلیل فروش"
                  subtitle="بر پایه سفارش‌های واقعی همین بازه، محاسبه‌شده از تاریخ خرید."
                >
                  {!canReadReports ? (
                    <Card className="p-4 text-body-2 text-muted">
                      برای نمایش نمودارهای روند به مجوز «مشاهدهٔ گزارش‌ها» نیاز است. شاخص‌های کلیدی
                      بالا بدون این مجوز نیز نمایش داده می‌شوند.
                    </Card>
                  ) : reports.isError ? (
                    <ErrorBlock
                      message="خطا در دریافت گزارش فروش"
                      onRetry={() => reports.refetch()}
                    />
                  ) : reports.isLoading || !reports.data ? (
                    <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
                      <ChartSkeleton />
                      <ChartSkeleton />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
                      <ChartFrame
                        title="روند فروش روزانه"
                        subtitle={`تعداد خرید ثبت‌شده در هر روز، ${toPersianNumber(rangeDays)} روز گذشته.`}
                        legend={[{ label: "تعداد خرید", color: "var(--color-primary)" }]}
                      >
                        {dailyCount > 0 ? (
                          <LineChart
                            points={dailyPoints}
                            ariaLabel={`روند تعداد خرید روزانه در ${toPersianNumber(rangeDays)} روز گذشته`}
                            seriesName="تعداد خرید"
                            unit="خرید"
                          />
                        ) : (
                          <ChartEmpty message="در این بازه فروشی ثبت نشده است." />
                        )}
                      </ChartFrame>

                      <ChartFrame
                        title="فروش بر پایه پلن"
                        subtitle="مبلغ فروش هر پلن در این بازه (تومان)."
                        legend={[{ label: "مبلغ فروش", color: "var(--color-primary)" }]}
                      >
                        {planBars.length > 0 ? (
                          <BarChart bars={planBars} ariaLabel="مبلغ فروش به تفکیک پلن در این بازه" />
                        ) : (
                          <ChartEmpty message="در این بازه فروشی ثبت نشده است." />
                        )}
                      </ChartFrame>
                    </div>
                  )}
                </Section>

                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                  <Card className="p-4">
                    <h3 className="mb-2 text-body-1 font-bold text-onSurface">دسترسی سریع</h3>
                    <div className="grid grid-cols-2 gap-2 text-body-2">
                      <Link
                        href="/admin/orders"
                        className="rounded-medium border border-divider px-3 py-2 hover:bg-surface-hover"
                      >
                        فروش و بازگشت
                      </Link>
                      <Link
                        href="/admin/finance"
                        className="rounded-medium border border-divider px-3 py-2 hover:bg-surface-hover"
                      >
                        تسویه وکلا
                      </Link>
                      <Link
                        href="/admin/support"
                        className="rounded-medium border border-divider px-3 py-2 hover:bg-surface-hover"
                      >
                        تیکت‌های پشتیبانی
                      </Link>
                      <Link
                        href="/admin/reports"
                        className="rounded-medium border border-divider px-3 py-2 hover:bg-surface-hover"
                      >
                        گزارش‌ها
                      </Link>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <h3 className="mb-2 text-body-1 font-bold text-onSurface">توجه</h3>
                    <p className="text-body-2 leading-relaxed text-muted">
                      این محیط توسعه است و از پرداخت شبیه‌سازی‌شده استفاده می‌کند. هیچ داده‌ای به
                      سیستم‌های واقعی ارسال نمی‌شود. مبالغ به تومان (IRT) و تاریخ‌ها به تقویم جلالی
                      نمایش داده می‌شوند.
                    </p>
                    <p className="mt-2 text-caption text-muted">
                      آخرین محاسبه: {toPersianDate(data.generatedAt)}
                    </p>
                  </Card>
                </div>
              </>
            );
          }}
        </StateView>
      )}
    </div>
  );
}
