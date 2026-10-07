// ============================================================
// LEGALIR — Analytics tab · Report 2 (user energy)
// ============================================================
// Distinguishes the LIVE balance (a snapshot: reward ledger + today's
// subscription credit) from the IN-RANGE movements (granted / consumed), and
// states the calculation source explicitly. Expired energy is surfaced as
// «ناموجود» — the tables hold no expiry, so it is never shown as zero.
//
// The per-user table is the paginated drill-down, sharing the same aggregates
// as the headline so a row can never disagree with a KPI.
// ============================================================

"use client";

import { useState } from "react";
import {
  Card,
  DataTable,
  SearchInput,
  Section,
  StateView,
  StatCard,
  Td,
  Th,
  Button,
} from "@/components/admin/ui";
import { BarChart, ChartEmpty, ChartFrame, DonutChart, catColor } from "@/components/admin/charts";
import { useAnalyticsEnergy, useAnalyticsEnergyUsers } from "@/hooks/useAnalytics";
import { toPersianNumber, toRelativeTime } from "@/lib/persian-utils";
import type { AnalyticsRangeQuery, EnergyUsersQuery } from "@/lib/api/analytics";
import type { EnergyReport } from "@legalir/types";
import { AnalyticsExportButton, Pager, QualityPanel, WindowCaption, comparisonTrend } from "./kit";
import { IconBolt, IconClock, IconCoin, IconRefresh } from "@/lib/icons";

const KPI_GRID = "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-4";

const SORT_OPTIONS: { value: NonNullable<EnergyUsersQuery["sort"]>; label: string }[] = [
  { value: "balance", label: "موجودی" },
  { value: "consumed", label: "مصرف بازه" },
  { value: "recent", label: "آخرین تغییر" },
];

export function EnergyTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsEnergy(range);

  return (
    <StateView
      query={query}
      loadingRows={6}
      isEmpty={() => false}
      emptyMessage="دادهٔ انرژی در دسترس نیست."
    >
      {(data) => <EnergyBody range={range} data={data} />}
    </StateView>
  );
}

