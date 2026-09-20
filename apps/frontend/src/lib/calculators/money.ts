// ============================================================
// LEGALIR — Money abstraction for legal calculators
// ============================================================
// All arithmetic happens in Rial (IRR), the base unit. Toman is a
// display/entry convenience only (1 Toman = 10 Rial). Keeping one
// canonical unit prevents the classic 10× error when a rate table
// is quoted in Rial but the user types Toman.
//
// Pure module — no React, no I/O. Safe on server and client.

import type { MoneyUnit } from "@legalir/types";

/** Rial per Toman. */
export const RIAL_PER_TOMAN = 10;

/** A monetary amount, always stored in Rial internally. */
export interface Money {
  /** Amount in Rial (IRR). Integer. */
  rial: number;
}

/** Construct Money from a value expressed in the given unit. */
export function money(value: number, unit: MoneyUnit = "IRR"): Money {
  const rial = unit === "IRT" ? value * RIAL_PER_TOMAN : value;
  return { rial: Math.round(rial) };
}

/** Read a Money value in the requested unit (rounded to the nearest integer). */
export function inUnit(m: Money, unit: MoneyUnit = "IRR"): number {
  return unit === "IRT" ? Math.round(m.rial / RIAL_PER_TOMAN) : m.rial;
}

/** Add two Money values. */
export function addMoney(a: Money, b: Money): Money {
  return { rial: a.rial + b.rial };
}

/** Subtract b from a. */
export function subMoney(a: Money, b: Money): Money {
  return { rial: a.rial - b.rial };
}

/** Multiply Money by a scalar, rounding to the nearest Rial. */
export function scaleMoney(m: Money, factor: number): Money {
  return { rial: Math.round(m.rial * factor) };
}

/** Clamp Money to a [min, max] Rial range. */
export function clampMoney(m: Money, minRial: number, maxRial: number): Money {
  return { rial: Math.min(Math.max(m.rial, minRial), maxRial) };
}

/** Compare two Money values. */
export function compareMoney(a: Money, b: Money): number {
  return a.rial - b.rial;
}

/** True when the amount is zero or negative. */
export function isNonPositive(m: Money): boolean {
  return m.rial <= 0;
}

/**
 * Round a Rial amount to the nearest multiple of `step` Rial.
 * Iranian judicial fees are conventionally rounded to the nearest
 * 1,000 Rial (100 Toman).
 */
export function roundTo(m: Money, stepRial: number): Money {
  if (stepRial <= 0) return m;
  return { rial: Math.round(m.rial / stepRial) * stepRial };
}
