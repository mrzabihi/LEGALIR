// ============================================================
// LEGALIR — Subscription (اشتراک)
// ============================================================
// Three clear, separated tabs:
//
//   1) وضعیت اشتراک — the active subscription (status, start/end, remaining
//      days, auto-renew), today's ENERGY (credit), the period quotas, the
//      boolean features — and, when the user has NO active subscription, the
//      purchasable plans surfaced right here so they never have to hunt.
//   2) تاریخچه خرید  — every past purchase with plan, amount, date and status.
//      Each row/card has a «جزئیات» button that opens THAT record's details.
//   3) پلنها         — the full, buyable plan row (mobile: snap carousel;
//      desktop: 3-up grid) with the real buy/upgrade action.
//
// DATA PROVENANCE (nothing is invented):
//   • subscription status/dates  → GET /api/v1/subscriptions/current
//   • today's energy + quotas     → GET /api/v1/subscription/usage
//   • boolean features            → GET /api/v1/entitlements
//   • purchasable plans           → GET /api/v1/plans
//   • purchase history            → GET /api/v1/subscription-history
// The «جزئیات» dialog renders a single history record verbatim; the recommended
// badge is only shown from a real signal (an admin «پیشنهادی»/«محبوب» tag, or
// the plan's own real discount), never self-declared.
// ============================================================

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button, ProgressLinear, SkeletonCard, Tabs } from "@legalir/ui";
import { PageIntroBanner } from "@/components/shared/page-intro-banner";
import { PlanCarousel } from "@/components/subscription/plan-carousel";
import { CheckoutModal } from "@/components/subscription/checkout-modal";
import { SubscriptionDetailsDialog } from "@/components/subscription/subscription-details-dialog";
import {
  useCurrentSubscription,
  useEntitlements,
  usePlansV1,
  useSubscriptionUsage,
  useSubscriptionUsageCards,
} from "@/hooks/useSubscription";
import { SubscriptionUsageBanners } from "@/components/subscription/subscription-usage-banner";
import { useSubscriptionHistory } from "@/hooks/usePhase11";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import { PLAN_ORDER, planDiscountPercent } from "@/lib/subscription/plan-visuals";
import { toPersianCurrency, toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  IconBolt,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconCoin,
  IconError,
  IconHistory,
  IconInfo,
  IconSubscription,
} from "@/lib/icons";
import type {
  Plan,
  PlanCode,
  SubscriptionUsageSummary,
  V1Subscription,
  V1SubscriptionHistoryItem,
} from "@legalir/types";

// ============================================================
// Tabs
// ============================================================

type TabValue = "status" | "history" | "plans";

const TAB_ITEMS: { value: TabValue; label: string }[] = [
  { value: "status", label: "وضعیت اشتراک" },
  { value: "history", label: "تاریخچه خرید" },
  { value: "plans", label: "پلن‌ها" },
];

// ============================================================
// Small shared pieces
// ============================================================

/** Status pill for a V1Subscription — always carries its own label. */
function subStatusPill(status: V1Subscription["status"]): { label: string; cls: string } {
  switch (status) {
    case "active":
      return { label: "فعال", cls: "bg-success-container text-success border-success" };
    case "pending":
      return { label: "در انتظار پرداخت", cls: "bg-warning-container text-warning border-warning" };
    case "expired":
      return { label: "منقضی‌شده", cls: "bg-surface-container text-muted border-divider" };
    case "cancelled":
      return { label: "لغو‌شده", cls: "bg-error-container text-error border-error" };
    case "superseded":
      return { label: "جایگزین‌شده", cls: "bg-surface-container text-muted border-divider" };
    default:
      return { label: status, cls: "bg-surface-container text-muted border-divider" };
  }
}

