// ============================================================
// LEGALIR — Search Normalization Layer (isometric: server + client)
// ============================================================
// The single place that turns a raw operator query (or a stored value) into a
// form that can be compared *reliably*. It exists because the same identity is
// written many ways in the wild, and a naive `String.includes` fails on all
// of them:
//
//   • Persian/Arabic letters:  ي ك  vs  ی ک   (Arabic yeh/kaf)
//   • digits:                 ۰۹۱۲  vs  ٠٩١٢  vs  0912
//   • whitespace:             "  علی   رضایی "  vs  "علی رضایی"
//   • mobile numbers:         09122842174  =  9122842174  =  +989122842174
//                             =  00989122842174  =  "0912-284-2174"
//
// Two comparison lanes, on purpose — never one blended "fuzzy" match:
//
//   1. TEXT   → `searchTextKey` / `matchesText`
//      Persian-normalized substring. Used for names, titles, emails, ids.
//      Deliberately *substring*, never edit-distance: an admin typing «رضا»
//      must find partials like «رضایی», but we never want a typo on a unique
//      id to silently return a *different* record.
//
//   2. PHONE  → `phoneSearchKey` / `matchesPhone`
//      Iranian mobile numbers are a *formatting* problem, not a typo problem.
//      Both the query and the stored value are reduced to the national
//      significant number (country/trunk prefix stripped) and then
//      substring-compared. That is what makes `09122842174` and `9122842174`
//      hit the SAME stored `+989122842174`.
//
// Nothing here writes to the database — normalization is a *read-side*
// projection only. Stored values are never rewritten.
// ============================================================

import { toWesternDigits } from "@legalir/validation";
import { normalizePersian } from "@/lib/persian-utils";

/**
 * Canonical TEXT key: Arabic↔Persian letters unified, Persian/Arabic digits →
 * ASCII, invisible/bidi marks and repeated spaces collapsed, Latin lowercased.
 * Thin, named re-export of {@link normalizePersian} so every search surface
 * has ONE obvious entry point instead of reaching for the formatter directly.
 */
export function searchTextKey(input: string | null | undefined): string {
  return normalizePersian(input ?? "");
}

/**
 * True when the (normalized) `query` is a substring of ANY of `fields`.
 * An empty query matches nothing (the caller decides what "no query" means).
 */
export function matchesText(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const q = searchTextKey(query);
  if (!q) return false;
  return fields.some((f) => f != null && searchTextKey(f).includes(q));
}

/**
 * Canonical PHONE key = the Iranian national significant number.
 *
 * Accepts every common shape and reduces them all to the same digit string:
 *   `+989122842174` · `00989122842174` · `989122842174` · `09122842174` ·
 *   `9122842174` · `۰۹۱۲۸۸۴۲۱۷۴` · `0912 284 2174` · `0912-284-2174`
 *        → `9122842174`
 *
 * Also works for PARTIAL queries (`9122`, `09122`) so a half-typed number
 * still prefix-matches. Returns `null` when there is nothing digit-like to
 * compare (so a name query never accidentally phone-matches).
 */
export function phoneSearchKey(input: string | null | undefined): string | null {
  if (!input) return null;
  // Persian/Arabic digits → ASCII, drop everything that is not a digit
  // (separators, `+`, parens, dashes — all presentation).
  let digits = toWesternDigits(String(input)).replace(/\D/g, "");
  if (!digits) return null;

  // Strip the country calling code / trunk prefix so both sides agree.
  if (digits.startsWith("0098")) {
    // international, 00-prefixed
    digits = digits.slice(4);
  } else if (digits.startsWith("98") && digits.length >= 12) {
    // bare country code, e.g. 989122842174 (only when long enough to be one)
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // national form with trunk prefix, e.g. 09122842174
    digits = digits.slice(1);
  }

  return digits || null;
}

/**
 * True when the query phone-key is a substring of the stored mobile's key.
 * Both sides go through the SAME {@link phoneSearchKey}, so a `0`-prefixed
 * query matches a stored `+98…` value and vice-versa — no one-sided coercion.
 */
export function matchesPhone(
  query: string,
  stored: string | null | undefined
): boolean {
  const q = phoneSearchKey(query);
  if (!q) return false;
  const s = phoneSearchKey(stored);
  return s != null && s.includes(q);
}

/**
 * A row predicate built from a single free-text query. The row matches when
 * the query hits EITHER lane: a phone field (normalized mobile match) or any
 * of the text fields (Persian-normalized substring). This is the shape every
 * admin list endpoint wants — `matchesRow(q, { phones, texts })` — so the
 * "search → filter" step reads identically across resources.
 */
export function matchesRow(
  query: string,
  lanes: {
    phones?: (string | null | undefined)[];
    texts?: (string | null | undefined)[];
  }
): boolean {
  const raw = query.trim();
  if (!raw) return false;

  if (lanes.phones?.some((p) => matchesPhone(raw, p))) return true;
  if (lanes.texts && matchesText(raw, ...lanes.texts)) return true;
  return false;
}
