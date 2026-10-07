// ============================================================
// LEGALIR — Category tone class map
// ============================================================
// The single place that turns a category's semantic tone into concrete
// Tailwind classes. Every class here resolves to a themeable design
// token (the semantic container / on-container / outline roles that
// already exist in globals.css for light AND dark), so no category ever
// hard-codes a hex and dark mode is correct without extra work.
//
// The surfaces a tone drives:
//   • banner — the soft, tinted section header panel
//   • iconBg — the solid tone fill behind the category glyph
//   • cardHoverBorder / cardIconTint — the quiet accent a card takes on
//     hover so it reads as belonging to its section, without ever
//     competing with the calculator name.

import type { CalculatorCategoryTone } from "@/lib/calculators/catalog";

export interface ToneClasses {
  /** Tinted section-header panel. */
  banner: string;
  /** Solid tone fill for the icon chip (used with a white glyph). */
  iconBg: string;
  /** Card hover: tone-matched border + icon-chip tint. */
  cardHoverBorder: string;
  cardIconTint: string;
}

export const TONE_CLASSES: Record<CalculatorCategoryTone, ToneClasses> = {
  primary: {
    banner: "border-primary-200 bg-primary-50",
    iconBg: "bg-gradient-to-br from-primary-600 to-primary-400",
    cardHoverBorder: "hover:border-primary-300",
    cardIconTint: "group-hover:bg-primary-100",
  },
  secondary: {
    banner: "border-secondary-200 bg-secondary-50",
    iconBg: "bg-gradient-to-br from-secondary-600 to-secondary-400",
    cardHoverBorder: "hover:border-secondary-300",
    cardIconTint: "group-hover:bg-secondary-100",
  },
  success: {
    banner: "border-success-200 bg-success-50",
    iconBg: "bg-gradient-to-br from-emerald-700 to-teal-600",
    cardHoverBorder: "hover:border-success-300",
    cardIconTint: "group-hover:bg-success-100",
  },
  warning: {
    banner: "border-warning-200 bg-warning-50",
    iconBg: "bg-gradient-to-br from-warning-600 to-warning-400",
    cardHoverBorder: "hover:border-warning-300",
    cardIconTint: "group-hover:bg-warning-100",
  },
  error: {
    banner: "border-error-200 bg-error-50",
    iconBg: "bg-gradient-to-br from-pink-600 to-rose-500",
    cardHoverBorder: "hover:border-error-300",
    cardIconTint: "group-hover:bg-error-100",
  },
  info: {
    banner: "border-info-200 bg-info-50",
    iconBg: "bg-gradient-to-br from-indigo-600 to-violet-500",
    cardHoverBorder: "hover:border-info-300",
    cardIconTint: "group-hover:bg-info-100",
  },
  neutral: {
    banner: "border-outline-variant bg-surface-container-low",
    iconBg: "bg-gradient-to-br from-slate-700 to-slate-500",
    cardHoverBorder: "hover:border-primary-300",
    cardIconTint: "group-hover:bg-surface-container",
  },
};

export function toneClasses(tone: CalculatorCategoryTone | undefined): ToneClasses {
  return TONE_CLASSES[tone ?? "neutral"];
}
