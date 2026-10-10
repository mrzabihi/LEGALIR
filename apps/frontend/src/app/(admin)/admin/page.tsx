// ============================================================
// LEGALIR — Admin · Overview (نمای کلی)
// ============================================================
// The operator's landing surface. The layout answers the three questions a
// manager asks first — "what is the state now?", "how does it compare with
// the previous period?", "what needs my action?" — in that order:
//
//   1. a control bar  → range presets (today / 7 / 30 / 90 / custom) that
//                       re-scope EVERY range-dependent block consistently;
//   2. key indicators → real values with a real previous-period comparison
//                       (the percentage is shown only when the previous
//                       window actually has data — never faked from zero);
//   3. needs attention → real counts that may require a decision;
//   4. charts         → trend (revenue / requests on SEPARATE axes, switched
//                       in place) · current-state composition · category and
//                       plan comparison · recent activity.
//
// Presentation only: every number comes from `buildOverview` /
// `revenueByPlan` / `dailySales`, which read the real tables. A metric that
// cannot be derived is shown as «ناموجود» with the reason, never as a fake
// zero, and a comparison that cannot be made is shown as «—».
// ============================================================

"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SegmentedControl } from "@legalir/ui";
import { useAdminOverview, useAdminReports, useAdminMe } from "@/hooks/useAdmin";
import type { AdminWindow } from "@/lib/api/admin";
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
  ErrorBlock,
  Section,
  FilterPills,
  Badge,
  ACCENT_TOKENS,
  type StatTrend,
  type StatAccent,
} from "@/components/admin/ui";
import {
  ChartFrame,
  ChartEmpty,
  ChartSkeleton,
  LineChart,
  BarChart,
  DonutChart,
  Sparkline,
  catColor,
  type ChartPoint,
  type BarDatum,
} from "@/components/admin/charts";
import {
  IconOpenInNew,
  IconWarning,
  IconInfo,
  IconError,
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
  IconRefresh,
  IconDownload,
  IconHeadset,
  IconHandshake,
  IconFileText,
  IconChevronLeft,
  IconCategory,
} from "@/lib/icons";
import type { AdminKpi, AdminOverview } from "@legalir/types";

const DESCRIPTION =
  "وضعیت کنونی پلتفرم، مقایسه با بازهٔ قبل و موارد نیازمند اقدام — همه بر پایه داده‌های واقعی.";

// ---------------------------------------------------------------------------
// Range control
// ---------------------------------------------------------------------------

