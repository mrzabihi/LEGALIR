// ============================================================
// LEGALIR — Subscription · Plan Card
// ============================================================
// A single buyable plan. Presentation-only: it renders the plan the API
// returned and raises `onSelect` — it never computes pricing, entitlement or
// checkout. The "پیشنهاد ویژه" badge is shown only when the data itself
// carries a discount AND the caller flags the plan as recommended (derived
// from real signals, never fabricated).
// ============================================================

"use client";

import { Button } from "@legalir/ui";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCheck, IconSparkle } from "@/lib/icons";
import type { Plan } from "@legalir/types";
import { planBgGradient, planDiscountPercent, planGradient } from "@/lib/subscription/plan-visuals";

export interface PlanCardProps {
  plan: Plan;
  /** The user's currently active plan (drives the "پلن فعلی" state). */
  isCurrent: boolean;
  /** The visually highlighted "best value" plan (real discount signal). */
  isRecommended?: boolean;
  onSelect: (plan: Plan) => void;
  isLoading: boolean;
  /** CTA label, resolved by the page from real subscription state. */
  ctaLabel: string;
  /** True when the plan sits above the user's current tier (shows an upgrade cue). */
  isUpgrade: boolean;
}

export function PlanCard({
  plan,
  isCurrent,
  isRecommended = false,
  onSelect,
  isLoading,
  ctaLabel,
  isUpgrade,
}: PlanCardProps) {
  const gradient = planGradient(plan.code);
  const bgGradient = planBgGradient(plan.code);
  const discount = planDiscountPercent(plan.listPrice, plan.salePrice);
  const showBadge = (isRecommended || discount > 0) && !isCurrent;

  return (
    <div
      className={[
        "relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-200",
        isCurrent
          ? `bg-gradient-to-br ${bgGradient} border-primary/40 shadow-md ring-1 ring-primary/20`
          : isRecommended
            ? "bg-surface border-primary/40 shadow-elevation-2 ring-1 ring-primary/15"
            : "bg-surface border-divider/60 shadow-sm hover:shadow-elevation-2",
      ].join(" ")}
    >
      {/* Accent top bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />

      {/* Floating status / recommendation badge */}
      {showBadge && (
        <span
          className={`absolute end-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium ${
            isRecommended
              ? "bg-primary text-on-primary shadow-sm"
              : "border border-divider/60 bg-surface-container text-on-surface-variant"
          }`}
        >
          {isRecommended && <IconSparkle size={13} />}
          {isRecommended ? "پیشنهاد ویژه" : `٪${toPersianNumber(discount)} تخفیف`}
        </span>
      )}

      <div className="pt-1">
        <h3 className="mb-1 text-h3 font-bold text-on-surface">{plan.nameFa}</h3>
        <p className="mb-4 min-h-[2.5rem] text-body-2 text-muted">{plan.descriptionFa}</p>
      </div>

      {/* Pricing hierarchy: list price → sale price → duration */}
      <div className="mb-4">
        {plan.listPrice > plan.salePrice && (
          <div className="flex items-center gap-2">
            <span className="text-caption text-muted line-through">
              {toPersianNumber(plan.listPrice)}
            </span>
            {discount > 0 && (
              <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-caption font-medium text-success">
                ٪{toPersianNumber(discount)}
              </span>
            )}
          </div>
        )}
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={`bg-gradient-to-r ${gradient} bg-clip-text text-h2 font-bold text-transparent`}
          >
            {toPersianNumber(plan.salePrice)}
          </span>
          <span className="text-body-2 text-muted">تومان</span>
        </div>
        <p className="mt-1 text-caption text-muted">
          به مدت {toPersianNumber(plan.durationDays)} روز
        </p>
      </div>

      {/* Usage limits */}
      <div className="mb-4 space-y-1.5 rounded-xl border border-divider/30 bg-surface-container/50 p-3">
        <div className="flex justify-between text-caption">
          <span className="text-muted">درخواست روزانه</span>
          <span className="font-medium text-on-surface">
            {toPersianNumber(plan.dailyRequestLimit)}
          </span>
        </div>
        <div className="flex justify-between text-caption">
          <span className="text-muted">توکن ماهانه</span>
          <span className="font-medium text-on-surface">
            {toPersianNumber(plan.totalTokenLimit)}
          </span>
        </div>
        {plan.usageLimits.map((ul) => (
          <div key={ul.featureKey} className="flex justify-between text-caption">
            <span className="text-muted">{ul.nameFa}</span>
            <span className="font-medium text-on-surface">{toPersianNumber(ul.limit)}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <ul className="mb-5 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-2 text-on-surface">
            <IconCheck size={16} className="mt-0.5 shrink-0 text-success" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* Action */}
      {isCurrent ? (
        <div
          className={`rounded-xl bg-gradient-to-r ${gradient} py-3 text-center text-button font-medium text-white shadow-sm`}
        >
          اشتراک فعلی
        </div>
      ) : (
        <Button
          variant="filled"
          onClick={() => onSelect(plan)}
          loading={isLoading}
          disabled={isLoading}
          className="w-full rounded-xl"
        >
          {isUpgrade ? "ارتقا به " + plan.nameFa : ctaLabel}
        </Button>
      )}
    </div>
  );
}
