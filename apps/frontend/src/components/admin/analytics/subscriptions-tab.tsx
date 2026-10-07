// ============================================================
// LEGALIR — Analytics tab · Report 1 (subscription sales by plan)
// ============================================================
// Count / gross / net over the window, a real previous-period comparison for
// each, a per-plan table (net of completed refunds) and two daily charts: the
// total net trend and the plan-vs-plan grouped comparison. Every series is the
// server's zero-filled daily bucket set, so a no-sale day is an explicit zero.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  Section,
  StateView,
  StatCard,
  Td,
  Th,
} from "@/components/admin/ui";
import {
  ChartEmpty,
  ChartFrame,
  GroupedBarChart,
  LineChart,
  catColor,
  type ChartPoint,
  type GroupedSeries,
} from "@/components/admin/charts";
import { useAnalyticsSubscriptions } from "@/hooks/useAnalytics";
import { toPersianCurrency, toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import type { AnalyticsRangeQuery } from "@/lib/api/analytics";
import type { SubscriptionSalesReport } from "@legalir/types";
import { AnalyticsExportButton, QualityPanel, WindowCaption, comparisonTrend } from "./kit";

const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-3";

export function SubscriptionsTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsSubscriptions(range);

  return (
    <StateView
      query={query}
      loadingRows={6}
      isEmpty={(d) =>
        d.byPlan.every((p) => p.count === 0) && d.daily.every((x) => x.plans.length === 0)
      }
      emptyMessage="در این بازه فروشی ثبت نشده است."
      emptyHint="برای بازهٔ دیگری تلاش کنید یا فروش‌ها ثبت شوند."
    >
      {(data) => <SubscriptionsBody range={range} data={data} />}
    </StateView>
  );
}

