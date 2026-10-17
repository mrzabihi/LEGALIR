// ============================================================
// LEGALIR — Contract colour palette (single source of truth)
// ============================================================
// The contract surfaces previously drew their colour from TWO unrelated
// places: the hand-built SVG scenes in `visuals.tsx` (which rotated the
// generic MD3 roles `--color-primary` / `--color-secondary` /
// `--color-tertiary`) and the service catalog in
// `lib/contract-services/catalog.ts` (which hard-coded a Tailwind rainbow —
// `from-blue-500 to-indigo-500`, `from-rose-500 to-pink-500`, …). Neither
// read from the LEGALIR brand palette, so a grid of cards never looked like
// one family.
//
// This module is now the ONE place a contract colour is defined. Everything
// else — the template-card scenes, the service-catalog tiles, the detail
// hero — reads from here.
//
// Two kinds of value live here, because they answer two different needs:
//
//   • `CATEGORY_GRADIENT` — a *fill* behind a white icon on a small tile.
//     Fills never flip between themes, so these are the raw brand hexes.
//
//   • `CONTRACT_ACCENT` — a *stroke/fill hue* for the illustrated scenes.
//     Line art must stay legible on BOTH the light and the dark card, so it
//     points at the theme-aware `--cv-*` custom properties registered in
//     globals.css rather than at a fixed hex.
//
// The family is deliberately narrow — the four LEGALIR brand colours plus a
// controlled navy complement — so nine cards read as one set while each
// keeps its own accent.
// ============================================================

import type { ContractTypeId } from "@legalir/types";

// ------------------------------------------------------------
// The brand family
// ------------------------------------------------------------

/** The raw LEGALIR brand hexes, plus the navy complement. */
export const BRAND_COLOURS = {
  /** سبز زغالی — the base material. */
  teal: "#222E2D",
  /** سبز برند — the live/active surface. */
  green: "#1D624E",
  /** A lifted green, one step off `green`, for adjacent cards to separate. */
  greenSoft: "#2E7A61",
  /** طلایی — the small, important accent. */
  gold: "#C69B38",
  /** A deeper, more legible gold for line art on light surfaces. */
  goldDeep: "#A37C3C",
  /** کرم روشن — the warm foreground. */
  ivory: "#FCF6E8",
  /** رنگ سرمه‌ای — the controlled complement that adds depth. */
  navy: "#26364A",
  /** A lifted navy, for adjacent cards to separate. */
  navySoft: "#3A4F6B",
} as const;

// ------------------------------------------------------------
// Category tiles — brand-family gradients
// ------------------------------------------------------------

/**
 * The gradient behind a white icon on a service-catalog tile, keyed by the
 * service taxonomy's `ContractCategoryId`.
 *
 * Every one is a two-stop drift *inside* a single brand hue, so the whole
 * catalog reads as one material. Categories stay distinguishable by their
 * icon and title — never by colour alone — which is why a shared, narrow
 * family is correct here rather than nine competing palettes.
 *
 * These are written as Tailwind arbitrary values (not interpolated hexes) so
 * the class strings stay statically analysable by the Tailwind compiler.
 */
export const CATEGORY_GRADIENT = {
  employment: "from-[#1D624E] to-[#222E2D]",
  "real-estate": "from-[#222E2D] to-[#2E7A61]",
  contracting: "from-[#A37C3C] to-[#C69B38]",
  technology: "from-[#26364A] to-[#3A4F6B]",
  finance: "from-[#C69B38] to-[#A37C3C]",
  business: "from-[#2E7A61] to-[#26364A]",
  vehicle: "from-[#3A4F6B] to-[#26364A]",
  corporate: "from-[#222E2D] to-[#26364A]",
  family: "from-[#1D624E] to-[#C69B38]",
} as const;

export type ContractCategoryKey = keyof typeof CATEGORY_GRADIENT;

/** The gradient classes for a category id, falling back to the brand pair. */
export function categoryGradient(id: string): string {
  return (
    CATEGORY_GRADIENT[id as ContractCategoryKey] ??
    "from-[#1D624E] to-[#222E2D]"
  );
}

// ------------------------------------------------------------
// Contract-type accents — theme-aware stroke hues
// ------------------------------------------------------------

/**
 * Each contract type's accent hue, as a theme-aware CSS variable reference.
 *
 * Spread across the family so no two neighbours in the template grid share a
 * hue: rent/sale/vehicle → green·teal·navy, debt → gold, freelance/nda →
 * lifted green·navy, saas → navy, startup → bright gold, employment → green.
 */
export const CONTRACT_ACCENT: Record<ContractTypeId | string, string> = {
  property_rent: "var(--cv-green)",
  property_sale: "var(--cv-teal)",
  commercial_rent: "var(--cv-teal)",
  commercial_sale: "var(--cv-gold)",
  vehicle_sale: "var(--cv-navy)",
  debt: "var(--cv-gold)",
  freelance: "var(--cv-green-soft)",
  nda: "var(--cv-navy-soft)",
  saas: "var(--cv-navy)",
  cloud_iaas: "var(--cv-navy)",
  cloud_paas: "var(--cv-teal)",
  cloud_baas: "var(--cv-green-soft)",
  startup: "var(--cv-gold-bright)",
  employment: "var(--cv-green)",
};

/** The accent for a contract type (falls back to the brand green). */
export function contractAccentToken(type: string): string {
  return CONTRACT_ACCENT[type] ?? "var(--cv-green)";
}