const PRESETS = [
  { value: "today", label: "امروز" },
  { value: "7", label: "۷ روز" },
  { value: "30", label: "۳۰ روز" },
  { value: "90", label: "۹۰ روز" },
  { value: "custom", label: "بازهٔ سفارشی" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

/** Local-calendar ISO date (YYYY-MM-DD) for `n` days ago. */
function isoDay(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function windowFor(
  preset: Preset,
  custom: { from: string; to: string }
): { rangeDays: number; window: AdminWindow | null } {
  if (preset === "custom") {
    if (custom.from && custom.to && custom.from <= custom.to) {
      return { rangeDays: 30, window: { from: custom.from, to: custom.to } };
    }
    return { rangeDays: 30, window: null };
  }
  if (preset === "today") {
    const d = isoDay(0);
    return { rangeDays: 1, window: { from: d, to: d } };
  }
  return { rangeDays: Number(preset), window: null };
}

// ---------------------------------------------------------------------------
// KPI presentation
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

const CURRENCY_KEYS = new Set(["sales_amount", "refunded_amount"]);

/**
 * One restrained accent per metric family — drawn from the design-system
 * semantic ramps, never a hand-picked colour. It tints the icon tile and a thin
 * bar on each card's start edge so a group reads as a family; the value keeps
 * its own semantic colour, so hue is never the only signal.
 */
const GROUP_ACCENT: Record<string, StatAccent> = {
  users: "info",
  lawyers: "success",
  sales: "brand",
  other: "warning",
};

/** The icon-tile accent for the hero row, keyed by KPI (revenue = brand lead). */
const HERO_ACCENT: Record<string, StatAccent> = {
  sales_amount: "brand",
  requests_in_range: "success",
  new_users: "info",
};

/** Renders the mapped icon for a KPI key, or nothing when the key is unknown. */
function KpiIcon({ kpiKey }: { kpiKey: string }) {
  const Ico = KPI_ICONS[kpiKey];
  return Ico ? <Ico size={16} /> : null;
}

function valueText(k: AdminKpi): string {
  return toPersianNumber(k.value);
}

/** A real previous-period comparison, or a neutral «—» when it cannot be made. */
function buildTrend(k: AdminKpi, comparisonLabel: string): StatTrend | undefined {
  if (k.unavailable || k.previousValue == null) return undefined;
  const pct = k.changePct;
  if (pct == null) {
    return {
      direction: "flat",
      tone: "neutral",
      labelFa: "—",
      titleFa: `مقایسه ممکن نیست: در ${comparisonLabel} داده‌ای برای این شاخص ثبت نشده است.`,
    };
  }
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const good = k.trend === "inverse" ? pct < 0 : pct > 0;
  const tone = pct === 0 ? "neutral" : good ? "good" : "bad";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const prevText = CURRENCY_KEYS.has(k.key)
    ? toPersianCurrency(k.previousValue)
    : toPersianNumber(k.previousValue);
  return {
    direction,
    tone,
    labelFa: `${sign}${toPersianNumber(Math.abs(pct))}٪`,
    titleFa: `مقایسه با ${comparisonLabel}: مقدار قبلی ${prevText}.`,
  };
}

/** The four hero indicators drawn straight from the returned KPIs + snapshot. */
const HERO_KEYS = ["sales_amount", "requests_in_range", "new_users"] as const;

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
    subtitleFa: "اندازهٔ پایهٔ کاربران و درخواست‌ها. ارقام بازه‌ای بر اساس تاریخ ثبت محاسبه می‌شوند.",
    keys: ["total_users", "requests_total", "points_issued"],
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
    subtitleFa: "اشتراک‌ها، خریدها و تعدیل‌های مالی بر اساس تاریخ خرید و ثبت ردیف.",
    keys: ["active_subscriptions", "sales_count", "refunded_amount", "refund_pending"],
  },
  {
    key: "other",
    titleFa: "سایر شاخص‌ها",
    subtitleFa: "شاخص‌هایی که از داده‌های موجود قابل محاسبه نیستند.",
    keys: ["ai_error_rate"],
  },
];

/**
 * Assign every returned KPI to exactly one group, skipping the keys already
 * shown in the hero row (so nothing is duplicated) while appending any new
 * server metric to «سایر شاخص‌ها» rather than dropping it.
 */
function groupKpis(kpis: AdminKpi[]): { group: KpiGroup; items: AdminKpi[] }[] {
  const used = new Set<string>(HERO_KEYS);
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
        group: { key: "other", titleFa: "سایر شاخص‌ها", subtitleFa: "شاخص‌های تکمیلی.", keys: [] },
        items: leftovers,
      });
  }
  return result;
}

// Column count follows the real content width: one column on a phone, two once
// there is room, three at tablet (a 256px rail plus four columns crushed the
// labels), and four only at desktop.
const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-4";

/**
 * One KPI card, wired straight from the returned metric. Presentational only —
 * `value`, `trend` and `unavailable` all come from the server value; a metric
 * flagged `unavailable` shows «قابل محاسبه نیست» (with its reason as the hint)
 * instead of a number that could be mistaken for a real zero, and never gets a
 * unit, trend or chart it cannot honestly have.
 */
