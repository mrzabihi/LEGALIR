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

import { useEffect, useState, type ReactNode } from "react";
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

/**
 * The three status cards share one structure — label, status line, explanation —
 * so the eye compares them row-by-row instead of re-parsing each card. Colour
 * comes from the semantic ramps (never a raw emerald/red/amber), and the dot is
 * decorative: the status word beside it carries the meaning for screen readers.
 */
const STATUS_TONE = {
  ok: { dot: "bg-success-500", text: "text-on-surface" },
  bad: { dot: "bg-error-500", text: "text-error-700" },
  pending: { dot: "bg-warning-500", text: "text-on-surface" },
} as const;

function StatusCard({
  label,
  tone,
  value,
  hint,
}: {
  label: string;
  tone: keyof typeof STATUS_TONE;
  value: string;
  hint?: ReactNode;
}) {
  const t = STATUS_TONE[tone];
  return (
    <Card className="p-4">
      <p className="text-caption font-medium text-muted">{label}</p>
      <p className="mt-1.5 flex items-center gap-2 text-h4 font-semibold text-onSurface">
        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
        <span className={t.text}>{value}</span>
      </p>
      {hint && <p className="mt-1.5 text-caption leading-relaxed text-muted">{hint}</p>}
    </Card>
  );
}

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
        <StatusCard
          label="سرور برنامه (Next.js)"
          tone="ok"
          value="پاسخ‌گو"
          hint="این صفحه از همین سرور بارگذاری شده است؛ بنابراین سرور فعال است."
        />

        <StatusCard
          label="لایهٔ داده (API مدیریت)"
          tone={dataOk ? "ok" : dataFailed ? "bad" : "pending"}
          value={dataOk ? "متصل" : dataFailed ? "پاسخ نداد" : "در حال بررسی…"}
          hint={
            dataOk && latency !== null
              ? `زمان پاسخ اندازه‌گیری‌شده: ${toPersianNumber(latency)} میلی‌ثانیه`
              : "بر پایه پاسخ واقعی دو فراخوانی داده (تنظیمات و نمای کلی)."
          }
        />

        <Card className="p-4">
          <p className="text-caption font-medium text-muted">محیط اجرا</p>
          <p className="mt-1.5 text-h4 font-semibold text-onSurface">
            {settings.data
              ? (ENVIRONMENT_FA[settings.data.environment] ?? settings.data.environment)
              : "—"}
          </p>
          {settings.data && (
            <p className="mt-1.5 text-caption leading-relaxed text-muted">
              منطقهٔ زمانی سرور: {settings.data.serverTimezone} · منطقهٔ نمایش پنل:{" "}
              {settings.data.displayTimezone} · واحد پول: {settings.data.currency}
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
              {/* Unavailable metrics render through the same KPI shell so the
                  row keeps one baseline; only the value is replaced by a muted
                  label (never a fabricated zero) and the hint carries the reason. */}
              {ov.kpis.map((k) => (
                <StatCard
                  key={k.key}
                  label={k.labelFa}
                  value={k.value}
                  hint={k.unavailable ? k.unavailableReasonFa : k.formulaFa}
                  unavailable={k.unavailable}
                  unavailableLabel="ناموجود"
                />
              ))}
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
