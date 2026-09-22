// ============================================================
// LEGALIR — Inheritance engine (موتور محاسبه سهم‌الارث)
// ============================================================
// Deterministic, exact, and article-backed. No LLM, no network, no
// clock: the same heir census always yields the same shares.
//
// Governing instrument: قانون مدنی، باب دوم (در ارث)، مواد ۸۶۲–۹۵۰.
//
// SCOPE — what this engine models with confidence:
//   • طبقه اول: پدر، مادر، اولاد، و اولاد اولاد به‌عنوان قائم‌مقام
//   • زوج و زوجه در همه ترکیب‌ها (مواد ۹۴۶ و ۹۴۷)
//   • طبقه دوم: برادر و خواهر (ماده ۹۲۳)
//   • طبقه سوم: تنها یک وارث (ماده ۹۳۶)
//
// Anything outside that set returns `unsupportedFa` rather than a
// guessed number. Inheritance law has genuinely contested corners
// (اجداد، رد در حضور مادر، ترکیب عمو/دایی) and a wrong share is worse
// than an honest «نیازمند بررسی تخصصی».
//
// Pure module — no React, no I/O.

import {
  frac,
  addFrac,
  subFrac,
  mulFrac,
  divFrac,
  ZERO,
  ONE,
  isZeroFrac,
  type Frac,
} from "../rational";
import { formatPercentFa } from "../format";
import { toPersianDigits } from "@/lib/persian-utils";
import { citeArticles, INSTRUMENT_FA, REVIEWED_AT } from "./sources";
import type { HeirInput, HeirShare, InheritanceOutcome } from "./types";

/** Shown whenever a combination is valid but not reliably modelled. */
export const UNSUPPORTED_FA =
  "این ترکیب وراث در نسخه فعلی نیازمند بررسی تخصصی است.";

// ============================================================
// Internal model
// ============================================================

/** One person (or one representative slot) inside a child unit. */
interface Person {
  key: string;
  labelFa: string;
  /** 2 for a male line, 1 for a female line. */
  weight: number;
}

/**
 * A child "slot". A living child is a slot with one person; a
 * predeceased child is a slot whose own children stand in for them
 * (قائم‌مقامی، ماده ۸۸۴) and divide the slot's share among themselves.
 */
interface Unit {
  line: "son" | "daughter";
  /** 2 for a son-line slot, 1 for a daughter-line slot. */
  weight: number;
  persons: Person[];
}

/** A computed share before money is attached. */
interface Allocation {
  key: string;
  labelFa: string;
  count: number;
  fraction: Frac;
  isSpouse: boolean;
}

// ============================================================
// Helpers
// ============================================================

/** Render a fraction as a Persian «n/d» string. */
function fractionFa(f: Frac): string {
  return `${toPersianDigits(f.n)}/${toPersianDigits(f.d)}`;
}

/** Persian words for the fractions that actually occur. */
const FRACTION_WORDS: Record<string, string> = {
  "1/1": "تمام ترکه",
  "1/2": "نصف",
  "1/3": "یک‌سوم",
  "2/3": "دو‌سوم",
  "1/4": "یک‌چهارم",
  "1/6": "یک‌ششم",
  "1/8": "یک‌هشتم",
  "5/24": "پنج‌بیست‌وچهارم",
  "15/24": "پانزده‌بیست‌وچهارم",
};

function fractionWords(f: Frac): string {
  return FRACTION_WORDS[`${f.n}/${f.d}`] ?? fractionFa(f);
}

/**
 * Split `totalRial` across `fractions` so the parts sum EXACTLY to the
 * total. Floors first, then the leftover Rial go to the largest
 * fractional remainders (largest-remainder method).
 */
function allocate(totalRial: number, fractions: Frac[]): number[] {
  const exact = fractions.map((f) => (totalRial * f.n) / f.d);
  const out = exact.map((v) => Math.floor(v));
  let leftover = totalRial - out.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);

  let k = 0;
  while (leftover > 0 && order.length > 0) {
    const target = order[k % order.length]!.i;
    out[target] = (out[target] ?? 0) + 1;
    leftover -= 1;
    k += 1;
  }
  return out;
}

