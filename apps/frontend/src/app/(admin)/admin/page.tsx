// ============================================================
// LEGALIR — Admin · Overview (نمای کلی)
// ============================================================
// The landing surface of the admin panel. Every KPI is computed from the
// real tables (lib/admin/metrics.ts); a metric that cannot be derived is
// shown as «ناموجود» with the reason, never as a fake zero.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminOverview } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import {
  PageHeader,
  Card,
  StatCard,
  StateView,
  InfoBanner,
  FilterPills,
  ErrorBlock,
} from "@/components/admin/ui";
import { IconOpenInNew, IconWarning } from "@/lib/icons";

const RANGES = [
  { value: "7", label: "۷ روز" },
  { value: "30", label: "۳۰ روز" },
  { value: "90", label: "۹۰ روز" },
];

export default function AdminOverviewPage() {
  const [range, setRange] = useState<string>("30");
  const query = useAdminOverview(Number(range));

  return (
    <div>
      <PageHeader
        title="نمای کلی"
        description="شاخص‌های کلیدی پلتفرم بر پایه داده‌های واقعی. بازه‌های زمانی بر اساس تاریخ خرید و ثبت ردیف‌ها محاسبه می‌شود."
        actions={
          <FilterPills
            options={RANGES}
            value={range}
            onChange={setRange}
          />
        }
      />

      {query.isError ? (
        <ErrorBlock message="خطا در دریافت شاخص‌های پلتفرم" onRetry={() => query.refetch()} />
      ) : (
        <StateView query={query}>
          {(data) => {
            const unavailable = data.kpis.filter((k) => k.unavailable);
            return (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
                  <span>
                    بازه: {toPersianNumber(data.rangeDays)} روز · منطقه زمانی: {data.timezone} · واحد پول:{" "}
                    {data.currency}
                  </span>
                  <span>به‌روزرسانی: {toRelativeTime(data.generatedAt)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
                  {data.kpis.map((k) =>
                    k.unavailable ? (
                      <Card key={k.key} className="p-4">
                        <p className="text-caption text-muted">{k.labelFa}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-h3 font-bold text-amber-600 dark:text-amber-400">
                          <IconWarning size={18} /> ناموجود
                        </p>
                        <p className="mt-1 text-caption text-muted">{k.unavailableReasonFa}</p>
                      </Card>
                    ) : (
                      <div key={k.key} className="relative">
                        <StatCard label={k.labelFa} value={k.value} hint={k.formulaFa} />
                        {k.drillHref && (
                          <Link
                            href={k.drillHref}
                            className="absolute end-3 top-3 text-muted hover:text-primary"
                            aria-label={`مشاهده ${k.labelFa}`}
                          >
                            <IconOpenInNew size={14} />
                          </Link>
                        )}
                      </div>
                    )
                  )}
                </div>

                {unavailable.length > 0 && (
                  <div className="mt-5">
                    <InfoBanner tone="warning">
                      {toPersianNumber(unavailable.length)} شاخص از داده‌های موجود قابل محاسبه نیست و
                      به‌صورت «ناموجود» نمایش داده می‌شود؛ هیچ مقدار ساختگی جایگزین نشده است.
                    </InfoBanner>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-4 tablet:grid-cols-2">
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
                    <p className="text-body-2 text-muted leading-relaxed">
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
