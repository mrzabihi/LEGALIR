// ============================================================
// LEGALIR — Admin · System status (وضعیت سامانه)
// ============================================================
// Honest system status. Every value here is either derived from a real API
// response or explicitly reported as unknown. There is NO hard-coded green
// "connected" badge: if the data layer does not answer, the page says so.
//
// The page proves two real things by rendering them together:
//   • the Next.js server responded (this page loaded), and
//   • the data layer answered within the measured latency (the settings +
//     overview calls below) — or failed, with the error shown verbatim.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useAdminSettings, useAdminOverview } from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  PageHeader,
  Card,
  StatCard,
  StateView,
  Badge,
  InfoBanner,
} from "@/components/admin/ui";

const ENVIRONMENT_FA: Record<string, string> = {
  development: "توسعه",
  staging: "آزمایشی (staging)",
  production: "تولید",
};

/** Measures how long the settings request took, from the browser side. */
function useMeasuredLatency(ready: boolean): number | null {
  const [latency, setLatency] = useState<number | null>(null);
  const startedAt = useState(() => Date.now())[0];
  useEffect(() => {
    if (ready && latency === null) setLatency(Date.now() - startedAt);
  }, [ready, latency, startedAt]);
  return latency;
}

export default function AdminHealthPage() {
  const settings = useAdminSettings();
  const overview = useAdminOverview(7);
  const latency = useMeasuredLatency(settings.isSuccess && overview.isSuccess);

  const dataOk = settings.isSuccess && overview.isSuccess;
  const dataFailed = settings.isError || overview.isError;

  return (
    <div>
      <PageHeader
        title="وضعیت سامانه"
        description="وضعیت واقعی سرور و لایهٔ داده. هیچ وضعیت ساختگی نمایش داده نمی‌شود؛ اگر لایهٔ داده پاسخ ندهد، همان خطا نشان داده می‌شود."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 tablet:grid-cols-3">
        <Card className="p-4">
          <p className="text-caption text-muted">سرور برنامه (Next.js)</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-body-2 font-medium text-on-surface">پاسخ‌گو</span>
          </div>
          <p className="mt-1 text-caption text-muted">
            این صفحه از همین سرور بارگذاری شده است؛ بنابراین سرور فعال است.
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-caption text-muted">لایهٔ داده (API مدیریت)</p>
          <div className="mt-1 flex items-center gap-2">
            {dataOk ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-body-2 font-medium text-on-surface">متصل</span>
              </>
            ) : dataFailed ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-body-2 font-medium text-red-600 dark:text-red-400">
                  پاسخ نداد
                </span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-body-2 font-medium text-on-surface">در حال بررسی…</span>
              </>
            )}
          </div>
          <p className="mt-1 text-caption text-muted">
            {dataOk && latency !== null
              ? `زمان پاسخ اندازه‌گیری‌شده: ${toPersianNumber(latency)} میلی‌ثانیه`
              : "بر پایه پاسخ واقعی دو فراخوانی داده (تنظیمات و نمای کلی)."}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-caption text-muted">محیط اجرا</p>
          <p className="mt-1 text-body-2 font-medium text-on-surface">
            {settings.data
              ? (ENVIRONMENT_FA[settings.data.environment] ?? settings.data.environment)
              : "—"}
          </p>
          {settings.data && (
            <p className="mt-1 text-caption text-muted">
              منطقه زمانی: {settings.data.timezone} · واحد پول: {settings.data.currency}
            </p>
          )}
        </Card>
      </div>

      {dataFailed && (
        <InfoBanner tone="warning">
          لایهٔ داده در پاسخ‌دهی ناموفق بود؛ این وضعیت بدون پوشش نمایش داده می‌شود تا مشکل
          پیگیری شود. مقادیر زیر ممکن است ناقص باشند.
        </InfoBanner>
      )}

      <StateView query={overview} loadingRows={4}>
        {(ov) => (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-caption text-muted">
              <Badge tone="info">بازه: {toPersianNumber(ov.rangeDays)} روز</Badge>
              {ov.kpis.filter((k) => k.unavailable).length > 0 && (
                <Badge tone="warning">
                  {toPersianNumber(ov.kpis.filter((k) => k.unavailable).length)} شاخص ناموجود
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
              {ov.kpis.map((k) =>
                k.unavailable ? (
                  <Card key={k.key} className="p-4">
                    <p className="text-caption text-muted">{k.labelFa}</p>
                    <p className="mt-1 text-h3 font-bold text-amber-600 dark:text-amber-400">
                      ناموجود
                    </p>
                    <p className="mt-1 text-caption text-muted">{k.unavailableReasonFa}</p>
                  </Card>
                ) : (
                  <StatCard key={k.key} label={k.labelFa} value={k.value} hint={k.formulaFa} />
                )
              )}
            </div>
          </>
        )}
      </StateView>

      <Card className="mt-5 p-4 text-caption text-muted">
        این محیط توسعه است و از پرداخت شبیه‌سازی‌شده استفاده می‌کند. هیچ داده‌ای به سامانه‌های
        واقعی ارسال نمی‌شود.
      </Card>
    </div>
  );
}
