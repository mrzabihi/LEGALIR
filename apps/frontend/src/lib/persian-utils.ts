// ============================================================
// LEGALIR — Persian Number & Date Formatting Utilities
// ============================================================

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/**
 * Convert Western Arabic numerals to Persian (e.g., 123 => ۱۲۳)
 */
export function toPersianDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[parseInt(d)] ?? d);
}

/**
 * Convert Persian/Arabic digits back to Western (e.g., ۱۲۳ => 123)
 */
export function fromPersianDigits(s: string): string {
  const map: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return s.replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
}

/**
 * The individual date/time style components `Intl.DateTimeFormat` treats as
 * mutually exclusive with `dateStyle`/`timeStyle` — supplying any of them
 * alongside `dateStyle` throws `TypeError` at construction.
 */
const DATE_TIME_COMPONENT_KEYS = [
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeZoneName",
] as const;

/**
 * Format a date as Persian/Jalali locale string.
 *
 * `dateStyle: "long"` is only applied as a DEFAULT: when the caller asks for
 * individual components (e.g. `{ month: "2-digit", day: "2-digit" }`) the
 * default is dropped, because Intl forbids `dateStyle` together with any
 * component option. Forcing both made such calls throw at runtime.
 */
export function toPersianDate(
  date: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  const resolved: Intl.DateTimeFormatOptions = { calendar: "persian", ...options };
  const usesComponents = DATE_TIME_COMPONENT_KEYS.some((k) => resolved[k] !== undefined);
  if (!usesComponents && resolved.dateStyle === undefined && resolved.timeStyle === undefined) {
    resolved.dateStyle = "long";
  }
  return new Intl.DateTimeFormat("fa-IR", resolved).format(d);
}

/**
 * Format a relative time in Persian
 */
export function toRelativeTime(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const rtf = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });
  const diff = d.getTime() - Date.now();
  const seconds = Math.round(diff / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const months = Math.round(days / 30);
  const years = Math.round(months / 12);

  if (Math.abs(years) >= 1) return rtf.format(years, "year");
  if (Math.abs(months) >= 1) return rtf.format(months, "month");
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
  if (Math.abs(minutes) >= 1) return rtf.format(minutes, "minute");
  return "همین الان";
}

/**
 * Format a number with Persian locale (e.g., separators)
 */
export function toPersianNumber(n: number): string {
  return toPersianDigits(new Intl.NumberFormat("fa-IR").format(n));
}

/**
 * Format currency in IRR (Rial) or Tomans
 */
export function toPersianCurrency(
  amount: number,
  currency: "IRR" | "IRT" = "IRT",
  compact = false
): string {
  const value = currency === "IRT" ? amount * 10 : amount;
  if (compact) {
    const formatter = Intl.NumberFormat("fa-IR", {
      notation: "compact",
      currency: "IRR",
      style: "currency",
      currencyDisplay: "narrowSymbol",
    });
    return formatter.format(value);
  }
  return `${toPersianNumber(amount)} تومان`;
}

/**
 * Normalize Persian text for search comparison.
 *
 * Collapses the orthographic variants that make naive `includes()` fail on
 * real Persian input: Arabic yeh/kaf vs Persian, Arabic-Indic digits vs
 * Persian, the zero-width non-joiner, tatweel, diacritics, and the Arabic
 * heh. Also lowercases Latin so mixed terms like `NDA` match `nda`.
 *
 * This is the single source of truth for Persian search normalization —
 * every search surface (services, library, contracts) should call it
 * rather than re-implementing its own character map.
 */
export function normalizePersian(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064A\u0649]/g, "\u06CC") // Arabic yeh / alef maksura → Persian yeh
    .replace(/\u0643/g, "\u06A9") // Arabic kaf → Persian kaf
    .replace(/\u0629/g, "\u0647") // Arabic teh marbuta → heh
    .replace(/[\u0623\u0625\u0622]/g, "\u0627") // alef variants → alef
    .replace(/[\u064B-\u0652\u0670]/g, "") // harakat / diacritics
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "") // ZWSP/ZWNJ/ZWJ/bidi marks
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Persian digits
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// Jalali (Solar Hijri) ⇄ Gregorian conversion
// ============================================================
// `Intl` can *render* Jalali dates but cannot convert a Jalali Y/M/D back into
// a Gregorian calendar date, so a date-range control cannot turn «این ماه»
// (this Jalali month) into the ISO bounds the API expects. These pure helpers
// close that gap.
//
// The conversion is the well-established arithmetic algorithm
// (the same one behind the widely-used `jalaali-js`): it is exact for the
// supported Jalali year range (roughly 1178–1633, far beyond product needs)
// and needs no timezone tables. Day arithmetic is done on Gregorian civil
// dates; the *display* timezone for turning an instant into a Jalali day is
// Asia/Tehran (see `isoToJalaliParts`).

