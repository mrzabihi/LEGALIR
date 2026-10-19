// ============================================================
// LEGALIR — Per-subscription usage banner (اشتراک‌ها)
// ============================================================
// One card per ACTIVE subscription, showing that subscription's REAL recorded
// consumption. The numbers come from `buildSubscriptionUsageCard` — the same
// `usage_transactions` projection the «تاریخچه و مصرف» page and the admin user
// tab read, so all three surfaces always agree.
//
// NO QUOTA IS INVENTED. The plan model defines daily request/token quotas, not
// a per-subscription energy cap, so `energyQuota`/`energyRemaining` arrive as
// `null`. When they are null this card shows consumption only — it never
// fabricates a remaining balance or a percentage.
// ============================================================

"use client";

import Link from "next/link";
import {
  SkeletonBlock,
  ErrorBanner,
  EmptyState,
} from "@/components/settings/settings-ui";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  IconBolt,
  IconCalendar,
  IconChevronRight,
  IconSubscription,
} from "@/lib/icons";
import type { SubscriptionUsageCard } from "@legalir/types";

const SUB_STATUS_LABEL: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار پرداخت",
  expired: "منقضی",
  cancelled: "لغوشده",
};

function UsageBannerCard({ card }: { card: SubscriptionUsageCard }) {
  const quota = card.energyQuota;
  const hasQuota = quota !== null && card.energyRemaining !== null;
  const usedPct = hasQuota
    ? Math.min(100, Math.round((card.energyUsed / Math.max(1, quota)) * 100))
    : 0;

  return (
    <article className="relative overflow-hidden rounded-xlarge border border-divider bg-surface p-5 shadow-elevation-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -end-12 h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--brand-gold)_22%,transparent)] blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
            <IconSubscription size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body-1 font-medium text-on-surface">
              {card.planNameFa}
            </p>
            <p className="text-caption text-muted">
              {SUB_STATUS_LABEL[card.status] ?? card.status}
              {card.daysRemaining !== null
                ? ` · ${toPersianNumber(card.daysRemaining)} روز باقی‌مانده`
                : ""}
            </p>
          </div>
        </div>

        <Link
          href="/settings/usage"
          className="touch-target inline-flex shrink-0 items-center gap-1 rounded-full border border-divider px-3 py-1.5 text-caption font-medium text-primary transition-colors hover:bg-surface-hover"
        >
          مشاهده جزئیات مصرف
          <IconChevronRight size={14} rtlFlip />
        </Link>
      </div>

      <dl className="relative mt-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1 text-caption text-muted">
            <IconBolt size={14} className="text-[var(--brand-fg-gold)]" />
            انرژی مصرف‌شده
          </dt>
          <dd className="mt-0.5 text-body-1 font-bold tabular-nums text-on-surface">
            {toPersianNumber(card.energyUsed)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">بازگشت انرژی</dt>
          <dd className="mt-0.5 text-body-1 font-bold tabular-nums text-on-surface">
            {toPersianNumber(card.energyRefunded)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">توکن (ورودی / خروجی)</dt>
          <dd
            className="mt-0.5 text-body-1 font-bold tabular-nums text-on-surface"
            dir="ltr"
          >
            {toPersianNumber(card.inputTokens)} / {toPersianNumber(card.outputTokens)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-caption text-muted">
            <IconCalendar size={14} />
            بازهٔ اشتراک
          </dt>
          <dd className="mt-0.5 text-body-2 text-on-surface">
            {toPersianDate(card.startAt)} تا {toPersianDate(card.endAt)}
          </dd>
        </div>
      </dl>

      {hasQuota ? (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-caption text-muted">
            <span>مصرف از سقف انرژی این اشتراک</span>
            <span className="tabular-nums">
              {toPersianNumber(card.energyUsed)} / {toPersianNumber(quota)}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-container"
            role="progressbar"
            aria-valuenow={card.energyUsed}
            aria-valuemin={0}
            aria-valuemax={quota}
            aria-label="سقف انرژی اشتراک"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="relative mt-4 text-caption leading-5 text-muted">
          پلن فعلی سقف انرژی مخصوص اشتراک تعریف نکرده است؛ بنابراین فقط مصرف واقعی
          ثبت‌شده نمایش داده می‌شود. اعتبار روزانه و سهمیه‌های دورهٔ همین اشتراک در
          «تاریخچه و مصرف» آمده است.
        </p>
      )}
    </article>
  );
}

export function SubscriptionUsageBanners({
  cards,
  isLoading,
  error,
  onRetry,
}: {
  cards: SubscriptionUsageCard[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) return <SkeletonBlock lines={4} />;
  if (error) return <ErrorBanner message={error.message} onRetry={onRetry} />;
  if (!cards || cards.length === 0) {
    return (
      <EmptyState text="اشتراک فعالی برای نمایش مصرف آن وجود ندارد. با خرید اشتراک، مصرف واقعی هر دوره اینجا نمایش داده می‌شود." />
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <UsageBannerCard key={card.subscriptionId} card={card} />
      ))}
    </div>
  );
}
