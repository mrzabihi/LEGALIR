// ============================================================
// LEGALIR — Analytics tab · Finance reconciliation
// ============================================================
// One job: prove the analytics money equals the orders model, and state the
// payment truth. The reconciliation compares this module's subscriptions-derived
// net (`gross − refunds`) with the net summed from the derived orders model
// (`listOrders`), and shows a pass/fail badge. Payment health never calls a
// simulated (mock) gateway "real" — it counts and labels it.
// ============================================================

"use client";

import { Card, DataTable, Section, StateView, StatCard, Td, Th } from "@/components/admin/ui";
import { BarChart, ChartFrame } from "@/components/admin/charts";
import { useAnalyticsFinance } from "@/hooks/useAnalytics";
import { toPersianCurrency, toPersianNumber } from "@/lib/persian-utils";
import type { AnalyticsRangeQuery } from "@/lib/api/analytics";
import type { FinanceAnalytics } from "@legalir/types";
import { QualityPanel, WindowCaption } from "./kit";
import { IconCheck, IconWarning } from "@/lib/icons";

const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-3";

export function FinanceTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsFinance(range);

  return (
    <StateView
      query={query}
      loadingRows={5}
      isEmpty={() => false}
      emptyMessage="دادهٔ مالی در دسترس نیست."
    >
      {(data) => <FinanceBody data={data} />}
    </StateView>
  );
}

