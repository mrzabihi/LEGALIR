import { describe, it, expect } from "vitest";
import { computeInheritance, UNSUPPORTED_FA } from "@/lib/calculators/inheritance/engine";
import type { HeirInput } from "@/lib/calculators/inheritance/types";
import { inheritanceCalculator } from "@/lib/calculators/calculators/inheritance";

// ============================================================
// Inheritance engine — deterministic, article-backed shares
// ============================================================
// Every case below is a hand-computed expectation from the Civil
// Code's فرض / حجب / رد rules. The engine must reproduce them
// exactly, and must refuse (not guess) the contested combinations.

/** Build a full heir census from a partial one. */
function heirs(partial: Partial<HeirInput> = {}): HeirInput {
  return {
    spouse: "none",
    wifeCount: 1,
    father: false,
    mother: false,
    sons: 0,
    daughters: 0,
    deceasedSons: 0,
    deceasedDaughters: 0,
    grandsonsViaSon: 0,
    granddaughtersViaSon: 0,
    grandsonsViaDaughter: 0,
    granddaughtersViaDaughter: 0,
    paternalGrandfather: false,
    paternalGrandmother: false,
    maternalGrandfather: false,
    maternalGrandmother: false,
    brothers: 0,
    sisters: 0,
    paternalUncles: 0,
    paternalAunts: 0,
    maternalUncles: 0,
    maternalAunts: 0,
    ...partial,
  };
}

/** Look up one share row by key. */
function share(outcome: ReturnType<typeof computeInheritance>, key: string) {
  const s = outcome.shares.find((x) => x.key === key);
  if (!s) throw new Error(`no share row for ${key}`);
  return s;
}

const ESTATE = 600_000_000; // Rial

