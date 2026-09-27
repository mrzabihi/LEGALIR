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
 * Format a date as Persian/Jalali locale string
 */
export function toPersianDate(
  date: Date | number | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    dateStyle: "long",
    ...options,
  }).format(d);
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