function SubscriptionsBody({
  range,
  data,
}: {
  range: AnalyticsRangeQuery;
  data: SubscriptionSalesReport;
}) {
  // Plans that actually sold in the window — the chart series, kept in a stable
  // colour by catalog index so re-scoping the range never repaints a plan.
  const soldCodes = useMemo(() => {
    const set = new Set<string>();
    for (const day of data.daily) for (const p of day.plans) set.add(p.planCode);
    // Preserve the catalog's own order for a stable legend; append any plan
    // that sold but is no longer in the catalog.
    const ordered = data.planCatalog.map((p) => p.planCode).filter((c) => set.has(c));
    for (const c of set) if (!ordered.includes(c)) ordered.push(c);
    return ordered;
  }, [data.daily, data.planCatalog]);

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    data.planCatalog.forEach((p, i) => m.set(p.planCode, catColor(i)));
    let next = data.planCatalog.length;
    for (const c of soldCodes) if (!m.has(c)) m.set(c, catColor(next++));
    return m;
  }, [data.planCatalog, soldCodes]);

  const planName = (code: string) =>
    data.planCatalog.find((p) => p.planCode === code)?.planNameFa ??
    data.byPlan.find((p) => p.planCode === code)?.planNameFa ??
    code;

  // Daily total net trend.
  const netPoints: ChartPoint[] = data.daily.map((d) => ({
    label: toPersianDate(d.date, { month: "2-digit", day: "2-digit" }),
    tooltipLabel: toPersianDate(d.date),
    value: d.plans.reduce((s, p) => s + p.net, 0),
  }));
  const netTotal = netPoints.reduce((s, p) => s + p.value, 0);

  // Previous-period overlay. Only offered when the server deemed the previous
  // window comparable — otherwise `previousDaily` is null and no toggle shows,
  // because a comparison against data that does not exist would be a fiction.
  const [showPrev, setShowPrev] = useState(false);
  const prevNet = data.previousDaily?.map((p) => p.net) ?? null;
  const prevHasData = prevNet != null && prevNet.some((v) => v !== 0);
  const canOverlay = data.previousDaily != null;
  const chartHasData = netTotal > 0 || (showPrev && prevHasData);

  // Per-plan daily net, one series per sold plan.
  const categories = data.daily.map((d) =>
    toPersianDate(d.date, { month: "2-digit", day: "2-digit" })
  );
  const series: GroupedSeries[] = soldCodes.map((code) => ({
    name: planName(code),
    color: colorOf.get(code),
    values: data.daily.map((d) => d.plans.find((p) => p.planCode === code)?.net ?? 0),
  }));

  return (
    <>
      <WindowCaption window={data.window} />

      <Section
        title="جمع فروش بازه"
        subtitle="تعداد، درآمد ناخالص و درآمد خالص (ناخالص منهای بازگشت وجه تکمیل‌شده) در بازهٔ انتخاب‌شده."
        actions={<AnalyticsExportButton kind="subscriptions" range={range} />}
      >
        <div className={KPI_GRID}>
          <StatCard
            label="تعداد فروش"
            value={data.totals.count.current}
            unit="فروش"
            trend={comparisonTrend(data.totals.count)}
            hint="خریدهای بازه از جدول اشتراک‌ها."
          />
          <StatCard
            label="درآمد ناخالص"
            value={toPersianCurrency(data.totals.gross.current)}
            trend={comparisonTrend(data.totals.gross, { unitFa: "تومان" })}
            hint="مجموع مبلغ خریدها در بازه."
            valueTitle={toPersianCurrency(data.totals.gross.current)}
          />
          <StatCard
            label="درآمد خالص"
            value={toPersianCurrency(data.totals.net.current)}
            trend={comparisonTrend(data.totals.net, { unitFa: "تومان" })}
            hint="ناخالص منهای بازگشت وجه تکمیل‌شده."
            valueTitle={toPersianCurrency(data.totals.net.current)}
          />
        </div>
      </Section>

      <Section
        title="روند فروش روزانه"
        subtitle="مجموع درآمد خالص هر روز (تومان). روزهای بدون فروش صفر رسم می‌شوند."
      >
        <ChartFrame
          title="درآمد خالص روزانه"
          subtitle={`${toPersianNumber(data.window.rangeDays)} روز بازهٔ انتخابی.`}
          action={
            canOverlay ? (
              <Button
                variant={showPrev ? "tonal" : "ghost"}
                size="sm"
                onClick={() => setShowPrev((v) => !v)}
                title="مقایسه با بازهٔ قبلی هم‌طول"
              >
                {showPrev ? "پنهان‌کردن دورهٔ قبل" : "نمایش دورهٔ قبل"}
              </Button>
            ) : undefined
          }
        >
          {chartHasData ? (
            <LineChart
              points={netPoints}
              ariaLabel="نمودار روند درآمد خالص روزانه"
              seriesName="درآمد خالص"
              unit="تومان"
              color="var(--control-selected)"
              overlay={
                showPrev && prevNet
                  ? { label: "دورهٔ قبل", values: prevNet }
                  : undefined
              }
            />
          ) : (
            <ChartEmpty message="در این بازه فروشی ثبت نشده است." />
          )}
        </ChartFrame>
      </Section>

      <Section
        title="مقایسهٔ پلن‌ها در هر روز"
        subtitle="درآمد خالص هر پلن، روز‌به‌روز، تا سهم هر پلن در روند فروش دیده شود."
      >
        <ChartFrame
          title="درآمد خالص بر پایهٔ پلن"
          subtitle="هر میله یک پلن؛ محور افقی روزهای بازه (راست‌به‌چپ)."
          legend={soldCodes.map((c) => ({
            label: planName(c),
            color: colorOf.get(c) ?? catColor(0),
          }))}
        >
          {series.length > 0 ? (
            <GroupedBarChart
              categories={categories}
              series={series}
              ariaLabel="مقایسهٔ درآمد خالص پلن‌ها در هر روز"
              unit="تومان"
              valueFormat={(n) => toPersianNumber(n)}
            />
          ) : (
            <ChartEmpty message="در این بازه فروشی برای مقایسه ثبت نشده است." />
          )}
        </ChartFrame>
      </Section>

      <Section
        title="فروش به تفکیک پلن"
        subtitle="تعداد، ناخالص، بازگشتی، خالص و سهم از درآمد خالص هر پلن."
      >
        {data.byPlan.length === 0 ? (
          <Card className="p-4 text-body-2 text-muted">پلنی در کاتالوگ ثبت نشده است.</Card>
        ) : (
          <DataTable
            head={
              <tr>
                <Th>پلن</Th>
                <Th>کد</Th>
                <Th>تعداد</Th>
                <Th>ناخالص (تومان)</Th>
                <Th>بازگشتی (تومان)</Th>
                <Th>خالص (تومان)</Th>
                <Th>سهم از خالص</Th>
              </tr>
            }
          >
            {data.byPlan.map((p) => (
              <tr key={p.planCode}>
                <Td className="font-medium text-on-surface">{p.planNameFa}</Td>
                <Td dir="ltr" className="text-caption text-muted">
                  {p.planCode}
                </Td>
                <Td className="tabular-nums">{toPersianNumber(p.count)}</Td>
                <Td className="tabular-nums">{toPersianCurrency(p.gross)}</Td>
                <Td className="tabular-nums text-muted">
                  {p.refunded ? toPersianCurrency(p.refunded) : "—"}
                </Td>
                <Td className="tabular-nums font-medium text-on-surface">
                  {toPersianCurrency(p.net)}
                </Td>
                <Td dir="ltr" className="tabular-nums">
                  {toPersianNumber(p.revenueSharePct)}٪
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      <QualityPanel flags={data.quality} />
    </>
  );
}
