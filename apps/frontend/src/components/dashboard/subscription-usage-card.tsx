// ============================================================
// LEGALIR — Subscription Usage Card (Dashboard)
// ============================================================
// Renders the usage engine's summary as TWO clearly separate assets:
//
//   1) اعتبار امروز اشتراک — today's subscription credit. Resets at
//      Tehran midnight and never carries over.
//   2) امتیازهای شما       — reward points. A persistent ledger that is
//      NEVER reset by the daily rollover.
//
// Below them, the period-scoped service quotas (tokens, AI messages,
// document analysis, contracts) which reset only at period end.
//
// Every number comes from GET /api/v1/subscription/usage — nothing is
// computed or hard-coded on the client.
// ============================================================

"use client";

import Link from "next/link";
import { useSubscriptionUsage } from "@/hooks/useSubscription";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconBolt,
  IconCalendar,
  IconChevronRight,
  IconCoin,
  IconDocument,
  IconChat,
  IconContract,
  IconDatabase,
} from "@/lib/icons";
import type { PeriodQuotaView, ServiceQuotaType } from "@legalir/types";

const QUOTA_ICON: Record<ServiceQuotaType, typeof IconDocument> = {
  AI_MESSAGES: IconChat,
  TOKENS: IconDatabase,
  DOCUMENT_ANALYSIS: IconDocument,
  CONTRACT_DRAFT: IconContract,
  CONTRACT_CREATION: IconContract,
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/** A compact progress bar for one period quota. */
function QuotaRow({ quota }: { quota: PeriodQuotaView }) {
  const Icon = QUOTA_ICON[quota.quotaType] ?? IconDocument;
  const unlimited = quota.unlimited || quota.limit === null || quota.limit <= 0;
  const limit = quota.limit ?? 0;
  const percent = unlimited ? 0 : pct(quota.used, limit);
  const exhausted = !unlimited && quota.remaining === 0;

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-2 text-on-surface truncate">{quota.nameFa}</span>
          <span className="shrink-0 text-caption text-muted tabular-nums">
            {unlimited
              ? "نامحدود"
              : `${toPersianNumber(quota.used)} از ${toPersianNumber(limit)}`}
          </span>
        </div>
        {!unlimited && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <span
              className={`block h-full rounded-full transition-all duration-medium2 ${
                exhausted ? "bg-error-500" : "bg-primary-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SubscriptionUsageCard() {
  const { data, isLoading, isError, refetch } = useSubscriptionUsage();

  return (
    <section
      className="mb-6 rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] shadow-elevation-1 p-5"
      aria-label="مصرف و سهمیه"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-titleMedium text-on-surface font-semibold">مصرف و سهمیه</h3>
          <p className="text-caption text-muted mt-0.5">
            اعتبار امروز، سهمیه‌های دوره و امتیازهای شما
          </p>
        </div>
        <Link
          href="/settings/usage"
          className="hidden tablet:inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] px-3.5 py-1.5 text-caption text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-on-surface transition-colors duration-short4 touch-target-min"
        >
          جزئیات بیشتر
          <IconChevronRight size={14} rtlFlip />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          <div className="h-28 rounded-medium bg-surface-container-high skeleton-shimmer" />
          <div className="h-28 rounded-medium bg-surface-container-high skeleton-shimmer" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-6 text-center">
          <p className="text-body-2 text-muted mb-3">خطا در دریافت اطلاعات مصرف</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-medium border border-[color:var(--color-outline-variant)] px-4 py-2 text-body-2 text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors touch-target"
          >
            تلاش مجدد
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── The two distinct assets ─────────────────────────── */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            {/* 1) Today's subscription credit */}
            <div className="rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-medium bg-info-50 text-info-600">
                  <IconBolt size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-body-2 text-on-surface font-medium">اعتبار امروز اشتراک</p>
                  <p className="text-caption text-muted">هر روز نیمه‌شب به وقت تهران بازنشانی می‌شود</p>
                </div>
              </div>

              {data.hasSubscription ? (
                <>
                  <p className="text-h3 text-on-surface font-bold tabular-nums" dir="ltr">
                    {toPersianNumber(data.daily.pointsRemaining)}
                    <span className="text-body-2 text-muted font-normal">
                      {" / "}
                      {toPersianNumber(data.daily.pointsTotal)}
                    </span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <span
                      className="block h-full rounded-full bg-info-500 transition-all duration-medium2"
                      style={{ width: `${pct(data.daily.pointsUsed, data.daily.pointsTotal)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-caption text-muted tabular-nums">
                    {toPersianNumber(data.daily.requestsRemaining)} درخواست از{" "}
                    {toPersianNumber(data.daily.requestLimit)} باقی‌مانده
                  </p>
                </>
              ) : (
                <p className="text-body-2 text-muted">
                  اشتراک فعالی ندارید. برای دریافت اعتبار روزانه یک پلن تهیه کنید.
                </p>
              )}
            </div>

            {/* 2) Reward points — a separate, persistent asset */}
            <Link
              href="/points"
              className="group rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-4 transition-colors hover:bg-surface-container-high"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-medium bg-[var(--color-violet-50)] text-[var(--color-violet-600)]">
                  <IconCoin size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-body-2 text-on-surface font-medium">امتیازهای شما</p>
                  <p className="text-caption text-muted">دائمی — با بازنشانی روزانه از بین نمی‌رود</p>
                </div>
              </div>
              <p className="text-h3 text-on-surface font-bold tabular-nums" dir="ltr">
                {toPersianNumber(data.rewardPoints)}
              </p>
              <p className="mt-2 text-caption text-muted">
                {data.allowRewardPointsAfterLimit
                  ? "پس از پایان اعتبار روزانه قابل استفاده است"
                  : "برای دریافت پاداش فعالیت کنید"}
              </p>
            </Link>
          </div>

          {/* ── Period-scoped service quotas ────────────────────── */}
          {data.hasSubscription && data.period.length > 0 && (
            <div className="rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
                  <IconCalendar size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-2 text-on-surface font-medium">سهمیه‌های دوره</p>
                  <p className="text-caption text-muted">
                    {data.daysRemaining !== null
                      ? `${toPersianNumber(data.daysRemaining)} روز تا پایان دوره`
                      : "در پایان دوره بازنشانی می‌شود"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3">
                {data.period.map((q) => (
                  <QuotaRow key={q.quotaType} quota={q} />
                ))}
              </div>
            </div>
          )}

          {/* Mobile action */}
          <Link
            href="/settings/usage"
            className="tablet:hidden flex w-full items-center justify-center gap-1 rounded-medium border border-[color:var(--color-outline-variant)] px-4 py-2.5 text-body-2 text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors duration-short4 touch-target"
          >
            جزئیات بیشتر
            <IconChevronRight size={16} rtlFlip />
          </Link>
        </div>
      )}
    </section>
  );
}
