// ============================================================
// LEGALIR — Contract template categories
// ============================================================
// The registry groups contract types by DOMAIN (املاک، خودرو، مالی،
// خدمات، کسب‌وکار) because that is how the domain model is organised.
// The Contracts page, however, offers the user three plain buckets —
// املاک / شخصی / تجاری — because that is how a person thinks about
// "what am I trying to do".
//
// This module is the single mapping between the two. The chips and the
// template grid both read it, so the two can never disagree about
// which bucket a contract belongs to.
// ============================================================

import type { ContractTypeId } from "@legalir/types";

/** The user-facing template buckets. */
export type TemplateCategory = "all" | "property" | "personal" | "business";

export interface TemplateCategoryDescriptor {
  key: TemplateCategory;
  labelFa: string;
}

/** Display order of the category chips. */
export const TEMPLATE_CATEGORIES: TemplateCategoryDescriptor[] = [
  { key: "all", labelFa: "همه" },
  { key: "property", labelFa: "املاک" },
  { key: "personal", labelFa: "شخصی" },
  { key: "business", labelFa: "تجاری" },
];

/**
 * Which bucket each contract type belongs to. Kept as an explicit map
 * (rather than derived from `domain`) so a future type can be filed
 * where the user expects it even when its domain differs.
 */
const TYPE_CATEGORY: Record<ContractTypeId, TemplateCategory> = {
  property_rent: "property",
  property_sale: "property",
  vehicle_sale: "personal",
  debt: "personal",
  freelance: "personal",
  nda: "business",
  saas: "business",
  startup: "business",
};

/** The bucket a contract type is filed under. */
export function templateCategoryFor(typeId: string): TemplateCategory {
  return TYPE_CATEGORY[typeId as ContractTypeId] ?? "personal";
}

/** True when `typeId` belongs in the selected bucket (or "all"). */
export function matchesTemplateCategory(typeId: string, category: TemplateCategory): boolean {
  return category === "all" || templateCategoryFor(typeId) === category;
}
