import { describe, it, expect } from "vitest";
import {
  computePropertyValue,
  ageCoefficient,
  floorCoefficient,
  streetCoefficient,
  UNKNOWN_LOCATION_FA,
} from "@/lib/calculators/regional-property/engine";
import { LOCATION_TREE } from "@/lib/calculators/regional-property/locations";
import type { PropertyInput } from "@/lib/calculators/regional-property/types";
import { regionalPropertyValueCalculator } from "@/lib/calculators/calculators/regional-property-value";

// ============================================================
// Regional property valuation — deterministic, coefficient-backed
// ============================================================
// Each case is a hand-computed expectation from the model documented
// in the engine header. The engine must reproduce them exactly and
// must refuse (not guess) an unknown location.

function property(partial: Partial<PropertyInput> = {}): PropertyInput {
  return {
    province: "tehran",
    city: "tehran",
    district: "district-1",
    block: "block-101",
    landAreaM2: 200,
    streetWidthM: 12,
    usage: "residential",
    hasBuilding: true,
    buildingAreaM2: 160,
    floors: 3,
    ageYears: 5,
    stage: "completed",
    hasParking: false,
    supportProgram: false,
    ...partial,
  };
}

const TREE = LOCATION_TREE;
// block-101 (تهران، منطقه ۱): land 900,000,000 / building 120,000,000 Rial per m².

describe("regional property — street-width coefficient", () => {
  it("is 1 at the 12 m base width", () => {
    expect(streetCoefficient(12, false)).toBe(1);
  });

  it("adds 2% per metre above the base (non-commercial)", () => {
    expect(streetCoefficient(15, false)).toBeCloseTo(1.06, 10);
  });

  it("adds 3% per metre above the base (commercial)", () => {
    expect(streetCoefficient(15, true)).toBeCloseTo(1.09, 10);
  });

  it("caps the bonus at 20 m non-commercial / 30 m commercial", () => {
    expect(streetCoefficient(40, false)).toBeCloseTo(1.16, 10);
    expect(streetCoefficient(40, true)).toBeCloseTo(1.54, 10);
  });

  it("reduces the rate below the base width", () => {
    expect(streetCoefficient(8, false)).toBeCloseTo(0.92, 10);
  });

  it("floors the width at the statutory minimum", () => {
    expect(streetCoefficient(1, false)).toBeCloseTo(streetCoefficient(4, false), 10);
  });
});

describe("regional property — age coefficient", () => {
  it("is 1 for a new building", () => {
    expect(ageCoefficient(0)).toBe(1);
  });

  it("depreciates 2% per year", () => {
    expect(ageCoefficient(5)).toBeCloseTo(0.9, 10);
  });

  it("stops depreciating at 20 years (40% floor)", () => {
    expect(ageCoefficient(20)).toBeCloseTo(0.6, 10);
    expect(ageCoefficient(50)).toBeCloseTo(0.6, 10);
  });
});

describe("regional property — floor coefficient", () => {
  it("gives no residential bonus up to 5 floors", () => {
    expect(floorCoefficient(5, false)).toBe(1);
  });

  it("adds 1.5% per residential floor above 5", () => {
    expect(floorCoefficient(8, false)).toBeCloseTo(1.045, 10);
  });

  it("adjusts commercial buildings 10% per floor above ground", () => {
    expect(floorCoefficient(3, true)).toBeCloseTo(1.2, 10);
  });

  it("caps the commercial floor coefficient at 2", () => {
    expect(floorCoefficient(50, true)).toBe(2);
  });
});

describe("regional property — land value", () => {
  it("multiplies area by the block rate at the base width", () => {
    const v = computePropertyValue(
      property({ hasBuilding: false, landAreaM2: 200, streetWidthM: 12 }),
      TREE
    );
    expect(v.landRatePerM2Rial).toBe(900_000_000);
    expect(v.landValueRial).toBe(180_000_000_000);
    expect(v.buildingValueRial).toBe(0);
    expect(v.netValueRial).toBe(180_000_000_000);
  });

  it("applies the street-width coefficient to the land rate", () => {
    const v = computePropertyValue(
      property({ hasBuilding: false, streetWidthM: 15 }),
      TREE
    );
    // 900,000,000 × 1.06 = 954,000,000
    expect(v.landRatePerM2Rial).toBe(954_000_000);
    expect(v.landValueRial).toBe(190_800_000_000);
  });
});

describe("regional property — building value", () => {
  it("multiplies area by the construction rate with all coefficients", () => {
    const v = computePropertyValue(
      property({
        buildingAreaM2: 100,
        floors: 3,
        ageYears: 0,
        stage: "completed",
      }),
      TREE
    );
    // 120,000,000 × 1 (stage) × 1 (age) × 1 (floors) = 120,000,000
    expect(v.buildingRatePerM2Rial).toBe(120_000_000);
    expect(v.buildingValueRial).toBe(12_000_000_000);
  });

  it("halves the building rate at the سفت‌کاری stage", () => {
    const v = computePropertyValue(
      property({ buildingAreaM2: 100, ageYears: 0, stage: "skeleton" }),
      TREE
    );
    expect(v.buildingRatePerM2Rial).toBe(60_000_000);
  });

  it("applies age depreciation to the building", () => {
    const v = computePropertyValue(
      property({ buildingAreaM2: 100, ageYears: 10, stage: "completed" }),
      TREE
    );
    // 120,000,000 × 0.8 = 96,000,000
    expect(v.buildingRatePerM2Rial).toBe(96_000_000);
  });

  it("halves the building rate when a non-residential unit has parking", () => {
    const v = computePropertyValue(
      property({
        usage: "commercial",
        buildingAreaM2: 100,
        ageYears: 0,
        floors: 1,
        hasParking: true,
      }),
      TREE
    );
    // 120,000,000 × 1 × 1 × 1 × 0.5 = 60,000,000
    expect(v.buildingRatePerM2Rial).toBe(60_000_000);
  });

  it("ignores parking for a residential unit", () => {
    const v = computePropertyValue(
      property({ buildingAreaM2: 100, ageYears: 0, hasParking: true }),
      TREE
    );
    expect(v.buildingRatePerM2Rial).toBe(120_000_000);
  });

  it("values no building when the plot has none", () => {
    const v = computePropertyValue(property({ hasBuilding: false }), TREE);
    expect(v.buildingValueRial).toBe(0);
    expect(v.sections.some((s) => s.titleFa.includes("اعیان"))).toBe(false);
  });
});

