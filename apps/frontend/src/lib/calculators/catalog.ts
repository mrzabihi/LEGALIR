// ============================================================
// LEGALIR — Calculators catalog (UI-facing presentation)
// ============================================================
// The catalog page is a *discovery* surface, not a raw dump of the
// registry. This module is the single source of truth for everything
// that surface needs, and it derives all of it from the real registry
// (`listCalculators`) plus a small, explicit presentation map:
//
//   • CATEGORY_PRESENTATION — title/description/icon/gradient per real
//     calculator category. Categories with no calculators never render,
//     because every consumer filters empty groups out.
//   • listCalculatorCards() — every registered calculator, mapped to a
//     flat, sortable card model (no React, no JSX in the data).
//   • QUICK_ACCESS_SLUGS / SUGGESTED_SLUGS — two *curated*, explicit
//     lists of real slugs. There is no recommendation engine in the
//     project, so rather than invent a reason we pin an ordered list of
//     existing calculators and resolve it against the registry.
//   • searchCalculators / filterCalculators — pure functions using the
//     shared `normalizePersian` so Arabic spelling and Persian digits
//     match, exactly like every other search surface in the app.
//
// Nothing here fabricates a calculator, a category or a number: an
// unknown slug, category or status simply resolves to nothing.
// ============================================================

import type { ComponentType } from "react";
import type {
  CalculatorCategory,
  CalculatorConfidence,
  CalculatorStatus,
} from "@legalir/types";
import {
  CALCULATOR_CATEGORY_FA,
  CALCULATOR_CONFIDENCE_FA,
  CALCULATOR_STATUS_FA,
  listCalculators,
} from "@/lib/calculators";
import { normalizePersian } from "@/lib/persian-utils";
import {
  IconBriefcase,
  IconCar,
  IconContract,
  IconGavel,
  IconLocation,
  IconScale,
  IconUsers,
} from "@/lib/icons";

// ============================================================
// Category presentation
// ============================================================

/** Minimal SVG icon signature — matches every `@/lib/icons` component. */
type IconComponent = ComponentType<{ size?: number; className?: string }>;

/**
 * The visual tone a category is coded with. One of the design system's
 * semantic roles, NOT an arbitrary colour: each tone maps to a soft
 * container tint + accent text + border that already exist as themeable
 * CSS variables (so dark mode is correct for free). Assigned one-per-
 * category and checked so no two adjacent sections share a tone.
 */
export type CalculatorCategoryTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export interface CalculatorCategoryMeta {
  id: CalculatorCategory;
  title: string;
  description: string;
  icon: IconComponent;
  /** Tailwind gradient for the category icon chip. */
  gradient: string;
  /** Semantic colour role that codes this category across banner + cards. */
  tone: CalculatorCategoryTone;
  /** DOM id for in-page anchors. */
  anchor: string;
}

/**
 * Display order for the category sections. Mirrors the previous catalog
 * page so nothing reorders for returning users; categories absent from
 * the registry are dropped before render.
 */
export const CATEGORY_ORDER: CalculatorCategory[] = [
  "employment",
  "property",
  "judicial",
  "family",
  "injury",
  "contracts",
  "civil",
];

/** Persian label for a category, falling back to the raw id. */
function categoryFa(category: CalculatorCategory): string {
  return CALCULATOR_CATEGORY_FA[category] ?? category;
}

/**
 * Per-category chrome. Descriptions are plain groupings of what the
 * calculators in that category actually compute — no invented claims.
 * The title comes from the shared `CALCULATOR_CATEGORY_FA` map, so the
 * label lives in exactly one place.
 */
