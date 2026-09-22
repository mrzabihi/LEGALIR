// ============================================================
// LEGALIR — Inheritance (سهم‌الارث) domain types
// ============================================================
// The engine's own vocabulary, kept separate from the UI-facing
// `CalculatorField` list so the legal model can be read on its own.
//
// Governing instrument: قانون مدنی، کتاب دوم، باب دوم (در ارث)،
// مواد ۸۶۲ تا ۹۵۰.
//
// Pure module — no React, no I/O.

import type { Frac } from "../rational";

/** Which spouse, if any, survives the deceased. */
export type SpouseKind = "none" | "husband" | "wife";

/** The heir census the engine reasons over. */
export interface HeirInput {
  // ---- همسر ----
  spouse: SpouseKind;
  /** Number of surviving wives (only meaningful when `spouse === "wife"`). */
  wifeCount: number;

  // ---- طبقه اول ----
  father: boolean;
  mother: boolean;
  /** Living sons. */
  sons: number;
  /** Living daughters. */
  daughters: number;
  /**
   * Sons who predeceased the deceased. Their own children stand in
   * their place (قائم‌مقامی، ماده ۸۸۴) and take the son's share.
   */
  deceasedSons: number;
  /** Daughters who predeceased the deceased. */
  deceasedDaughters: number;
  /** Children of the predeceased sons. */
  grandsonsViaSon: number;
  granddaughtersViaSon: number;
  /** Children of the predeceased daughters. */
  grandsonsViaDaughter: number;
  granddaughtersViaDaughter: number;

  // ---- طبقه دوم ----
  paternalGrandfather: boolean;
  paternalGrandmother: boolean;
  maternalGrandfather: boolean;
  maternalGrandmother: boolean;
  brothers: number;
  sisters: number;

  // ---- طبقه سوم ----
  paternalUncles: number;
  paternalAunts: number;
  maternalUncles: number;
  maternalAunts: number;
}

/** One line of the result table. */
export interface HeirShare {
  /** Stable key for tests and React lists. */
  key: string;
  /** Display label, e.g. «پسر» / «اولاد پسر (قائم‌مقام)». */
  labelFa: string;
  /** Number of people this row covers. */
  count: number;
  /** Exact share of the whole estate. */
  fraction: Frac;
  /** Share rendered as a Persian fraction, e.g. «۱/۸». */
  fractionFa: string;
  /** Share as a percentage of the estate, for the table. */
  percentFa: string;
  /** Total amount for this row, in Rial. */
  amountRial: number;
  /** Amount per person, in Rial. */
  amountPerPersonRial: number;
  /** True for the spouse row (styled distinctly). */
  isSpouse: boolean;
}

/** The engine's full output. */
export interface InheritanceOutcome {
  /** One row per heir group, in display order. */
  shares: HeirShare[];
  /** The estate value the shares were computed against, in Rial. */
  totalRial: number;
  /** Sum of every row's `amountRial` — equals `totalRial` when supported. */
  distributedRial: number;
  /** Unallocated residue, in Rial. Zero for every supported case. */
  remainderRial: number;
  /** Which طبقه actually inherited; 0 when there is no heir at all. */
  activeClass: 1 | 2 | 3 | 0;
  /** Heir groups that were excluded, with the reason. */
  excludedFa: string[];
  /** Plain-Persian «نحوه محاسبه». */
  explanationFa: string;
  /** «مبنای قانونی» — the articles relied on. */
  legalNotesFa: string[];
  /**
   * Set when the combination is legally valid but not reliably modelled.
   * The UI shows this instead of a number.
   */
  unsupportedFa?: string;
}