describe("inheritance — spouse", () => {
  it("husband alone takes the whole estate (ماده ۹۱۶)", () => {
    const o = computeInheritance(heirs({ spouse: "husband" }), ESTATE);
    expect(o.shares).toHaveLength(1);
    expect(share(o, "spouse").fractionFa).toBe("۱/۱");
    expect(o.distributedRial).toBe(ESTATE);
    expect(o.remainderRial).toBe(0);
  });

  it("wife alone takes the whole estate (ماده ۹۱۶)", () => {
    const o = computeInheritance(heirs({ spouse: "wife" }), ESTATE);
    expect(share(o, "spouse").fractionFa).toBe("۱/۱");
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("husband with descendants takes ۱/۴ (ماده ۹۴۶)", () => {
    const o = computeInheritance(heirs({ spouse: "husband", sons: 1 }), ESTATE);
    expect(share(o, "spouse").fractionFa).toBe("۱/۴");
    expect(share(o, "son").fractionFa).toBe("۳/۴");
  });

  it("husband without descendants takes ۱/۲ (ماده ۹۴۶)", () => {
    const o = computeInheritance(
      heirs({ spouse: "husband", father: true, mother: true }),
      ESTATE
    );
    expect(share(o, "spouse").fractionFa).toBe("۱/۲");
  });

  it("wife with descendants takes ۱/۸ (ماده ۹۴۷)", () => {
    const o = computeInheritance(heirs({ spouse: "wife", sons: 1 }), ESTATE);
    expect(share(o, "spouse").fractionFa).toBe("۱/۸");
    expect(share(o, "son").fractionFa).toBe("۷/۸");
  });

  it("wife without descendants takes ۱/۴ (ماده ۹۴۷)", () => {
    const o = computeInheritance(
      heirs({ spouse: "wife", father: true, mother: true }),
      ESTATE
    );
    expect(share(o, "spouse").fractionFa).toBe("۱/۴");
  });

  it("splits the wife's share equally among co-wives (ماده ۹۴۷)", () => {
    const o = computeInheritance(
      heirs({ spouse: "wife", wifeCount: 2, sons: 2 }),
      ESTATE
    );
    const spouse = share(o, "spouse");
    expect(spouse.count).toBe(2);
    expect(spouse.fractionFa).toBe("۱/۸");
    expect(spouse.amountRial).toBe(75_000_000);
    expect(spouse.amountPerPersonRial).toBe(37_500_000);
  });
});

describe("inheritance — class 1: parents", () => {
  it("father and mother only: mother ۱/۳, father ۲/۳ (ماده ۹۰۶)", () => {
    const o = computeInheritance(heirs({ father: true, mother: true }), ESTATE);
    expect(share(o, "mother").fractionFa).toBe("۱/۳");
    expect(share(o, "father").fractionFa).toBe("۲/۳");
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("father alone takes the whole estate", () => {
    const o = computeInheritance(heirs({ father: true }), ESTATE);
    expect(share(o, "father").fractionFa).toBe("۱/۱");
  });

  it("mother alone takes the whole estate", () => {
    const o = computeInheritance(heirs({ mother: true }), ESTATE);
    expect(share(o, "mother").fractionFa).toBe("۱/۱");
  });

  it("mother is reduced to ۱/۶ by descendants (ماده ۹۱۰)", () => {
    const o = computeInheritance(
      heirs({ father: true, mother: true, sons: 1 }),
      ESTATE
    );
    expect(share(o, "mother").fractionFa).toBe("۱/۶");
    expect(share(o, "father").fractionFa).toBe("۱/۶");
    expect(share(o, "son").fractionFa).toBe("۲/۳");
  });
});

describe("inheritance — class 1: children", () => {
  it("one son takes the residue", () => {
    const o = computeInheritance(heirs({ sons: 1 }), ESTATE);
    expect(share(o, "son").fractionFa).toBe("۱/۱");
  });

  it("sons split equally (ماده ۸۸۸)", () => {
    const o = computeInheritance(heirs({ sons: 3 }), ESTATE);
    const s = share(o, "son");
    expect(s.count).toBe(3);
    expect(s.fractionFa).toBe("۱/۱");
    expect(s.amountPerPersonRial).toBe(200_000_000);
  });

  it("son takes double a daughter (ماده ۸۸۷)", () => {
    const o = computeInheritance(heirs({ sons: 1, daughters: 1 }), ESTATE);
    expect(share(o, "son").fractionFa).toBe("۲/۳");
    expect(share(o, "daughter").fractionFa).toBe("۱/۳");
  });

  it("two sons and one daughter split ۲:۲:۱", () => {
    const o = computeInheritance(heirs({ sons: 2, daughters: 1 }), ESTATE);
    expect(share(o, "son").fractionFa).toBe("۴/۵");
    expect(share(o, "daughter").fractionFa).toBe("۱/۵");
    expect(share(o, "son").amountPerPersonRial).toBe(240_000_000);
  });

  it("one daughter alone takes ۱/۲ then the residue by رد (مواد ۸۸۶ و ۹۱۴)", () => {
    const o = computeInheritance(heirs({ daughters: 1 }), ESTATE);
    expect(share(o, "daughter").fractionFa).toBe("۱/۱");
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("two daughters alone take ۲/۳ then the residue by رد (مواد ۸۸۶ و ۹۱۴)", () => {
    const o = computeInheritance(heirs({ daughters: 2 }), ESTATE);
    expect(share(o, "daughter").fractionFa).toBe("۱/۱");
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("father, mother and one daughter: surplus split by فرض ratio (ماده ۹۰۷)", () => {
    const o = computeInheritance(
      heirs({ father: true, mother: true, daughters: 1 }),
      ESTATE
    );
    expect(share(o, "mother").fractionFa).toBe("۱/۶");
    expect(share(o, "father").fractionFa).toBe("۵/۲۴");
    expect(share(o, "daughter").fractionFa).toBe("۵/۸"); // = ۱۵/۲۴
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("father, mother and two daughters: daughters take ۲/۳", () => {
    const o = computeInheritance(
      heirs({ father: true, mother: true, daughters: 2 }),
      ESTATE
    );
    expect(share(o, "mother").fractionFa).toBe("۱/۶");
    expect(share(o, "father").fractionFa).toBe("۱/۶");
    expect(share(o, "daughter").fractionFa).toBe("۲/۳");
    expect(o.distributedRial).toBe(ESTATE);
  });
});

describe("inheritance — representation (قائم‌مقامی، ماده ۸۸۴)", () => {
  it("grandsons stand in for a predeceased son", () => {
    const o = computeInheritance(
      heirs({ deceasedSons: 1, grandsonsViaSon: 2 }),
      ESTATE
    );
    const g = share(o, "grandson_via_son");
    expect(g.count).toBe(2);
    expect(g.fractionFa).toBe("۱/۱");
    expect(g.amountPerPersonRial).toBe(300_000_000);
  });

  it("grandsons and granddaughters via a son split ۲:۱", () => {
    const o = computeInheritance(
      heirs({ deceasedSons: 1, grandsonsViaSon: 1, granddaughtersViaSon: 1 }),
      ESTATE
    );
    expect(share(o, "grandson_via_son").fractionFa).toBe("۲/۳");
    expect(share(o, "granddaughter_via_son").fractionFa).toBe("۱/۳");
  });

  it("a living son does not displace a predeceased son's children", () => {
    // Both a living son and a predeceased son's children are present:
    // the living son is one slot, the grandchildren occupy the other.
    const o = computeInheritance(
      heirs({ sons: 1, deceasedSons: 1, grandsonsViaSon: 1 }),
      ESTATE
    );
    expect(share(o, "son").fractionFa).toBe("۱/۲");
    expect(share(o, "grandson_via_son").fractionFa).toBe("۱/۲");
  });
});

describe("inheritance — class 2: siblings (ماده ۹۲۳)", () => {
  it("brothers take double sisters", () => {
    const o = computeInheritance(heirs({ brothers: 2, sisters: 1 }), ESTATE);
    expect(share(o, "brother").fractionFa).toBe("۴/۵");
    expect(share(o, "sister").fractionFa).toBe("۱/۵");
    expect(o.distributedRial).toBe(ESTATE);
  });

  it("brothers alone split equally", () => {
    const o = computeInheritance(heirs({ brothers: 2 }), ESTATE);
    expect(share(o, "brother").fractionFa).toBe("۱/۱");
    expect(share(o, "brother").amountPerPersonRial).toBe(300_000_000);
  });

  it("sisters alone split equally", () => {
    const o = computeInheritance(heirs({ sisters: 3 }), ESTATE);
    expect(share(o, "sister").fractionFa).toBe("۱/۱");
  });

  it("class 2 is excluded while a class-1 heir exists (ماده ۸۶۳)", () => {
    const o = computeInheritance(heirs({ sons: 1, brothers: 2 }), ESTATE);
    expect(o.activeClass).toBe(1);
    expect(o.shares.find((s) => s.key === "brother")).toBeUndefined();
    expect(o.excludedFa.join(" ")).toContain("طبقه دوم");
  });
});

describe("inheritance — class 3: uncles and aunts (ماده ۹۳۶)", () => {
  it("a single paternal uncle takes the whole estate", () => {
    const o = computeInheritance(heirs({ paternalUncles: 1 }), ESTATE);
    expect(o.activeClass).toBe(3);
    expect(share(o, "class3").fractionFa).toBe("۱/۱");
  });

  it("a single maternal aunt takes the whole estate", () => {
    const o = computeInheritance(heirs({ maternalAunts: 1 }), ESTATE);
    expect(share(o, "class3").labelFa).toBe("خاله");
    expect(share(o, "class3").fractionFa).toBe("۱/۱");
  });
});

describe("inheritance — unsupported combinations (no guessing)", () => {
  it("returns the honest message when no heir is recorded", () => {
    const o = computeInheritance(heirs(), ESTATE);
    expect(o.unsupportedFa).toBeTruthy();
    expect(o.shares).toHaveLength(0);
  });

  it("refuses grandparents (اجداد rules not modelled)", () => {
    const o = computeInheritance(heirs({ paternalGrandfather: true }), ESTATE);
    expect(o.unsupportedFa).toBe(UNSUPPORTED_FA);
  });

  it("refuses mixed uncles and aunts", () => {
    const o = computeInheritance(
      heirs({ paternalUncles: 1, maternalUncles: 1 }),
      ESTATE
    );
    expect(o.unsupportedFa).toBe(UNSUPPORTED_FA);
  });

  it("refuses a single parent alongside only daughters (contested رد)", () => {
    const o = computeInheritance(heirs({ father: true, daughters: 1 }), ESTATE);
    expect(o.unsupportedFa).toBe(UNSUPPORTED_FA);
  });

  it("never emits a number for an unsupported combination", () => {
    const o = computeInheritance(heirs({ maternalGrandmother: true }), ESTATE);
    expect(o.distributedRial).toBe(0);
    expect(o.remainderRial).toBe(ESTATE);
  });
});

describe("inheritance — exact reconciliation", () => {
  const supported: Partial<HeirInput>[] = [
    { spouse: "husband", sons: 1 },
    { spouse: "wife", wifeCount: 3, daughters: 2 },
    { father: true, mother: true },
    { father: true, mother: true, sons: 2, daughters: 3 },
    { daughters: 1 },
    { daughters: 4 },
    { sons: 1, daughters: 1 },
    { brothers: 3, sisters: 2 },
    { paternalUncles: 1 },
    { deceasedSons: 2, grandsonsViaSon: 3, granddaughtersViaSon: 1 },
    { spouse: "husband", father: true, mother: true, daughters: 1 },
  ];

  it("distributes the estate exactly, with no phantom remainder", () => {
    for (const partial of supported) {
      const o = computeInheritance(heirs(partial), ESTATE);
      expect(o.unsupportedFa, JSON.stringify(partial)).toBeUndefined();
      expect(o.distributedRial, JSON.stringify(partial)).toBe(ESTATE);
      expect(o.remainderRial, JSON.stringify(partial)).toBe(0);
    }
  });

  it("reconciles exactly even for an awkward estate value", () => {
    const odd = 1_000_000_007;
    for (const partial of supported) {
      const o = computeInheritance(heirs(partial), odd);
      expect(o.distributedRial, JSON.stringify(partial)).toBe(odd);
    }
  });

  it("is deterministic — same census yields identical output", () => {
    const h = heirs({ spouse: "wife", father: true, mother: true, sons: 2 });
    expect(computeInheritance(h, ESTATE)).toEqual(computeInheritance(h, ESTATE));
  });
});

describe("inheritance — calculator wrapper", () => {
  it("maps flat form input onto the heir census", () => {
    const r = inheritanceCalculator.compute({
      spouse: "husband",
      wifeCount: 1,
      father: false,
      mother: false,
      sons: 1,
      daughters: 0,
      deceasedSons: 0,
      deceasedDaughters: 0,
      grandsonsViaSon: 0,
      granddaughtersViaSon: 0,
      grandsonsViaDaughter: 0,
      granddaughtersViaDaughter: 0,
      paternalGrandfather: false,
      paternalGrandmother: false,
      maternalGrandfather: false,
      maternalGrandmother: false,
      brothers: 0,
      sisters: 0,
      paternalUncles: 0,
      paternalAunts: 0,
      maternalUncles: 0,
      maternalAunts: 0,
      estateValue: 400_000_000,
    });
    expect(r.unsupportedFa).toBeUndefined();
    expect(r.tables).toHaveLength(1);
    expect(r.tables![0]!.rows).toHaveLength(2);
    // `headlineValue` is in Rial; the form's money field is in Toman.
    expect(r.headlineValue).toBe(4_000_000_000);
    expect(r.legalNotesFa!.length).toBeGreaterThan(0);
  });

  it("surfaces the unsupported message through the wrapper", () => {
    const r = inheritanceCalculator.compute({
      spouse: "none",
      estateValue: 100_000_000,
    });
    expect(r.unsupportedFa).toBeTruthy();
    expect(r.headlineFa).toBe("—");
  });
});
