// ============================================================
// LEGALIR — Persian number formatting (single source of truth)
// ============================================================
// Pure, framework-free helpers shared by every numeric field in the
// design system. Nothing here touches React or the DOM, so it is
// safe on the server, in tests and in the browser.
//
// Two concerns live here and nowhere else:
//   1. digit normalisation + grouping  (parse / format)
//   2. number → Persian words          (money helper lines)
//
// The canonical Persian thousands separator is U+066C (٬), which is
// what `Intl.NumberFormat("fa-IR")` emits — so fields formatted here
// match every other Persian number already rendered in the app.
// ============================================================

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** The Persian thousands separator (U+066C). */
export const THOUSANDS_SEPARATOR = "\u066C";

/** Any digit in any of the three scripts the app accepts. */
const ANY_DIGIT = /[0-9۰-۹٠-٩]/;

/** Convert every Persian/Arabic-Indic digit in `input` to ASCII. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** Convert ASCII digits in `input` to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/**
 * Parse a user-typed numeric string into a plain number.
 *
 * Accepts Persian/Arabic-Indic digits and any of the separators a
 * user might paste or type — `,` `٬` `٫` `،` and spaces. Returns
 * `null` when the string holds no parseable number, so callers can
 * distinguish "empty" from "invalid".
 *
 * `.` is ambiguous: it is both the European thousands separator
 * («۵۰۰.۰۰۰.۰۰۰») and the decimal point. By default it is treated as
 * a thousands separator, which is what money and count fields need.
 * Pass `{ decimal: true }` for fields that accept fractions — the
 * last `.` then becomes the decimal point and any earlier ones are
 * treated as grouping.
 */
export function parseFormattedNumber(
  input: string,
  opts?: { decimal?: boolean }
): number | null {
  let s = normalizeDigits(input).replace(/[,\u066C\u066B\u060C\s]/g, "");

  if (opts?.decimal) {
    const lastDot = s.lastIndexOf(".");
    if (lastDot !== -1) {
      s =
        s.slice(0, lastDot).replace(/\./g, "") +
        "." +
        s.slice(lastDot + 1).replace(/\./g, "");
    }
  } else {
    s = s.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Group the integer part of a number with thousands separators.
 * The fractional part (if any) is left untouched.
 */
export function groupDigits(
  value: number | string,
  separator: string = THOUSANDS_SEPARATOR
): string {
  const [intPart = "", fracPart] = String(value).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
}

/**
 * Format an amount for display: Persian digits + thousands grouping.
 * `formatPersianAmount(3_000_000)` → «۳٬۰۰۰٬۰۰۰».
 */
export function formatPersianAmount(
  value: number,
  separator: string = THOUSANDS_SEPARATOR
): string {
  return toPersianDigits(groupDigits(value, separator));
}

// ------------------------------------------------------------
// Number → Persian words
// ------------------------------------------------------------

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = [
  "ده", "یازده", "دوازده", "سیزده", "چهارده",
  "پانزده", "شانزده", "هفده", "هجده", "نوزده",
];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = [
  "", "صد", "دویست", "سیصد", "چهارصد",
  "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد",
];
/** Scale words, indexed by group position (0 = units). */
const SCALES = ["", " هزار", " میلیون", " میلیارد", " بیلیون", " بیلیارد"];

/** Words for a 0–999 group. */
function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) parts.push(HUNDREDS[hundreds] ?? "");

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10] ?? "");
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens > 0) parts.push(TENS[tens] ?? "");
    if (ones > 0) parts.push(ONES[ones] ?? "");
  }

  return parts.join(" و ");
}

/**
 * Spell a non-negative integer in Persian words.
 *
 * `numberToPersianWords(3_000_000)` → «سه میلیون»
 * `numberToPersianWords(12_500_000)` → «دوازده میلیون و پانصد هزار»
 */
export function numberToPersianWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i] ?? 0;
    if (group === 0) continue;
    parts.push(threeDigitsToWords(group) + (SCALES[i] ?? ""));
  }

  return parts.join(" و ");
}

/**
 * Spell a monetary amount with its unit label, e.g.
 * «سه میلیون تومان». Returns "" for a zero/absent amount so callers
 * can suppress the meaningless «صفر تومان» line.
 */
export function formatMoneyWords(value: number | null | undefined, unitLabel: string): string {
  if (value === null || value === undefined || value === 0) return "";
  return `${numberToPersianWords(value)} ${unitLabel}`;
}

// ------------------------------------------------------------
// Caret helpers — keep the cursor stable while formatting
// ------------------------------------------------------------

/** True when `char` is a digit in any accepted script. */
export function isDigitChar(char: string): boolean {
  return ANY_DIGIT.test(char);
}

/**
 * Count the digits in `text` that appear before `caret`.
 * Used to remember the logical cursor position across a reformat.
 */
export function digitsBefore(text: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < caret && i < text.length; i++) {
    if (isDigitChar(text[i] ?? "")) count++;
  }
  return count;
}

/**
 * The string index that sits just after the `digitIndex`-th digit.
 * The inverse of `digitsBefore` — used to restore the caret after the
 * value has been re-grouped.
 */
export function caretAfterDigit(text: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (isDigitChar(text[i] ?? "")) {
      seen++;
      if (seen === digitIndex) return i + 1;
    }
  }
  return text.length;
}
