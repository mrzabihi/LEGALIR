// ============================================================
// LEGALIR — Regional property value dataset (ارزش منطقه‌ای)
// ============================================================
// The per-block land and construction rates the valuation engine
// multiplies by. These are ANNUAL rates: the tax administration
// publishes a دفترچه ارزش منطقه‌ای each year, and every rate here must
// be re-verified against that booklet before a release.
//
// IMPORTANT — verification policy:
//   The rates below are ILLUSTRATIVE placeholders shaped like the real
//   booklet (province → city → district → block, with a land rate and
//   a construction rate per m²). They are NOT the official 1404
//   figures. Before this calculator is used on a real file, replace
//   every rate with the value from the current دفترچه and bump
//   `source.verifiedAt`.
//
// Pure data module — no I/O.

import type { RateDataset } from "@legalir/types";

/** One block's rates, in Rial per square metre. */
export interface BlockRate {
  /** Land (عرصه) rate, Rial/m². */
  landRatePerM2Rial: number;
  /** Construction (اعیان) rate, Rial/m². */
  buildingRatePerM2Rial: number;
}

/** A district within a city. */
export interface District {
  nameFa: string;
  blocks: Record<string, BlockRate>;
}

/** A city within a province. */
export interface City {
  nameFa: string;
  districts: Record<string, District>;
}

/** A province. */
export interface Province {
  nameFa: string;
  cities: Record<string, City>;
}

/** The full location tree, keyed by stable slug. */
export type LocationTree = Record<string, Province>;

// ============================================================
// Illustrative location tree
// ============================================================
// Two provinces are seeded so the cascading selects have real data to
// walk. Rates are placeholders — see the verification note above.

export const LOCATION_TREE: LocationTree = {
  tehran: {
    nameFa: "تهران",
    cities: {
      tehran: {
        nameFa: "تهران",
        districts: {
          "district-1": {
            nameFa: "منطقه ۱",
            blocks: {
              "block-101": { landRatePerM2Rial: 900_000_000, buildingRatePerM2Rial: 120_000_000 },
              "block-102": { landRatePerM2Rial: 750_000_000, buildingRatePerM2Rial: 110_000_000 },
            },
          },
          "district-6": {
            nameFa: "منطقه ۶",
            blocks: {
              "block-601": { landRatePerM2Rial: 600_000_000, buildingRatePerM2Rial: 100_000_000 },
              "block-602": { landRatePerM2Rial: 520_000_000, buildingRatePerM2Rial: 95_000_000 },
            },
          },
          "district-15": {
            nameFa: "منطقه ۱۵",
            blocks: {
              "block-1501": { landRatePerM2Rial: 180_000_000, buildingRatePerM2Rial: 70_000_000 },
              "block-1502": { landRatePerM2Rial: 150_000_000, buildingRatePerM2Rial: 65_000_000 },
            },
          },
        },
      },
      eslamshahr: {
        nameFa: "اسلامشهر",
        districts: {
          "district-central": {
            nameFa: "مرکزی",
            blocks: {
              "block-c1": { landRatePerM2Rial: 60_000_000, buildingRatePerM2Rial: 45_000_000 },
            },
          },
        },
      },
    },
  },
  isfahan: {
    nameFa: "اصفهان",
    cities: {
      isfahan: {
        nameFa: "اصفهان",
        districts: {
          "district-1": {
            nameFa: "منطقه ۱",
            blocks: {
              "block-101": { landRatePerM2Rial: 300_000_000, buildingRatePerM2Rial: 80_000_000 },
            },
          },
          "district-5": {
            nameFa: "منطقه ۵",
            blocks: {
              "block-501": { landRatePerM2Rial: 220_000_000, buildingRatePerM2Rial: 70_000_000 },
            },
          },
        },
      },
    },
  },
};

// ============================================================
// Versioned dataset wrapper
// ============================================================

export const DATASET_REGIONAL_PROPERTY_1404: RateDataset = {
  id: "regional-property-1404",
  titleFa: "ارزش منطقه‌ای املاک سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle:
      "دفترچه ارزش منطقه‌ای املاک — سازمان امور مالیاتی (موضوع ماده ۶۴ قانون مالیات‌های مستقیم)",
    sourceAuthority: "سازمان امور مالیاتی کشور",
    sourceUrl: null,
    publicationDate: "1404-01-01",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: "جمهوری اسلامی ایران",
    calculationYear: 1404,
    version: "regional-property-1404.1",
    verifiedAt: "2026-09-22",
    notes:
      "نرخ‌های این نسخه نمونه‌وار و هم‌شکل دفترچه رسمی است و جایگزین ارقام مصوب سال جاری نیست. پیش از استفاده در پرونده واقعی، نرخ هر بلوک را از دفترچه ارزش منطقه‌ای همان سال تأیید و مقدار verifiedAt را به‌روز کنید.",
  },
  rates: {
    tree: LOCATION_TREE,
  },
};

/** The location tree carried by the dataset. */
export function locationTree(ds: RateDataset): LocationTree {
  return (ds.rates as { tree: LocationTree }).tree;
}

/** Look up one block's rates, or undefined when the path is unknown. */
export function findBlock(
  tree: LocationTree,
  province: string,
  city: string,
  district: string,
  block: string
): BlockRate | undefined {
  return tree[province]?.cities[city]?.districts[district]?.blocks[block];
}
