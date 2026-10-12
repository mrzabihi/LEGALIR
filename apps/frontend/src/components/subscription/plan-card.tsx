// ============================================================
// LEGALIR — Subscription · Plan Card
// ============================================================
// A single buyable plan. Presentation-only: it renders the plan the API
// returned and raises `onSelect` — it never computes pricing, entitlement or
// checkout. The "پیشنهاد ویژه" badge is shown only when the caller flags the
// plan as recommended from a real signal (an admin «پیشنهادی» tag, or the
// plan's own real discount), never fabricated.
//
// Palette: a fixed printed-ticket palette (see globals.css `--plan-*`) —
// a light ivory base for selectable plans and a deep green for the
// emphasised (recommended / current) card, with gold accents. It is
// deliberately theme-independent so the plan grid reads the same in light
// and dark, exactly like a printed ticket.
// ============================================================

"use client";

import { Button } from "@legalir/ui";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconCheck, IconSparkle } from "@/lib/icons";
import type { Plan } from "@legalir/types";
import { planDiscountPercent } from "@/lib/subscription/plan-visuals";

export interface PlanCardProps {
  plan: Plan;
  /** The user's currently active plan (drives the "پلن فعلی" state). */
  isCurrent: boolean;
  /** The visually highlighted "best value" plan (real discount/tag signal). */
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
  const discount = planDiscountPercent(plan.listPrice, plan.salePrice);
  const emblem = isCurrent || isRecommended;

  // ---- Palette (fixed, theme-independent) ----------------------------------
  // Emblem cards (current / recommended) sit on deep green with ivory text and
  // gold accents; all other cards sit on light ivory with deep-green text.
  const surface = emblem
    ? "bg-plan-green-dark text-[var(--brand-ivory)] ring-1 ring-[color-mix(in_srgb,var(--plan-gold)_55%,transparent)]"
    : "bg-plan-ivory text-plan-green-dark ring-1 ring-[color-mix(in_srgb,var(--plan-green)_24%,transparent)]";

  const muted = emblem
    ? "text-[color-mix(in_srgb,var(--brand-ivory)_78%,transparent)]"
    : "text-plan-green";
  const panel = emblem
    ? "bg-[color-mix(in_srgb,var(--brand-ivory)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--brand-ivory)_16%,transparent)]"
    : "bg-plan-ivory-soft ring-1 ring-[color-mix(in_srgb,var(--plan-green)_18%,transparent)]";
  const ribbon = emblem ? "bg-plan-gold" : "bg-plan-green";
  const featureTick = emblem ? "text-plan-gold" : "text-plan-green";

  return (
    <article
      className={[
        "relative flex h-full flex-col overflow-hidden rounded-xlarge p-5 shadow-elevation-1 transition-shadow duration-short3",
        surface,
        isRecommended ? "shadow-elevation-3" : "hover:shadow-elevation-3",
      ].join(" ")}
    >
      {/* Accent ribbon along the top edge of every card. */}
      <div className={`absolute inset-x-0 top-0 h-1.5 ${ribbon}`} aria-hidden="true" />

      {/* Floating recommendation / current badge (real signal only). */}
      {isRecommended && !isCurrent && (
        <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full bg-plan-gold px-2.5 py-1 text-caption font-bold text-plan-green-dark shadow-elevation-1">
          <IconSparkle size={13} />
          پیشنهاد ویژه
        </span>
      )}
      {isCurrent && (
        <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--brand-ivory)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand-ivory)_14%,transparent)] px-2.5 py-1 text-caption font-bold text-[var(--brand-ivory)]">
          پلن فعلی
        </span>
      )}

      {/* Header: name + teaser */}
      <header className="pt-3">
        <h3 className="text-h3 font-bold">{plan.nameFa}</h3>
        <p className={`mt-1 min-h-[2.5rem] text-body-2 ${muted}`}>{plan.descriptionFa}</p>
      </header>

      {/* Price hierarchy: list price → sale price → duration */}
      <div className="mt-3">
        <div className="flex h-6 items-center gap-2">
          {plan.listPrice > plan.salePrice && (
            <span className={`text-body-2 line-through ${muted}`}>
              {toPersianNumber(plan.listPrice)}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-plan-gold px-2 py-0.5 text-caption font-bold text-plan-green-dark">
              ٪{toPersianNumber(discount)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-h1 font-bold tabular-nums">{toPersianNumber(plan.salePrice)}</span>
          <span className={`text-body-2 ${muted}`}>تومان</span>
        </div>
        <p className={`mt-1 text-caption ${muted}`}>به مدت {toPersianNumber(plan.durationDays)} روز</p>
      </div>

      {/* Quota panel — the plan's real usage limits */}
      <div className={`mt-4 space-y-2 rounded-large p-3.5 ${panel}`}>
        <div className="flex justify-between text-body-2">
          <span className={muted}>درخواست روزانه</span>
          <span className="font-bold tabular-nums">{toPersianNumber(plan.dailyRequestLimit)}</span>
        </div>
        <div className="flex justify-between text-body-2">
          <span className={muted}>توکن ماهانه</span>
          <span className="font-bold tabular-nums">{toPersianNumber(plan.totalTokenLimit)}</span>
        </div>
        {plan.usageLimits.map((ul) => (
          <div key={ul.featureKey} className="flex justify-between text-caption">
            <span className={muted}>{ul.nameFa}</span>
            <span className="font-medium tabular-nums">{toPersianNumber(ul.limit)}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <ul className="mt-4 mb-5 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-2">
            <IconCheck size={16} className={`mt-0.5 shrink-0 ${featureTick}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* Action */}
      {isCurrent ? (
        <div
          className="rounded-large border border-[color-mix(in_srgb,var(--brand-ivory)_40%,transparent)] py-3 text-center text-button font-semibold text-[var(--brand-ivory)]"
          aria-current="true"
        >
          اشتراک فعلی
        </div>
      ) : (
        <Button
          variant="filled"
          onClick={() => onSelect(plan)}
          loading={isLoading}
          disabled={isLoading}
          className={
            emblem
              ? "w-full rounded-large !bg-plan-gold !text-plan-green-dark hover:!brightness-[0.96]"
              : "w-full rounded-large !bg-plan-green !text-white hover:!brightness-[0.96]"
          }
        >
          {isUpgrade ? "ارتقا به " + plan.nameFa : ctaLabel}
        </Button>
      )}
    </article>
  );
}