function KpiStatCard({
  k,
  comparisonLabel,
  accent,
  chart,
  moreLabel = "مشاهدهٔ جزئیات",
}: {
  k: AdminKpi;
  comparisonLabel: string;
  accent?: StatAccent;
  /** A real-data glyph (e.g. a `Sparkline`); omit when no honest history exists. */
  chart?: ReactNode;
  moreLabel?: string;
}) {
  return (
    <StatCard
      label={k.labelFa}
      value={valueText(k)}
      unit={k.unitFa}
      hint={k.formulaFa}
      icon={<KpiIcon kpiKey={k.key} />}
      accentTone={accent}
      href={k.drillHref}
      valueTitle={
        !k.unavailable && CURRENCY_KEYS.has(k.key) ? toPersianCurrency(k.value) : undefined
      }
      trend={buildTrend(k, comparisonLabel)}
      unavailable={k.unavailable}
      unavailableLabel="قابل محاسبه نیست"
      chart={chart}
      moreLabel={k.drillHref ? moreLabel : undefined}
    />
  );
}

/**
 * A composition donut, shown as the last cell of a KPI group. It sits inside the
 * same card family (accent tint, edge bar, hover lift) and renders the group's
 * REAL "state" — every slice is a server-supplied count. When there is nothing
 * to compose it says so, rather than drawing an empty ring.
 */
function KpiDonutCard({
  title,
  hint,
  accent,
  slices,
  ariaLabel,
  centerLabel,
  emptyMessage,
  href,
  moreLabel = "مشاهدهٔ جزئیات",
}: {
  title: string;
  hint?: string;
  accent: StatAccent;
  slices: { label: string; value: number }[];
  ariaLabel: string;
  centerLabel: string;
  emptyMessage: string;
  href?: string;
  moreLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 start-0 w-1 ${ACCENT_TOKENS[accent].bar}`}
      />
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${ACCENT_TOKENS[accent].tile}`}
        >
          <IconCategory size={16} />
        </span>
        <p className="min-w-0 flex-1 text-caption font-medium text-muted">{title}</p>
      </div>

      <div className="mt-3 flex flex-1 items-center justify-center">
        {total > 0 ? (
          <DonutChart
            slices={slices}
            ariaLabel={ariaLabel}
            centerLabel={centerLabel}
            size={132}
            thickness={18}
            layout="stack"
          />
        ) : (
          <p className="py-4 text-center text-caption text-muted">{emptyMessage}</p>
        )}
      </div>

      {hint && <p className="mt-2 text-caption leading-relaxed text-muted">{hint}</p>}
      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-primary">
          {moreLabel}
          <IconChevronLeft size={13} aria-hidden="true" />
        </span>
      )}
    </>
  );

  const cls = `relative flex flex-col overflow-hidden p-4 ${ACCENT_TOKENS[accent].hover}`;

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${title} — ${moreLabel}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <Card interactive className={cls}>
          {body}
        </Card>
      </Link>
    );
  }
  return <Card className={cls}>{body}</Card>;
}

// Accent bar/tile colours come from the shared `ACCENT_TOKENS` map (ui.tsx),
// so the group marker and the card family can never drift apart.

/**
 * A titled block of KPI cards. The heading (accent marker + title + subtitle)
 * sits clear of the cards and the whole block carries a faint container fill,
 * so the four metric families never read as one continuous mass of cards.
 */