/** Whole days from now until `iso`, clamped at zero. */
function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((t - Date.now()) / 86_400_000));
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-large border border-divider bg-surface-container px-3 py-2.5">
      <dt className="text-caption text-muted">{label}</dt>
      <dd
        className={`mt-0.5 font-medium text-on-surface ${
          mono ? "font-mono text-caption" : "text-body-2"
        }`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/** A titled section card — the tab panels' common shell. */
function Panel({
  title,
  icon,
  aside,
  children,
}: {
  title: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xlarge border border-divider bg-surface p-5 shadow-elevation-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-body-1 font-semibold text-on-surface">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-large border border-error bg-error-container p-4 text-center">
      <p className="flex items-center justify-center gap-2 text-body-2 text-error">
        <IconError size={18} />
        {message}
      </p>
      <Button variant="text" onClick={onRetry} className="mt-2">
        تلاش مجدد
      </Button>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-large border border-divider bg-surface-container px-5 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
        {icon}
      </span>
      <h3 className="text-body-1 font-semibold text-on-surface">{title}</h3>
      <p className="max-w-md text-body-2 text-muted">{text}</p>
      {action}
    </div>
  );
}

// ============================================================
// Energy — today's subscription credit (resets at Tehran midnight)
// ============================================================

function EnergyCard({ summary }: { summary: SubscriptionUsageSummary }) {
  const { daily } = summary;
  const total = Math.max(1, daily.pointsTotal);
  const remainingPct = Math.min(100, Math.round((daily.pointsRemaining / total) * 100));
  const exhausted = daily.pointsRemaining <= 0;
  const sweep = (daily.pointsRemaining / total) * 360;

  return (
    <section className="relative overflow-hidden rounded-xlarge bg-gradient-to-br from-[var(--brand-green)] to-[var(--brand-teal)] p-5 text-[var(--brand-ivory)] shadow-elevation-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -end-10 h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--brand-gold)_45%,transparent)] opacity-60 blur-3xl"
      />
      <div className="relative flex items-start gap-4">
        {/* Radial credit gauge */}
        <div
          className="relative h-16 w-16 shrink-0"
          role="img"
          aria-label={`${toPersianNumber(daily.pointsRemaining)} انرژی باقی‌مانده از ${toPersianNumber(daily.pointsTotal)}`}
        >
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <defs>
              <linearGradient id="subsEnergyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--brand-gold)" />
                <stop offset="100%" stopColor="#E0C879" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(252,246,232,0.18)" strokeWidth="3.5" />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke={exhausted ? "#f87171" : "url(#subsEnergyGrad)"}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${sweep} ${360 - sweep}`}
              className="transition-all duration-700 ease-emphasized"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-body-2 font-bold tabular-nums text-white">
            {toPersianNumber(remainingPct)}٪
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IconBolt size={18} className="text-[var(--brand-gold)]" />
            <span className="text-body-1 font-medium text-white">انرژی امروز اشتراک</span>
          </div>
          <p className="mt-1 text-h2 font-bold tabular-nums text-white" dir="ltr">
            {toPersianNumber(daily.pointsRemaining)}
            <span className="text-body-2 font-normal text-[color-mix(in_srgb,var(--brand-ivory)_80%,transparent)]">
              {" / "}
              {toPersianNumber(daily.pointsTotal)}
            </span>
          </p>
          <p className="mt-1 text-caption text-[color-mix(in_srgb,var(--brand-ivory)_80%,transparent)]">
            {toPersianNumber(daily.requestsRemaining)} درخواست از {toPersianNumber(daily.requestLimit)} باقی‌مانده
          </p>
        </div>
      </div>

      <p className="relative mt-3 text-caption text-[color-mix(in_srgb,var(--brand-ivory)_80%,transparent)]">
        انرژی هر روز نیمه‌شب به وقت تهران به‌طور کامل بازنشانی می‌شود و به روز بعد منتقل نمی‌گردد.
      </p>
    </section>
  );
}

// ============================================================
// Status tab
// ============================================================

function CurrentSubscriptionPanel({ subscription }: { subscription: V1Subscription }) {
  const pill = subStatusPill(subscription.status);
  const isActive = subscription.status === "active";
  const isPending = subscription.status === "pending";
  const daysLeft = daysUntil(subscription.endAt);
  const expiringSoon = isActive && daysLeft <= 7 && daysLeft > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-h3 font-bold text-on-surface">{subscription.planNameFa}</span>
        <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-caption font-medium ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <Stat label="تاریخ شروع" value={subscription.startAt ? toPersianDate(subscription.startAt) : "—"} />
        <Stat label="تاریخ پایان" value={subscription.endAt ? toPersianDate(subscription.endAt) : "—"} />
        <Stat
          label="روزهای باقی‌مانده"
          value={isActive ? `${toPersianNumber(daysLeft)} روز` : "—"}
        />
        <Stat label="تمدید خودکار" value={subscription.autoRenew ? "فعال" : "غیرفعال"} />
      </dl>

      {isPending && (
        <p className="flex items-start gap-2 rounded-large border border-warning bg-warning-container p-3 text-caption text-warning">
          <IconInfo size={16} className="mt-0.5 shrink-0" />
          این اشتراک در انتظار تکمیل پرداخت است و تا آن زمان فعال نمی‌شود.
        </p>
      )}

      {expiringSoon && (
        <p className="flex items-start gap-2 rounded-large border border-warning bg-warning-container p-3 text-caption text-warning">
          <IconInfo size={16} className="mt-0.5 shrink-0" />
          اشتراک شما به‌زودی منقضی می‌شود. برای ادامهٔ استفاده، آن را تمدید کنید.
        </p>
      )}

      {subscription.status === "expired" && (
        <p className="flex items-start gap-2 rounded-large border border-error bg-error-container p-3 text-caption text-error">
          <IconError size={16} className="mt-0.5 shrink-0" />
          اشتراک شما منقضی شده است. برای ادامهٔ استفاده، یکی از پلن‌ها را خریداری کنید.
        </p>
      )}

      {subscription.status === "cancelled" && (
        <p className="flex items-start gap-2 rounded-large border border-error bg-error-container p-3 text-caption text-error">
          <IconError size={16} className="mt-0.5 shrink-0" />
          اشتراک شما لغو شده است. برای فعال‌سازی مجدد، یک پلن جدید انتخاب کنید.
        </p>
      )}
    </div>
  );
}

