// ============================================================
// LEGALIR — Exact rational arithmetic for share-based calculators
// ============================================================
// Inheritance shares are exact fractions (۱/۶، ۱/۸، ۲/۳ …). Doing
// that arithmetic in floating point drifts — 1/6 + 1/6 + 2/3 does not
// equal 1 in IEEE-754, and a drifted total would leave a phantom
// remainder in the result table. Every share is therefore computed as
// an exact rational and only converted to money at the very end.
//
// Denominators stay small (2, 3, 4, 6, 8, 24 …), so plain `number`
// is safe — no BigInt needed.
//
// Pure module — no React, no I/O.

/** An exact fraction, always stored in lowest terms with `d > 0`. */
export interface Frac {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Build a fraction in lowest terms. */
export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error("Frac: zero denominator");
  let num = n;
  let den = d;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return { n: num / g, d: den / g };
}

export const ZERO: Frac = { n: 0, d: 1 };
export const ONE: Frac = { n: 1, d: 1 };

export function addFrac(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function subFrac(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mulFrac(a: Frac, b: Frac): Frac {
  return frac(a.n * b.n, a.d * b.d);
}

export function divFrac(a: Frac, b: Frac): Frac {
  if (b.n === 0) throw new Error("Frac: division by zero");
  return frac(a.n * b.d, a.d * b.n);
}

/** Scale a fraction by an integer count. */
export function scaleFrac(a: Frac, k: number): Frac {
  return frac(a.n * k, a.d);
}

export function isZeroFrac(a: Frac): boolean {
  return a.n === 0;
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compareFrac(a: Frac, b: Frac): number {
  return a.n * b.d - b.n * a.d;
}

export function fracToNumber(a: Frac): number {
  return a.n / a.d;
}

/** Sum a list of fractions. */
export function sumFrac(list: Frac[]): Frac {
  return list.reduce(addFrac, ZERO);
}
