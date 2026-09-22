// ============================================================
// LEGALIR — Jalali (Solar Hijri) Date Picker
// Self-contained Persian date picker using three dropdowns
// (day / month / year) — no calendar grid.
// Stores/emits dates in "YYYY-MM-DD" Jalali format (e.g. 1366-12-06),
// matching the profile birthDate storage format.
// ============================================================

"use client";

import React, { useMemo, useState, useCallback } from "react";
import { toPersianNumber } from "@/lib/persian-utils";
import { Select } from "@legalir/ui";

// ---------------------------------------------------------------------------
// Jalali <-> Gregorian conversion (jalaali-js algorithm)
// ---------------------------------------------------------------------------

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

/** Today's Jalali date. */
function todayJalali(): { jy: number; jm: number; jd: number } {
  const now = new Date();
  return d2j(g2d(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}

/** Days in a given Jalali month/year. */
function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // In the jalaali-js algorithm `leap === 0` marks a leap year, so
  // Esfand has 30 days then and 29 otherwise.
  return jalCal(jy).leap === 0 ? 30 : 29;
}

/** Parse "YYYY-MM-DD" Jalali string → {jy,jm,jd} or null. */
function parseJalali(value: string): { jy: number; jm: number; jd: number } | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const jy = parseInt(m[1]!, 10);
  const jm = parseInt(m[2]!, 10);
  const jd = parseInt(m[3]!, 10);
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

/** Format a Jalali date as Persian words, e.g. "۱۳ شهریور ۱۳۶۶". */
export function formatJalaliLong(jy: number, jm: number, jd: number): string {
  return `${toPersianNumber(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianNumber(jy)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JalaliDatePickerProps {
  /** Current value in "YYYY-MM-DD" Jalali format, or "" */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const MIN_YEAR = 1300;

export function JalaliDatePicker({ value, onChange, disabled = false, className = "" }: JalaliDatePickerProps) {
  const today = useMemo(() => todayJalali(), []);
  const maxYear = today.jy; // e.g. 1405

  const selected = useMemo(() => parseJalali(value), [value]);

  const [day, setDay] = useState<number>(() => selected?.jd ?? 1);
  const [month, setMonth] = useState<number>(() => selected?.jm ?? 1);
  const [year, setYear] = useState<number>(() => selected?.jy ?? today.jy);

  // Keep local state in sync when the incoming value changes externally.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const p = parseJalali(value);
    if (p) {
      setDay(p.jd);
      setMonth(p.jm);
      setYear(p.jy);
    }
  }

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= MIN_YEAR; y--) list.push(y);
    return list;
  }, [maxYear]);

  const daysInMonth = jalaliMonthLength(year, month);
  const days = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [daysInMonth]);

  // Clamp day when month/year changes (e.g. 31 → 30/29).
  const effectiveDay = Math.min(day, daysInMonth);

  const apply = useCallback(() => {
    const next = `${year}-${String(month).padStart(2, "0")}-${String(effectiveDay).padStart(2, "0")}`;
    onChange(next);
  }, [year, month, effectiveDay, onChange]);

  return (
    <div className={`flex flex-col gap-2 ${className}`} dir="rtl">
      <div className="flex items-center gap-1.5">
        {/* Day */}
        <div className="w-[68px]">
          <Select
            value={String(effectiveDay)}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
            disabled={disabled}
            aria-label="روز"
            selectSize="small"
            fullWidth
            options={days.map((d) => ({ value: String(d), label: toPersianNumber(d) }))}
          />
        </div>

        {/* Month */}
        <div className="flex-1 min-w-[96px]">
          <Select
            value={String(month)}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            disabled={disabled}
            aria-label="ماه"
            selectSize="small"
            fullWidth
            options={JALALI_MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))}
          />
        </div>

        {/* Year */}
        <div className="w-[84px]">
          <Select
            value={String(year)}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            disabled={disabled}
            aria-label="سال"
            selectSize="small"
            fullWidth
            options={years.map((y) => ({ value: String(y), label: toPersianNumber(y) }))}
          />
        </div>

        <button
          type="button"
          onClick={apply}
          disabled={disabled}
          className="text-caption text-primary hover:bg-primary-50 rounded-lg px-2.5 py-1.5 border border-primary/40 transition-colors touch-target disabled:opacity-50"
        >
          اعمال
        </button>
      </div>

      {selected && (
        <p className="text-caption text-muted">
          تاریخ انتخاب‌شده: <span className="text-on-surface font-medium">{formatJalaliLong(selected.jy, selected.jm, selected.jd)}</span>
        </p>
      )}
    </div>
  );
}