function KpiGroupSection({
  title,
  subtitle,
  infoFa,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  infoFa?: string;
  accent?: StatAccent;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 rounded-large border border-divider bg-surface-container p-3 tablet:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        {accent && (
          <span
            aria-hidden="true"
            className={`mt-1.5 h-5 w-1.5 shrink-0 rounded-full ${ACCENT_TOKENS[accent].bar}`}
          />
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-h3 font-bold text-onSurface">
            {title}
            {infoFa && (
              <span title={infoFa} className="text-muted" aria-label={infoFa} role="img">
                <IconInfo size={15} />
              </span>
            )}
          </h2>
          {subtitle && <p className="mt-0.5 text-body-2 text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const SEVERITY: Record<
  "info" | "warning" | "error",
  { count: string; icon: IconComponent; ring: string }
> = {
  info: { count: "text-info", icon: IconInfo, ring: "border-s-info" },
  warning: { count: "text-warning", icon: IconWarning, ring: "border-s-warning" },
  error: { count: "text-error", icon: IconError, ring: "border-s-error" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState<{ from: string; to: string }>({
    from: isoDay(29),
    to: isoDay(0),
  });

  const { rangeDays, window: windowParam } = useMemo(
    () => windowFor(preset, custom),
    [preset, custom]
  );

  const query = useAdminOverview(rangeDays, windowParam);
  const { can } = useAdminMe();
  const canReadReports = can("admin:reports:read");
  const reports = useAdminReports(rangeDays, { enabled: canReadReports, window: windowParam });

  const refetchAll = () => {
    void query.refetch();
    if (canReadReports) void reports.refetch();
  };

  const refetching = query.isFetching || (canReadReports && reports.isFetching);

  return (
    <div>
      <PageHeader
        title="نمای کلی"
        description={DESCRIPTION}
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="hidden text-caption text-muted tablet:inline">بازه زمانی</span>
              <FilterPills options={PRESETS as unknown as { value: Preset; label: string }[]} value={preset} onChange={setPreset} />
              <button
                type="button"
                onClick={refetchAll}
                disabled={refetching}
                className="inline-flex items-center gap-1.5 rounded-medium border border-divider bg-surface px-3 py-2 text-caption font-medium text-on-surface-variant transition-colors hover:bg-surface-hover disabled:opacity-50"
                aria-label="به‌روزرسانی گزارش"
              >
                <IconRefresh size={15} className={refetching ? "animate-spin" : ""} />
                <span className="hidden tablet:inline">به‌روزرسانی</span>
              </button>
              {canReadReports && (
                <Link
                  href="/admin/reports"
                  className="inline-flex items-center gap-1.5 rounded-medium border border-divider bg-surface px-3 py-2 text-caption font-medium text-on-surface-variant transition-colors hover:bg-surface-hover"
                >
                  <IconDownload size={15} />
                  <span className="hidden tablet:inline">خروجی گزارش</span>
                </Link>
              )}
            </div>

            {preset === "custom" && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-1.5 text-caption text-muted">
                  از
                  <input
                    type="date"
                    value={custom.from}
                    max={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-caption text-muted">
                  تا
                  <input
                    type="date"
                    value={custom.to}
                    min={custom.from}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
            )}
          </div>
        }
      />

      {query.isError ? (
        <ErrorBlock message="خطا در دریافت شاخص‌های پلتفرم" onRetry={() => query.refetch()} />
      ) : (
        <StateView query={query}>
          {(data) => (
            <OverviewBody
              data={data}
              reports={reports}
              canReadReports={canReadReports}
              rangeDays={rangeDays}
            />
          )}
        </StateView>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function OverviewBody({
  data,
  reports,
  canReadReports,
  rangeDays,
}: {
  data: AdminOverview;
  reports: ReturnType<typeof useAdminReports>;
  canReadReports: boolean;
  rangeDays: number;
}) {
  const [series, setSeries] = useState<"revenue" | "requests">("revenue");

  const generatedAt = new Date(data.generatedAt);
  const comparisonLabel = data.comparison
    ? `بازهٔ ${toPersianNumber(data.comparison.windowDays)} روزهٔ قبل`
    : "بازهٔ قبل";

  const heroKpis = HERO_KEYS.map((k) => data.kpis.find((x) => x.key === k)).filter(
    (x): x is AdminKpi => Boolean(x)
  );

  // --- Trend series (single axis; the two measures are switched, not overlaid) ---
  const revenuePoints: ChartPoint[] =
    reports.data?.daily.map((d) => ({
      label: toPersianDate(d.date, { month: "2-digit", day: "2-digit" }),
      tooltipLabel: toPersianDate(d.date),
      value: d.amount,
    })) ?? [];
  const revenueTotal = reports.data?.daily.reduce((s, d) => s + d.amount, 0) ?? 0;

  const requestPoints: ChartPoint[] = data.dailyRequests.map((d) => ({
    label: toPersianDate(d.date, { dateStyle: undefined, month: "2-digit", day: "2-digit" }),
    tooltipLabel: toPersianDate(d.date),
    value: d.count,
  }));
  const requestsTotal = data.dailyRequests.reduce((s, d) => s + d.count, 0);

  // Real per-day request counts over the SAME resolved window — the only honest
  // history the overview exposes, so it is the only KPI that gets a sparkline.
  const requestSparkValues = data.dailyRequests.map((d) => d.count);

  // --- Comparison charts (stable per-index colour) ---
  const planBars: BarDatum[] =
    reports.data?.byPlan.map((p, i) => ({
      label: p.planNameFa,
      value: p.amount,
      display: toPersianCurrency(p.amount),
      color: catColor(i),
    })) ?? [];

  const categoryBars: BarDatum[] = data.requestsByCategory.slice(0, 7).map((c, i) => ({
    label: c.labelFa,
    value: c.count,
    display: toPersianNumber(c.count),
    color: catColor(i),
  }));

  const stateSlices = data.requestsByState.map((s) => ({ label: s.labelFa, value: s.count }));

  // Range-independent KPI groups below the fold.
  const groups = groupKpis(data.kpis);

  // --- Per-section composition (real slices only — never a fabricated split) ---
  const kpiValue = (key: string) => data.kpis.find((k) => k.key === key)?.value ?? 0;

  // Users: growth share of the window against the lifetime base.
  const totalUsers = kpiValue("total_users");
  const newUsers = kpiValue("new_users");
  const userSlices = [
    { label: "کاربران جدید در بازه", value: newUsers },
    { label: "سایر کاربران", value: Math.max(0, totalUsers - newUsers) },
  ];

  // Lawyers: the three headings of the section, so the donut IS their ratio.
  const lawyersTotal = kpiValue("lawyers_total");
  const lawyersVerified = kpiValue("lawyers_verified");
  const lawyersPending = kpiValue("lawyers_pending");
  const lawyerSlices = [
    { label: "تأییدشده", value: lawyersVerified },
    { label: "در انتظار بررسی", value: lawyersPending },
    { label: "سایر وضعیت‌ها", value: Math.max(0, lawyersTotal - lawyersVerified - lawyersPending) },
  ];

  // Sales: real purchase counts per plan over the resolved window (reports query).
  const planSlices =
    reports.data?.byPlan.map((p) => ({ label: p.planNameFa, value: p.count })) ?? [];

  // Only the sections that have an honest composition get a donut card.
  const donutForGroup: Record<
    string,
    {
      title: string;
      hint: string;
      ariaLabel: string;
      centerLabel: string;
      emptyMessage: string;
      href: string;
      slices: { label: string; value: number }[];
    }
  > = {
    users: {
      title: "ترکیب کاربران",
      hint: "سهم کاربران جدید بازه در برابر سایر کاربران.",
      ariaLabel: "ترکیب کاربران: سهم کاربران جدید بازه در برابر سایر کاربران.",
      centerLabel: "کاربر",
      emptyMessage: "داده‌ای برای ترکیب کاربران در دسترس نیست.",
      href: "/admin/users",
      slices: userSlices,
    },
    lawyers: {
      title: "وضعیت تأیید وکلا",
      hint: "نسبت وکلای تأییدشده، در انتظار بررسی و سایر وضعیت‌ها.",
      ariaLabel: "ترکیب وضعیت وکلا: تأییدشده، در انتظار بررسی و سایر وضعیت‌ها.",
      centerLabel: "وکیل",
      emptyMessage: "وکیلی برای نمایش ترکیب ثبت نشده است.",
      href: "/admin/lawyers",
      slices: lawyerSlices,
    },
    sales: {
      title: "تعداد فروش بر اساس پلن",
      hint: "سهم هر پلن از خریدهای بازهٔ انتخاب‌شده.",
      ariaLabel: "ترکیب تعداد فروش بر اساس پلن در بازهٔ انتخاب‌شده.",
      centerLabel: "خرید",
      emptyMessage: "خریدی در این بازه ثبت نشده است.",
      href: "/admin/orders",
      slices: planSlices,
    },
  };

  return (
    <>
      {/* Active window — makes the date basis explicit and re-scopes everything */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-large border border-divider bg-surface-container-low px-3.5 py-2.5 text-caption text-muted">
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
            از {toPersianDate(generatedAt.getTime() - data.rangeDays * 86_400_000)} تا{" "}
            {toPersianDate(generatedAt)}
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

      {/* 1 · Key indicators */}
      <KpiGroupSection
        title="شاخص‌های کلیدی"
        subtitle={`مقایسه هر شاخص با ${comparisonLabel}. هر کارت به گزارش تفصیلی خود پیوند دارد.`}
        infoFa="درآمد فروش بر اساس تاریخ خرید، درخواست‌ها بر اساس تاریخ ثبت و کاربران بر اساس تاریخ عضویت محاسبه می‌شوند. ارزش کل (نه بازه‌ای) با «—» نشان داده می‌شود."
      >
        <div className={KPI_GRID}>
          {heroKpis.map((k) => (
            <KpiStatCard
              key={k.key}
              k={k}
              comparisonLabel={comparisonLabel}
              accent={HERO_ACCENT[k.key]}
              chart={
                k.key === "requests_in_range" && requestSparkValues.length >= 2 ? (
                  <Sparkline
                    values={requestSparkValues}
                    ariaLabel={`روند تعداد درخواست‌های ثبت‌شده در هر روز، ${toPersianNumber(rangeDays)} روز گذشته؛ از راست (قدیمی‌تر) به چپ (امروز).`}
                    color="var(--color-info-500)"
                  />
                ) : undefined
              }
            />
          ))}
          <StatCard
            label="درخواست‌های باز (کنونی)"
            value={toPersianNumber(data.openRequestsTotal)}
            hint="درخواست‌های غیرپایانی در زمان تولید گزارش؛ با «درخواست‌های ثبت‌شده در بازه» اشتباه نشود."
            icon={<IconClock size={16} />}
            accentTone="info"
            href="/admin/requests"
            moreLabel="مشاهدهٔ جزئیات"
          />
        </div>
      </KpiGroupSection>

      {/* 2 · Needs attention */}
      <Section
        title="نیازمند اقدام"
        subtitle="مواردی که به تصمیم اپراتور نیاز دارند و از داده‌های واقعی شمارش شده‌اند."
      >
        {data.attention.length === 0 ? (
          <Card className="flex items-center gap-2 p-4 text-body-2 text-muted">
            <IconShieldCheck size={18} className="text-success" aria-hidden="true" />
            در حال حاضر موردی نیازمند اقدام نیست.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-3">
            {data.attention.map((a) => {
              const s = SEVERITY[a.severity];
              const Icon = s.icon;
              return (
                <Link
                  key={a.key}
                  href={a.href}
                  className={`group block rounded-large border border-s-2 border-divider ${s.ring} bg-surface p-4 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-body-2 text-on-surface-variant">
                      <Icon size={16} className={s.count} aria-hidden="true" />
                      <span className="truncate">{a.labelFa}</span>
                    </span>
                    <IconOpenInNew
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 text-muted transition-colors group-hover:text-primary"
                    />
                  </div>
                  <p className={`mt-1 text-h2 font-bold tabular-nums ${s.count}`}>
                    {toPersianNumber(a.count)}
                  </p>
                  <p className="mt-0.5 text-caption leading-relaxed text-muted">{a.hintFa}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* 3 · Trend + composition */}
      <div className="mb-6 grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-8">
          <ChartFrame
            title={series === "revenue" ? "روند درآمد فروش" : "روند ثبت درخواست‌ها"}
            subtitle={
              series === "revenue"
                ? `مجموع مبلغ فروش هر روز (تومان) در ${toPersianNumber(rangeDays)} روز گذشته.`
                : `تعداد درخواست‌های ثبت‌شده در هر روز، ${toPersianNumber(rangeDays)} روز گذشته.`
            }
            action={
              <SegmentedControl
                ariaLabel="انتخاب سری نمودار روند"
                idBase="trend-series"
                segments={[
                  { value: "revenue", label: "درآمد" },
                  { value: "requests", label: "درخواست‌ها" },
                ]}
                value={series}
                onChange={(v) => setSeries(v as "revenue" | "requests")}
              />
            }
          >
            {!canReadReports && series === "revenue" ? (
              <Card className="p-4 text-body-2 text-muted">
                برای نمایش روند درآمد به مجوز «مشاهدهٔ گزارش‌ها» نیاز است.
              </Card>
            ) : series === "revenue" ? (
              reports.isError ? (
                <ErrorBlock message="خطا در دریافت گزارش فروش" onRetry={() => reports.refetch()} />
              ) : reports.isLoading || !reports.data ? (
                <ChartSkeleton />
              ) : revenueTotal > 0 ? (
                <LineChart
                  points={revenuePoints}
                  ariaLabel={`روند درآمد فروش روزانه در ${toPersianNumber(rangeDays)} روز گذشته`}
                  seriesName="درآمد"
                  unit="تومان"
                  color="var(--control-selected)"
                  axisFont={18}
                />
              ) : (
                <ChartEmpty message="در این بازه فروشی ثبت نشده است." />
              )
            ) : requestsTotal > 0 ? (
              <LineChart
                points={requestPoints}
                ariaLabel={`روند ثبت درخواست‌ها در ${toPersianNumber(rangeDays)} روز گذشته`}
                seriesName="درخواست"
                unit="درخواست"
                axisFont={18}
              />
            ) : (
              <ChartEmpty message="در این بازه درخواستی ثبت نشده است." />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-4">
          <ChartFrame
            title="ترکیب درخواست‌ها بر اساس وضعیت"
            subtitle="سهم هر وضعیت از درخواست‌های باز کنونی."
          >
            {stateSlices.length === 0 ? (
              <ChartEmpty message="درخواست بازِ فعالی وجود ندارد." />
            ) : (
              <DonutChart
                slices={stateSlices}
                ariaLabel="سهم وضعیت‌های درخواست‌های باز"
                centerLabel="درخواست باز"
              />
            )}
          </ChartFrame>
        </div>
      </div>

      {/* 4 · Comparison + recent activity */}
      <div className="grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-6">
          <ChartFrame
            title="درخواست‌ها به تفکیک دسته"
            subtitle={`تعداد درخواست‌های ثبت‌شده در بازه، بر اساس دستهٔ حقوقی.`}
          >
            {categoryBars.length === 0 ? (
              <ChartEmpty message="در این بازه درخواستی ثبت نشده است." />
            ) : (
              <BarChart bars={categoryBars} ariaLabel="تعداد درخواست‌ها به تفکیک دسته" />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-6">
          <ChartFrame
            title="مبلغ فروش بر پایه پلن"
            subtitle="مجموع مبلغ فروش هر پلن در بازه (تومان)."
          >
            {!canReadReports ? (
              <Card className="p-4 text-body-2 text-muted">
                برای نمایش این نمودار به مجوز «مشاهدهٔ گزارش‌ها» نیاز است.
              </Card>
            ) : reports.isError ? (
              <ErrorBlock message="خطا در دریافت گزارش فروش" onRetry={() => reports.refetch()} />
            ) : reports.isLoading || !reports.data ? (
              <ChartSkeleton height={180} />
            ) : planBars.length === 0 ? (
              <ChartEmpty message="در این بازه فروشی ثبت نشده است." />
            ) : (
              <BarChart bars={planBars} ariaLabel="مبلغ فروش به تفکیک پلن در این بازه" />
            )}
          </ChartFrame>
        </div>
      </div>

      {/* 5 · Recent activity + quick access */}
      <div className="mt-6 grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-8">
          <Card className="flex h-full flex-col p-4 tablet:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-body-1 font-bold text-onSurface">آخرین درخواست‌ها</h3>
              <Link
                href="/admin/requests"
                className="text-caption font-medium text-primary hover:underline"
              >
                مشاهده همه
              </Link>
            </div>
            {data.recentRequests.length === 0 ? (
              <p className="py-6 text-center text-body-2 text-muted">درخواستی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {data.recentRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/requests/${encodeURIComponent(r.id)}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="truncate text-body-2 text-on-surface" title={r.title}>
                        {r.title}
                      </span>
                      <span className="shrink-0 text-caption tabular-nums text-muted">
                        {toRelativeTime(r.createdAt)}
                      </span>
                      <span className="col-span-2 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{r.categoryFa}</Badge>
                        <span className="text-caption text-muted">{r.stateFa}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="desktop:col-span-4">
          <Card className="flex h-full flex-col p-4 tablet:p-5">
            <h3 className="mb-3 text-body-1 font-bold text-onSurface">دسترسی سریع</h3>
            <div className="grid grid-cols-1 gap-2 text-body-2 mobile-l:grid-cols-2 desktop:grid-cols-1">
              {[
                { href: "/admin/orders", label: "فروش و بازگشت وجه", icon: IconBalance },
                { href: "/admin/finance", label: "تسویه وکلا", icon: IconHandshake },
                { href: "/admin/support", label: "تیکت‌های پشتیبانی", icon: IconHeadset },
                { href: "/admin/reports", label: "گزارش‌ها", icon: IconFileText },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2 rounded-medium border border-divider px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-hover"
                >
                  <l.icon size={16} className="text-muted" aria-hidden="true" />
                  {l.label}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-caption leading-relaxed text-muted">
              این محیط توسعه است و از پرداخت شبیه‌سازی‌شده استفاده می‌کند. مبالغ به تومان (IRT) و
              تاریخ‌ها به تقویم جلالی نمایش داده می‌شوند.
            </p>
          </Card>
        </div>
      </div>

      {/* 6 · Supplemental indicators (below the fold) — one block per family */}
      <div className="mt-6">
        {groups.map(({ group, items }) => {
          const donut = donutForGroup[group.key];
          return (
            <KpiGroupSection
              key={group.key}
              title={group.titleFa}
              subtitle={group.subtitleFa}
              accent={GROUP_ACCENT[group.key]}
            >
              <div className={KPI_GRID}>
                {items.map((k) => (
                  <KpiStatCard
                    key={k.key}
                    k={k}
                    comparisonLabel={comparisonLabel}
                    accent={GROUP_ACCENT[group.key]}
                  />
                ))}
                {donut && (
                  <KpiDonutCard
                    title={donut.title}
                    hint={donut.hint}
                    accent={GROUP_ACCENT[group.key] ?? "brand"}
                    slices={donut.slices}
                    ariaLabel={donut.ariaLabel}
                    centerLabel={donut.centerLabel}
                    emptyMessage={donut.emptyMessage}
                    href={donut.href}
                  />
                )}
              </div>
            </KpiGroupSection>
          );
        })}
      </div>
    </>
  );
}