export const CATEGORY_PRESENTATION: Record<CalculatorCategory, Omit<CalculatorCategoryMeta, "id">> = {
  employment: {
    title: categoryFa("employment"),
    description: "حقوق، مزایا، بیمه، مالیات حقوق و پایان کار",
    icon: IconBriefcase,
    gradient: "from-indigo-600 to-violet-500",
    tone: "info",
    anchor: "cat-employment",
  },
  property: {
    title: categoryFa("property"),
    description: "خرید و فروش، اجاره، دفترخانه و کمیسیون",
    icon: IconLocation,
    gradient: "from-emerald-700 to-teal-600",
    tone: "success",
    anchor: "cat-property",
  },
  judicial: {
    title: categoryFa("judicial"),
    description: "هزینه دادرسی، حق‌الوکاله، کارشناسی، داوری و اجرا",
    icon: IconGavel,
    gradient: "from-slate-700 to-slate-500",
    tone: "neutral",
    anchor: "cat-judicial",
  },
  family: {
    title: categoryFa("family"),
    description: "مهریه، نفقه، اجرت‌المثل و سهم‌الارث",
    icon: IconUsers,
    gradient: "from-pink-600 to-rose-500",
    tone: "error",
    anchor: "cat-family",
  },
  injury: {
    title: categoryFa("injury"),
    description: "دیه، ارش و خسارت تصادف",
    icon: IconCar,
    gradient: "from-warning-600 to-warning-400",
    tone: "warning",
    anchor: "cat-injury",
  },
  contracts: {
    title: categoryFa("contracts"),
    description: "وجه التزام و خسارت تأخیر در انجام تعهد",
    icon: IconContract,
    gradient: "from-secondary-600 to-secondary-400",
    tone: "secondary",
    anchor: "cat-contracts",
  },
  civil: {
    title: categoryFa("civil"),
    description: "خسارت تأخیر، مطالبات چک و ارزش ملک",
    icon: IconScale,
    gradient: "from-primary-600 to-primary-400",
    tone: "primary",
    anchor: "cat-civil",
  },
};

// ============================================================
// Card model
// ============================================================

/** A calculator, flattened for the catalog grid / rows. */
export interface CalculatorCardModel {
  slug: string;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  category: CalculatorCategory;
  categoryLabel: string;
  /** Category banner gradient — reused on the card's icon chip. */
  categoryGradient: string;
  /** The category's semantic colour role, so a card can be tinted to match
   *  its section (used for the subtle category-coloured hover accent). */
  categoryTone: CalculatorCategoryTone;
  /** Emoji icon declared on the calculator itself. */
  icon: string;
  legalBasisFa: string;
  status?: CalculatorStatus;
  statusLabel: string | null;
  confidence: CalculatorConfidence;
  confidenceLabel: string;
  available: boolean;
  /** Normalised haystack used by `searchCalculators`. */
  searchText: string;
}

/** Statuses in the order they are offered as filters. */
export const STATUS_ORDER: CalculatorStatus[] = [
  "legal_basis",
  "official_tariff",
  "estimate",
  "not_determinable",
];

function buildCard(calc: ReturnType<typeof listCalculators>[number]): CalculatorCardModel {
  const { def } = calc;
  const meta = CATEGORY_PRESENTATION[def.category];
  const categoryLabel = CALCULATOR_CATEGORY_FA[def.category] ?? def.category;

  return {
    slug: def.slug,
    href: `/calculators/${def.slug}`,
    title: def.titleFa,
    subtitle: def.subtitleFa,
    description: def.descriptionFa,
    category: def.category,
    categoryLabel,
    categoryGradient: meta?.gradient ?? "from-slate-700 to-slate-500",
    categoryTone: meta?.tone ?? "neutral",
    icon: def.icon,
    legalBasisFa: def.legalBasisFa,
    status: def.status,
    statusLabel: def.status ? (CALCULATOR_STATUS_FA[def.status] ?? null) : null,
    confidence: def.confidence,
    confidenceLabel: CALCULATOR_CONFIDENCE_FA[def.confidence] ?? def.confidence,
    available: def.available,
    // Text a user might plausibly type — name, one-line description, the
    // fuller description, the category and the governing instrument.
    searchText: normalizePersian(
      [def.titleFa, def.subtitleFa, def.descriptionFa, categoryLabel, def.legalBasisFa].join(" ")
    ),
  };
}

let cachedCards: CalculatorCardModel[] | null = null;

/**
 * Every registered calculator as a card model, sorted by CATEGORY_ORDER
 * and, within a category, by registry order (registration order is the
 * deliberate catalog order — see `lib/calculators/index.ts`).
 */
export function listCalculatorCards(): CalculatorCardModel[] {
  if (cachedCards) return cachedCards;
  const orderIndex = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));

  cachedCards = listCalculators()
    .map(buildCard)
    .sort((a, b) => {
      const ai = orderIndex.get(a.category) ?? CATEGORY_ORDER.length;
      const bi = orderIndex.get(b.category) ?? CATEGORY_ORDER.length;
      return ai - bi;
    });
  return cachedCards;
}

