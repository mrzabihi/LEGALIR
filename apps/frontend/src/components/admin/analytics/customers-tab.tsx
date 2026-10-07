// ============================================================
// LEGALIR — Analytics tab · Reports 3 & 4 (customers)
// ============================================================
// Report 3 — purchase ranking: window-scoped paid orders, gross/refunded/net,
// first/last purchase and last-seen, sortable and paginated.
// Report 4 — LRFM: raw L/R/F/M, the declared segment table, average AND median
// repurchase interval (separately), new-vs-returning, realized LTV and the
// honest "what is NOT computed" note (there is no invented «N» dimension).
// Staff accounts are excluded from the cohort — this is stated in the note.
// ============================================================

"use client";

import { useState } from "react";
import {
  Card,
  DataTable,
  Section,
  StateView,
  StatCard,
  Td,
  Th,
  Button,
} from "@/components/admin/ui";
import { BarChart, ChartEmpty, ChartFrame, catColor } from "@/components/admin/charts";
import { useAnalyticsCustomers, useAnalyticsRanking } from "@/hooks/useAnalytics";
import { toPersianNumber, toPersianCurrency, toRelativeTime } from "@/lib/persian-utils";
import type { AnalyticsRangeQuery, PurchaseRankingQuery } from "@/lib/api/analytics";
import type { CustomerAnalyticsReport, LrfmSegment } from "@legalir/types";
import { AnalyticsExportButton, Pager, QualityPanel, WindowCaption } from "./kit";

const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-4";

const SORT_OPTIONS: { value: NonNullable<PurchaseRankingQuery["sort"]>; label: string }[] = [
  { value: "net", label: "خالص" },
  { value: "count", label: "تعداد" },
  { value: "recency", label: "تازگی خرید" },
];

/** Persian label for a segment — mirrors the server's report labels. */
const SEGMENT_FA: Record<LrfmSegment, string> = {
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

export function CustomersTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsCustomers(range);

  return (
    <StateView
      query={query}
      loadingRows={6}
      isEmpty={(d) => d.cohortSize === 0}
      emptyMessage="کاربری برای تحلیل وجود ندارد."
    >
      {(data) => <CustomersBody range={range} data={data} />}
    </StateView>
  );
}