/** Merge allocations that share a key (e.g. two sons → one row). */
function aggregate(allocs: Allocation[]): Allocation[] {
  const map = new Map<string, Allocation>();
  for (const a of allocs) {
    const existing = map.get(a.key);
    if (existing) {
      existing.fraction = addFrac(existing.fraction, a.fraction);
      existing.count += a.count;
    } else {
      map.set(a.key, { ...a });
    }
  }
  return Array.from(map.values());
}

// ============================================================
// Child units (اولاد و اولاد اولاد)
// ============================================================

function buildUnits(h: HeirInput): Unit[] {
  const units: Unit[] = [];

  for (let i = 0; i < h.sons; i++) {
    units.push({
      line: "son",
      weight: 2,
      persons: [{ key: "son", labelFa: "پسر", weight: 2 }],
    });
  }
  for (let i = 0; i < h.daughters; i++) {
    units.push({
      line: "daughter",
      weight: 1,
      persons: [{ key: "daughter", labelFa: "دختر", weight: 1 }],
    });
  }

  // Predeceased sons: their children occupy the son-slots they left.
  const viaSon = h.grandsonsViaSon + h.granddaughtersViaSon;
  if (h.deceasedSons > 0 && viaSon > 0) {
    const persons: Person[] = [];
    for (let i = 0; i < h.grandsonsViaSon; i++) {
      persons.push({ key: "grandson_via_son", labelFa: "نوه پسر (از پسر)", weight: 2 });
    }
    for (let i = 0; i < h.granddaughtersViaSon; i++) {
      persons.push({ key: "granddaughter_via_son", labelFa: "نوه دختر (از پسر)", weight: 1 });
    }
    units.push({ line: "son", weight: 2 * h.deceasedSons, persons });
  }

  // Predeceased daughters: same, on the daughter-line.
  const viaDaughter = h.grandsonsViaDaughter + h.granddaughtersViaDaughter;
  if (h.deceasedDaughters > 0 && viaDaughter > 0) {
    const persons: Person[] = [];
    for (let i = 0; i < h.grandsonsViaDaughter; i++) {
      persons.push({ key: "grandson_via_daughter", labelFa: "نوه پسر (از دختر)", weight: 2 });
    }
    for (let i = 0; i < h.granddaughtersViaDaughter; i++) {
      persons.push({ key: "granddaughter_via_daughter", labelFa: "نوه دختر (از دختر)", weight: 1 });
    }
    units.push({ line: "daughter", weight: 1 * h.deceasedDaughters, persons });
  }

  return units;
}

/** Split `pool` across the child units, then within each unit. */
function distributeChildren(pool: Frac, units: Unit[]): Allocation[] {
  const totalUnitWeight = units.reduce((s, u) => s + u.weight, 0);
  if (totalUnitWeight === 0) return [];

  const out: Allocation[] = [];
  for (const unit of units) {
    const unitShare = mulFrac(pool, frac(unit.weight, totalUnitWeight));
    const totalPersonWeight = unit.persons.reduce((s, p) => s + p.weight, 0);
    if (totalPersonWeight === 0) continue;
    for (const person of unit.persons) {
      out.push({
        key: person.key,
        labelFa: person.labelFa,
        count: 1,
        fraction: mulFrac(unitShare, frac(person.weight, totalPersonWeight)),
        isSpouse: false,
      });
    }
  }
  return out;
}

// ============================================================
// Class 1 (طبقه اول)
// ============================================================

interface ClassResult {
  allocs: Allocation[];
  unsupported?: string;
  notes: string[];
}

