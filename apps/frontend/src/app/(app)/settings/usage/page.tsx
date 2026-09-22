// ============================================================
// LEGALIR — Settings · Usage & History (تاریخچه و مصرف)
// ============================================================
// The detailed view of the usage engine. It renders the SAME two
// assets the dashboard card does, never a single "امتیاز" number:
//
//   1) اعتبار امروز اشتراک — today's subscription credit. Resets at
//      Tehran midnight, never carries over.
//   2) امتیازهای شما       — reward points. A persistent ledger that
//      the daily rollover never touches.
//
// Below them: the period-scoped service quotas (reset only at period
// end) and the usage-transaction ledger. Every number comes from
// GET /api/v1/subscription/usage — nothing is computed on the client.
// ============================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  SettingsCard,
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
} from "@/components/settings/settings-ui";
import { useSubscriptionHistory } from "@/hooks/usePhase11";
import { useSubscriptionUsage, useSubscriptionUsageHistory } from "@/hooks/useSubscription";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconHistory,
  IconChat,
  IconDocument,
  IconContract,
  IconSubscription,
  IconBolt,
  IconCoin,
  IconCalendar,
  IconDatabase,
  IconChevronRight,
} from "@/lib/icons";
import type {
  V1SubscriptionHistoryItem,
  PeriodQuotaView,
  ServiceQuotaType,
  SubscriptionUsageSummary,
  UsageHistoryItem,
  UsageTransactionStatus,
} from "@legalir/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR");
}

function pct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

/** Remaining time until `resetAt`, formatted as HH:MM:SS (Persian digits). */
function useResetCountdown(resetAt: string | undefined): string {
  const compute = useCallback(() => {
    if (!resetAt) return "--:--:--";
    const diff = new Date(resetAt).getTime() - Date.now();
    if (diff <= 0) return "۰۰:۰۰:۰۰";
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
  }, [resetAt]);

  const [value, setValue] = useState(compute);
  useEffect(() => {
    setValue(compute());
    if (!resetAt) return;
    const id = setInterval(() => setValue(compute()), 1000);
    return () => clearInterval(id);
  }, [compute, resetAt]);
  return value;
}

const QUOTA_ICON: Record<ServiceQuotaType, typeof IconDocument> = {
  AI_MESSAGES: IconChat,
  TOKENS: IconDatabase,
  DOCUMENT_ANALYSIS: IconDocument,
  CONTRACT_DRAFT: IconContract,
  CONTRACT_CREATION: IconContract,
};

