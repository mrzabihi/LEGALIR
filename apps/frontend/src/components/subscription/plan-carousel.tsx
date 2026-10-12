// ============================================================
// LEGALIR — Subscription · Plan Carousel
// ============================================================
// Mobile/PWA: a horizontal, snap-scrolling row of plan cards. Each card takes
// almost the whole width (`w-[85%]`, `snap-center`) so ONE card is centred per
// scroll and the next card peeks in, making it obvious the row scrolls. Only
// this strip scrolls horizontally — the page never does.
//
// Desktop (laptop+ / ≥900px): the same cards lay out as a plain 3-up grid; no
// carousel. The switch is at `laptop`, NOT `tablet`: between 600–899px there is
// no sidebar yet, so a 3-up grid would squeeze each card to ~170px and break.
//
// This is presentation only. It renders whatever plans the page hands it and
// calls back with `onSelect`; it does not price, entitle or check out anything.
// ============================================================

"use client";

import { useEffect, useRef } from "react";
import type { Plan, PlanCode } from "@legalir/types";
import { PlanCard } from "./plan-card";

export interface PlanCarouselProps {
  plans: Plan[];
  /** The user's active plan, if any — the row opens centred on it. */
  currentPlanCode: PlanCode | null;
  /** The best-value plan to highlight (real discount signal), if any. */
  recommendedCode: PlanCode | null;
  onSelect: (plan: Plan) => void;
  isLoading: boolean;
  /** CTA label for a selectable (non-current, non-upgrade) plan. */
  ctaLabel: string;
  /** True when the plan is above the user's current tier. */
  isUpgrade: (plan: Plan) => boolean;
}

export function PlanCarousel({
  plans,
  currentPlanCode,
  recommendedCode,
  onSelect,
  isLoading,
  ctaLabel,
  isUpgrade,
}: PlanCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  // Open the strip on the plan that matters to the user: the active one when
  // subscribed, otherwise the recommended one.
  const focusCode = currentPlanCode ?? recommendedCode;

  useEffect(() => {
    if (!focusCode) return;
    const el = focusRef.current;
    if (!el || typeof el.scrollIntoView !== "function") return;
    // `block: "nearest"` keeps this from scrolling the page vertically.
    el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [focusCode, plans.length]);

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="پلن‌های اشتراک"
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide laptop:grid laptop:grid-cols-3 laptop:gap-4 laptop:overflow-visible laptop:pb-0"
    >
      {plans.map((plan) => {
        const isCurrent = plan.code === currentPlanCode;
        const isRecommended = plan.code === recommendedCode;
        return (
          <div
            key={plan.id}
            ref={isCurrent || (!currentPlanCode && isRecommended) ? focusRef : undefined}
            className="w-[85%] shrink-0 snap-center laptop:w-auto laptop:shrink"
          >
            <PlanCard
              plan={plan}
              isCurrent={isCurrent}
              isRecommended={isRecommended}
              onSelect={onSelect}
              isLoading={isLoading}
              ctaLabel={ctaLabel}
              isUpgrade={isUpgrade(plan)}
            />
          </div>
        );
      })}
    </div>
  );
}
