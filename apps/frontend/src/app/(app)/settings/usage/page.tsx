// ============================================================
// LEGALIR — Settings · Usage & History (تاریخچه و مصرف)
// ============================================================
// Dedicated page for consumption metrics and subscription history.
// This is the ONLY place usage history is shown — the notifications
// and privacy pages never route here.
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
import { useSubscriptionHistory, useProfileUsage } from "@/hooks/usePhase11";
import { useDailyQuota } from "@/hooks/useDashboard";
import { IconHistory, IconChat, IconShield, IconDocument, IconContract, IconSubscription } from "@/lib/icons";
import type {
  V1ProfileUsage,
  V1SubscriptionHistoryItem,
  V1DailyQuota,
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

function MetricCard({
  label,
  used,
  total,
  unit,
  icon,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  icon: React.ReactNode;
}) {
  const usedPct = pct(used, total);
  const barColor = usedPct >= 90 ? "bg-error" : usedPct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="flex items-start gap-3 rounded-large bg-surface-hover p-4 border border-divider">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-2 text-muted">{label}</p>
        <p className="text-body-1 text-on-surface font-medium tabular-nums">
          {used.toLocaleString("fa-IR")} / {total.toLocaleString("fa-IR")} {unit}
        </p>
        <div
          className="mt-1.5 h-2 w-full rounded-full bg-gray-200 dark:bg-surface overflow-hidden"
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`مصرف ${label}`}
        >
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${usedPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function UsageTabContent({
  usage,
  quota,
  isLoading,
  error,
  onRetry,
}: {
  usage: V1ProfileUsage | undefined;
  quota: V1DailyQuota | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const countdown = useResetCountdown(quota?.resetAt);

  if (isLoading) return <SkeletonBlock lines={6} />;
  if (error) return <ErrorBanner message={error.message} onRetry={onRetry} />;
  if (!usage) return <EmptyState text="اطلاعات مصرف در دسترس نیست." />;

  const dailyUsed = quota?.used ?? usage.dailyRequestsUsed;
  const dailyTotal = quota?.total ?? usage.dailyRequestsTotal;
  const remaining = Math.max(0, dailyTotal - dailyUsed);
  const exhausted = quota?.exhausted ?? remaining <= 0;
  const expired = quota?.subscriptionExpired ?? false;

  const dailySweep = dailyTotal > 0 ? (remaining / dailyTotal) * 360 : 0;
  const dailyDash = `${dailySweep} ${360 - dailySweep}`;
  const dailyExhausted = dailyTotal > 0 && remaining === 0;
  const dailyLow = !dailyExhausted && dailyTotal > 0 && remaining / dailyTotal <= 0.25;

  const metrics = [
    { key: "tokens", label: "توکن", used: usage.tokensUsed, total: usage.tokensTotal, unit: "توکن", icon: <IconShield size={20} className="text-primary" /> },
    { key: "analysis", label: "تحلیل سند", used: usage.documentAnalysesUsed, total: usage.documentAnalysesTotal, unit: "تحلیل", icon: <IconDocument size={20} className="text-primary" /> },
    { key: "contracts", label: "تولید قرارداد", used: usage.contractsGenerated, total: usage.contractsTotal, unit: "قرارداد", icon: <IconContract size={20} className="text-primary" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="group relative overflow-hidden rounded-large bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-100 border border-white/10 backdrop-blur p-5">
        <span className="pointer-events-none absolute -top-10 -end-10 w-32 h-32 rounded-full bg-blue-400/20 blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div
            className="relative w-16 h-16 shrink-0"
            role="img"
            aria-label={`${dailyUsed.toLocaleString("fa-IR")} درخواست مصرف‌شده از ${dailyTotal.toLocaleString("fa-IR")}؛ ${remaining.toLocaleString("fa-IR")} باقی‌مانده`}
          >
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <defs>
                <linearGradient id="settingsQuotaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="15.915" fill="none"
                stroke={dailyExhausted ? "#f87171" : dailyLow ? "#fbbf24" : "url(#settingsQuotaGrad)"}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={dailyDash}
                className="transition-all duration-700 ease-emphasized"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-body-1 font-bold text-white tabular-nums">
              {remaining.toLocaleString("fa-IR")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <IconChat size={18} className="text-blue-200" />
              <span className="text-body-1 text-white font-medium">درخواست امروز</span>
            </div>
            <p className="mt-1 text-h3 font-bold text-white tabular-nums" dir="ltr">
              {dailyUsed.toLocaleString("fa-IR")} / {dailyTotal.toLocaleString("fa-IR")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-primary-200/90">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-300" aria-hidden="true" />
                {remaining.toLocaleString("fa-IR")} مانده
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white/25" aria-hidden="true" />
                {dailyUsed.toLocaleString("fa-IR")} مصرف
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-primary-200/90">
          <p>{remaining.toLocaleString("fa-IR")} درخواست باقی‌مانده</p>
          <p>بازنشانی تا <span className="tabular-nums" dir="ltr">{countdown}</span></p>
        </div>

        {(exhausted || expired) && (
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-medium bg-white/10 p-3 border border-white/15">
            <p className="text-body-2 text-white">
              {expired ? "اشتراک شما به پایان رسیده است." : "سهمیه درخواست امروز شما به پایان رسیده است."}
            </p>
            <Link
              href="/subscription"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-body-2 text-blue-700 font-medium transition hover:bg-blue-50 touch-target"
            >
              <IconSubscription size={16} />
              {expired ? "تمدید اشتراک" : "خرید اشتراک"}
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.key} label={m.label} used={m.used} total={m.total} unit={m.unit} icon={m.icon} />
        ))}
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
  const usageQuery = useProfileUsage();
  const quotaQuery = useDailyQuota();
  const historyQuery = useSubscriptionHistory(1, 20);

  return (
    <SettingsShell
      title="تاریخچه و مصرف"
      description="میزان مصرف سهمیه و تاریخچه اشتراک‌های شما."
    >
      <SettingsCard title="تاریخچه و مصرف" icon={<IconHistory size={22} />}>
        <div className="flex gap-1 rounded-full bg-surface-hover p-1 mb-5 w-fit" role="tablist" aria-label="برگه‌های تاریخچه و مصرف">
          <button
            role="tab"
            aria-selected={activeTab === "usage"}
            onClick={() => setActiveTab("usage")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${activeTab === "usage" ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-on-surface"}`}
          >
            مصرف
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${activeTab === "history" ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-on-surface"}`}
          >
            تاریخچه
          </button>
        </div>

        {activeTab === "usage" ? (
          <UsageTabContent
            usage={usageQuery.data}
            quota={quotaQuery.data}
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
