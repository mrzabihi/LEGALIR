// ============================================================
// LEGALIR — Lawyer marketplace grouping (single source of truth)
// ============================================================
// The marketplace renders lawyers as category sections (a horizontal
// carousel per practice area) instead of one long vertical list. All the
// derivation lives here so the page, the carousel and the tests agree:
//
//   primarySpecialty()        → the slug a lawyer is filed under
//   groupByPrimarySpecialty() → ordered category sections
//   featuredLawyers()         → the "recommended" row
//   yearsOfExperience()       → headline experience figure
//
// Nothing here invents data: a lawyer is filed under their FIRST declared
// specialization (the order the profile author chose), and a lawyer with
// no specializations is dropped from the grouped view rather than being
// filed under a made-up category.
// ============================================================

import type { LawyerListItem } from "@legalir/types";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { specialtyLabel } from "./specialty";

/** Max years across specialties — the headline experience figure. */
export function yearsOfExperience(lawyer: LawyerListItem): number {
  return lawyer.specializations.reduce((m, s) => Math.max(m, s.yearsExperience), 0);
}

/**
 * The category a lawyer is filed under in the grouped marketplace: their
 * first declared specialization. `null` when the profile declares none.
 */
export function primarySpecialty(lawyer: LawyerListItem): string | null {
  return lawyer.specializations[0]?.category ?? null;
}

export interface LawyerCategoryGroup {
  /** Legal-category slug (or a demo-only slug such as `technology`). */
  category: string;
  /** Persian label for the section header. */
  label: string;
  lawyers: LawyerListItem[];
}

/** Canonical ordering index for a slug — unknown slugs sort last. */
function canonicalIndex(category: string): number {
  const keys = Object.keys(LEGAL_CATEGORY_FA);
  const idx = keys.indexOf(category);
  return idx === -1 ? keys.length : idx;
}

/**
 * Group lawyers into category sections, filed by primary specialty.
 *
 * Sections are ordered by size (fullest first) so the richest practice
 * areas lead the page; ties fall back to the canonical category order so
 * the layout is stable across renders. Lawyers with no specialization are
 * omitted — they still appear in the "browse all" grid.
 */
export function groupByPrimarySpecialty(lawyers: LawyerListItem[]): LawyerCategoryGroup[] {
  const groups = new Map<string, LawyerListItem[]>();

  for (const lawyer of lawyers) {
    const category = primarySpecialty(lawyer);
    if (!category) continue;
    const bucket = groups.get(category);
    if (bucket) bucket.push(lawyer);
    else groups.set(category, [lawyer]);
  }

  return Array.from(groups.entries())
    .map(([category, members]) => ({
      category,
      label: specialtyLabel(category),
      lawyers: members,
    }))
    .sort(
      (a, b) =>
        b.lawyers.length - a.lawyers.length ||
        canonicalIndex(a.category) - canonicalIndex(b.category)
    );
}

/**
 * The "recommended" row: requestable lawyers first, then by rating, then
 * by experience. Lawyers removed by LEGALIR review are never featured.
 */
export function featuredLawyers(lawyers: LawyerListItem[], limit = 8): LawyerListItem[] {
  return lawyers
    .filter((l) => l.availabilityStatus !== "REJECTED")
    .slice()
    .sort(
      (a, b) =>
        Number(b.acceptingRequests) - Number(a.acceptingRequests) ||
        (b.performance.averageRating ?? 0) - (a.performance.averageRating ?? 0) ||
        yearsOfExperience(b) - yearsOfExperience(a)
    )
    .slice(0, limit);
}
