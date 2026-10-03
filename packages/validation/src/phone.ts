// ============================================================
// LEGALIR — Iranian mobile number normalization
// ============================================================
// Single source of truth for turning any common Iranian mobile
// format into one canonical E.164 identity:  +989123456789
//
// Every surface that accepts a mobile number — web forms, API route
// handlers and the JSON store — funnels through this module, so a
// number typed as 09123456789, 9123456789, +989123456789,
// 00989123456789, 989123456789, ۰۹۱۲۳۴۵۶۷۸۹, ٠٩١٢٣٤٥٦٧٨٩,
// "0912 345 6789", "0912-345-6789" or "+98 (912) 345 6789" all
// resolve to the same account.
//
// Invalid input is rejected — we never strip letters or truncate
// digits to force a value through.
// ============================================================

import { z } from "zod";

/** Iran's country calling code. */
export const IRAN_DIAL_CODE = "+98";

/** Shared, user-facing validation message (Persian). */
export const MOBILE_ERROR_MESSAGE =
  "شماره موبایل معتبر وارد کنید؛ مانند 09123456789";

/** National significant number: exactly 10 digits, starting with 9. */
const IRAN_NATIONAL_RE = /^9\d{9}$/;

/** Canonical E.164 form of an Iranian mobile. */
const IRAN_E164_RE = /^\+989\d{9}$/;

/** Persian (U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digits. */
const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Zero-width, bidi-control and BOM characters that must not survive. */
const INVISIBLE_RE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Separators a user may legitimately type between digit groups. */
const SEPARATOR_RE = /[\s\-().\u00A0\u2010-\u2015]/g;

/**
 * Convert Persian/Arabic-Indic digits to ASCII and drop invisible
 * characters. Does not remove separators and does not validate.
 */
export function toWesternDigits(input: string): string {
  return input
    .replace(INVISIBLE_RE, "")
    .replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] ?? d);
}

/**
 * Normalize any supported Iranian mobile format to canonical E.164.
 *
 * Order of operations:
 *   1. Persian/Arabic digits → ASCII, drop invisible characters
 *   2. trim, then remove allowed separators (space, dash, dot, parens)
 *   3. reject anything that is not an optional single '+' followed by digits
 *   4. detect national vs international and strip the correct prefix
 *   5. validate the 10-digit national part (must start with 9)
 *   6. emit `+989123456789`
 *
 * @returns canonical E.164 string, or `null` when the input is not a
 *          valid Iranian mobile number.
 */
export function normalizeIranMobile(raw: string): string | null {
  if (typeof raw !== "string") return null;

  // 1 + 2 — digits to ASCII, drop invisibles, trim, drop separators.
  const compact = toWesternDigits(raw).trim().replace(SEPARATOR_RE, "");
  if (!compact) return null;

  // 3 — only an optional leading '+' plus digits may remain. Letters,
  //     a second '+', or stray symbols make the input invalid.
  if (!/^\+?\d+$/.test(compact)) return null;

  // 4 — strip the correct prefix.
  let national: string;
  if (compact.startsWith("+")) {
    if (!compact.startsWith(IRAN_DIAL_CODE)) return null;
    national = compact.slice(IRAN_DIAL_CODE.length);
  } else if (compact.startsWith("0098")) {
    national = compact.slice(4);
  } else if (compact.startsWith("98") && compact.length === 12) {
    // bare country code without '+', e.g. 989123456789
    national = compact.slice(2);
  } else if (compact.startsWith("0")) {
    // national form with trunk prefix, e.g. 09123456789
    national = compact.slice(1);
  } else {
    // national form without trunk prefix, e.g. 9123456789
    national = compact;
  }

  // 5 — validate the national significant number.
  if (!IRAN_NATIONAL_RE.test(national)) return null;

  // 6 — canonical E.164.
  return `${IRAN_DIAL_CODE}${national}`;
}

/** True when `raw` is a valid Iranian mobile in any accepted format. */
export function isValidIranMobile(raw: string): boolean {
  return normalizeIranMobile(raw) !== null;
}

/**
 * Canonical E.164 → national display form (`+989123456789` → `09123456789`).
 * Non-canonical input is returned unchanged.
 */
export function toNationalMobile(mobile: string): string {
  return IRAN_E164_RE.test(mobile)
    ? `0${mobile.slice(IRAN_DIAL_CODE.length)}`
    : mobile;
}

/**
 * Canonical E.164 → Persian-digit national display (`۰۹۱۲۳۴۵۶۷۸۹`).
 * Non-canonical input is returned unchanged.
 */
export function toPersianMobileDisplay(mobile: string): string {
  return toNationalMobile(mobile).replace(
    /\d/g,
    (d) => PERSIAN_DIGITS[Number(d)] ?? d
  );
}

/**
 * Mask a mobile for logs and reports: first four and last four digits,
 * everything between replaced with `***`. Accepts any format.
 */
export function maskMobile(mobile: string): string {
  const digits = toWesternDigits(mobile).replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

/**
 * Zod schema that accepts any supported Iranian mobile format and
 * transforms it to canonical E.164.
 */
export const iranMobileSchema = z
  .string()
  .min(1, MOBILE_ERROR_MESSAGE)
  .transform((value, ctx) => {
    const normalized = normalizeIranMobile(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MOBILE_ERROR_MESSAGE,
      });
      return z.NEVER;
    }
    return normalized;
  });
