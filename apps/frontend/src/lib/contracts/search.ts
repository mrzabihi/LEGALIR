// ============================================================
// LEGALIR — Persian-aware contract search
// ============================================================
// The Contracts page search must find «خودرو» when the user types
// «خودرو», «محرمانگی» when they type «محرمانگی», and «نرم افزار»
// when they type «نرم‌افزار» (or vice versa). Persian text has several
// interchangeable code points that a naive `includes()` misses:
//
//   ی (U+06CC) ↔ ي (U+064A)   Arabic yeh
//   ک (U+06A9) ↔ ك (U+0643)   Arabic kaf
//   ه (U+0647) ↔ ة (U+0629)   teh marbuta
//   نیم‌فاصله (U+200C)         zero-width non-joiner
//   اعراب / تشدید             diacritics
//   Persian ↔ Arabic digits
//
// `normalizeFa` folds all of these to one canonical form, so both the
// haystack and the needle are compared in the same space. This is the
// ONLY place that normalisation lives — the template library and the
// user-contract list both search through it.
// ============================================================

import { fromPersianDigits } from "@/lib/persian-utils";

/**
 * Fold Persian/Arabic text to a canonical, comparable form:
 *   • Arabic yeh/kaf/teh-marbuta → Persian forms
 *   • strip ZWNJ, tatweel and diacritics
 *   • collapse whitespace
 *   • Persian/Arabic digits → ASCII
 *   • lowercase (for any Latin text)
 */
export function normalizeFa(input: string): string {
  return fromPersianDigits(input)
    .replace(/[\u064A\u0649]/g, "\u06CC") // ي ى → ی
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/\u0629/g, "\u0647") // ة → ه
    // ZWNJ (نیم‌فاصله) is a *word separator* in Persian, not noise: fold
    // it to a space so «نرم‌افزار» and «نرم افزار» normalise identically.
    // The other zero-width/bidi marks carry no meaning and are dropped.
    .replace(/\u200C/g, " ")
    .replace(/[\u200B\u200D-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u064B-\u0652\u0670]/g, "") // harakat / diacritics
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A searchable contract template record. */
export interface SearchableTemplate {
  id: string;
  titleFa: string;
  descriptionFa: string;
  categoryFa: string;
  /** Extra terms that should match this template (synonyms, aliases). */
  keywords?: string[];
}

/**
 * Score a template against a query. Returns 0 when there is no match.
 * Higher is a better match:
 *   3 — title contains the query
 *   2 — a keyword contains the query
 *   1 — description or category contains the query
 */
export function scoreTemplate(template: SearchableTemplate, query: string): number {
  const q = normalizeFa(query);
  if (!q) return 0;

  const title = normalizeFa(template.titleFa);
  if (title.includes(q)) return 3;

  for (const kw of template.keywords ?? []) {
    if (normalizeFa(kw).includes(q)) return 2;
  }

  if (normalizeFa(template.descriptionFa).includes(q)) return 1;
  if (normalizeFa(template.categoryFa).includes(q)) return 1;

  return 0;
}

/**
 * Filter + rank templates by a query. An empty query returns the input
 * unchanged (so the caller keeps its curated display order).
 *
 * `toSearchable` lets a caller search a richer record (e.g. a registry
 * `ContractDefinition`, whose title field is `typeFa`) without having to
 * reshape it first — the original objects are returned, not the views.
 */
export function searchTemplates<T>(
  templates: T[],
  query: string,
  toSearchable: (template: T) => SearchableTemplate = (t) => t as SearchableTemplate
): T[] {
  const q = normalizeFa(query);
  if (!q) return templates;

  return templates
    .map((t) => ({ t, score: scoreTemplate(toSearchable(t), q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.t);
}

/** True when `haystack` contains `query` under Persian normalisation. */
export function faIncludes(haystack: string, query: string): boolean {
  const q = normalizeFa(query);
  if (!q) return true;
  return normalizeFa(haystack).includes(q);
}
