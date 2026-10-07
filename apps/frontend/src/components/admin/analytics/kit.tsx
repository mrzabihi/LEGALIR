// ============================================================
// LEGALIR — Admin analytics UI kit
// ============================================================
// Presentational building blocks shared by every analytics tab. Nothing here
// fetches or derives a number: KPI/trend/caption values are passed in from a
// report that already computed them, so a tab can never be tempted to invent
// a figure. The one side-effectful control (export) is permission-gated on the
// server's own `admin:analytics:export` and reports through the app snackbar.
//
// Design language mirrors components/admin/ui.tsx (tokens, tones, spacing) so
// the BI surface reads as part of the same panel.
// ============================================================

"use client";

import { useState, type ReactNode } from "react";
import { snackbar } from "@legalir/ui";
import {
  toPersianNumber,
  toPersianDigits,
  toPersianDate,
  toPersianCurrency,
  toRelativeTime,
} from "@/lib/persian-utils";
import {
  Badge,
  Button,
  Card,
  FilterPills,
  InfoBanner,
  StatCard,
  type StatTrend,
} from "@/components/admin/ui";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconRefresh,
  IconWarning,
} from "@/lib/icons";
import { useAdminMe } from "@/hooks/useAdmin";
import {
  downloadAnalyticsExport,
  type AnalyticsExportKind,
  type AnalyticsRangeQuery,
} from "@/lib/api/analytics";
import type {
  AnalyticsComparison,
  AnalyticsDataQualityFlag,
  AnalyticsKpiCard,
  AnalyticsQualityStatus,
  AnalyticsRangeKey,
  AnalyticsWindowInfo,
  JalaliParts,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Range control (§ dashboard presets)
// ---------------------------------------------------------------------------

/** The five shared presets. Every tab is scoped by exactly this one control. */
export const RANGE_PRESETS: { value: AnalyticsRangeKey; label: string }[] = [
  { value: "today", label: "امروز" },
  { value: "7d", label: "۷ روز" },
  { value: "30d", label: "۳۰ روز" },
  { value: "jalali_month", label: "ماه جاری" },
  { value: "custom", label: "بازهٔ سفارشی" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `۱۴۰۵/۰۳/۲۵` from Jalali parts. */
export function jalaliNumericFa(p: JalaliParts): string {
  return toPersianDigits(`${p.jy}/${pad2(p.jm)}/${pad2(p.jd)}`);
}

/** A `YYYY-MM-DD` string, or `undefined` when incomplete/invalid. */
function dayOrUndefined(v: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/**
 * The shared range selector. Emits a complete `AnalyticsRangeQuery` so the page
 * holds one piece of state for the whole dashboard. Custom bounds use native
 * date inputs (Gregorian `YYYY-MM-DD`, matching the server's expectation) and
 * an inline Jalali equivalence so a Persian operator sees the real dates.
 */
export function RangeControl({
  value,
  onChange,
}: {
  value: AnalyticsRangeQuery;
  onChange: (next: AnalyticsRangeQuery) => void;
}) {
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  function emitCustom(nextFrom: string, nextTo: string) {
    onChange({ preset: "custom", from: dayOrUndefined(nextFrom), to: dayOrUndefined(nextTo) });
  }

  function selectPreset(preset: AnalyticsRangeKey) {
    if (preset === "custom") {
      // Seed the custom bounds from the currently resolved window so switching
      // to «سفارشی» starts from a sensible, real range rather than a blank.
      const seedFrom = value.from ?? "";
      const seedTo = value.to ?? "";
      setFrom(seedFrom);
      setTo(seedTo);
      emitCustom(seedFrom, seedTo);
      return;
    }
    onChange({ preset });
  }

  const customIncomplete =
    value.preset === "custom" && (!dayOrUndefined(from) || !dayOrUndefined(to));

  return (
    <div className="flex flex-col items-end gap-2">
      <FilterPills options={RANGE_PRESETS} value={value.preset} onChange={selectPreset} />
      {value.preset === "custom" && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5 text-caption text-muted">
            از
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                emitCustom(e.target.value, to);
              }}
              className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex items-center gap-1.5 text-caption text-muted">
            تا
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                emitCustom(from, e.target.value);
              }}
              className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
          {!customIncomplete && from && to && (
            <span className="text-caption text-muted">
              معادل شمسی: {toPersianDate(from)} تا {toPersianDate(to)}
            </span>
          )}
        </div>
      )}
      {customIncomplete && (
        <span className="text-caption text-warning-700">
          برای بازهٔ سفارشی، تاریخ شروع و پایان را کامل انتخاب کنید.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active-window caption
// ---------------------------------------------------------------------------

/**
 * The explicit date basis of a report. Shows the resolved Jalali bounds, the
 * Tehran timezone, the refresh time and — crucially — states plainly when the
 * previous window has no data, so a missing trend is never read as a zero.
 */
export function WindowCaption({
  window: w,
  refreshedAt,
  noteFa,
}: {
  window: AnalyticsWindowInfo;
  refreshedAt?: string;
  noteFa?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-large border border-divider bg-surface-container-low px-3.5 py-2.5 text-caption text-muted">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <IconClock size={15} aria-hidden="true" />
        <span>
          بازه فعال:{" "}
          <strong className="font-semibold text-on-surface-variant">
            {toPersianNumber(w.rangeDays)} روز
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          از {jalaliNumericFa(w.fromJalali)} تا {jalaliNumericFa(w.toJalali)}
        </span>
        <span aria-hidden="true">·</span>
        <span>منطقه زمانی تهران</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {w.comparable ? (
          <span>
            مقایسه با بازهٔ هم‌طول قبل ({toPersianNumber(w.rangeDays)} روز پیش از {jalaliNumericFa(w.fromJalali)})
          </span>
        ) : (
          <span className="font-medium text-warning-700">
            دادهٔ کافی برای مقایسه با بازهٔ قبل وجود ندارد.
          </span>
        )}
        {refreshedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>به‌روزرسانی: {toRelativeTime(refreshedAt)}</span>
          </>
        )}
      </span>
      {noteFa && (
        <p className="w-full leading-relaxed text-muted" title={noteFa}>
          {noteFa}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trends — always honest, never a fabricated percentage
// ---------------------------------------------------------------------------

/** A real previous-period trend for a KPI card, or undefined when none exists. */
export function kpiTrend(k: AnalyticsKpiCard): StatTrend | undefined {
  if (k.unavailable || k.previousValue == null) return undefined;
  const pct = k.changePct ?? null;
  if (pct == null) {
    return {
      direction: "flat",
      tone: "neutral",
      labelFa: "—",
      titleFa: "مقایسه ممکن نیست: در بازهٔ قبل مقداری برای این شاخص ثبت نشده است.",
    };
  }
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const good = k.trend === "inverse" ? pct < 0 : pct > 0;
  const tone = pct === 0 ? "neutral" : good ? "good" : "bad";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const prevText = k.unitFa
    ? toPersianCurrency(k.previousValue)
    : toPersianNumber(k.previousValue);
  return {
    direction,
    tone,
    labelFa: `${sign}${toPersianNumber(Math.abs(pct))}٪`,
    titleFa: `مقایسه با بازهٔ قبل: مقدار قبلی ${prevText}.`,
  };
}

/** A trend from a report's `{current, previous, changePct}` comparison cell. */
export function comparisonTrend(
  cmp: AnalyticsComparison,
  opts: { unitFa?: string; inverse?: boolean } = {}
): StatTrend | undefined {
  if (cmp.previous == null) return undefined;
  const pct = cmp.changePct;
  if (pct == null) {
    return {
      direction: "flat",
      tone: "neutral",
      labelFa: "—",
      titleFa: "مقایسه ممکن نیست: در بازهٔ قبل مقداری برای این شاخص ثبت نشده است.",
    };
  }
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const good = opts.inverse ? pct < 0 : pct > 0;
  const tone = pct === 0 ? "neutral" : good ? "good" : "bad";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const prevText = opts.unitFa
    ? toPersianCurrency(cmp.previous)
    : toPersianNumber(cmp.previous);
  return {
    direction,
    tone,
    labelFa: `${sign}${toPersianNumber(Math.abs(pct))}٪`,
    titleFa: `مقایسه با بازهٔ قبل: مقدار قبلی ${prevText}.`,
  };
}

/**
 * Render one overview KPI. An `unavailable` KPI is shown as «ناموجود» with its
 * reason — never a fake zero, and never a trend it cannot have.
 */
export function AnalyticsKpiView({ kpi }: { kpi: AnalyticsKpiCard }) {
  if (kpi.unavailable) {
    return (
      <StatCard
        label={kpi.labelFa}
        value="ناموجود"
        hint={kpi.unavailableReasonFa}
        tone="warning"
        icon={<IconWarning size={16} />}
      />
    );
  }
  return (
    <StatCard
      label={kpi.labelFa}
      value={kpi.value}
      unit={kpi.unitFa}
      hint={kpi.formulaFa}
      href={kpi.drillHref}
      trend={kpiTrend(kpi)}
      valueTitle={kpi.unitFa ? toPersianCurrency(kpi.value) : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Data-quality panel
// ---------------------------------------------------------------------------

const QUALITY_TONE: Record<
  AnalyticsQualityStatus,
  { tone: "success" | "warning" | "neutral" | "danger"; label: string }
> = {
  real: { tone: "success", label: "واقعی" },
  partial: { tone: "warning", label: "جزئی" },
  unavailable: { tone: "neutral", label: "ناموجود" },
  blocked: { tone: "danger", label: "مسدود" },
};

function qualityCounts(flags: AnalyticsDataQualityFlag[]) {
  const c = { real: 0, partial: 0, unavailable: 0, blocked: 0 };
  for (const f of flags) c[f.status] += 1;
  return c;
}

/**
 * The honest contract panel. Collapsed by default (a one-line summary of how
 * many metric families are real / partial / unavailable) and expandable to the
 * full flag register, each flag stating the reason and what would make it real.
 */
export function QualityPanel({ flags }: { flags: AnalyticsDataQualityFlag[] }) {
  const [open, setOpen] = useState(false);
  const c = qualityCounts(flags);
  const allGood = c.partial === 0 && c.unavailable === 0 && c.blocked === 0;

  return (
    <Card className="mt-6 p-4 tablet:p-5" as="section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${
              allGood ? "bg-success-soft text-success-700" : "bg-warning-soft text-warning-700"
            }`}
          >
            {allGood ? <IconCheck size={17} /> : <IconWarning size={17} />}
          </span>
          <div className="min-w-0">
            <h3 className="text-body-1 font-bold text-onSurface">کیفیت داده و محدودیت‌ها</h3>
            <p className="mt-0.5 text-caption text-muted">
              {toPersianNumber(c.real)} شاخص واقعی
              {c.partial > 0 && <> · {toPersianNumber(c.partial)} جزئی</>}
              {c.unavailable > 0 && <> · {toPersianNumber(c.unavailable)} ناموجود</>}
              {c.blocked > 0 && <> · {toPersianNumber(c.blocked)} مسدود</>}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "بستن جزئیات" : "مشاهدهٔ جزئیات"}
        </Button>
      </div>

      {open && (
        <ul className="mt-4 space-y-2">
          {flags.map((f) => {
            const t = QUALITY_TONE[f.status];
            return (
              <li
                key={f.id}
                className="rounded-medium border border-divider bg-surface-container-low p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-caption text-muted" dir="ltr">
                      {f.id}
                    </span>
                    <span className="truncate text-body-2 font-medium text-on-surface">
                      {f.labelFa}
                    </span>
                  </span>
                  <Badge tone={t.tone} dot>
                    {t.label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-caption leading-relaxed text-on-surface-variant">
                  {f.reasonFa}
                </p>
                {f.captureNeededFa && f.captureNeededFa !== "—" && (
                  <p className="mt-1 text-caption leading-relaxed text-muted">
                    برای واقعی‌شدن: {f.captureNeededFa}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** A minimal RTL pager for the drill-down tables. Emits a 1-based page. */
export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
      <span>
        نمایش {toPersianNumber(from)} تا {toPersianNumber(to)} از {toPersianNumber(total)} ردیف
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          startIcon={<IconChevronRight size={14} />}
        >
          قبلی
        </Button>
        <span className="tabular-nums">
          {toPersianNumber(page)} / {toPersianNumber(pageCount)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          endIcon={<IconChevronLeft size={14} />}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const EXPORT_KIND_FA: Record<AnalyticsExportKind, string> = {
  subscriptions: "فروش اشتراک به تفکیک پلن",
  customers: "تحلیل مشتریان (LRFM)",
  energy: "انرژی کاربران",
  finance: "تطبیق مالی",
};

/**
 * Server-built XLSX export for one analytics surface, over the SAME resolved
 * range as the screen. Gated on `admin:analytics:export` (the server re-checks
 * it on the POST), audited server-side, and announced via the snackbar.
 */
export function AnalyticsExportButton({
  kind,
  range,
}: {
  kind: AnalyticsExportKind;
  range: AnalyticsRangeQuery;
}) {
  const { can } = useAdminMe();
  const allowed = can("admin:analytics:export");
  const [busy, setBusy] = useState(false);
  const surfaceFa = EXPORT_KIND_FA[kind];

  async function run() {
    if (busy || !allowed) return;
    setBusy(true);
    try {
      await downloadAnalyticsExport(kind, range);
      snackbar.show({ message: `خروجی «${surfaceFa}» ساخته و دانلود شد.`, variant: "success" });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "خروجی گرفتن ناموفق بود";
      snackbar.show({ message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={run}
      disabled={busy || !allowed}
      title={
        allowed
          ? `دانلود خروجی کامل «${surfaceFa}» برای بازهٔ انتخاب‌شده (اکسل)`
          : "برای خروجی گرفتن این بخش دسترسی ندارید"
      }
    >
      <IconDownload size={14} />
      {busy ? "در حال آماده‌سازی…" : "خروجی اکسل"}
    </Button>
  );
}

/** A read-only notice shown when the operator may view but not export. */
export function ExportDeniedNote() {
  return (
    <InfoBanner tone="warning">
      برای خروجی گرفتن اکسل از این گزارش به مجوز «خروجی تحلیل» نیاز دارید؛ گزارش فقط‌خواندنی است.
    </InfoBanner>
  );
}

/** Convenience: a refresh button matching the overview page's styling. */
export function RefreshButton({
  onClick,
  busy,
  label = "به‌روزرسانی",
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={busy} title={label}>
      <IconRefresh size={15} className={busy ? "animate-spin" : ""} />
      {label}
    </Button>
  );
}

/** A small empty-data card used when a report legitimately has nothing. */
export function ChartlessEmpty({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <p className="text-body-2 text-muted">{message}</p>
      {children}
    </Card>
  );
}
