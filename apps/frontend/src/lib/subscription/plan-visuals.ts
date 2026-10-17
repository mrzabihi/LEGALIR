// ============================================================
// LEGALIR — Subscription · Plan visuals
// ============================================================
// Presentation-only constants shared by the plan carousel and the
// current-subscription card. Nothing here invents data: every value is
// derived from the plan the API returns (order, accent, discount %).
// ============================================================

import type { PlanCode } from "@legalir/types";
import { computeDiscountPercent } from "@/lib/usage/plan-pricing";

/** Lowest → highest tier. Used to label an upgrade vs. a plain selection. */
export const PLAN_ORDER: PlanCode[] = ["silver", "gold", "diamond"];

/** Accent gradient (top bar / sale price text) per tier — brand family only:
 *  a neutral gray for the entry tier, then the LEGALIR gold and green. */
export const PLAN_GRADIENTS: Record<PlanCode, string> = {
  silver: "from-neutral-400 to-neutral-500",
  gold: "from-[var(--brand-gold)] to-[var(--brand-gold-deep)]",
  diamond: "from-[var(--brand-green)] to-[#2E8B6F]",
};

/** Soft background gradient for the highlighted (current) card. Built from
 *  solid MD3 container roles so it stays legible in dark mode — a static light
 *  palette (`from-blue-50`) would render the card near-white on a dark surface. */
export const PLAN_BG_GRADIENTS: Record<PlanCode, string> = {
  silver: "from-surface-container to-surface-container-low",
  gold: "from-secondary-container to-surface",
  diamond: "from-primary-container to-surface",
};

const FALLBACK_GRADIENT = "from-[var(--brand-green)] to-[var(--brand-teal)]";
const FALLBACK_BG = "from-surface-container to-surface";

export function planGradient(code: PlanCode): string {
  return PLAN_GRADIENTS[code] ?? FALLBACK_GRADIENT;
}

export function planBgGradient(code: PlanCode): string {
  return PLAN_BG_GRADIENTS[code] ?? FALLBACK_BG;
}

/**
 * The real discount a plan carries, as a whole percentage, computed from its
 * own list price and sale price. Returns 0 when there is no discount, so no
 * badge is shown for a full-price plan.
 */
export function planDiscountPercent(listPrice: number, salePrice: number): number {
  return computeDiscountPercent(listPrice, salePrice);
}