function distributeClass1(
  h: HeirInput,
  units: Unit[],
  bloodPool: Frac
): ClassResult {
  const allocs: Allocation[] = [];
  const notes: string[] = [];
  const hasChildren = units.length > 0;

  // ---- No children: parents only (ماده ۹۰۶) ----
  if (!hasChildren) {
    if (h.father && h.mother) {
      allocs.push({
        key: "mother",
        labelFa: "مادر",
        count: 1,
        fraction: mulFrac(bloodPool, frac(1, 3)),
        isSpouse: false,
      });
      allocs.push({
        key: "father",
        labelFa: "پدر",
        count: 1,
        fraction: mulFrac(bloodPool, frac(2, 3)),
        isSpouse: false,
      });
      notes.push("a906");
    } else if (h.father) {
      allocs.push({ key: "father", labelFa: "پدر", count: 1, fraction: bloodPool, isSpouse: false });
    } else if (h.mother) {
      allocs.push({ key: "mother", labelFa: "مادر", count: 1, fraction: bloodPool, isSpouse: false });
    }
    return { allocs, notes };
  }

  // ---- Children present ----
  // Parents take their fixed فرض; the mother is reduced to ۱/۶ by the
  // existence of descendants (حجب از سهم، ماده ۹۱۰).
  const motherFrac = h.mother ? mulFrac(bloodPool, frac(1, 6)) : ZERO;
  const fatherFrac = h.father ? mulFrac(bloodPool, frac(1, 6)) : ZERO;
  if (h.mother) notes.push("a910");

  const childrenPool = subFrac(subFrac(bloodPool, motherFrac), fatherFrac);

  const hasSonLine = units.some((u) => u.line === "son");
  const daughterLines = units.filter((u) => u.line === "daughter").length;

  // The parents' fixed فرض is pushed once, at the end — except in the
  // ماده ۹۰۷ branch, which allocates the father's augmented share itself.
  let parentsPushed = false;

  if (hasSonLine) {
    // A son-line exists, so the children take the residue (مواد ۸۸۷ و ۸۸۸).
    notes.push("a887");
    allocs.push(...distributeChildren(childrenPool, units));
  } else {
    // Only daughter-lines: the daughters take a fixed فرض (ماده ۸۸۶).
    notes.push("a886");
    const fard = daughterLines === 1 ? frac(1, 2) : frac(2, 3);
    const daughtersFard = mulFrac(bloodPool, fard);
    const surplus = subFrac(childrenPool, daughtersFard);

    if (isZeroFrac(surplus)) {
      allocs.push(...distributeChildren(daughtersFard, units));
    } else if (!h.father && !h.mother) {
      // No other heir: the surplus returns to the daughters (ماده ۹۱۴).
      notes.push("a914");
      allocs.push(...distributeChildren(childrenPool, units));
    } else if (h.father && h.mother) {
      // ماده ۹۰۷: surplus split between father and daughter by فرض ratio.
      notes.push("a907");
      const fatherW = frac(1, 6);
      const totalW = addFrac(fatherW, fard);
      const fatherExtra = mulFrac(surplus, divFrac(fatherW, totalW));
      const daughterExtra = mulFrac(surplus, divFrac(fard, totalW));
      allocs.push({
        key: "father",
        labelFa: "پدر",
        count: 1,
        fraction: addFrac(fatherFrac, fatherExtra),
        isSpouse: false,
      });
      allocs.push({
        key: "mother",
        labelFa: "مادر",
        count: 1,
        fraction: motherFrac,
        isSpouse: false,
      });
      allocs.push(...distributeChildren(addFrac(daughtersFard, daughterExtra), units));
      parentsPushed = true;
    } else {
      // Only one parent present alongside only daughters — the رد rule
      // here is genuinely contested. Do not guess.
      return { allocs: [], unsupported: UNSUPPORTED_FA, notes };
    }
  }

  if (!parentsPushed) {
    if (h.mother) {
      allocs.push({ key: "mother", labelFa: "مادر", count: 1, fraction: motherFrac, isSpouse: false });
    }
    if (h.father) {
      allocs.push({ key: "father", labelFa: "پدر", count: 1, fraction: fatherFrac, isSpouse: false });
    }
  }

  return { allocs, notes };
}

// ============================================================
// Class 2 (طبقه دوم) — siblings only
// ============================================================

function distributeClass2(h: HeirInput, bloodPool: Frac): ClassResult {
  const allocs: Allocation[] = [];
  const notes: string[] = [];

  const hasGrandparents =
    h.paternalGrandfather || h.paternalGrandmother ||
    h.maternalGrandfather || h.maternalGrandmother;

  if (hasGrandparents) {
    // The اجداد rules (مواد ۹۲۱–۹۲۵) are intricate and not modelled.
    return { allocs: [], unsupported: UNSUPPORTED_FA, notes };
  }

  const total = h.brothers + h.sisters;
  if (total === 0) return { allocs: [], unsupported: UNSUPPORTED_FA, notes };

  notes.push("a923");
  const totalWeight = h.brothers * 2 + h.sisters * 1;
  if (h.brothers > 0) {
    allocs.push({
      key: "brother",
      labelFa: "برادر",
      count: h.brothers,
      fraction: mulFrac(bloodPool, frac(h.brothers * 2, totalWeight)),
      isSpouse: false,
    });
  }
  if (h.sisters > 0) {
    allocs.push({
      key: "sister",
      labelFa: "خواهر",
      count: h.sisters,
      fraction: mulFrac(bloodPool, frac(h.sisters * 1, totalWeight)),
      isSpouse: false,
    });
  }
  return { allocs, notes };
}