/** Resolve an explicit, ordered list of slugs against the registry. */
export function cardsBySlugs(slugs: readonly string[]): CalculatorCardModel[] {
  const bySlug = new Map(listCalculatorCards().map((c) => [c.slug, c]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((c): c is CalculatorCardModel => Boolean(c));
}

// ============================================================
// Curated lists (real slugs only)
// ============================================================

/**
 * The six cards on the home "دسترسی سریع" grid — one per category, so
 * the entry point samples the whole breadth of the catalog. Everything
 * else is one query away on the full list.
 */
export const QUICK_ACCESS_SLUGS = [
  "court-fee",
  "salary-benefits",
  "inheritance",
  "property-transaction-cost",
  "delayed-payment",
  "diyeh-advanced",
] as const;

/**
 * The «محاسبه‌گرهای پیشنهادی» row. These are the calculators requested
 * most often at a desk, pinned as an explicit ordered list — there is
 * no recommendation engine, so the order is a curation choice, not a
 * claim about the user.
 */
export const SUGGESTED_SLUGS = [
  "lawyer-fee",
  "court-fee",
  "diyeh",
  "salary-benefits",
  "property-transfer-tax",
  "severance",
  "real-estate-commission",
  "overtime",
] as const;

// ============================================================
// Search
// ============================================================

/**
 * Filter cards by a free-text query. Every whitespace-separated term
 * must appear somewhere in the card's normalised haystack (AND
 * semantics), so «حقوق بیمه» narrows rather than widens.
 */
export function searchCalculators(
  cards: CalculatorCardModel[],
  query: string
): CalculatorCardModel[] {
  const terms = normalizePersian(query).split(" ").filter(Boolean);
  if (terms.length === 0) return cards;
  return cards.filter((card) => terms.every((term) => card.searchText.includes(term)));
}

// ============================================================
// Filters
// ============================================================

export interface CalculatorFilter {
  /** Category id, or `"all"` / undefined for every category. */
  category?: string;
  /** Status id, or `"all"` / undefined for every status. */
  status?: string;
  /** Confidence id, or `"all"` / undefined for every confidence. */
  confidence?: string;
}

export function filterCalculators(
  cards: CalculatorCardModel[],
  filter: CalculatorFilter
): CalculatorCardModel[] {
  const { category, status, confidence } = filter;
  return cards.filter((card) => {
    if (category && category !== "all" && card.category !== category) return false;
    if (status && status !== "all" && card.status !== status) return false;
    if (confidence && confidence !== "all" && card.confidence !== confidence) return false;
    return true;
  });
}

/** Search and filters compose — the result is bounded by both. */
export function applyCalculatorQuery(
  cards: CalculatorCardModel[],
  query: string,
  filter: CalculatorFilter
): CalculatorCardModel[] {
  return filterCalculators(searchCalculators(cards, query), filter);
}

// ============================================================
// Counts + grouping
// ============================================================

export interface CategoryGroup {
  meta: CalculatorCategoryMeta;
  items: CalculatorCardModel[];
}

/** Categories that actually own calculators, in CATEGORY_ORDER. */
export function populatedCategories(cards: CalculatorCardModel[]): CalculatorCategoryMeta[] {
  const present = new Set(cards.map((c) => c.category));
  return CATEGORY_ORDER.filter((c) => present.has(c)).map((c) => ({
    id: c,
    ...CATEGORY_PRESENTATION[c],
  }));
}

/** Group cards into ordered category sections (empty groups dropped). */
export function groupCalculatorsByCategory(cards: CalculatorCardModel[]): CategoryGroup[] {
  return populatedCategories(cards).map((meta) => ({
    meta,
    items: cards.filter((c) => c.category === meta.id),
  }));
}

export function categoryCounts(cards: CalculatorCardModel[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const card of cards) out[card.category] = (out[card.category] ?? 0) + 1;
  return out;
}

/** Filter chips for categories that have at least one calculator. */
export function categoryOptions(cards: CalculatorCardModel[]): { id: string; label: string; count: number }[] {
  const counts = categoryCounts(cards);
  return populatedCategories(cards).map((meta) => ({
    id: meta.id,
    label: meta.title,
    count: counts[meta.id] ?? 0,
  }));
}

/** Filter chips for statuses that have at least one calculator. */
export function statusOptions(cards: CalculatorCardModel[]): { id: string; label: string; count: number }[] {
  return STATUS_ORDER.map((status) => ({
    id: status as string,
    label: CALCULATOR_STATUS_FA[status] ?? status,
    count: cards.filter((c) => c.status === status).length,
  })).filter((option) => option.count > 0);
}