function EnergyBody({
  range,
  data,
}: {
  range: AnalyticsRangeQuery;
  data: EnergyReport;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<NonNullable<EnergyUsersQuery["sort"]>>("balance");
  const [page, setPage] = useState(1);

  const users = useAnalyticsEnergyUsers(range, {
    search: search || undefined,
    sort,
    page,
    pageSize: 20,
  });
  const t = data.totals;

  return (
    <>
      <WindowCaption
        window={data.window}
        refreshedAt={data.refreshedAt}
        noteFa={data.sourceNoteFa}
      />

      <Section
        title="جمع انرژی"
        subtitle="«موجودی جاری» یک تصویر لحظه‌ای است؛ «دریافتی/مصرف» حرکت‌های همان بازهٔ انتخابی است. این دو مبنا با هم مخلوط نمی‌شوند."
        actions={<AnalyticsExportButton kind="energy" range={range} />}
      >
        <div className={KPI_GRID}>
          <StatCard
            label="موجودی جاری (تصویر لحظه‌ای)"
            value={t.currentBalance}
            unit="امتیاز"
            icon={<IconCoin size={16} />}
            accent
            hint={`مجموع پاداش (${toPersianNumber(t.rewardBalance)}) + ماندهٔ اعتبار روزانهٔ اشتراک (${toPersianNumber(
              t.subscriptionBalance
            )}).`}
          />
          <StatCard
            label="دریافتی بازه"
            value={t.granted}
            unit="امتیاز"
            icon={<IconBolt size={16} />}
            trend={comparisonTrend(data.granted)}
            hint="اعتبار اشتراک + پاداش ثبت‌شده در بازه."
          />
          <StatCard
            label="مصرف بازه"
            value={t.consumed}
            unit="امتیاز"
            icon={<IconBolt size={16} />}
            trend={comparisonTrend(data.consumed)}
            hint="مصرف خالص از تراکنش‌های استفاده (برگشتی‌ها کسر شده)."
          />
          <StatCard
            label="باقیمانده بازه"
            value={t.remaining}
            unit="امتیاز"
            icon={<IconClock size={16} />}
            hint="دریافتی بازه منهای مصرف بازه."
          />
        </div>

        <div className="mt-3">
          <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-caption text-muted">
            <span>
              انرژی منقضی‌شده:{" "}
              <strong className="font-semibold text-warning-700">ناموجود</strong> — جدول‌ها زمان
              انقضا ذخیره نمی‌کنند؛ این عدد صفر نیست، قابل محاسبه نیست.
            </span>
          </Card>
        </div>
      </Section>

      <div className="mb-6 grid grid-cols-1 gap-4 desktop:grid-cols-12">
        <div className="desktop:col-span-4">
          <ChartFrame title="منبع انرژی دریافتی" subtitle="سهم هر منبع از انرژی اعطاشده در بازه.">
            {data.bySource.length === 0 ? (
              <ChartEmpty message="در این بازه انرژی اعطا نشده است." height={160} />
            ) : (
              <BarChart
                bars={data.bySource.map((s, i) => ({
                  label: s.labelFa,
                  value: s.granted,
                  display: toPersianNumber(s.granted),
                  color: catColor(i),
                }))}
                ariaLabel="انرژی دریافتی به تفکیک منبع"
                unit="امتیاز"
              />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-4">
          <ChartFrame title="مصرف به تفکیک فعالیت" subtitle="مصرف خالص هر نوع فعالیت در بازه.">
            {data.byActivity.length === 0 ? (
              <ChartEmpty message="در این بازه مصرفی ثبت نشده است." height={160} />
            ) : (
              <BarChart
                bars={data.byActivity.map((a, i) => ({
                  label: a.labelFa,
                  value: a.consumed,
                  display: toPersianNumber(a.consumed),
                  color: catColor(i),
                }))}
                ariaLabel="انرژی مصرف‌شده به تفکیک فعالیت"
                unit="امتیاز"
              />
            )}
          </ChartFrame>
        </div>

        <div className="desktop:col-span-4">
          <ChartFrame
            title="توزیع موجودی کاربران"
            subtitle="تعداد کاربران در هر بازهٔ موجودی (لحظه‌ای)."
          >
            {data.distribution.every((d) => d.count === 0) ? (
              <ChartEmpty message="کاربری با موجودی ثبت نشده است." height={160} />
            ) : (
              <DonutChart
                slices={data.distribution.map((d) => ({ label: d.labelFa, value: d.count }))}
                ariaLabel="توزیع کاربران بر اساس موجودی انرژی"
                centerLabel="کاربر"
              />
            )}
          </ChartFrame>
        </div>
      </div>

      <Section
        title="بیشترین موجودی‌ها"
        subtitle="ده کاربر با بیشترین موجودی جاری (تصویر لحظه‌ای)."
      >
        {data.topHolders.length === 0 ? (
          <Card className="p-4 text-body-2 text-muted">کاربری با موجودی ثبت نشده است.</Card>
        ) : (
          <DataTable
            head={
              <tr>
                <Th>کاربر</Th>
                <Th>موبایل</Th>
                <Th>موجودی</Th>
                <Th>دریافتی بازه</Th>
                <Th>مصرف بازه</Th>
                <Th>آخرین تغییر</Th>
              </tr>
            }
          >
            {data.topHolders.map((u) => (
              <tr key={u.userId}>
                <Td className="font-medium text-on-surface">{u.displayName ?? "بدون نام"}</Td>
                <Td dir="ltr" className="tabular-nums text-muted">
                  {u.mobileMasked}
                </Td>
                <Td className="tabular-nums font-medium text-on-surface">
                  {toPersianNumber(u.balance)}
                </Td>
                <Td className="tabular-nums">{toPersianNumber(u.granted)}</Td>
                <Td className="tabular-nums">{toPersianNumber(u.consumed)}</Td>
                <Td className="whitespace-nowrap text-muted">
                  {u.lastChangeAt ? toRelativeTime(u.lastChangeAt) : "—"}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      <Section
        title="انرژی همهٔ کاربران"
        subtitle="جدول کامل با جست‌وجو و مرتب‌سازی؛ همین ارقام مبنای خروجی اکسل هستند."
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="جست‌وجوی نام، موبایل یا شناسه…"
            className="w-full max-w-xs"
          />
          <div className="flex items-center gap-1.5">
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => users.refetch()}
              disabled={users.isFetching}
              title="به‌روزرسانی جدول"
            >
              <IconRefresh size={14} className={users.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <StateView
          query={users}
          loadingRows={5}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="کاربری با این مشخصات یافت نشد."
        >
          {(pageData) => (
            <>
              <DataTable
                head={
                  <tr>
                    <Th>کاربر</Th>
                    <Th>موبایل</Th>
                    <Th>موجودی</Th>
                    <Th>دریافتی بازه</Th>
                    <Th>مصرف بازه</Th>
                    <Th>آخرین تغییر</Th>
                  </tr>
                }
              >
                {pageData.items.map((u) => (
                  <tr key={u.userId}>
                    <Td className="font-medium text-on-surface">{u.displayName ?? "بدون نام"}</Td>
                    <Td dir="ltr" className="tabular-nums text-muted">
                      {u.mobileMasked}
                    </Td>
                    <Td className="tabular-nums font-medium text-on-surface">
                      {toPersianNumber(u.balance)}
                    </Td>
                    <Td className="tabular-nums">{toPersianNumber(u.granted)}</Td>
                    <Td className="tabular-nums">{toPersianNumber(u.consumed)}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {u.lastChangeAt ? toRelativeTime(u.lastChangeAt) : "—"}
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

      <QualityPanel flags={data.quality} />
    </>
  );
}