// ============================================================
// Class 3 (طبقه سوم) — a single uncle/aunt only
// ============================================================

function distributeClass3(h: HeirInput, bloodPool: Frac): ClassResult {
  const notes: string[] = ["a936"];
  const total =
    h.paternalUncles + h.paternalAunts + h.maternalUncles + h.maternalAunts;

  if (total !== 1) {
    // Mixed عمو/عمه/دایی/خاله shares are not reliably modelled.
    return { allocs: [], unsupported: UNSUPPORTED_FA, notes };
  }

  const label =
    h.paternalUncles === 1 ? "عمو" :
    h.paternalAunts === 1 ? "عمه" :
    h.maternalUncles === 1 ? "دایی" : "خاله";

  return {
    allocs: [{ key: "class3", labelFa: label, count: 1, fraction: bloodPool, isSpouse: false }],
    notes,
  };
}

// ============================================================
// Public entry point
// ============================================================

export function computeInheritance(
  h: HeirInput,
  estateRial: number
): InheritanceOutcome {
  const units = buildUnits(h);
  const hasDescendants = units.length > 0;

  // ---- Spouse (مواد ۹۴۶ و ۹۴۷) ----
  let spouseFrac = ZERO;
  const spouseNotes: string[] = [];
  if (h.spouse === "husband") {
    spouseFrac = hasDescendants ? frac(1, 4) : frac(1, 2);
    spouseNotes.push("a946");
  } else if (h.spouse === "wife") {
    spouseFrac = hasDescendants ? frac(1, 8) : frac(1, 4);
    spouseNotes.push("a947");
  }

  const bloodPool = subFrac(ONE, spouseFrac);

  // ---- Which طبقه inherits (مواد ۸۶۲ و ۸۶۳) ----
  const hasClass1 = h.father || h.mother || hasDescendants;
  const hasClass2 =
    h.paternalGrandfather || h.paternalGrandmother ||
    h.maternalGrandfather || h.maternalGrandmother ||
    h.brothers > 0 || h.sisters > 0;
  const hasClass3 =
    h.paternalUncles + h.paternalAunts + h.maternalUncles + h.maternalAunts > 0;

  const activeClass: 1 | 2 | 3 | 0 = hasClass1 ? 1 : hasClass2 ? 2 : hasClass3 ? 3 : 0;

  const excludedFa: string[] = [];
  if (activeClass === 1) {
    if (hasClass2) excludedFa.push("وراث طبقه دوم به سبب وجود وارث طبقه اول محجوب‌اند (ماده ۸۶۳).");
    if (hasClass3) excludedFa.push("وراث طبقه سوم به سبب وجود وارث طبقه اول محجوب‌اند (ماده ۸۶۳).");
  } else if (activeClass === 2) {
    if (hasClass3) excludedFa.push("وراث طبقه سوم به سبب وجود وارث طبقه دوم محجوب‌اند (ماده ۸۶۳).");
  }

  // ---- No blood heir at all ----
  if (activeClass === 0) {
    if (h.spouse === "none") {
      return {
        shares: [],
        totalRial: estateRial,
        distributedRial: 0,
        remainderRial: estateRial,
        activeClass: 0,
        excludedFa,
        explanationFa: "هیچ وارثی ثبت نشده است.",
        legalNotesFa: citeArticles(["a862"]),
        unsupportedFa: "هیچ وارثی برای تقسیم ترکه ثبت نشده است.",
      };
    }
    // Spouse alone takes the whole estate (ماده ۹۱۶).
    const allocs: Allocation[] = [
      {
        key: "spouse",
        labelFa: h.spouse === "husband" ? "زوج" : "زوجه",
        count: h.spouse === "wife" ? Math.max(1, h.wifeCount) : 1,
        fraction: ONE,
        isSpouse: true,
      },
    ];
    return finalize(
      allocs,
      estateRial,
      0,
      excludedFa,
      ["a916"],
      "تنها وارث، همسر متوفی است و تمام ترکه به او می‌رسد (ماده ۹۱۶)."
    );
  }

  // ---- Distribute the blood pool ----
  const result =
    activeClass === 1 ? distributeClass1(h, units, bloodPool)
    : activeClass === 2 ? distributeClass2(h, bloodPool)
    : distributeClass3(h, bloodPool);

  if (result.unsupported) {
    return {
      shares: [],
      totalRial: estateRial,
      distributedRial: 0,
      remainderRial: estateRial,
      activeClass,
      excludedFa,
      explanationFa: "",
      legalNotesFa: citeArticles(["a862", "a863"]),
      unsupportedFa: result.unsupported,
    };
  }

  const allocs: Allocation[] = [];
  if (h.spouse !== "none") {
    allocs.push({
      key: "spouse",
      labelFa: h.spouse === "husband" ? "زوج" : "زوجه",
      count: h.spouse === "wife" ? Math.max(1, h.wifeCount) : 1,
      fraction: spouseFrac,
      isSpouse: true,
    });
  }
  allocs.push(...result.allocs);

  const explanation = buildExplanation(h, activeClass, spouseFrac, result.allocs, excludedFa);
  const notes = [...spouseNotes, ...result.notes];

  return finalize(allocs, estateRial, activeClass, excludedFa, notes, explanation);
}