function PeriodQuotas({ summary }: { summary: SubscriptionUsageSummary }) {
  if (summary.period.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
      {summary.period.map((q) => {
        const unlimited = q.unlimited || q.limit === null || q.limit <= 0;
        const limit = q.limit ?? 0;
        const usedPct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((q.used / limit) * 100));
        const exhausted = !unlimited && q.remaining === 0;
        return (
          <div key={q.quotaType} className="rounded-large border border-divider bg-surface-hover p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-2 text-on-surface">{q.nameFa}</span>
              <span className="text-body-2 font-medium tabular-nums text-on-surface">
                {unlimited ? "نامحدود" : `${toPersianNumber(q.used)} / ${toPersianNumber(limit)}`}
              </span>
            </div>
            {!unlimited && (
              <ProgressLinear
                value={usedPct}
                max={100}
                color={exhausted ? "error" : usedPct >= 70 ? "secondary" : "primary"}
                size="small"
                className="mt-2"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BooleanFeatures({
  entitlements,
}: {
  entitlements: { featureKey: string; nameFa: string; isBoolean: boolean; isEnabled: boolean }[];
}) {
  const bools = entitlements.filter((e) => e.isBoolean);
  if (bools.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
      {bools.map((e) => (
        <li
          key={e.featureKey}
          className="flex items-center justify-between gap-2 rounded-large border border-divider px-3 py-2"
        >
          <span className="text-body-2 text-on-surface">{e.nameFa}</span>
          {e.isEnabled ? (
            <span className="inline-flex items-center gap-1 text-caption font-medium text-success">
              <IconCheck size={14} />
              فعال
            </span>
          ) : (
            <span className="text-caption text-muted">غیرفعال</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Compact ivory plan card used only in the unsubscribed "پیشنهادی" strip. */
function PlanSummaryCard({
  plan,
  isRecommended,
  onSelect,
}: {
  plan: Plan;
  isRecommended: boolean;
  onSelect: (plan: Plan) => void;
}) {
  const discount = planDiscountPercent(plan.listPrice, plan.salePrice);
  return (
    <article className="flex h-full flex-col rounded-xlarge bg-plan-ivory p-4 text-plan-green-dark ring-1 ring-[color-mix(in_srgb,var(--plan-green)_24%,transparent)] shadow-elevation-1">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-body-1 font-bold">{plan.nameFa}</h3>
        {isRecommended && (
          <span className="shrink-0 rounded-full bg-plan-gold px-2 py-0.5 text-caption font-bold text-plan-green-dark">
            پیشنهاد ویژه
          </span>
        )}
      </div>
      <p className="mt-1 min-h-[2.25rem] text-caption text-plan-green">{plan.descriptionFa}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="text-h3 font-bold tabular-nums">{toPersianNumber(plan.salePrice)}</span>
        <span className="text-caption text-plan-green">تومان</span>
        {discount > 0 && (
          <span className="rounded-full bg-plan-gold px-2 py-0.5 text-caption font-bold text-plan-green-dark">
            ٪{toPersianNumber(discount)}
          </span>
        )}
      </div>
      <p className="mt-1 text-caption text-plan-green">
        به مدت {toPersianNumber(plan.durationDays)} روز · {toPersianNumber(plan.dailyRequestLimit)} درخواست روزانه
      </p>
      <Button
        variant="filled"
        onClick={() => onSelect(plan)}
        className="mt-3 w-full rounded-large !bg-plan-green !text-white hover:!brightness-[0.96]"
      >
        انتخاب و خرید
      </Button>
    </article>
  );
}

// ============================================================
// History tab
// ============================================================

const HISTORY_STATUS_CLASS: Record<string, string> = {
  active: "bg-success-container text-success border-success",
  expired: "bg-surface-container text-muted border-divider",
  cancelled: "bg-error-container text-error border-error",
  unknown: "bg-warning-container text-warning border-warning",
};

function HistoryTab({
  items,
  onOpenDetails,
}: {
  items: V1SubscriptionHistoryItem[];
  onOpenDetails: (item: V1SubscriptionHistoryItem) => void;
}) {
  return (
    <>
      {/* Mobile: stacked cards — never a squeezed table */}
      <ul className="space-y-2 tablet:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-large border border-divider bg-surface-container p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-1 font-semibold text-on-surface">{item.planNameFa}</p>
                <p className="mt-0.5 text-caption text-muted">خرید: {toPersianDate(item.purchasedAt)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-caption font-medium ${
                  HISTORY_STATUS_CLASS[item.status] ?? HISTORY_STATUS_CLASS["unknown"]
                }`}
              >
                {item.statusFa}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-body-2 font-medium text-on-surface">
                {toPersianCurrency(item.amount)}
              </span>
              <Button variant="text" onClick={() => onOpenDetails(item)}>
                جزئیات
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto tablet:block">
        <table className="w-full text-right text-body-2">
          <thead>
            <tr className="border-b border-divider text-muted">
              <th className="pb-2 pl-3 font-medium">پلن</th>
              <th className="pb-2 pl-3 font-medium">مبلغ</th>
              <th className="pb-2 pl-3 font-medium">تاریخ خرید</th>
              <th className="pb-2 pl-3 font-medium">وضعیت</th>
              <th className="pb-2 font-medium"><span className="sr-only">جزئیات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-surface-hover">
                <td className="py-3 pl-3 font-medium text-on-surface">{item.planNameFa}</td>
                <td className="py-3 pl-3 text-on-surface">{toPersianCurrency(item.amount)}</td>
                <td className="py-3 pl-3 text-on-surface">{toPersianDate(item.purchasedAt)}</td>
                <td className="py-3 pl-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium ${
                      HISTORY_STATUS_CLASS[item.status] ?? HISTORY_STATUS_CLASS["unknown"]
                    }`}
                  >
                    {item.statusFa}
                  </span>
                </td>
                <td className="py-3 text-left">
                  <Button variant="text" onClick={() => onOpenDetails(item)}>
                    جزئیات
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// Page
// ============================================================

export default function SubscriptionPage() {
  const [tab, setTab] = useState<TabValue>("status");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<V1SubscriptionHistoryItem | null>(null);

  const subQuery = useCurrentSubscription();
  const entQuery = useEntitlements();
  const plansQuery = usePlansV1();
  const usageQuery = useSubscriptionUsage();
  const usageCardsQuery = useSubscriptionUsageCards();
  const historyQuery = useSubscriptionHistory(1, 20);

  // Hydration guard. `useCurrentSubscription` (`["v1","subscriptions",
  // "current"]`) is the SAME query the header's SubscriptionStatusChip reads.
  // The shell can resolve — and warm the cache — before this page hydrates, so
  // `hasActiveSubscription` (and the reward-points banner it gates, rendered in
  // the main return outside the status tab's `usageQuery.isLoading` mask) would
  // flip on at hydration while the server, where the chip was still pending,
  // rendered it hidden → mismatch. Gate the derived flag on `useIsHydrated()`.
  const hydrated = useIsHydrated();

  const subscription = subQuery.data ?? null;
  const plans = plansQuery.data ?? [];
  const usage = usageQuery.data;
  const historyItems = historyQuery.data?.items ?? [];

  const hasActiveSubscription = hydrated && subscription?.status === "active";

  // ── Real recommended signal (never self-declared) ──────────────────────
  // An admin «پیشنهادی»/«محبوب» tag wins; otherwise the plan with the largest
  // real discount; otherwise nothing is highlighted at all.
  const recommendedCode = useMemo<PlanCode | null>(() => {
    if (plans.length === 0) return null;
    const tagged = plans.find((p) =>
      (p.tags ?? []).some((t) => t.includes("پیشنهاد") || t.toLowerCase().includes("popular"))
    );
    if (tagged) return tagged.code;
    let best: Plan | null = null;
    for (const p of plans) {
      const pct = planDiscountPercent(p.listPrice, p.salePrice);
      if (pct <= 0) continue;
      if (!best || pct > planDiscountPercent(best.listPrice, best.salePrice)) best = p;
    }
    return best?.code ?? null;
  }, [plans]);

  const currentPlanCode = subscription?.planCode ?? null;
  const currentTier = currentPlanCode ? PLAN_ORDER.indexOf(currentPlanCode) : -1;
  const isUpgrade = (plan: Plan) =>
    hasActiveSubscription && currentTier >= 0 && PLAN_ORDER.indexOf(plan.code) > currentTier;
  const ctaLabel = hasActiveSubscription ? "خرید اشتراک" : "انتخاب اشتراک";

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    setSelectedPlan(null);
    // The commit may have changed the account state — refresh every surface.
    subQuery.refetch();
    entQuery.refetch();
    usageQuery.refetch();
    historyQuery.refetch();
  };

  // ── Status tab ─────────────────────────────────────────────────────────
  function renderStatus() {
    if (subQuery.isLoading || usageQuery.isLoading) {
      return (
        <div className="space-y-4">
          <div className="rounded-xlarge border border-divider bg-surface p-5 shadow-elevation-1">
            <SkeletonCard lines={3} />
          </div>
          <div className="rounded-xlarge border border-divider bg-surface p-5 shadow-elevation-1">
            <SkeletonCard lines={4} />
          </div>
        </div>
      );
    }

    if (subQuery.isError) {
      return <ErrorCard message="خطا در دریافت وضعیت اشتراک" onRetry={() => subQuery.refetch()} />;
    }

    const noActive = !subscription || subscription.status !== "active";

    return (
      <div className="space-y-4">
        {/* Energy — the daily credit, from the usage engine */}
        {usage ? (
          <EnergyCard summary={usage} />
        ) : usageQuery.isError ? (
          <ErrorCard message="خطا در دریافت اطلاعات انرژی و مصرف" onRetry={() => usageQuery.refetch()} />
        ) : null}

        {/* Per-subscription real consumption (same ledger as /settings/usage).
            Only ACTIVE, unexpired subscriptions come back; the component owns
            the loading / error / no-active-subscription states. */}
        <Panel title="مصرف هر اشتراک">
          <SubscriptionUsageBanners
            cards={usageCardsQuery.data}
            isLoading={usageCardsQuery.isLoading}
            error={usageCardsQuery.error as Error | null}
            onRetry={() => usageCardsQuery.refetch()}
          />
        </Panel>

        {/* The subscription itself */}
        <Panel
          title="وضعیت اشتراک"
          icon={<IconSubscription size={18} className="text-primary" />}
        >
          {subscription ? (
            <CurrentSubscriptionPanel subscription={subscription} />
          ) : (
            <EmptyCard
              icon={<IconSubscription size={22} />}
              title="اشتراک فعالی ندارید"
              text="در حال حاضر اشتراک فعالی ندارید. برای دسترسی به امکانات، یکی از پلن‌های زیر را انتخاب کنید."
            />
          )}
        </Panel>

        {/* Purchasable plans surfaced right here when there is nothing active */}
        {noActive && (
          <Panel
            title="پلن‌های پیشنهادی"
            icon={<IconCheck size={18} className="text-primary" />}
            aside={
              <Button variant="text" onClick={() => setTab("plans")}>
                مشاهده و مقایسهٔ همه
              </Button>
            }
          >
            {plansQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 laptop:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xlarge border border-divider bg-surface p-4">
                    <SkeletonCard lines={4} />
                  </div>
                ))}
              </div>
            ) : plans.length === 0 ? (
              <EmptyCard
                icon={<IconInfo size={22} />}
                title="پلنی برای نمایش نیست"
                text="در حال حاضر پلنی برای فروش در دسترس نیست. لطفاً بعداً مراجعه کنید."
              />
            ) : (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide laptop:grid laptop:grid-cols-3 laptop:gap-4 laptop:overflow-visible laptop:pb-0">
                {plans.map((plan) => (
                  <div key={plan.id} className="w-[85%] shrink-0 snap-center laptop:w-auto laptop:shrink">
                    <PlanSummaryCard
                      plan={plan}
                      isRecommended={plan.code === recommendedCode}
                      onSelect={handleSelectPlan}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* Period quotas — only meaningful while a period is running */}
        {hasActiveSubscription && usage && usage.period.length > 0 && (
          <Panel
            title="سهمیه‌های دوره"
            icon={<IconCalendar size={18} className="text-primary" />}
            aside={
              usage.daysRemaining !== null ? (
                <span className="text-caption text-muted">
                  {toPersianNumber(usage.daysRemaining)} روز تا پایان دوره
                </span>
              ) : (
                <span className="text-caption text-muted">پایان دوره بازنشانی می‌شود</span>
              )
            }
          >
            <PeriodQuotas summary={usage} />
          </Panel>
        )}

        {/* Boolean features (from entitlements) */}
        {hasActiveSubscription && entQuery.data && entQuery.data.entitlements.length > 0 && (
          <Panel
            title="قابلیت‌های ویژه"
            icon={<IconCheck size={18} className="text-primary" />}
          >
            <BooleanFeatures entitlements={entQuery.data.entitlements} />
          </Panel>
        )}
      </div>
    );
  }

  // ── History tab ────────────────────────────────────────────────────────
  function renderHistory() {
    return (
      <Panel title="تاریخچه خرید" icon={<IconHistory size={18} className="text-primary" />}>
        {historyQuery.isLoading ? (
          <SkeletonCard lines={5} />
        ) : historyQuery.isError ? (
          <ErrorCard message="خطا در دریافت تاریخچه خرید" onRetry={() => historyQuery.refetch()} />
        ) : historyItems.length === 0 ? (
          <EmptyCard
            icon={<IconHistory size={22} />}
            title="تاریخچه‌ای وجود ندارد"
            text="هنوز خریدی ثبت نشده است. پس از اولین خرید، سابقهٔ آن در این بخش نمایش داده می‌شود."
            action={
              <Button variant="filled" onClick={() => setTab("plans")}>
                مشاهده پلن‌ها
              </Button>
            }
          />
        ) : (
          <HistoryTab items={historyItems} onOpenDetails={setDetailsItem} />
        )}
      </Panel>
    );
  }

  // ── Plans tab ──────────────────────────────────────────────────────────
  function renderPlans() {
    return (
      <div className="space-y-4">
        {!hasActiveSubscription && !subQuery.isLoading && (
          <p className="flex items-start gap-2 rounded-large border border-warning bg-warning-container p-3 text-body-2 text-warning">
            <IconInfo size={18} className="mt-0.5 shrink-0" />
            شما اشتراک فعالی ندارید. با انتخاب یکی از پلن‌های زیر، به امکانات لیگالیر دسترسی پیدا می‌کنید.
          </p>
        )}

        {plansQuery.isLoading ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide laptop:grid laptop:grid-cols-3 laptop:gap-4 laptop:overflow-visible laptop:pb-0">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[85%] shrink-0 snap-center rounded-xlarge border border-divider bg-surface p-6 laptop:w-auto laptop:shrink"
              >
                <SkeletonCard lines={5} />
              </div>
            ))}
          </div>
        ) : plansQuery.isError ? (
          <ErrorCard message="خطا در دریافت پلن‌ها" onRetry={() => plansQuery.refetch()} />
        ) : plans.length === 0 ? (
          <EmptyCard
            icon={<IconInfo size={22} />}
            title="پلنی برای نمایش نیست"
            text="در حال حاضر پلنی برای فروش در دسترس نیست. لطفاً بعداً مراجعه کنید."
          />
        ) : (
          <PlanCarousel
            plans={plans}
            currentPlanCode={currentPlanCode}
            recommendedCode={recommendedCode}
            onSelect={handleSelectPlan}
            isLoading={false}
            ctaLabel={ctaLabel}
            isUpgrade={isUpgrade}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 tablet:p-6" dir="rtl">
      <PageIntroBanner
        title="اشتراک"
        description="وضعیت اشتراک، انرژی امروز، سهمیه‌های دوره، تاریخچهٔ خرید و پلن‌های قابل خرید."
        icon={IconSubscription}
      />

      <div className="mt-5">
        <Tabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(v) => setTab(v as TabValue)}
          variant="primary"
          fullWidth
        />

        <div className="mt-5">
          {tab === "status" && renderStatus()}
          {tab === "history" && renderHistory()}
          {tab === "plans" && renderPlans()}
        </div>
      </div>

      {/* Order-review + confirmation (server-computed pricing) */}
      <CheckoutModal open={checkoutOpen} plan={selectedPlan} onClose={handleCloseCheckout} />

      {/* One purchase record's details */}
      <SubscriptionDetailsDialog
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onViewPlans={() => {
          setDetailsItem(null);
          setTab("plans");
        }}
      />

      {/* Small brand-note: reward points are a separate asset — link out. */}
      {hasActiveSubscription && (
        <a
          href="/points"
          className="mt-5 flex items-center justify-between gap-3 rounded-xlarge border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-gold)_16%,transparent)] text-[var(--brand-fg-gold)]">
              <IconCoin size={18} />
            </span>
            <span className="text-body-2 text-on-surface">
              امتیازهای پاداش شما دارایی جداگانه‌ای است و با بازنشانی روزانه از بین نمی‌رود.
            </span>
          </span>
          <IconChevronRight size={16} className="shrink-0 text-muted" rtlFlip />
        </a>
      )}
    </div>
  );
}
