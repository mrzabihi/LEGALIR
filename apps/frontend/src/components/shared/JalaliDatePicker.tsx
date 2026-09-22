// ============================================================
// LEGALIR — Jalali (Solar Hijri) Date Picker
// ============================================================
// Self-contained Persian date picker using three labelled dropdowns
// (روز / ماه / سال) — no calendar grid.
//
// Stores/emits dates in "YYYY-MM-DD" Jalali format (e.g. 1366-12-06),
// matching the profile birthDate storage format.
//
// The selectable year range is a *prop*, not a constant: a contract
// end date must reach into the future (1405–1450), while a birth or
// marriage date must reach into the past. Callers declare which they
// need; this component never guesses.
//
// Jalali month lengths are real: فروردین–شهریور have 31 days,
// مهر–بهمن 30, and اسفند 29 or 30 on a leap year. Changing the month
// or year re-derives the valid day list and clamps the selection, so
// ۳۱ شهریور → مهر resolves to ۳۰ instead of emitting an invalid date.
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

/** Days in a given Jalali month/year. */
export function jalaliMonthLength(jy: number, jm: number): number {
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

/** Earliest year offered when the caller does not narrow the range. */
const DEFAULT_MIN_YEAR = 1300;
/** Latest year offered by default — future contract dates must reach here. */
const DEFAULT_MAX_YEAR = 1450;
/** Year the picker rests on when the field is empty. */
const DEFAULT_YEAR = 1405;

interface JalaliDatePickerProps {
  /** Current value in "YYYY-MM-DD" Jalali format, or "" */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Earliest selectable Jalali year. Default 1300. */
  minYear?: number;
  /** Latest selectable Jalali year. Default 1450. */
  maxYear?: number;
  /** Year shown when the field is empty. Default 1405 (clamped to range). */
  defaultYear?: number;
  /** Error message shown beneath the control; also turns the borders red. */
  errorMessage?: string;
  /** Show the «تاریخ انتخابشده» confirmation line. Default true. */
  showSelected?: boolean;
}

export function JalaliDatePicker({
  value,
  onChange,
  disabled = false,
  className = "",
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
  defaultYear = DEFAULT_YEAR,
  errorMessage,
  showSelected = true,
}: JalaliDatePickerProps) {
  const hasError = Boolean(errorMessage);

  // The resting year must always be inside the offered range.
  const restingYear = Math.min(Math.max(defaultYear, minYear), maxYear);

  const selected = useMemo(() => parseJalali(value), [value]);

  const [day, setDay] = useState<number>(() => selected?.jd ?? 1);
  const [month, setMonth] = useState<number>(() => selected?.jm ?? 1);
  const [year, setYear] = useState<number>(() => selected?.jy ?? restingYear);

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
    for (let y = maxYear; y >= minYear; y--) list.push(y);
    return list;
  }, [minYear, maxYear]);

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
      <div className="flex items-start gap-2">
        {/* Day */}
        <div className="w-[92px] shrink-0">
          <Select
            label="روز"
            value={String(effectiveDay)}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
            disabled={disabled}
            error={hasError}
            selectSize="small"
            fullWidth
            options={days.map((d) => ({ value: String(d), label: toPersianNumber(d) }))}
          />
        </div>

        {/* Month */}
        <div className="min-w-[112px] flex-1">
          <Select
            label="ماه"
            value={String(month)}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            disabled={disabled}
            error={hasError}
            selectSize="small"
            fullWidth
            options={JALALI_MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))}
          />
        </div>

        {/* Year */}
        <div className="w-[104px] shrink-0">
          <Select
            label="سال"
            value={String(year)}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            disabled={disabled}
            error={hasError}
            selectSize="small"
            fullWidth
            options={years.map((y) => ({ value: String(y), label: toPersianNumber(y) }))}
          />
        </div>

        <button
          type="button"
          onClick={apply}
          disabled={disabled}
          className="mt-1 shrink-0 rounded-medium border border-primary/40 px-3 py-2 text-caption text-primary transition-colors hover:bg-primary-50 touch-target disabled:opacity-50"
        >
          اعمال
        </button>
      </div>

      {errorMessage && (
        <p className="px-1 text-labelSmall text-error" role="alert">
          {errorMessage}
        </p>
      )}

      {showSelected && !errorMessage && selected && (
        <p className="px-1 text-caption text-muted">
          تاریخ انتخاب‌شده:{" "}
          <span className="font-medium text-on-surface">
            {formatJalaliLong(selected.jy, selected.jm, selected.jd)}
          </span>
        </p>
      )}
    </div>
  );
}
