// ============================================================
// LEGALIR — Persian formatting helpers for calculator output
// ============================================================
// Calculators must never hand-roll number formatting. Everything
// funnels through here so units, separators and digits stay
// consistent across every calculator and every surface.
//
// Pure module — no React, no I/O.

import type { MoneyUnit } from "@legalir/types";
import { toPersianDigits } from "@/lib/persian-utils";
import { inUnit, type Money } from "./money";

/** Unit label in Persian. */
export const UNIT_LABEL_FA: Record<MoneyUnit, string> = {
  IRR: "ریال",
  IRT: "تومان",
};

/**
 * Format a Money value with Persian digits, thousands separators and
 * the unit label — e.g. «۱٬۲۰۰٬۰۰۰٬۰۰۰ ریال».
 */
export function formatMoney(m: Money, unit: MoneyUnit = "IRR"): string {
  const value = inUnit(m, unit);
  const grouped = new Intl.NumberFormat("fa-IR").format(value);
  return `${grouped} ${UNIT_LABEL_FA[unit]}`;
}

/** Format a plain number with Persian digits and separators. */
export function formatNumberFa(value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** Format a 0–1 ratio as a Persian percentage, e.g. «۳٪». */
export function formatPercentFa(ratio: number, maxFractionDigits = 2): string {
  const pct = ratio * 100;
  return `${new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: maxFractionDigits,
  }).format(pct)}٪`;
}

/** Format a day count, e.g. «۹۰ روز». */
export function formatDaysFa(days: number): string {
  return `${formatNumberFa(days, 1)} روز`;
}

/** Format a month count, e.g. «۱۲ ماه». */
export function formatMonthsFa(months: number): string {
  return `${formatNumberFa(months, 1)} ماه`;
}

/** Format a year count, e.g. «۳ سال». */
export function formatYearsFa(years: number): string {
  return `${formatNumberFa(years, 2)} سال`;
}

/** Format a Jalali year, e.g. «۱۴۰۴». */
export function formatYearFa(year: number): string {
  return toPersianDigits(year);
}