/** One period-scoped quota with a progress bar. */
function QuotaCard({ quota }: { quota: PeriodQuotaView }) {
  const Icon = QUOTA_ICON[quota.quotaType] ?? IconDocument;
  const unlimited = quota.unlimited || quota.limit === null || quota.limit <= 0;
  const limit = quota.limit ?? 0;
  const usedPct = unlimited ? 0 : pct(quota.used, limit);
  const exhausted = !unlimited && quota.remaining === 0;
  const barColor = exhausted ? "bg-error" : usedPct >= 70 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="flex items-start gap-3 rounded-large bg-surface-hover p-4 border border-divider">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon size={20} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-2 text-muted">{quota.nameFa}</p>
        <p className="text-body-1 text-on-surface font-medium tabular-nums">
          {unlimited
            ? "نامحدود"
            : `${toPersianNumber(quota.used)} / ${toPersianNumber(limit)}`}
        </p>
        {!unlimited && (
          <div
            className="mt-1.5 h-2 w-full rounded-full bg-gray-200 dark:bg-surface overflow-hidden"
            role="progressbar"
            aria-valuenow={quota.used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={`مصرف ${quota.nameFa}`}
          >
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${usedPct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

const TX_STATUS_CLASS: Record<UsageTransactionStatus, string> = {
  RESERVED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30",
  COMPLETED: "bg-success/10 text-success border-success/20",
  REVERSED: "bg-muted/10 text-muted border-muted/20",
  FAILED: "bg-error/10 text-error border-error/20",
};

const TX_STATUS_FA: Record<UsageTransactionStatus, string> = {
  RESERVED: "در حال انجام",
  COMPLETED: "انجام‌شده",
  REVERSED: "بازگردانده‌شده",
  FAILED: "ناموفق",
};

function UsageTabContent({
  summary,
  history,
  isLoading,
  error,
  onRetry,
}: {
  summary: SubscriptionUsageSummary | undefined;
  history: UsageHistoryItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const countdown = useResetCountdown(summary?.daily.resetAt);

  if (isLoading) return <SkeletonBlock lines={6} />;
  if (error) return <ErrorBanner message={error.message} onRetry={onRetry} />;
  if (!summary) return <EmptyState text="اطلاعات مصرف در دسترس نیست." />;

  const { daily } = summary;
  const creditPct = pct(daily.pointsUsed, daily.pointsTotal);
  const creditExhausted = daily.pointsRemaining <= 0;
  const creditLow = !creditExhausted && daily.pointsTotal > 0 && daily.pointsRemaining / daily.pointsTotal <= 0.25;
  const creditSweep = (daily.pointsRemaining / Math.max(1, daily.pointsTotal)) * 360;

  return (
    <div className="space-y-5">
      {/* ── The two distinct assets ─────────────────────────────── */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
        {/* 1) Today's subscription credit — resets at Tehran midnight */}
        <div className="group relative overflow-hidden rounded-large bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-100 border border-white/10 backdrop-blur p-5">
          <span className="pointer-events-none absolute -top-10 -end-10 w-32 h-32 rounded-full bg-blue-400/20 blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
          <div className="relative flex items-center gap-4">
            <div
              className="relative w-16 h-16 shrink-0"
              role="img"
              aria-label={`${toPersianNumber(daily.pointsRemaining)} امتیاز اعتبار باقی‌مانده از ${toPersianNumber(daily.pointsTotal)}`}
            >
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <defs>
                  <linearGradient id="settingsCreditGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke={creditExhausted ? "#f87171" : creditLow ? "#fbbf24" : "url(#settingsCreditGrad)"}
                  strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${creditSweep} ${360 - creditSweep}`}
                  className="transition-all duration-700 ease-emphasized"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-body-2 font-bold text-white tabular-nums">
                {toPersianNumber(creditPct)}٪
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <IconBolt size={18} className="text-blue-200" />
                <span className="text-body-1 text-white font-medium">اعتبار امروز اشتراک</span>
              </div>
              <p className="mt-1 text-h3 font-bold text-white tabular-nums" dir="ltr">
                {toPersianNumber(daily.pointsRemaining)}
                <span className="text-body-2 text-primary-200/90 font-normal">
                  {" / "}
                  {toPersianNumber(daily.pointsTotal)}
                </span>
              </p>
              <p className="mt-1 text-caption text-primary-200/90">
                {toPersianNumber(daily.requestsRemaining)} درخواست از {toPersianNumber(daily.requestLimit)} باقی‌مانده
              </p>
            </div>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-primary-200/90">
            <p>هر روز نیمه‌شب به وقت تهران بازنشانی می‌شود</p>
            <p>بازنشانی تا <span className="tabular-nums" dir="ltr">{countdown}</span></p>
          </div>

          {(!summary.hasSubscription || creditExhausted) && (
            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-medium bg-white/10 p-3 border border-white/15">
              <p className="text-body-2 text-white">
                {!summary.hasSubscription
                  ? "اشتراک فعالی ندارید."
                  : "اعتبار امروز شما به پایان رسیده است."}
              </p>
              <Link
                href="/subscription"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-body-2 text-blue-700 font-medium transition hover:bg-blue-50 touch-target"
              >
                <IconSubscription size={16} />
                {summary.subscriptionExpired ? "تمدید اشتراک" : "خرید اشتراک"}
              </Link>
            </div>
          )}
        </div>

        {/* 2) Reward points — a separate, persistent asset */}
        <Link
          href="/points"
          className="group rounded-large border border-divider bg-surface p-5 transition-colors hover:bg-surface-hover"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-violet-50)] text-[var(--color-violet-600)]">
              <IconCoin size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-body-1 text-on-surface font-medium">امتیازهای شما</p>
              <p className="text-caption text-muted">دائمی — با بازنشانی روزانه از بین نمی‌رود</p>
            </div>
          </div>
          <p className="text-h2 text-on-surface font-bold tabular-nums" dir="ltr">
            {toPersianNumber(summary.rewardPoints)}
          </p>
          <p className="mt-2 text-caption text-muted">
            {summary.allowRewardPointsAfterLimit
              ? "پس از پایان اعتبار روزانه قابل استفاده است"
              : "برای دریافت پاداش فعالیت کنید"}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-caption text-primary font-medium">
            مشاهده امتیازها
            <IconChevronRight size={14} rtlFlip />
          </span>
        </Link>
      </div>

      {/* ── Period-scoped service quotas ────────────────────────── */}
      {summary.hasSubscription && summary.period.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <IconCalendar size={18} className="text-muted" />
            <h4 className="text-body-1 text-on-surface font-medium">سهمیه‌های دوره</h4>
            <span className="text-caption text-muted">
              {summary.daysRemaining !== null
                ? `— ${toPersianNumber(summary.daysRemaining)} روز تا پایان دوره`
                : "— در پایان دوره بازنشانی می‌شود"}
            </span>
          </div>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            {summary.period.map((q) => (
              <QuotaCard key={q.quotaType} quota={q} />
            ))}
          </div>
        </div>
      )}

      {/* ── Usage transaction ledger ────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconHistory size={18} className="text-muted" />
          <h4 className="text-body-1 text-on-surface font-medium">آخرین فعالیت‌ها</h4>
        </div>
        {!history || history.length === 0 ? (
          <EmptyState text="فعالیتی برای نمایش وجود ندارد." />
        ) : (
          <ul className="divide-y divide-divider rounded-large border border-divider overflow-hidden">
            {history.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="text-body-2 text-on-surface font-medium truncate">{tx.displayNameFa}</p>
                  <p className="text-caption text-muted">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-body-2 text-on-surface tabular-nums">
                    {toPersianNumber(tx.pointsCost)} امتیاز
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${TX_STATUS_CLASS[tx.status]}`}>
                    {TX_STATUS_FA[tx.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  expired: "bg-muted/10 text-muted border-muted/20",
  cancelled: "bg-muted/10 text-muted border-muted/20",
  unknown: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-success",
  expired: "bg-muted",
  cancelled: "bg-muted",
  unknown: "bg-amber-500",
};

function HistoryTabContent({
  history,
  isLoading,
  error,
  onRetry,
}: {
  history: V1SubscriptionHistoryItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) return <SkeletonBlock lines={5} />;
  if (error) return <ErrorBanner message={error.message} onRetry={onRetry} />;
  if (!history || history.length === 0) return <EmptyState text="تاریخچه‌ای برای نمایش وجود ندارد." />;

  return (
    <>
      <div className="tablet:hidden space-y-2">
        {history.map((item) => (
          <div key={item.id} className="rounded-large bg-surface p-4 border border-divider">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_CLASS[item.status] ?? STATUS_CLASS['unknown']}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? STATUS_DOT['unknown']}`} />
                {item.statusFa}
              </span>
              <span className="text-caption text-muted">{formatDate(item.purchasedAt)}</span>
            </div>
            <p className="text-body-2 text-on-surface font-medium">{item.planNameFa}</p>
          </div>
        ))}
      </div>
      <div className="hidden tablet:block overflow-x-auto">
        <table className="w-full text-right text-body-2">
          <thead>
            <tr className="border-b border-divider text-muted">
              <th className="pb-2 pl-3 font-medium">تاریخ</th>
              <th className="pb-2 pl-3 font-medium">نام اشتراک</th>
              <th className="pb-2 font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-surface-hover/50 transition-colors">
                <td className="py-2.5 pl-3 text-on-surface">{formatDate(item.purchasedAt)}</td>
                <td className="py-2.5 pl-3 text-on-surface">{item.planNameFa}</td>
                <td className="py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_CLASS[item.status] ?? STATUS_CLASS['unknown']}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? STATUS_DOT['unknown']}`} />
                    {item.statusFa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function UsageSettingsPage() {
  const [activeTab, setActiveTab] = useState<"usage" | "history">("usage");
  const usageQuery = useSubscriptionUsage();
  const txQuery = useSubscriptionUsageHistory(1, 20);
  const historyQuery = useSubscriptionHistory(1, 20);

  return (
    <SettingsShell
      title="تاریخچه و مصرف"
      description="اعتبار امروز اشتراک، امتیازهای دائمی، سهمیه‌های دوره و تاریخچه اشتراک‌های شما."
    >
      <SettingsCard title="تاریخچه و مصرف" icon={<IconHistory size={22} />}>
        <div className="flex gap-1 rounded-full bg-surface-hover p-1 mb-5 w-fit" role="tablist" aria-label="برگه‌های تاریخچه و مصرف">
          <button
            role="tab"
            aria-selected={activeTab === "usage"}
            onClick={() => setActiveTab("usage")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${activeTab === "usage" ? "bg-control-selected text-control-selected-foreground shadow-sm" : "text-muted hover:text-on-surface"}`}
          >
            مصرف
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${activeTab === "history" ? "bg-control-selected text-control-selected-foreground shadow-sm" : "text-muted hover:text-on-surface"}`}
          >
            تاریخچه
          </button>
        </div>

        {activeTab === "usage" ? (
          <UsageTabContent
            summary={usageQuery.data}
            history={txQuery.data?.items}
            isLoading={usageQuery.isLoading}
            error={usageQuery.error as Error | null}
            onRetry={() => usageQuery.refetch()}
          />
        ) : (
          <HistoryTabContent
            history={historyQuery.data?.items}
            isLoading={historyQuery.isLoading}
            error={historyQuery.error as Error | null}
            onRetry={() => historyQuery.refetch()}
          />
        )}
      </SettingsCard>
    </SettingsShell>
  );
}
