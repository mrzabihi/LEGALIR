// ============================================================
// LEGALIR — Contract date utilities (Jalali ⇄ ISO)
// ============================================================
// The contract data layer stores every date as an ISO Gregorian
// string ("YYYY-MM-DD") so it is sortable and machine-readable.
// The UI shows Jalali. This module is the ONLY place that converts
// between the two for contracts — components must not re-implement
// the jalaali algorithm.
//
// The conversion core is the same jalaali-js algorithm used by
// `components/shared/JalaliDatePicker.tsx`; it is duplicated here in
// a pure, dependency-free form so server code can import it without
// pulling in a React component.
// ============================================================

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    return { jy, jm: 7 + div(k - 186, 30), jd: mod(k - 186, 30) + 1 };
  }
  jy -= 1;
  k += 179;
  if (r.leap === 1) k += 1;
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Days in a given Jalali month/year. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // In the jalaali-js algorithm `leap === 0` marks a leap year, so
  // Esfand has 30 days then and 29 otherwise.
  return jalCal(jy).leap === 0 ? 30 : 29;
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/** Today's Jalali date parts. */
export function todayJalali(): JalaliParts {
  const now = new Date();
  return d2j(g2d(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}

/** Today as an ISO Gregorian date string ("YYYY-MM-DD"). */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Convert a Date to an ISO "YYYY-MM-DD" string (local, not UTC-shifted). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse an ISO "YYYY-MM-DD" string into a Date, or null. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  // `new Date` rolls invalid days over (2026-02-30 → 2026-03-02), so
  // confirm the constructed date still matches the input.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** ISO Gregorian "YYYY-MM-DD" → Jalali parts, or null. */
export function isoToJalali(iso: string | null | undefined): JalaliParts | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

/** Jalali parts → ISO Gregorian "YYYY-MM-DD". */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = d2g(j2d(jy, jm, jd));
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

/** Parse a "YYYY-MM-DD" Jalali string → parts, or null. */
export function parseJalaliString(value: string | null | undefined): JalaliParts | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const jy = parseInt(m[1]!, 10);
  const jm = parseInt(m[2]!, 10);
  const jd = parseInt(m[3]!, 10);
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

/** ISO Gregorian → "YYYY-MM-DD" Jalali string (for the date picker), or "". */
export function isoToJalaliString(iso: string | null | undefined): string {
  const parts = isoToJalali(iso);
  if (!parts) return "";
  return `${parts.jy}-${String(parts.jm).padStart(2, "0")}-${String(parts.jd).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" Jalali string → ISO Gregorian, or null. */
export function jalaliStringToIso(value: string | null | undefined): string | null {
  const parts = parseJalaliString(value);
  if (!parts) return null;
  return jalaliToIso(parts.jy, parts.jm, parts.jd);
}

/** Format Jalali parts as Persian words, e.g. «۱۳ شهریور ۱۴۰۵». */
export function formatJalaliParts(parts: JalaliParts): string {
  return `${toFa(parts.jd)} ${JALALI_MONTHS[parts.jm - 1]} ${toFa(parts.jy)}`;
}

/** Format an ISO date as a long Persian Jalali string, or "—". */
export function formatIsoJalali(iso: string | null | undefined): string {
  const parts = isoToJalali(iso);
  return parts ? formatJalaliParts(parts) : "—";
}

/** Format an ISO date as a short Persian Jalali string, e.g. «۱۴۰۵/۰۶/۱۳». */
export function formatIsoJalaliShort(iso: string | null | undefined): string {
  const parts = isoToJalali(iso);
  if (!parts) return "—";
  return `${toFa(parts.jy)}/${toFa(String(parts.jm).padStart(2, "0"))}/${toFa(String(parts.jd).padStart(2, "0"))}`;
}

/** Whole months between two ISO dates (start → end), or null. */
export function monthsBetween(startIso: string | null, endIso: string | null): number | null {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return months < 0 ? null : months;
}

/** Add whole months to an ISO date, clamping the day to the target month. */
export function addMonthsIso(iso: string, months: number): string | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

/** True when `iso` is a valid ISO date string. */
export function isValidIsoDate(iso: string | null | undefined): boolean {
  return parseIsoDate(iso) !== null;
}

// Local Persian-digit helper (avoids importing the UI util into server code).
function toFa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}
