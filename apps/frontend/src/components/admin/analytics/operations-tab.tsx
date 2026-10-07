// ============================================================
// LEGALIR — Analytics tab · Report 6 (platform operations)
// ============================================================
// The operational health of the platform over the SAME range as every other
// tab. Three real surfaces, each labelled for what it is:
//   • the request pipeline — a LIVE snapshot of open requests by state, plus
//     the window-scoped count of newly created requests (with a real trend);
//   • the lawyer review queue — a LIVE snapshot of profiles by decision bucket;
//   • the audit trail — the one operational table with a complete history, so
//     it is the metric that is actually windowed.
// A metric that cannot be derived (renewal rate, first-response SLA, login
// failures) is rendered as an explicit «ناموجود» card with its reason — never a
// plausible-looking estimate.
// ============================================================

"use client";

import { Section, StateView, StatCard } from "@/components/admin/ui";
import { BarChart, ChartEmpty, ChartFrame, DonutChart, catColor } from "@/components/admin/charts";
import { useAnalyticsOperations } from "@/hooks/useAnalytics";
import { toPersianNumber, toRelativeTime } from "@/lib/persian-utils";
import type { AnalyticsRangeQuery } from "@/lib/api/analytics";
import type { OperationsReport } from "@legalir/types";
import { QualityPanel, WindowCaption, comparisonTrend } from "./kit";
import {
  IconBriefcase,
  IconClock,
  IconGavel,
  IconHistory,
  IconShieldCheck,
  IconWarning,
} from "@/lib/icons";

const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-4";

export function OperationsTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsOperations(range);

  return (
    <StateView
      query={query}
      loadingRows={6}
      isEmpty={() => false}
      emptyMessage="دادهٔ عملیاتی برای این بازه در دسترس نیست."
    >
      {(data) => <OperationsBody data={data} />}
    </StateView>
  );
}