function CustomersBody({
  range,
  data,
}: {
  range: AnalyticsRangeQuery;
  data: CustomerAnalyticsReport;
}) {
  const [sort, setSort] = useState<NonNullable<PurchaseRankingQuery["sort"]>>("net");
  const [page, setPage] = useState(1);
  const ranking = useAnalyticsRanking(range, { sort, page, pageSize: 20 });

  const returningPct =
    data.buyerCount === 0
      ? 0
      : Math.round((data.newVsReturning.returningCount / data.buyerCount) * 1000) / 10;

  return (
    <>
      <WindowCaption window={data.window} />

      <Section
        title="تصویر کلی مشتریان"
        subtitle="تحلیل بر پایهٔ کل عمر کاربر است (نه فقط بازهٔ انتخابی)؛ بخش‌ها و LTV محقق‌شده بر همین پایه محاسبه می‌شوند."
        actions={<AnalyticsExportButton kind="customers" range={range} />}
      >
        <div className={KPI_GRID}>
          <StatCard
            label="اندازهٔ کوهورت (مشتریان)"
            value={data.cohortSize}
            unit="کاربر"
            hint="حساب‌های کارکنان پلتفرم از این شمارش کنار گذاشته شده‌اند."
          />
          <StatCard
            label="خریداران"
            value={data.buyerCount}
            unit="نفر"
            hint="کاربرانی با حداقل یک خرید."
          />
          <StatCard
            label="LTV محقق‌شده"
            value={toPersianCurrency(data.realizedLtv)}
            hint="میانگین درآمد خالص هر خریدار (فقط محقق‌شده؛ پیش‌بینی نمی‌شود)."
            valueTitle={toPersianCurrency(data.realizedLtv)}
          />
          <StatCard
            label="بازگشتی‌ها"
            value={`${toPersianNumber(returningPct)}٪`}
            hint={`${toPersianNumber(data.newVsReturning.returningCount)} از ${toPersianNumber(
              data.buyerCount
            )} خریدار، بازگشتی‌اند (خرید دوم یا خرید در ماهی دیگر).`}
          />
        </div>
      </Section>

      {/* Explicit honest disclaimer — no invented N dimension, M caveat, LTV scope */}
      <Card className="mb-6 border-s-2 border-s-info p-4 text-body-2 leading-relaxed text-on-surface-variant">
        {data.notComputedNoteFa}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-7">
          <ChartFrame
            title="توزیع بخش‌های LRFM"
            subtitle="تعداد کاربران هر بخش (کل کوهورت مشتریان)."
          >
            {data.segments.length === 0 ? (
              <ChartEmpty message="بخشی برای نمایش وجود ندارد." height={180} />
            ) : (
              <BarChart
                bars={data.segments.map((s, i) => ({
                  label: s.labelFa,
                  value: s.count,
                  display: `${toPersianNumber(s.count)} (${toPersianNumber(s.sharePct)}٪)`,
                  color: catColor(i),
                }))}
                ariaLabel="توزیع کاربران در بخش‌های LRFM"
                unit="نفر"
              />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-5">
          <ChartFrame
            title="فاصلهٔ خرید مجدد"
            subtitle="میانگین و میانه به‌صورت جداگانه — فقط خریداران با دو خرید یا بیشتر."
          >
            {data.repurchaseAvgDays == null ? (
              <ChartEmpty
                message={`فاصلهٔ خرید برای محاسبه کافی نیست؛ ${toPersianNumber(
                  data.singlePurchaseBuyers
                )} خریدار فقط یک بار خرید کرده‌اند.`}
                height={180}
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-large border border-divider bg-surface-container-low p-3">
                  <p className="text-caption text-muted">میانگین فاصله</p>
                  <p className="mt-1 text-h3 font-bold tabular-nums text-onSurface">
                    {toPersianNumber(data.repurchaseAvgDays)}{" "}
                    <span className="text-caption font-medium text-muted">روز</span>
                  </p>
                </div>
                <div className="rounded-large border border-divider bg-surface-container-low p-3">
                  <p className="text-caption text-muted">میانهٔ فاصله</p>
                  <p className="mt-1 text-h3 font-bold tabular-nums text-onSurface">
                    {data.repurchaseMedianDays == null
                      ? "—"
                      : toPersianNumber(data.repurchaseMedianDays)}{" "}
                    <span className="text-caption font-medium text-muted">روز</span>
                  </p>
                </div>
                <p className="text-caption leading-relaxed text-muted">
                  {toPersianNumber(data.singlePurchaseBuyers)} خریدار تک‌خرید از این محاسبه کنار
                  گذاشته شده‌اند.
                </p>
              </div>
            )}
          </ChartFrame>
        </div>
      </div>

      <Section
        title="خلاصهٔ بخش‌ها"
        subtitle="تعداد، سهم از کوهورت و درآمد خالص هر بخش. برچسب «در معرض ریزش» یک قاعدهٔ R > ۹۰ روز است، نه پیش‌بینی مدل."
      >
        <DataTable
          head={
            <tr>
              <Th>بخش</Th>
              <Th>تعداد</Th>
              <Th>سهم از کوهورت</Th>
              <Th>درآمد خالص (تومان)</Th>
            </tr>
          }
        >
          {data.segments.map((s) => (
            <tr key={s.segment}>
              <Td className="font-medium text-on-surface">{s.labelFa}</Td>
              <Td className="tabular-nums">{toPersianNumber(s.count)}</Td>
              <Td dir="ltr" className="tabular-nums">
                {toPersianNumber(s.sharePct)}٪
              </Td>
              <Td className="tabular-nums">{toPersianCurrency(s.net)}</Td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section
        title="رتبه‌بندی خرید"
        subtitle="خریدهای هر کاربر در بازهٔ انتخابی، با مبلغ ناخالص، بازگشتی و خالص، اولین/آخرین خرید و آخرین فعالیت."
      >
        <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-caption text-muted">مرتب‌سازی:</span>
          {SORT_OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={sort === o.value ? "tonal" : "ghost"}
              onClick={() => {
                setSort(o.value);
                setPage(1);
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>

        <StateView
          query={ranking}
          loadingRows={5}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="در این بازه خریدی برای رتبه‌بندی ثبت نشده است."
        >
          {(pageData) => (
            <>
              <DataTable
                head={
                  <tr>
                    <Th>کاربر</Th>
                    <Th>شناسه</Th>
                    <Th>تعداد خرید</Th>
                    <Th>ناخالص</Th>
                    <Th>بازگشتی</Th>
                    <Th>خالص (تومان)</Th>
                    <Th>اولین خرید</Th>
                    <Th>آخرین خرید</Th>
                    <Th>آخرین فعالیت</Th>
                  </tr>
                }
              >
                {pageData.items.map((r) => (
                  <tr key={r.userId}>
                    <Td className="font-medium text-on-surface">{r.displayName ?? "بدون نام"}</Td>
                    <Td dir="ltr" className="font-mono text-caption text-muted" title={r.userId}>
                      {r.userId.length > 14 ? `${r.userId.slice(0, 14)}…` : r.userId}
                    </Td>
                    <Td className="tabular-nums">{toPersianNumber(r.orderCount)}</Td>
                    <Td className="tabular-nums">{toPersianCurrency(r.gross)}</Td>
                    <Td className="tabular-nums text-muted">
                      {r.refunded ? toPersianCurrency(r.refunded) : "—"}
                    </Td>
                    <Td className="tabular-nums font-medium text-on-surface">
                      {toPersianCurrency(r.net)}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {r.firstPurchaseAt ? toRelativeTime(r.firstPurchaseAt) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {r.lastPurchaseAt ? toRelativeTime(r.lastPurchaseAt) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {r.lastActiveAt ? toRelativeTime(r.lastActiveAt) : "—"}
                    </Td>
                  </tr>
                ))}
              </DataTable>
              <Pager
                page={pageData.page}
                pageSize={pageData.pageSize}
                total={pageData.total}
                onChange={setPage}
              />
            </>
          )}
        </StateView>
      </Section>

      <Section
        title="مشتریان کلیدی (بالاترین ارزش)"
        subtitle="ده خریدار با بالاترین درآمد خالص در طول عمر."
      >
        {data.top.length === 0 ? (
          <Card className="p-4 text-body-2 text-muted">خریداری ثبت نشده است.</Card>
        ) : (
          <DataTable
            head={
              <tr>
                <Th>کاربر</Th>
                <Th>بخش</Th>
                <Th>L (روز)</Th>
                <Th>R (روز)</Th>
                <Th>F (خرید)</Th>
                <Th>M (تومان)</Th>
              </tr>
            }
          >
            {data.top.map((r) => (
              <tr key={r.userId}>
                <Td className="font-medium text-on-surface">{r.displayName ?? "بدون نام"}</Td>
                <Td>{SEGMENT_FA[r.segment]}</Td>
                <Td className="tabular-nums">{r.l == null ? "—" : toPersianNumber(r.l)}</Td>
                <Td className="tabular-nums">{r.r == null ? "—" : toPersianNumber(r.r)}</Td>
                <Td className="tabular-nums">{toPersianNumber(r.f)}</Td>
                <Td className="tabular-nums">{toPersianCurrency(r.m)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      <QualityPanel flags={data.quality} />
    </>
  );
}
