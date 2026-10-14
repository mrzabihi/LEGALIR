// ============================================================
// LEGALIR — My Points (امتیازهای من)
// Displays current balance, ways to earn, reward history, and
// the future redemption teaser. All values come from the backend
// rewards API — the frontend never computes point amounts.
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useMe } from "@/hooks/useDashboard";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import { useRewardsSummary, useClaimDailyVisit } from "@/hooks/useRewards";
import { usePointsAccount, usePointsTransactions } from "@/hooks/useAccount";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  IconCoin,
  IconPerson,
  IconStar,
  IconSubscription,
  IconCheck,
  IconArrowBack,
  IconInfo,
} from "@/lib/icons";
import type { RewardRuleInfo, RewardLedgerItem } from "@legalir/types";

// ============================================================
// Rule status resolution (display only — amounts come from API)
// ============================================================

function resolveRuleStatus(
  rule: RewardRuleInfo,
  profileCompleted: boolean,
  visitClaimed: boolean
): { label: string; tone: "success" | "amber" | "neutral" | "primary" } {
  if (!rule.enabled) return { label: "به‌زودی", tone: "neutral" };

  switch (rule.eventType) {
    case "PROFILE_COMPLETED":
      return profileCompleted
        ? { label: "دریافت شده", tone: "success" }
        : { label: "تکمیل کنید", tone: "amber" };
    case "DAILY_VISIT":
      return visitClaimed
        ? { label: "امروز دریافت شده", tone: "success" }
        : { label: "دریافت نشده", tone: "amber" };
    case "SUBSCRIPTION_SILVER_PURCHASED":
    case "SUBSCRIPTION_GOLD_PURCHASED":
    case "SUBSCRIPTION_DIAMOND_PURCHASED":
      return { label: "پس از خرید", tone: "primary" };
    default:
      return { label: "دریافت نشده", tone: "neutral" };
  }
}

const TONE_CLASSES: Record<"success" | "amber" | "neutral" | "primary", string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-500/10 dark:text-neutral-400 dark:border-neutral-500/20",
  primary: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-500/10 dark:text-primary-400 dark:border-primary-500/20",
};

function ruleIcon(eventType: RewardRuleInfo["eventType"]) {
  switch (eventType) {
    case "PROFILE_COMPLETED":
      return <IconPerson size={20} />;
    case "DAILY_VISIT":
      return <IconCheck size={20} />;
    case "REFERRAL_COMPLETED":
      return <IconStar size={20} />;
    default:
      return <IconSubscription size={20} />;
  }
}

// ============================================================
// Page
// ============================================================

