// ============================================================
// LEGALIR — Usage report panel (shared by the user page and the admin tab)
// ============================================================
// ONE component renders the «مصرف انرژی و توکن» report. It is fed by the
// caller's own data source — the user's page uses `useUsageReport`, the admin
// user tab uses `useAdminUserUsageReport` — but both read the same server
// projection (`lib/usage/report.ts`), so identical filters always produce
// identical numbers.
//
// ENERGY and TOKENS are never merged: they are different units (LegalIR's
// internal charge vs. the model's real token usage) and each has its own card,
// column and aggregate.
// ============================================================

"use client";

import { useState } from "react";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
} from "@/components/settings/settings-ui";
import {
  IconHistory,
  IconFilter,
  IconBolt,
  IconDatabase,
  IconChevronRight,
} from "@/lib/icons";
import type {
  ActivityType,
  EnergySettlementStatus,
  UsageReportItem,
  UsageReportResponse,
  UsageTransactionStatus,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type UsageRangePreset = "7d" | "30d" | "90d";

export interface UsageReportFilters {
  from?: string;
  to?: string;
  serviceKey?: string;
  activityType?: ActivityType;
  status?: UsageTransactionStatus;
  page?: number;
  pageSize?: number;
}

/** Resolve a preset to an explicit ISO window (the server defaults to 30d). */
export function resolveRange(preset: UsageRangePreset): { from: string; to: string } {
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const to = new Date();
  return {
    from: new Date(to.getTime() - days * 86_400_000).toISOString(),
    to: to.toISOString(),
  };
}

const RANGE_LABEL: Record<UsageRangePreset, string> = {
  "7d": "۷ روز اخیر",
  "30d": "۳۰ روز اخیر",
  "90d": "۹۰ روز اخیر",
};

const STATUS_FILTER_LABEL: Record<UsageTransactionStatus, string> = {
  RESERVED: "در حال انجام",
  COMPLETED: "انجام‌شده",
  REVERSED: "بازگردانده‌شده",
  FAILED: "ناموفق",
};

const SETTLEMENT_CLASS: Record<EnergySettlementStatus, string> = {
  RESERVED: "bg-warning-container text-warning border-warning",
  CHARGED: "bg-success-container text-success border-success",
  REFUNDED: "bg-surface-container text-muted border-divider",
  CREDITED: "bg-primary-container text-primary border-primary",
  FAILED: "bg-error-container text-error border-error",
  FREE: "bg-[color-mix(in_srgb,var(--brand-gold)_16%,transparent)] text-[var(--brand-fg-gold)] border-[color-mix(in_srgb,var(--brand-gold)_40%,transparent)]",
};

const TOKEN_STATUS_LABEL: Record<UsageReportItem["tokenStatus"], string> = {
  ACTUAL: "واقعی",
  ESTIMATED: "تخمینی",
  UNAVAILABLE: "ناموجود",
};

export type UsageReportData = {
  report: UsageReportResponse;
  services?: { serviceKey: string; serviceNameFa: string }[];
  actions?: { activityType: ActivityType; actionNameFa: string }[];
};

function formatDateTime(iso: string): string {
  return toPersianDate(iso, { dateStyle: "short", timeStyle: "short" });
}

/** A stat block — one unit only, never energy + tokens added together. */
function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "energy" | "token" | "neutral";
}) {
  const toneClass =
    tone === "energy"
      ? "border-[color-mix(in_srgb,var(--brand-green)_28%,transparent)]"
      : tone === "token"
        ? "border-[color-mix(in_srgb,var(--brand-gold)_32%,transparent)]"
        : "border-divider";
  return (
    <div className={`rounded-large border bg-surface p-4 ${toneClass}`}>
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-1 text-h3 font-bold text-on-surface tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-caption text-muted leading-5">{hint}</p> : null}
    </div>
  );
}

