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

/** Accent gradient (top bar / sale price text) per tier. */
export const PLAN_GRADIENTS: Record<PlanCode, string> = {
  silver: "from-slate-400 to-gray-500",
  gold: "from-amber-400 to-yellow-500",
  diamond: "from-blue-400 to-cyan-500",
};

/** Soft background gradient for the highlighted (current) card. */
export const PLAN_BG_GRADIENTS: Record<PlanCode, string> = {
  silver: "from-slate-50 to-gray-50",
  gold: "from-amber-50 to-yellow-50",
  diamond: "from-blue-50 to-cyan-50",
};

const FALLBACK_GRADIENT = "from-primary-500 to-primary-700";
const FALLBACK_BG = "from-primary-50 to-blue-50";

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
