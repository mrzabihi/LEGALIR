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
//   • cardHoverBorder — the quiet accent a card takes on hover so it
//     reads as belonging to its section, without ever competing with the
//     calculator name
//
// The category's icon-chip gradient is deliberately NOT here: it is a
// property of the category, not of its tone, so it lives once in
// `CATEGORY_PRESENTATION` and is consumed by both the banner and the
// card. One source, so the two can never drift.

import type { CalculatorCategoryTone } from "@/lib/calculators/catalog";

export interface ToneClasses {
  /** Tinted section-header panel. */
  banner: string;
  /** Card hover: tone-matched border. */
  cardHoverBorder: string;
}

export const TONE_CLASSES: Record<CalculatorCategoryTone, ToneClasses> = {
  primary: {
    banner: "border-primary-200 bg-primary-50",
    cardHoverBorder: "hover:border-primary-300",
  },
  secondary: {
    banner: "border-secondary-200 bg-secondary-50",
    cardHoverBorder: "hover:border-secondary-300",
  },
  success: {
    banner: "border-success-200 bg-success-50",
    cardHoverBorder: "hover:border-success-300",
  },
  warning: {
    banner: "border-warning-200 bg-warning-50",
    cardHoverBorder: "hover:border-warning-300",
  },
  error: {
    banner: "border-error-200 bg-error-50",
    cardHoverBorder: "hover:border-error-300",
  },
  info: {
    banner: "border-info-200 bg-info-50",
    cardHoverBorder: "hover:border-info-300",
  },
  neutral: {
    banner: "border-outline-variant bg-surface-container-low",
    cardHoverBorder: "hover:border-primary-300",
  },
};

export function toneClasses(tone: CalculatorCategoryTone | undefined): ToneClasses {
  return TONE_CLASSES[tone ?? "neutral"];
}