const TEHRAN_TIMEZONE = "Asia/Tehran";

/** Truncated integer division (matches the reference algorithm's `~~`). */
function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

function imod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

/** Jalali-year boundaries where the calendar's leap pattern changes. */
const JALALI_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

interface JalaliCal {
  /** 0 = leap year, otherwise the index of the leap year in the cycle. */
  leap: number;
  /** Gregorian year that begins on this Jalali year's Farvardin 1. */
  gy: number;
  /** Gregorian day-of-March that is Farvardin 1. */
  march: number;
}

function jalaliCal(jy: number, withoutLeap: boolean): JalaliCal {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0]!;
  let jump = 0;

  if (jy < jp || jy >= JALALI_BREAKS[bl - 1]!) {
    throw new Error(`Invalid Jalali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    const jm = JALALI_BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + idiv(jump, 33) * 8 + idiv(imod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + idiv(n, 33) * 8 + idiv(imod(n, 33) + 3, 4);
  if (imod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = idiv(gy, 4) - idiv((idiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  let leap = 0;
  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + idiv(jump + 4, 33) * 33;
    leap = imod(imod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }

  return { leap, gy, march };
}

/** Gregorian (gy,gm,gd) → Julian Day Number. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d =
    idiv((gy + idiv(gm - 8, 6) + 100100) * 1461, 4) +
    idiv(153 * imod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - idiv(idiv(gy + 100100 + idiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number → Gregorian (gy,gm,gd). */
function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + idiv(idiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = idiv(imod(j, 1461), 4) * 5 + 308;
  const gd = idiv(imod(i, 153), 5) + 1;
  const gm = imod(idiv(i, 153), 12) + 1;
  const gy = idiv(j, 1461) + idiv(8 - gm, 6) - 100100;
  return { gy, gm, gd };
}

function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const r = jalaliCal(jy, true);
  return (
    gregorianToJdn(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    idiv(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

/** True when the given Jalali year is a leap year (Esfand has 30 days). */
export function isJalaliLeapYear(jy: number): boolean {
  return jalaliCal(jy, false).leap === 0;
}

/** Number of days in a Jalali month (29/30/31). */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** Jalali (jy,jm,jd) → the Gregorian date `YYYY-MM-DD`. */
export function jalaliToIsoDate(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jdnToGregorian(jalaliToJdn(jy, jm, jd));
  const mm = String(gm).padStart(2, "0");
  const dd = String(gd).padStart(2, "0");
  return `${gy}-${mm}-${dd}`;
}

/** Gregorian `YYYY-MM-DD` (or an ISO day) → Jalali parts. */
export function isoDateToJalali(isoDate: string): {
  jy: number;
  jm: number;
  jd: number;
} {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const gy = y!;
  const gm = m!;
  const gd = d!;
  const jdn = gregorianToJdn(gy, gm, gd);
  const gregorianYear = jdnToGregorian(jdn).gy;
  let jy = gregorianYear - 621;
  const r = jalaliCal(jy, false);
  const jdn1f = gregorianToJdn(gregorianYear, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + idiv(k, 31), jd: imod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + idiv(k, 30), jd: imod(k, 30) + 1 };
}

/**
 * The Tehran-local Jalali day parts of an instant (ISO string or Date).
 * Uses `Intl` to resolve the Asia/Tehran civil date first, so day boundaries
 * follow Tehran midnight — not UTC — which is what a Persian user expects.
 */
export function isoToJalaliParts(date: Date | number | string): {
  jy: number;
  jm: number;
  jd: number;
} {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const g = `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`;
  return isoDateToJalali(g);
}

/** The ISO `from`/`to` bounds (inclusive) of a whole Jalali month. */
export function jalaliMonthRangeIso(
  jy: number,
  jm: number
): { fromIso: string; toIso: string } {
  return {
    fromIso: jalaliToIsoDate(jy, jm, 1),
    toIso: jalaliToIsoDate(jy, jm, jalaliMonthLength(jy, jm)),
  };
}

/**
 * Format a file size in bytes to a human-readable Persian string.
 * Examples: 1024 => "۱ کیلوبایت", 1048576 => "۱ مگابایت"
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "۰ بایت";

  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);

  const formatted = i === 0
    ? toPersianDigits(Math.round(value))
    : toPersianDigits(parseFloat(value.toFixed(1)));

  return `${formatted} ${units[i]}`;
}
