// ============================================================
// LEGALIR — Lawyer workbench · Dashboard (نمای کلی)
// ============================================================
// Everything on this page is derived server-side from real stored requests
// (`buildLawyerDashboard`), never a seeded counter:
//
//   · seven workflow counters + the two SLA counters,
//   · a 30-day referral/accept trend,
//   · a concrete, ordered «now do this» list, and
//   · a one-paragraph Persian summary of the most urgent work.
//
// Every number is a link. The dashboard response carries the request ids
// behind each counter (`buckets`), and the list route filters by the SAME
// bucket predicate — so clicking «nearly due» lands on exactly those rows.
// ============================================================

"use client";

import Link from "next/link";
import { useLawyerDashboard } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorBlock,
  PageHeader,
  StatCard,
  type StatAccent,
} from "@/components/admin/ui";
import { ChartFrame, LineChart, type ChartPoint } from "@/components/admin/charts";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  LAWYER_BANK_STATUS_FA,
  LAWYER_REFERRAL_SURFACES,
  LAWYER_REFERRAL_SURFACE_FA,
  type LawyerActionItem,
  type LawyerDashboardCounts,
} from "@legalir/types";
import {
  IconAdd,
  IconBalance,
  IconCalculator,
  IconCheckCircle,
  IconClock,
  IconDocument,
  IconGavel,
  IconInfo,
  IconPerson,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";

type Bucket = keyof LawyerDashboardCounts;

/** The KPI grid — every card deep-links to the bucket that produced it. */
const KPIS: {
  bucket: Bucket;
  label: string;
  tone: "default" | "warning" | "success" | "danger";
  accent: StatAccent;
  icon: React.ReactNode;
}[] = [
  {
    bucket: "newAssignments",
    label: "درخواست جدید (بازنشده)",
    tone: "default",
    accent: "brand",
    icon: <IconAdd size={18} />,
  },
  {
    bucket: "viewed",
    label: "بازشده، منتظر تصمیم",
    tone: "warning",
    accent: "warning",
    icon: <IconClock size={18} />,
  },
  {
    bucket: "accepted",
    label: "پذیرفته، هنوز شروع نشده",
    tone: "default",
    accent: "info",
    icon: <IconCheckCircle size={18} />,
  },
  {
    bucket: "inProgress",
    label: "در حال انجام",
    tone: "default",
    accent: "info",
    icon: <IconGavel size={18} />,
  },
  {
    bucket: "waitingForClient",
    label: "منتظر پاسخ موکل",
    tone: "warning",
    accent: "warning",
    icon: <IconInfo size={18} />,
  },
  {
    bucket: "completed",
    label: "تکمیل‌شده",
    tone: "success",
    accent: "success",
    icon: <IconCheckCircle size={18} />,
  },
  {
    bucket: "declined",
    label: "ردشده",
    tone: "default",
    accent: "brand",
    icon: <IconWarning size={18} />,
  },
  {
    bucket: "cancelled",
    label: "لغوشده",
    tone: "default",
    accent: "brand",
    icon: <IconWarning size={18} />,
  },
  {
    bucket: "atRisk",
    label: "نزدیک به مهلت",
    tone: "warning",
    accent: "warning",
    icon: <IconClock size={18} />,
  },
  {
    bucket: "breached",
    label: "گذشته از مهلت",
    tone: "danger",
    accent: "warning",
    icon: <IconWarning size={18} />,
  },
];

const ACTION_LABEL: Record<LawyerActionItem["kind"], string> = {
  new: "درخواست جدید",
  accept: "نیازمند تصمیم",
  info: "منتظر موکل",
  sla: "هشدار مهلت",
  reply: "در حال انجام",
};

const ACTION_TONE: Record<
  LawyerActionItem["kind"],
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  new: "brand",
  accept: "warning",
  info: "info",
  sla: "danger",
  reply: "neutral",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">در حال بارگذاری داشبورد…</span>
      <div className="h-9 w-64 rounded-medium bg-surface-container-high skeleton-shimmer" />
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 laptop:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-24 rounded-large bg-surface-container-high skeleton-shimmer" />
        ))}
      </div>
      <div className="h-72 rounded-large bg-surface-container-high skeleton-shimmer" />
    </div>
  );
}

/**
 * Jalali day labels for the axis. The `YYYY-MM-DD` key is parsed as a civil
 * date; midnight UTC can fall on the previous Jalali day in Tehran, so the
 * formatter pins the same timezone the projection buckets the days in.
 */
