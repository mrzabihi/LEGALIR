// ============================================================
// LEGALIR — Specialty presentation map (single source of truth)
// ============================================================
// Two things are derived from a specialty slug, and both live here so no
// card ever hard-codes them:
//
//   specialtyIcon()  → the large, subtle watermark glyph behind a card
//   specialtyLabel() → the Persian chip label
//
// Labels fall back to LEGAL_CATEGORY_FA (the canonical category labels in
// @legalir/types) and then to a small set of extra slugs used by demo
// profiles that are not LegalCategory values (technology, brand, …).
// ============================================================

import type { ComponentType, SVGProps } from "react";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import {
  IconUsers,
  IconHome,
  IconContract,
  IconBusiness,
  IconCalculator,
  IconGavel,
  IconShield,
  IconCode,
  IconTrademark,
  IconBriefcase,
  IconCar,
  IconScale,
  IconLawBook,
} from "@/lib/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/**
 * Primary glyph per legal category. Every slug in LEGAL_CATEGORY_FA has an
 * entry so a watermark is always available; `other` is the fallback.
 */
const SPECIALTY_ICON: Record<string, IconComponent> = {
  family: IconUsers,
  contract: IconContract,
  real_estate: IconHome,
  labor: IconBriefcase,
  commerce: IconBriefcase,
  criminal: IconGavel,
  tax: IconCalculator,
  companies: IconBusiness,
  checks: IconLawBook,
  immigration: IconCar,
  cyber: IconShield,
  other: IconScale,
};

/** Extra slugs used by demo profiles that are not LegalCategory values. */
const EXTRA_ICON: Record<string, IconComponent> = {
  technology: IconCode,
  software: IconCode,
  saas: IconCode,
  brand: IconTrademark,
  trademark: IconTrademark,
  digital: IconCode,
  property: IconHome,
  business: IconBusiness,
  contracts: IconContract,
};

/** Persian labels for the extra (non-category) specialty slugs. */
const EXTRA_LABEL: Record<string, string> = {
  technology: "فناوری",
  software: "قراردادهای نرم‌افزاری",
  saas: "SaaS",
  brand: "ثبت برند",
  trademark: "ثبت برند",
  digital: "حقوق دیجیتال",
  property: "املاک",
  business: "کسب‌وکار",
  contracts: "قراردادها",
};

/**
 * Resolve the watermark glyph for a specialty slug. Falls back to the
 * generic scale-of-justice icon so a card never renders without one.
 */
export function specialtyIcon(category: string | null | undefined): IconComponent {
  if (!category) return IconScale;
  return SPECIALTY_ICON[category] ?? EXTRA_ICON[category] ?? IconScale;
}

/** Resolve the Persian label for a specialty slug. */
export function specialtyLabel(category: string): string {
  return LEGAL_CATEGORY_FA[category] ?? EXTRA_LABEL[category] ?? category;
}