function OperationsBody({ data }: { data: OperationsReport }) {
  const req = data.requests;
  const queue = data.lawyerQueue;
  const audit = data.audit;

  return (
    <>
      <WindowCaption window={data.window} noteFa={req.snapshotNoteFa} />

      <Section
        title="دورهٔ درخواست‌ها"
        subtitle="موجودی درخواست‌ها یک تصویر لحظه‌ای است؛ «ثبت‌شده در بازه» محدود به همین بازهٔ انتخابی است و مقایسه با بازهٔ قبل دارد."
      >
        <div className={KPI_GRID}>
          <StatCard
            label="کل درخواست‌ها (لحظه‌ای)"
            value={req.totalNow}
            unit="درخواست"
            icon={<IconBriefcase size={16} />}
            hint="همهٔ درخواست‌های ثبت‌شده در سیستم، در همهٔ وضعیت‌ها."
          />
          <StatCard
            label="درخواست‌های باز (لحظه‌ای)"
            value={req.openNow}
            unit="درخواست"
            icon={<IconClock size={16} />}
            accent
            hint="درخواست‌های در وضعیت‌های غیرپایانی (خط لولهٔ فعال)."
          />
          <StatCard
            label="ثبت‌شده در بازه"
            value={req.created.current}
            unit="درخواست"
            icon={<IconGavel size={16} />}
            trend={comparisonTrend(req.created)}
            hint="درخواست‌هایی که در بازهٔ انتخابی ایجاد شده‌اند."
          />
          <StatCard
            label="میانگین عمر درخواست‌های باز"
            value={req.avgAgeDays == null ? "—" : toPersianNumber(req.avgAgeDays)}
            unit={req.avgAgeDays == null ? undefined : "روز"}
            icon={<IconClock size={16} />}
            hint={
              req.avgAgeDays == null
                ? "هیچ درخواست بازی وجود ندارد."
                : "از آخرین به‌روزرسانی هر درخواست باز تا همین لحظه."
            }
          />
        </div>
      </Section>

      <div className="mb-6 grid grid-cols-1 gap-4 desktop:grid-cols-2">
        <ChartFrame
          title="ترکیب وضعیت درخواست‌های باز"
          subtitle="تعداد درخواست‌های باز در هر وضعیت ماشین حالت (تصویر لحظه‌ای)."
        >
          {req.byState.length === 0 ? (
            <ChartEmpty message="هیچ درخواست بازی وجود ندارد." height={180} />
          ) : (
            <BarChart
              bars={req.byState.map((s, i) => ({
                label: s.labelFa,
                value: s.count,
                display: toPersianNumber(s.count),
                color: catColor(i),
              }))}
              ariaLabel="توزیع درخواست‌های باز بر اساس وضعیت"
              unit="درخواست"
            />
          )}
        </ChartFrame>

        <ChartFrame
          title="صف بررسی وکلا"
          subtitle="پروفایل‌های وکلا بر اساس آخرین تصمیم بررسی (تصویر لحظه‌ای)."
          action={
            queue.reviewCount > 0 ? (
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-caption font-medium text-warning-700">
                {toPersianNumber(queue.reviewCount)} در انتظار بررسی
              </span>
            ) : undefined
          }
        >
          {queue.totalNow === 0 ? (
            <ChartEmpty message="پروفایل وکیلی ثبت نشده است." height={180} />
          ) : (
            <DonutChart
              slices={queue.byBucket
                .filter((b) => b.count > 0)
                .map((b) => ({ label: b.labelFa, value: b.count }))}
              ariaLabel="توزیع وکلا بر اساس تصمیم بررسی"
              centerLabel="وکیل"
            />
          )}
        </ChartFrame>
      </div>

      <Section
        title="گزارش بازرسی (Audit)"
        subtitle="تنها دادهٔ عملیاتی با تاریخچهٔ کامل و قابل‌پنجره‌گذاری. هر عمل مدیریتی حساس در این دفتر ثبت می‌شود."
      >
        <div className={KPI_GRID}>
          <StatCard
            label="رویدادهای بازه"
            value={audit.entries.current}
            unit="رویداد"
            icon={<IconHistory size={16} />}
            trend={comparisonTrend(audit.entries)}
            hint="تعداد ردیف‌های دفتر بازرسی در بازهٔ انتخابی."
          />
          <StatCard
            label="مدیران فعال بازه"
            value={audit.distinctActors}
            unit="نفر"
            icon={<IconShieldCheck size={16} />}
            hint="تعداد متمایز مدیرانی که در بازه عمل ثبت‌شده انجام داده‌اند."
          />
          <StatCard
            label="موفق / ردشده"
            value={`${toPersianNumber(audit.successCount)} / ${toPersianNumber(audit.deniedCount)}`}
            icon={<IconShieldCheck size={16} />}
            tone={audit.deniedCount > 0 ? "warning" : "default"}
            hint={`موفق: ${toPersianNumber(audit.successCount)} · ردشده: ${toPersianNumber(
              audit.deniedCount
            )} · ناموفق: ${toPersianNumber(audit.failureCount)}`}
          />
          <StatCard
            label="آخرین رویداد"
            value={audit.latestAt ? toRelativeTime(audit.latestAt) : "—"}
            icon={<IconClock size={16} />}
            hint={
              audit.latestAt
                ? `آخرین رویداد ثبت‌شده در دفتر بازرسی (تازگی حدود ${toPersianNumber(
                    audit.freshnessHours ?? 0
                  )} ساعت).`
                : "دفتر بازرسی خالی است."
            }
          />
        </div>

        <div className="mt-4">
          <ChartFrame title="پرتکرارترین اقدامات بازه" subtitle="اقدام‌های مدیریتی ثبت‌شده در این بازه.">
            {audit.byAction.length === 0 ? (
              <ChartEmpty message="در این بازه اقدام مدیریتی ثبت نشده است." height={160} />
            ) : (
              <BarChart
                bars={audit.byAction.map((a, i) => ({
                  label: a.labelFa,
                  value: a.count,
                  display: toPersianNumber(a.count),
                  color: catColor(i),
                }))}
                ariaLabel="پرتکرارترین اقدامات مدیریتی در بازه"
                unit="رویداد"
              />
            )}
          </ChartFrame>
        </div>
      </Section>

      <Section
        title="شاخص‌های عملیاتی ناموجود"
        subtitle="این شاخص‌ها از جداول فعلی قابل استخراج نیستند و به‌صراحت «ناموجود» گزارش می‌شوند؛ هیچ عدد ساختگی جای آن‌ها نیست."
      >
        <div className="grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-3">
          {data.unavailable.map((u) => (
            <StatCard
              key={u.key}
              label={u.labelFa}
              value="ناموجود"
              tone="warning"
              icon={<IconWarning size={16} />}
              hint={u.reasonFa}
            />
          ))}
        </div>
      </Section>

      <QualityPanel flags={data.quality} />
    </>
  );
}
