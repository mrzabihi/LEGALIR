// ============================================================
// LEGALIR — Canonical money model
// ============================================================
// The single place where rial/toman conversion happens. Every other
// module stores and passes `Money` (integer rial); only the UI layer
// calls `formatToman` / `toToman`.
//
//   1 toman = 10 rial
//
// Never write `/ 10` or `* 10` anywhere else.
// ============================================================

import type { Money } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";

/** Rial per toman. */
export const RIAL_PER_TOMAN = 10;

/** Build a Money value from an integer rial amount. */
export function rial(amount: number): Money {
  return { amount: Math.round(amount), currency: "IRR" };
}

/** Build a Money value from a toman amount (converts to rial). */
export function toman(amount: number): Money {
  return { amount: Math.round(amount * RIAL_PER_TOMAN), currency: "IRR" };
}

/** The integer toman value of a Money amount. */
export function toToman(money: Money | null | undefined): number {
  if (!money) return 0;
  return Math.round(money.amount / RIAL_PER_TOMAN);
}

/** The integer rial value of a Money amount. */
export function toRial(money: Money | null | undefined): number {
  return money?.amount ?? 0;
}

/** True when the amount is zero or absent. */
export function isZeroMoney(money: Money | null | undefined): boolean {
  return !money || money.amount === 0;
}

/**
 * Format a Money amount as a Persian toman string with grouping,
 * e.g. «۱,۰۰۰,۰۰۰,۰۰۰ تومان».
 */
export function formatToman(money: Money | null | undefined): string {
  if (!money) return "—";
  return `${toPersianNumber(toToman(money))} تومان`;
}

/**
 * Format a Money amount as a compact Persian toman string,
 * e.g. «۱ میلیارد تومان» / «۲۵ میلیون تومان».
 */
export function formatTomanCompact(money: Money | null | undefined): string {
  if (!money) return "—";
  const t = toToman(money);
  if (t === 0) return "۰ تومان";
  const abs = Math.abs(t);
  if (abs >= 1_000_000_000) {
    const v = t / 1_000_000_000;
    return `${toPersianNumber(Number(v.toFixed(v % 1 === 0 ? 0 : 2)))} میلیارد تومان`;
  }
  if (abs >= 1_000_000) {
    const v = t / 1_000_000;
    return `${toPersianNumber(Number(v.toFixed(v % 1 === 0 ? 0 : 1)))} میلیون تومان`;
  }
  if (abs >= 1_000) {
    const v = t / 1_000;
    return `${toPersianNumber(Number(v.toFixed(v % 1 === 0 ? 0 : 1)))} هزار تومان`;
  }
  return `${toPersianNumber(t)} تومان`;
}

/**
 * Parse a user-entered toman string (Persian or Latin digits, with
 * separators) into a Money value. Returns null when unparseable.
 */
export function parseTomanInput(input: string): Money | null {
  const normalized = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,\s٫،]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return toman(n);
}

/** Sum a list of Money amounts. */
export function sumMoney(items: (Money | null | undefined)[]): Money {
  return rial(items.reduce((acc, m) => acc + toRial(m), 0));
}

/** True when two Money amounts are equal. */
export function moneyEquals(a: Money | null | undefined, b: Money | null | undefined): boolean {
  return toRial(a) === toRial(b);
}