describe("regional property — support program", () => {
  it("halves the value for a covered residential first transfer", () => {
    const v = computePropertyValue(
      property({
        district: "district-15",
        block: "block-1501",
        hasBuilding: false,
        landAreaM2: 100,
        supportProgram: true,
      }),
      TREE
    );
    // land = 180,000,000 × 100 = 18,000,000,000; discount = half.
    expect(v.grossValueRial).toBe(18_000_000_000);
    expect(v.discountRial).toBe(9_000_000_000);
    expect(v.netValueRial).toBe(9_000_000_000);
  });

  it("does not apply to a non-covered district", () => {
    const v = computePropertyValue(
      property({ district: "district-1", supportProgram: true }),
      TREE
    );
    expect(v.discountRial).toBe(0);
  });

  it("does not apply to a non-residential use", () => {
    const v = computePropertyValue(
      property({
        district: "district-15",
        block: "block-1501",
        usage: "commercial",
        supportProgram: true,
      }),
      TREE
    );
    expect(v.discountRial).toBe(0);
  });
});

describe("regional property — unknown location", () => {
  it("refuses a block that is not in the dataset", () => {
    const v = computePropertyValue(
      property({ district: "district-999", block: "nope" }),
      TREE
    );
    expect(v.unsupportedFa).toBe(UNKNOWN_LOCATION_FA);
    expect(v.netValueRial).toBe(0);
  });

  it("refuses an unknown province", () => {
    const v = computePropertyValue(property({ province: "nowhere" }), TREE);
    expect(v.unsupportedFa).toBe(UNKNOWN_LOCATION_FA);
  });
});

describe("regional property — reconciliation and determinism", () => {
  it("keeps gross = land + building and net = gross − discount", () => {
    const v = computePropertyValue(property(), TREE);
    expect(v.grossValueRial).toBe(v.landValueRial + v.buildingValueRial);
    expect(v.netValueRial).toBe(v.grossValueRial - v.discountRial);
  });

  it("is deterministic — same census yields identical output", () => {
    const p = property({ streetWidthM: 18, ageYears: 7, floors: 6 });
    expect(computePropertyValue(p, TREE)).toEqual(computePropertyValue(p, TREE));
  });

  it("emits a section per component plus a summary", () => {
    const v = computePropertyValue(property(), TREE);
    const titles = v.sections.map((s) => s.titleFa);
    expect(titles).toContain("عرصه (زمین)");
    expect(titles).toContain("اعیان (ساختمان)");
    expect(titles).toContain("جمع‌بندی ارزش");
  });
});

describe("regional property — calculator wrapper", () => {
  it("computes a full valuation from flat form input", () => {
    const r = regionalPropertyValueCalculator.compute({
      province: "tehran",
      city: "tehran",
      district: "district-1",
      block: "block-101",
      landAreaM2: 200,
      streetWidthM: 12,
      usage: "residential",
      hasBuilding: true,
      buildingAreaM2: 160,
      floors: 3,
      ageYears: 5,
      stage: "completed",
      hasParking: false,
      supportProgram: false,
    });
    expect(r.unsupportedFa).toBeUndefined();
    expect(r.sections!.length).toBeGreaterThanOrEqual(3);
    expect(r.headlineValue).toBeGreaterThan(0);
    expect(r.legalNotesFa!.length).toBeGreaterThan(0);
  });

  it("surfaces the unknown-location message through the wrapper", () => {
    const r = regionalPropertyValueCalculator.compute({
      province: "tehran",
      city: "tehran",
      district: "district-1",
      block: "missing-block",
      landAreaM2: 100,
      streetWidthM: 12,
      usage: "residential",
      hasBuilding: false,
    });
    expect(r.unsupportedFa).toBe(UNKNOWN_LOCATION_FA);
    expect(r.headlineFa).toBe("—");
  });

  it("ignores report metadata — it never changes the value", () => {
    const base = {
      province: "tehran",
      city: "tehran",
      district: "district-1",
      block: "block-101",
      landAreaM2: 200,
      streetWidthM: 12,
      usage: "residential",
      hasBuilding: true,
      buildingAreaM2: 160,
      floors: 3,
      ageYears: 5,
      stage: "completed",
      hasParking: false,
      supportProgram: false,
    };
    const withMeta = regionalPropertyValueCalculator.compute({
      ...base,
      ownerName: "الف",
      nationalId: "0012345678",
      plaque: "۱۲۳",
      address: "تهران، خیابان نمونه",
    });
    const without = regionalPropertyValueCalculator.compute(base);
    expect(withMeta.headlineValue).toBe(without.headlineValue);
  });
});