export default function MyPointsPage() {
  const me = useMe();
  const summary = useRewardsSummary();
  const account = usePointsAccount();
  const history = usePointsTransactions(1, 50);
  const claim = useClaimDailyVisit();

  const [toast, setToast] = useState<string | null>(null);

  // Hydration guard. `me` and the rewards summary are shell-owned queries
  // (AppLayout/TopBar/Sidebar) that can resolve — and warm the cache — before
  // this page hydrates, because `(app)/loading.tsx` nests the page in its own
  // Suspense boundary. The values below all render into the DOM (balance,
  // «سر زدن روزانه» state, the راههای کسب امتیاز list), so reading them at
  // the hydration render would diverge from the server HTML. Gate them until
  // hydration completes; `account` is page-owned and safe to read directly.
  const hydrated = useIsHydrated();
  const summaryReady = hydrated && !summary.isPending;
  const meReady = hydrated && !me.isPending;

  const profileCompleted = meReady && (me.data?.profile?.completionPercent ?? 0) >= 100;
  // Balance is the ledger-derived aggregate — the same source the header
  // badge and dashboard card read, so all three always agree.
  const balance = account.data?.balance ?? (summaryReady ? summary.data?.balance : undefined) ?? 0;
  const lifetimeEarned = account.data?.lifetimeEarned ?? 0;
  const lifetimeSpent = account.data?.lifetimeSpent ?? 0;
  const visitClaimed = summaryReady && summary.data?.today?.visitRewardClaimed === true;
  // During the loading branch the server rendered no rules; keep it that way
  // for the hydration render, then let the list appear once hydrated.
  const rules = summaryReady ? summary.data?.rules ?? [] : [];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClaimDaily = useCallback(async () => {
    const res = await claim.mutateAsync();
    if (res.awarded) {
      setToast(`+${toPersianNumber(res.points)} امتیاز — امتیاز حضور امروز به حساب شما اضافه شد.`);
    }
  }, [claim]);

  return (
    <div className="p-4 tablet:p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Toast (daily reward micro-interaction) */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up-fade rounded-medium bg-emerald-600 text-white px-5 py-3 text-body-2 shadow-elevation-8 motion-reduce:transition-none"
        >
          {toast}
        </div>
      )}

      <Breadcrumb
        items={[
          { label: "داشبورد", href: "/dashboard" },
          { label: "امتیازهای من" },
        ]}
      />

      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="w-10 h-10 flex items-center justify-center rounded-medium bg-surface border border-divider text-muted hover:text-primary transition-colors touch-target-min"
          aria-label="بازگشت"
        >
          <IconArrowBack size={20} rtlFlip />
        </Link>
        <h1 className="text-h2 text-onSurface font-bold">امتیازهای من</h1>
      </div>

      {/* Balance hero */}
      <section className="relative rounded-large bg-gradient-to-br from-secondary-600 via-secondary-700 to-secondary-900 p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-large bg-white/15 text-white">
            <IconCoin size={28} />
          </span>
          <div>
            <p className="text-caption text-secondary-100/80">موجودی فعلی</p>
            <p className="text-h1 text-white font-bold tabular-nums" aria-live="polite">
              {toPersianNumber(balance)}
              <span className="text-body-1 text-secondary-200 font-normal mr-2">امتیاز</span>
            </p>
          </div>
        </div>

        {/* Lifetime aggregates — derived from the ledger, never stored */}
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-medium bg-white/10 px-4 py-3">
            <p className="text-caption text-secondary-100/80">مجموع کسب‌شده</p>
            <p className="text-body-1 text-white font-semibold tabular-nums mt-0.5" dir="ltr">
              +{toPersianNumber(lifetimeEarned)}
            </p>
          </div>
          <div className="rounded-medium bg-white/10 px-4 py-3">
            <p className="text-caption text-secondary-100/80">مجموع خرج‌شده</p>
            <p className="text-body-1 text-white font-semibold tabular-nums mt-0.5" dir="ltr">
              −{toPersianNumber(lifetimeSpent)}
            </p>
          </div>
        </div>
      </section>

      {/* Daily visit claim */}
      <section className="rounded-large bg-surface border border-divider shadow-elevation-1 p-5 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <IconCheck size={22} />
            </span>
            <div>
              <p className="text-body-1 text-onSurface font-semibold">سر زدن روزانه</p>
              <p className="text-caption text-muted mt-0.5">
                {visitClaimed
                  ? "امتیاز حضور امروز دریافت شد"
                  : "هر روز با ورود به محیط کار، ۱۰۰ امتیاز بگیرید"}
              </p>
            </div>
          </div>
          {visitClaimed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-caption font-medium dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
              <IconCheck size={14} />
              امروز دریافت شده
            </span>
          ) : (
            <button
              onClick={handleClaimDaily}
              disabled={claim.isPending}
              className="inline-flex items-center gap-1.5 rounded-medium bg-primary text-primary-on px-5 py-2.5 text-button font-medium hover:bg-primary-600 hover:text-white transition-colors disabled:opacity-50 touch-target"
            >
              {claim.isPending ? "در حال دریافت..." : "دریافت امتیاز"}
            </button>
          )}
        </div>
      </section>

      {/* Ways to earn */}
      <section className="mb-6">
        <h2 className="text-h3 text-onSurface font-bold mb-3">راه‌های کسب امتیاز</h2>
        <div className="space-y-2">
          {rules.map((rule) => {
            const status = resolveRuleStatus(rule, profileCompleted, visitClaimed);
            return (
              <div
                key={rule.eventType}
                className="flex items-center gap-3 rounded-medium bg-surface border border-divider p-4 shadow-elevation-1"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-secondary-50 text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-400">
                  {ruleIcon(rule.eventType)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-1 text-onSurface font-medium">{rule.labelFa}</p>
                  {rule.descriptionFa && (
                    <p className="text-caption text-muted mt-0.5 line-clamp-1">{rule.descriptionFa}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-body-2 text-secondary-700 dark:text-secondary-400 font-semibold tabular-nums" dir="ltr">
                    +{toPersianNumber(rule.points)}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${TONE_CLASSES[status.tone]}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Future redemption teaser */}
      <section className="rounded-large bg-surface border border-dashed border-divider p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-neutral-100 text-neutral-400 dark:bg-neutral-500/10">
            <IconInfo size={20} />
          </span>
          <div>
            <h3 className="text-body-1 text-onSurface font-semibold">استفاده از امتیاز</h3>
            <p className="text-body-2 text-muted mt-1 leading-relaxed">
              به‌زودی می‌توانید از امتیازهای لیگالیر برای دریافت مزایا و اشتراک‌ها استفاده کنید.
            </p>
            <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 px-3 py-1 text-caption font-medium mt-2 dark:bg-neutral-500/10 dark:text-neutral-400 dark:border-neutral-500/20">
              به‌زودی
            </span>
          </div>
        </div>
      </section>

      {/* History */}
      <section>
        <h2 className="text-h3 text-onSurface font-bold mb-3">تاریخچه امتیازها</h2>
        {history.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-medium bg-surface border border-divider skeleton-shimmer" />
            ))}
          </div>
        ) : history.data?.items && history.data.items.length > 0 ? (
          <div className="rounded-large bg-surface border border-divider shadow-elevation-1 divide-y divide-divider">
            {history.data.items.map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-large bg-surface border border-divider p-6 text-center">
            <p className="text-body-2 text-muted">هنوز امتیازی دریافت نکرده‌اید.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryRow({ item }: { item: RewardLedgerItem }) {
  const positive = item.pointsDelta >= 0;
  return (
    <div className="flex items-center gap-3 p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium ${
          positive
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            : "bg-red-50 text-error dark:bg-red-500/10"
        }`}
      >
        <IconCoin size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-2 text-onSurface font-medium">{item.description}</p>
        <p className="text-caption text-muted mt-0.5">{toPersianDate(item.createdAt)}</p>
      </div>
      <span
        className={`shrink-0 text-body-2 font-semibold tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-error"}`}
        dir="ltr"
      >
        {positive ? "+" : ""}
        {toPersianNumber(item.pointsDelta)}
      </span>
    </div>
  );
}