function trendPoints(
  trend: { date: string; referred: number }[]
): ChartPoint[] {
  return trend.map((p) => ({
    label: toPersianDate(`${p.date}T12:00:00Z`, { month: "2-digit", day: "2-digit" }),
    tooltipLabel: toPersianDate(`${p.date}T12:00:00Z`),
    value: p.referred,
  }));
}

export default function LawyerDashboardPage() {
  const query = useLawyerDashboard();
  const data = query.data;

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !data)
    return <ErrorBlock message="خطا در بارگذاری داشبورد" onRetry={() => query.refetch()} />;

  const profile = data.profile;
  const missing = data.profileCompleteness.missing;
  // One row per referral, tagged with every surface it belongs to. Grouping
  // by surface is how the lawyer sees the SAME referral under «قراردادها»
  // and «وکالت» — the row is reused, never duplicated in the data.
  const referralGroups = LAWYER_REFERRAL_SURFACES.map((surface) => ({
    surface,
    items: data.referrals.filter((r) => r.surfaces.includes(surface)),
  })).filter((group) => group.items.length > 0);
  const points = trendPoints(data.trend);
  const acceptedValues = data.trend.map((p) => p.accepted);
  const noReferrals = points.every((p) => p.value === 0) && acceptedValues.every((v) => v === 0);

  return (
    <div>
      <PageHeader
        title={profile ? `سلام، ${profile.fullName}` : "نمای کلی"}
        description="وضعیت درخواست‌های ارجاع‌شده، مهلت‌ها و کارهای فوری — همه بر پایهٔ داده‌های واقعی."
        icon={<IconBalance size={22} />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
            startIcon={<IconRefresh size={15} />}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* The server-written summary of the most urgent work. */}
      <Card className="mb-5 p-4 tablet:p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-soft text-primary tablet:flex"
          >
            <IconInfo size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-body-1 font-bold text-onSurface">خلاصهٔ وضعیت</h2>
            <p className="mt-1 text-body-2 leading-7 text-on-surface-variant">{data.summaryFa}</p>
            <p className="mt-2 text-caption text-muted">
              آخرین محاسبه: {toPersianDate(data.generatedAt)}
            </p>
          </div>
        </div>
      </Card>

      {/* Profile / bank readiness — both gate new referrals, so they sit above
          the numbers rather than buried in settings. */}
      {(missing.length > 0 ||
        data.bankStatus === "NOT_SET" ||
        data.bankStatus === "NEEDS_CORRECTION") && (
        <div className="mb-5 grid gap-3 tablet:grid-cols-2">
          {missing.length > 0 && (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-body-2 font-bold text-onSurface">
                    <IconPerson size={17} className="text-warning-600" />
                    پروفایل حرفه‌ای ناقص است
                  </h3>
                  <p className="mt-1 text-caption text-muted">
                    تا تکمیل این موارد، ممکن است ارجاع جدیدی دریافت نکنید.
                  </p>
                </div>
                <Badge tone="warning">
                  {toPersianNumber(data.profileCompleteness.percent)}٪
                </Badge>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {missing.map((gap) => (
                  <li key={gap.key}>
                    <Link
                      href={gap.href}
                      className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-soft px-2.5 py-1 text-caption text-warning-700 transition-colors hover:border-warning-300"
                    >
                      {gap.labelFa}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(data.bankStatus === "NOT_SET" || data.bankStatus === "NEEDS_CORRECTION") && (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-body-2 font-bold text-onSurface">
                    <IconCalculator size={17} className="text-warning-600" />
                    حساب تسویه
                  </h3>
                  <p className="mt-1 text-caption text-muted">
                    برای تسویهٔ دستمزد، اطلاعات شبا را تکمیل کنید.
                  </p>
                </div>
                <Badge tone={data.bankStatus === "NOT_SET" ? "neutral" : "warning"}>
                  {LAWYER_BANK_STATUS_FA[data.bankStatus]}
                </Badge>
              </div>
              <Link
                href="/lawyer/bank"
                className="mt-3 inline-block text-caption font-medium text-primary hover:underline"
              >
                ثبت / اصلاح اطلاعات بانکی
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* KPI grid — every card is a link into the bucket-filtered list. */}
      <div className="mb-6 grid grid-cols-2 gap-3 tablet:grid-cols-3 laptop:grid-cols-5">
        {KPIS.map((kpi) => (
          <StatCard
            key={kpi.bucket}
            label={kpi.label}
            value={data.counts[kpi.bucket]}
            icon={kpi.icon}
            tone={kpi.tone}
            accentTone={kpi.accent}
            href={`/lawyer/referrals?bucket=${kpi.bucket}`}
            moreLabel="مشاهدهٔ فهرست"
          />
        ))}
      </div>

      {/* Every referral assigned to this lawyer, grouped by the surface it
          appears on. A referral that spans two surfaces (a case carrying a
          power of attorney) is the SAME row under both — the API sends it
          once, with every surface in `surfaces`. */}
      <Card className="mb-5">
        <CardHeader
          title="ارجاعات شما"
          subtitle="پرونده‌ها، قراردادها، مشاوره‌ها و وکالت‌هایی که به شما ارجاع شده‌اند."
        />
        <CardBody>
          {referralGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <IconInfo size={26} className="text-muted" />
              <p className="text-body-2 text-muted">موردی به شما ارجاع نشده است.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {referralGroups.map((group) => (
                <section key={group.surface} aria-labelledby={`referrals-${group.surface}`}>
                  <h3
                    id={`referrals-${group.surface}`}
                    className="mb-2 flex items-center gap-2 text-body-2 font-bold text-onSurface"
                  >
                    {LAWYER_REFERRAL_SURFACE_FA[group.surface]}
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption font-normal text-on-surface-variant">
                      {toPersianNumber(group.items.length)}
                    </span>
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={`${group.surface}-${item.id}`}>
                        <Link
                          href={item.href}
                          className="flex items-start justify-between gap-3 rounded-medium border border-divider px-3 py-2.5 transition-colors hover:border-primary-300 hover:bg-surface-hover"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-body-2 font-medium text-on-surface">
                              {item.titleFa}
                            </span>
                            <span className="mt-0.5 block text-caption text-muted">
                              {item.clientNameFa ?? "موکل"} ·{" "}
                              {toPersianDate(item.updatedAt)}
                            </span>
                          </span>
                          <Badge tone="neutral">{item.stateFa}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid min-w-0 gap-5 laptop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Trend — `min-w-0` lets the card shrink to the grid column. Without
            it the auto-sized column inherits the chart's intrinsic width and
            the whole row overflowed a 390px phone by 67px. */}
        <ChartFrame
          className="min-w-0"
          title="روند ۳۰ روز گذشته"
          subtitle="تعداد ارجاع‌ها؛ خط‌چین: پذیرش‌شده‌ها در همان روز"
          legend={[
            { label: "ارجاع‌شده", color: "var(--chart-cat-1)" },
            { label: "پذیرش‌شده", color: "var(--chart-cat-2)" },
          ]}
        >
          {noReferrals ? (
            <p className="py-16 text-center text-body-2 text-muted">
              در ۳۰ روز گذشته ارجاعی ثبت نشده است.
            </p>
          ) : (
            <LineChart
              points={points}
              ariaLabel="روند ارجاع‌ها در ۳۰ روز گذشته"
              seriesName="ارجاع‌شده"
              overlay={{
                label: "پذیرش‌شده",
                values: acceptedValues,
                color: "var(--chart-cat-2)",
              }}
            />
          )}
        </ChartFrame>

        {/* Action list */}
        <Card className="flex h-full min-w-0 flex-col">
          <CardHeader
            title="کارهای فوری"
            subtitle="به ترتیب اولویت — برای دیدن جزئیات کلیک کنید."
          />
          <CardBody className="flex-1">
            {data.actionItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <IconCheckCircle size={30} className="text-success" />
                <p className="text-body-2 text-muted">کار فوری‌ای در صف نیست.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {data.actionItems.map((item, i) => (
                  <li key={`${item.kind}-${item.requestId}-${i}`}>
                    <Link
                      href={`/lawyer/referrals/${item.requestId}`}
                      className="block rounded-medium border border-divider px-3 py-2.5 transition-colors hover:border-primary-300 hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-body-2 font-medium text-on-surface">
                          {item.title}
                        </span>
                        <Badge tone={ACTION_TONE[item.kind]}>{ACTION_LABEL[item.kind]}</Badge>
                      </div>
                      <p className="mt-1 text-caption text-muted">{item.detailFa}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <div className="border-t border-divider p-3">
            <Link
              href="/lawyer/referrals"
              className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
            >
              <IconDocument size={14} /> همهٔ درخواست‌ها
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