// ============================================================
// Assembly
// ============================================================

function finalize(
  rawAllocs: Allocation[],
  estateRial: number,
  activeClass: 1 | 2 | 3 | 0,
  excludedFa: string[],
  noteKeys: string[],
  explanationFa: string
): InheritanceOutcome {
  const allocs = aggregate(rawAllocs);
  const amounts = allocate(estateRial, allocs.map((a) => a.fraction));

  const shares: HeirShare[] = allocs.map((a, i) => {
    const amountRial = amounts[i] ?? 0;
    return {
      key: a.key,
      labelFa: a.labelFa,
      count: a.count,
      fraction: a.fraction,
      fractionFa: fractionFa(a.fraction),
      percentFa: formatPercentFa(a.fraction.n / a.fraction.d),
      amountRial,
      amountPerPersonRial: a.count > 0 ? Math.floor(amountRial / a.count) : amountRial,
      isSpouse: a.isSpouse,
    };
  });

  const distributedRial = shares.reduce((s, x) => s + x.amountRial, 0);

  return {
    shares,
    totalRial: estateRial,
    distributedRial,
    remainderRial: estateRial - distributedRial,
    activeClass,
    excludedFa,
    explanationFa,
    legalNotesFa: citeArticles(noteKeys),
  };
}

/** Compose the plain-Persian «نحوه محاسبه» narrative. */
function buildExplanation(
  h: HeirInput,
  activeClass: 1 | 2 | 3,
  spouseFrac: Frac,
  bloodAllocs: Allocation[],
  excludedFa: string[]
): string {
  const parts: string[] = [];

  parts.push(
    activeClass === 1
      ? "وارث طبقه اول (پدر، مادر، اولاد و اولاد اولاد) ارث می‌برند."
      : activeClass === 2
        ? "چون وارثی از طبقه اول وجود ندارد، وارث طبقه دوم (برادر و خواهر) ارث می‌برند."
        : "چون وارثی از طبقات اول و دوم وجود ندارد، وارث طبقه سوم ارث می‌برد."
  );

  if (!isZeroFrac(spouseFrac)) {
    const label = h.spouse === "husband" ? "زوج" : "زوجه";
    const hasKids =
      h.sons + h.daughters + h.deceasedSons + h.deceasedDaughters > 0;
    parts.push(
      `${label} به سبب ${hasKids ? "وجود اولاد" : "نبودن اولاد"}، ${fractionWords(spouseFrac)} ترکه را می‌برد.`
    );
  }

  for (const a of bloodAllocs) {
    parts.push(
      `${a.labelFa}${a.count > 1 ? ` (${toPersianDigits(a.count)} نفر)` : ""}: ${fractionWords(a.fraction)}.`
    );
  }

  if (excludedFa.length > 0) parts.push(excludedFa.join(" "));

  return parts.join(" ");
}

/** The instrument + review date, for the provenance block. */
export const INHERITANCE_SOURCE = {
  instrumentFa: INSTRUMENT_FA,
  reviewedAt: REVIEWED_AT,
};