function FinanceBody({ data }: { data: FinanceAnalytics }) {
  const rec = data.reconcile;
  const pay = data.payments;

  const concentrationBars = [
    { label: "۱٪ بالا", pct: data.concentration.top1Pct },
    { label: "۵٪ بالا", pct: data.concentration.top5Pct },
    { label: "۱۰٪ بالا", pct: data.concentration.top10Pct },
    { label: "۲۰٪ بالا", pct: data.concentration.top20Pct },
  ];

  return (
    <>
      <WindowCaption window={data.window} />

      <Section
        title="تطبیق مالی"
        subtitle="درآمد خالص این داشبورد باید دقیقاً با خالص مدل سفارش‌ها برابر باشد؛ این همان چیزی است که ثابت می‌کند دو بخش یک پول را گزارش می‌کنند."
      >
        <Card
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 border-s-2 p-4 ${
            rec.matches ? "border-s-success" : "border-s-error"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${
                rec.matches ? "bg-success-soft text-success-700" : "bg-error-soft text-error-700"
              }`}
            >
              {rec.matches ? <IconCheck size={20} /> : <IconWarning size={20} />}
            </span>
            <div>
              <p className="text-body-1 font-bold text-onSurface">
                {rec.matches ? "تطبیق برقرار است" : "تطبیق برقرار نیست"}
              </p>
              <p className="mt-0.5 text-caption text-muted">
                خالص داشبورد: {toPersianCurrency(rec.net)} · خالص سفارش‌ها:{" "}
                {toPersianCurrency(data.ordersNet)}
              </p>
            </div>
          </div>
          <span className="text-caption text-muted">
            {rec.matches
              ? "دو منبع مستقل، یک عدد را تأیید می‌کنند."
              : "اختلاف میان دو منبع وجود دارد؛ نیازمند بررسی است."}
          </span>
        </Card>

        <div className={KPI_GRID}>
          <StatCard
            label="درآمد ناخالص"
            value={toPersianCurrency(data.gross)}
            hint="مجموع مبلغ خریدها در بازه."
            valueTitle={toPersianCurrency(data.gross)}
          />
          <StatCard
            label="بازگشت وجه (تکمیل‌شده)"
            value={toPersianCurrency(data.refunds)}
            tone="warning"
            hint="تعدیل‌های مالی «تکمیل‌شده» در بازه."
            valueTitle={toPersianCurrency(data.refunds)}
          />
          <StatCard
            label="درآمد خالص"
            value={toPersianCurrency(data.net)}
            hint="ناخالص منهای بازگشت وجه تکمیل‌شده."
            valueTitle={toPersianCurrency(data.net)}
          />
        </div>
      </Section>

      <div className="mb-6 grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-6">
          <ChartFrame
            title="تمرکز درآمد"
            subtitle={`سهم بالاترین خریداران از کل درآمد مثبت بازه (${toPersianNumber(
              data.concentration.buyers
            )} خریدار).`}
          >
            {data.concentration.buyers === 0 ? (
              <Card className="p-4 text-body-2 text-muted">در این بازه خریداری ثبت نشده است.</Card>
            ) : (
              <BarChart
                bars={concentrationBars.map((c) => ({
                  label: c.label,
                  value: c.pct,
                  display: `${toPersianNumber(c.pct)}٪`,
                }))}
                ariaLabel="تمرکز درآمد بر بالاترین خریداران"
              />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-6">
          <ChartFrame
            title="وضعیت پرداخت‌ها"
            subtitle="پرداخت‌های مرتبط با خریدهای همین بازه؛ مبالغ شبیه‌سازی‌شده به‌صراحت جدا شمرده می‌شوند."
          >
            <DataTable
              head={
                <tr>
                  <Th>وضعیت</Th>
                  <Th>تعداد</Th>
                </tr>
              }
              minWidth={280}
            >
              <tr>
                <Td className="font-medium text-on-surface">پرداخت‌شده</Td>
                <Td className="tabular-nums">{toPersianNumber(pay.paid)}</Td>
              </tr>
              <tr>
                <Td>در انتظار</Td>
                <Td className="tabular-nums">{toPersianNumber(pay.pending)}</Td>
              </tr>
              <tr>
                <Td>ناموفق</Td>
                <Td className="tabular-nums">{toPersianNumber(pay.failed)}</Td>
              </tr>
              <tr>
                <Td className="font-medium text-warning-700">از درگاه شبیه‌سازی‌شده (mock)</Td>
                <Td className="tabular-nums text-warning-700">{toPersianNumber(pay.mock)}</Td>
              </tr>
            </DataTable>
            <p className="mt-2 text-caption leading-relaxed text-muted">
              {pay.coveragePct == null
                ? "در این بازه اشتراکی ثبت نشده، پس پوشش پرداخت قابل‌محاسبه نیست."
                : `پوشش پرداخت: ${toPersianNumber(pay.coveragePct)}٪ از ${toPersianNumber(
                    pay.windowCount
                  )} خرید بازه دارای ردیف پرداخت هستند.`}
              {pay.mock > 0 &&
                " خریدهای این محیط از درگاه شبیه‌سازی‌شده‌اند و «پرداخت واقعی» محسوب نمی‌شوند."}
            </p>
          </ChartFrame>
        </div>
      </div>

      <Section
        title="بازگشت وجه‌های در انتظار"
        subtitle="تعدیل‌های مالی که هنوز تکمیل نشده‌اند (یک بدهی بالقوه، جدا از بازگشت‌های تسویه‌شده)."
      >
        <div className="grid grid-cols-1 gap-3 mobile-l:grid-cols-2">
          <StatCard
            label="تعداد بازگشت در انتظار"
            value={data.refundPendingCount}
            unit="مورد"
            icon={<IconWarning size={16} />}
            tone={data.refundPendingCount > 0 ? "warning" : "default"}
            hint="تعدیل‌های مالی با وضعیت غیرتکمیل‌شده."
          />
          <StatCard
            label="مبلغ بازگشت در انتظار"
            value={toPersianCurrency(data.refundPendingAmount)}
            tone={data.refundPendingAmount > 0 ? "warning" : "default"}
            hint="مجموع مبلغ تعدیل‌های در انتظار."
            valueTitle={toPersianCurrency(data.refundPendingAmount)}
          />
        </div>
      </Section>

      <QualityPanel flags={data.quality} />
    </>
  );
}
