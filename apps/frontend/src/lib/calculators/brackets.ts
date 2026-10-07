// ============================================================
// LEGALIR — Cumulative ad-valorem bracket arithmetic
// ============================================================
// Iranian judicial and tax tariffs are almost always expressed as a
// *cumulative* schedule: each slice of the base amount is charged at
// its own rate, and the slices are summed. This module owns that one
// piece of arithmetic so every tariff calculator (court fee, lawyer
// fee, expert fee, arbitration, notary, transfer tax) shares a single,
// testable implementation instead of re-deriving it.
//
// Pure module — no React, no I/O.

/** One cumulative bracket. `upToRial: null` marks the open-ended top. */
export interface Bracket {
  upToRial: number | null;
  rate: number;
}

/** One charged slice, for display in a breakdown. */
export interface BracketSlice {
  /** The rate applied to this slice. */
  rate: number;
  /** The portion of the base amount that fell in this bracket (Rial). */
  sliceRial: number;
  /** The fee charged on this slice (Rial, unrounded). */
  feeRial: number;
}

export interface BracketBreakdown {
  /** Total fee across all brackets (Rial, unrounded). */
  totalRial: number;
  /** Per-bracket slices, in schedule order, omitting empty brackets. */
  slices: BracketSlice[];
}

/**
 * Apply a cumulative ad-valorem schedule to a base amount.
 *
 * Each bracket covers the range `(previous upper, this upper]`; the
 * portion of `baseRial` inside that range is charged at the bracket's
 * rate. A `null` upper bound is open-ended. Brackets must be declared
 * in ascending order.
 */
export function applyBrackets(baseRial: number, brackets: Bracket[]): BracketBreakdown {
  const slices: BracketSlice[] = [];
  let remaining = Math.max(0, baseRial);
  let lowerBound = 0;
  let totalRial = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const upper = bracket.upToRial ?? Infinity;
    const sliceRial = Math.min(remaining, upper - lowerBound);
    if (sliceRial > 0) {
      const feeRial = sliceRial * bracket.rate;
      totalRial += feeRial;
      slices.push({ rate: bracket.rate, sliceRial, feeRial });
      remaining -= sliceRial;
    }
    lowerBound = upper;
  }

  return { totalRial, slices };
}