/** Mobile card for one ledger row. */
function RowCard({ item }: { item: UsageReportItem }) {
  return (
    <div className="rounded-large border border-divider bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body-2 font-medium text-on-surface">
            {item.serviceNameFa}
          </p>
          <p className="truncate text-caption text-muted">{item.actionNameFa}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${SETTLEMENT_CLASS[item.settlement]}`}
        >
          {item.settlementLabelFa}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-caption">
        <div>
          <dt className="text-muted">انرژی</dt>
          <dd className="text-body-2 font-medium tabular-nums text-on-surface">
            {toPersianNumber(item.energyFinal)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">توکن (ورودی / خروجی)</dt>
          <dd className="text-body-2 font-medium tabular-nums text-on-surface" dir="ltr">
            {toPersianNumber(item.inputTokens)} / {toPersianNumber(item.outputTokens)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">وضعیت توکن</dt>
          <dd className="text-body-2 text-on-surface">
            {TOKEN_STATUS_LABEL[item.tokenStatus]}
          </dd>
        </div>
        <div>
          <dt className="text-muted">زمان</dt>
          <dd className="text-body-2 text-on-surface">{formatDateTime(item.createdAt)}</dd>
        </div>
      </dl>

      <p className="mt-3 font-mono text-caption text-muted" dir="ltr">
        {item.trackingId}
      </p>
    </div>
  );
}

export function UsageReportPanel({
  data,
  isLoading,
  error,
  onRetry,
  query,
  onQueryChange,
  compact = false,
  hiddenActions = false,
}: {
  data: UsageReportData | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  query: UsageReportFilters;
  onQueryChange: (next: UsageReportFilters) => void;
  /** The admin drawer is narrower — fewer breakdown tables. */
  compact?: boolean;
  hiddenActions?: boolean;
}) {
  const [preset, setPreset] = useState<UsageRangePreset>("30d");

  const report = data?.report;
  const services = data?.services ?? [];
  const actions = data?.actions ?? [];

  const applyPreset = (next: UsageRangePreset) => {
    setPreset(next);
    const range = resolveRange(next);
    onQueryChange({ ...query, from: range.from, to: range.to, page: 1 });
  };

  const totals = report?.totals;
  const totalPages = report
    ? Math.max(1, Math.ceil(report.totalItems / report.pageSize))
    : 1;

  const activeFilters =
    (query.serviceKey ? 1 : 0) +
    (query.activityType ? 1 : 0) +
    (query.status ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="rounded-large border border-divider bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-caption text-muted">
            <IconFilter size={16} />
            فیلترها
            {activeFilters > 0 ? ` (${toPersianNumber(activeFilters)})` : ""}
          </span>
          <div
            className="flex flex-wrap gap-1 rounded-full bg-surface-hover p-1"
            role="group"
            aria-label="بازهٔ زمانی"
          >
            {(Object.keys(RANGE_LABEL) as UsageRangePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={preset === p}
                onClick={() => applyPreset(p)}
                className={`rounded-full px-3 py-1.5 text-caption font-medium transition-colors ${
                  preset === p
                    ? "bg-control-selected text-control-selected-foreground"
                    : "text-muted hover:text-on-surface"
                }`}
              >
                {RANGE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 tablet:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-caption text-muted">سرویس</span>
            <select
              value={query.serviceKey ?? ""}
              onChange={(e) =>
                onQueryChange({
                  ...query,
                  serviceKey: e.target.value || undefined,
                  page: 1,
                })
              }
              className="w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">همهٔ سرویس‌ها</option>
              {services.map((s) => (
                <option key={s.serviceKey} value={s.serviceKey}>
                  {s.serviceNameFa}
                </option>
              ))}
            </select>
          </label>

          {!hiddenActions && (
            <label className="block">
              <span className="mb-1 block text-caption text-muted">نوع عملیات</span>
              <select
                value={query.activityType ?? ""}
                onChange={(e) =>
                  onQueryChange({
                    ...query,
                    activityType: (e.target.value || undefined) as
                      | ActivityType
                      | undefined,
                    page: 1,
                  })
                }
                className="w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">همهٔ عملیات‌ها</option>
                {actions.map((a) => (
                  <option key={a.activityType} value={a.activityType}>
                    {a.actionNameFa}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-caption text-muted">وضعیت</span>
            <select
              value={query.status ?? ""}
              onChange={(e) =>
                onQueryChange({
                  ...query,
                  status: (e.target.value || undefined) as
                    | UsageTransactionStatus
                    | undefined,
                  page: 1,
                })
              }
              className="w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              {(Object.keys(STATUS_FILTER_LABEL) as UsageTransactionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_FILTER_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() =>
              onQueryChange({
                ...query,
                serviceKey: undefined,
                activityType: undefined,
                status: undefined,
                page: 1,
              })
            }
            className="mt-3 text-caption font-medium text-primary hover:underline"
          >
            حذف همهٔ فیلترها
          </button>
        )}
      </div>

      {isLoading ? (
        <SkeletonBlock lines={8} />
      ) : error ? (
        <ErrorBanner message={error.message} onRetry={onRetry} />
      ) : !report || !totals || totals.operations === 0 ? (
        <EmptyState text="در این بازه و با این فیلترها، مصرفی ثبت نشده است." />
      ) : (
        <>
          {/* ── Energy totals ─────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconBolt size={16} className="text-[var(--brand-fg-gold)]" />
              <h4 className="text-body-1 font-medium text-on-surface">انرژی مصرف‌شده</h4>
            </div>
            <div
              className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2 tablet:grid-cols-4"}`}
            >
              <Stat
                label="انرژی نهایی"
                value={toPersianNumber(totals.energy)}
                hint="واحد داخلی لگال‌آی‌آر — جمع «کسر شده» پس از بازگشت‌ها"
                tone="energy"
              />
              <Stat
                label="رزرو اولیه"
                value={toPersianNumber(totals.energyReserved)}
                hint="مبلغی که پیش از اجرا کنار گذاشته شد"
                tone="energy"
              />
              <Stat
                label="بازگردانده‌شده"
                value={toPersianNumber(totals.energyRefunded)}
                hint="درخواست‌های ناموفق یا لغوشده"
                tone="energy"
              />
              <Stat
                label="عملیات"
                value={toPersianNumber(totals.operations)}
                hint={`${toPersianNumber(totals.freeOperations)} رایگان · ${toPersianNumber(
                  totals.failedOperations
                )} ناموفق · ${toPersianNumber(totals.refundedOperations)} بازگردانده‌شده`}
                tone="energy"
              />
            </div>
          </div>

          {/* ── Token totals ──────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconDatabase size={16} className="text-muted" />
              <h4 className="text-body-1 font-medium text-on-surface">مصرف توکن مدل</h4>
            </div>
            <div
              className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2 tablet:grid-cols-4"}`}
            >
              <Stat
                label="توکن ورودی"
                value={toPersianNumber(totals.inputTokens)}
                hint="متن ارسالی به مدل — واقعی یا تخمینی بنا بر وضعیت هر رکورد"
                tone="token"
              />
              <Stat
                label="توکن خروجی"
                value={toPersianNumber(totals.outputTokens)}
                hint="پاسخ تولیدشده توسط مدل"
                tone="token"
              />
              <Stat
                label="مجموع توکن"
                value={toPersianNumber(totals.totalTokens)}
                hint="واحد مصرف واقعی مدل — با انرژی جمع نمی‌شود"
                tone="token"
              />
              <Stat
                label="رکوردهای بدون توکن واقعی"
                value={toPersianNumber(
                  totals.unavailableTokenOperations + totals.estimatedTokenOperations
                )}
                hint={`${toPersianNumber(
                  totals.estimatedTokenOperations
                )} تخمینی · ${toPersianNumber(
                  totals.unavailableTokenOperations
                )} ناموجود`}
                tone="token"
              />
            </div>
          </div>

          {/* ── Breakdown by service ─────────────────────────── */}
          <div>
            <h4 className="mb-2 text-body-1 font-medium text-on-surface">
              تفکیک بر اساس سرویس
            </h4>
            <div className="overflow-x-auto rounded-large border border-divider">
              <table className="w-full text-right text-body-2">
                <thead className="bg-surface-hover text-caption text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">سرویس</th>
                    <th className="px-3 py-2 font-medium">عملیات</th>
                    <th className="px-3 py-2 font-medium">انرژی</th>
                    <th className="px-3 py-2 font-medium">توکن ورودی</th>
                    <th className="px-3 py-2 font-medium">توکن خروجی</th>
                    <th className="px-3 py-2 font-medium">مجموع توکن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {report.byService.map((s) => (
                    <tr
                      key={s.serviceKey}
                      className="transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-3 py-2.5 text-on-surface">{s.serviceNameFa}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">
                        {toPersianNumber(s.operations)}
                      </td>
                      <td className="px-3 py-2.5 font-medium tabular-nums text-on-surface">
                        {toPersianNumber(s.energy)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">
                        {toPersianNumber(s.inputTokens)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">
                        {toPersianNumber(s.outputTokens)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-on-surface">
                        {toPersianNumber(s.totalTokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Breakdown by action ──────────────────────────── */}
          {!compact && report.byAction.length > 0 && (
            <div>
              <h4 className="mb-2 text-body-1 font-medium text-on-surface">
                تفکیک بر اساس نوع عملیات
              </h4>
              <div className="overflow-x-auto rounded-large border border-divider">
                <table className="w-full text-right text-body-2">
                  <thead className="bg-surface-hover text-caption text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">نوع عملیات</th>
                      <th className="px-3 py-2 font-medium">تعداد</th>
                      <th className="px-3 py-2 font-medium">انرژی</th>
                      <th className="px-3 py-2 font-medium">مجموع توکن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {report.byAction.map((a) => (
                      <tr
                        key={a.activityType}
                        className="transition-colors hover:bg-surface-hover"
                      >
                        <td className="px-3 py-2.5 text-on-surface">{a.actionNameFa}</td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {toPersianNumber(a.operations)}
                        </td>
                        <td className="px-3 py-2.5 font-medium tabular-nums text-on-surface">
                          {toPersianNumber(a.energy)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {toPersianNumber(a.totalTokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Ledger rows ──────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconHistory size={16} className="text-muted" />
                <h4 className="text-body-1 font-medium text-on-surface">ریز عملیات</h4>
              </div>
              <span className="text-caption text-muted">
                {toPersianNumber(report.totalItems)} رکورد
              </span>
            </div>

            <div className="space-y-2 tablet:hidden">
              {report.items.map((item) => (
                <RowCard key={item.id} item={item} />
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-large border border-divider tablet:block">
              <table className="w-full text-right text-body-2">
                <thead className="bg-surface-hover text-caption text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">زمان</th>
                    <th className="px-3 py-2 font-medium">سرویس</th>
                    <th className="px-3 py-2 font-medium">عملیات</th>
                    <th className="px-3 py-2 font-medium">انرژی</th>
                    <th className="px-3 py-2 font-medium">توکن (ورودی / خروجی)</th>
                    <th className="px-3 py-2 font-medium">وضعیت</th>
                    <th className="px-3 py-2 font-medium">شناسهٔ رهگیری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {report.items.map((item) => (
                    <tr
                      key={item.id}
                      className="align-top transition-colors hover:bg-surface-hover"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-on-surface">{item.serviceNameFa}</td>
                      <td className="px-3 py-2.5 text-muted">{item.actionNameFa}</td>
                      <td className="px-3 py-2.5 font-medium tabular-nums text-on-surface">
                        {toPersianNumber(item.energyFinal)}
                        {item.energyRefunded > 0 && (
                          <span className="mr-1 text-caption text-success">
                            (+{toPersianNumber(item.energyRefunded)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted" dir="ltr">
                        {toPersianNumber(item.inputTokens)} /{" "}
                        {toPersianNumber(item.outputTokens)}
                        <span className="mr-1 text-caption">
                          ({TOKEN_STATUS_LABEL[item.tokenStatus]})
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${SETTLEMENT_CLASS[item.settlement]}`}
                        >
                          {item.settlementLabelFa}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-caption text-muted" dir="ltr">
                        {item.trackingId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-caption leading-5 text-muted">
              انرژی، واحد داخلی محاسبهٔ لگال‌آی‌آر است؛ توکن، مصرف واقعی مدل زبانی. این دو با
              هم جمع نمی‌شوند. برچسب «تخمینی» یا «ناموجود» یعنی ارائه‌دهندهٔ مدل عدد واقعی را
              برنگردانده است.
            </p>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  disabled={(report.page ?? 1) <= 1}
                  onClick={() =>
                    onQueryChange({ ...query, page: (report.page ?? 1) - 1 })
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-divider px-3 py-1.5 text-caption font-medium text-on-surface disabled:opacity-40"
                >
                  <IconChevronRight size={14} />
                  قبلی
                </button>
                <span className="text-caption tabular-nums text-muted">
                  صفحهٔ {toPersianNumber(report.page)} از {toPersianNumber(totalPages)}
                </span>
                <button
                  type="button"
                  disabled={(report.page ?? 1) >= totalPages}
                  onClick={() =>
                    onQueryChange({ ...query, page: (report.page ?? 1) + 1 })
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-divider px-3 py-1.5 text-caption font-medium text-on-surface disabled:opacity-40"
                >
                  بعدی
                  <IconChevronRight size={14} rtlFlip />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
