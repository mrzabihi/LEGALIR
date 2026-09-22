// ============================================================
// LEGALIR — Regional property valuation coefficients
// ============================================================
// The *structural* coefficients of the ارزش منطقه‌ای model: how street
// width, building age, construction stage, floor and parking adjust
// the base rates. These are stable rules from the آیین‌نامه اجرایی
// ماده ۶۴ قانون مالیات‌های مستقیم, not annual rates — so they live
// here, outside the versioned location dataset.
//
// The *rates themselves* (Rial per m² for each block) change every
// year and live in the versioned dataset (`locations.ts`).
//
// Pure data module — no I/O.

import type { ConstructionStage, PropertyUsage } from "./types";

// ============================================================
// Street width (عرض گذر)
// ============================================================
// The base rate assumes a 12 m street. Each metre of extra width
// raises the land rate by a fixed percentage, up to a statutory
// ceiling; narrower streets reduce it by the same step.

export interface StreetWidthRule {
  /** The width the base rate is quoted for, in metres. */
  baseWidthM: number;
  /** Percentage added per metre above the base (non-commercial). */
  stepPercent: number;
  /** Percentage added per metre above the base (commercial). */
  commercialStepPercent: number;
  /** Widest street that still earns a bonus (non-commercial), in metres. */
  maxWidthM: number;
  /** Widest street that still earns a bonus (commercial), in metres. */
  commercialMaxWidthM: number;
  /** Narrowest street the model will value, in metres. */
  minWidthM: number;
}

export const STREET_WIDTH: StreetWidthRule = {
  baseWidthM: 12,
  stepPercent: 0.02,
  commercialStepPercent: 0.03,
  maxWidthM: 20,
  commercialMaxWidthM: 30,
  minWidthM: 4,
};

// ============================================================
// Building age (عمر بنا)
// ============================================================
// Depreciation accrues at a fixed annual rate up to a ceiling, after
// which it stops — the building is treated as fully depreciated.

export interface AgeRule {
  /** Depreciation per year of age. */
  annualDepreciation: number;
  /** Age (years) at which depreciation stops accruing. */
  maxYears: number;
  /** Maximum total depreciation. */
  maxDepreciation: number;
}

export const AGE: AgeRule = {
  annualDepreciation: 0.02,
  maxYears: 20,
  maxDepreciation: 0.4,
};

// ============================================================
// Construction stage (مرحله ساخت)
// ============================================================
// A completed building is worth its full construction rate; each
// earlier stage is worth a statutory fraction of it.

export const STAGE_COEFFICIENT: Record<ConstructionStage, number> = {
  completed: 1,
  finishing: 0.8,
  skeleton: 0.5,
  structure: 0.3,
  foundation: 0.1,
};

export const STAGE_LABEL_FA: Record<ConstructionStage, string> = {
  completed: "اتمام کامل",
  finishing: "نازک‌کاری",
  skeleton: "سفت‌کاری",
  structure: "اسکلت",
  foundation: "فوندانسیون",
};

// ============================================================
// Floors (طبقات)
// ============================================================
// Residential buildings earn a bonus for each floor above a free
// threshold. Commercial buildings are adjusted per floor.

export interface FloorRule {
  /** Floors that earn no residential bonus. */
  residentialFreeFloors: number;
  /** Residential bonus per floor above the free threshold. */
  residentialPerFloorAbove: number;
  /** Commercial adjustment per floor above the ground floor. */
  commercialPerFloor: number;
  /** Ceiling on the commercial floor coefficient. */
  commercialMaxCoefficient: number;
}

export const FLOORS: FloorRule = {
  residentialFreeFloors: 5,
  residentialPerFloorAbove: 0.015,
  commercialPerFloor: 0.1,
  commercialMaxCoefficient: 2,
};

// ============================================================
// Parking (پارکینگ)
// ============================================================
// A parking space is valued at a fraction of the building rate for
// non-residential uses.

export const PARKING_COEFFICIENT_NON_RESIDENTIAL = 0.5;

// ============================================================
// Support program (برنامه حمایتی)
// ============================================================
// The first transfer of a dwelling in the covered districts is valued
// at a fraction of the assessed value.

export interface SupportRule {
  /** Fraction of the assessed value charged on a covered first transfer. */
  firstTransferCoefficient: number;
  /** Districts (by name) the program covers. */
  coveredDistricts: string[];
}

export const SUPPORT: SupportRule = {
  firstTransferCoefficient: 0.5,
  coveredDistricts: [
    "منطقه ۹",
    "منطقه ۱۰",
    "منطقه ۱۱",
    "منطقه ۱۲",
    "منطقه ۱۳",
    "منطقه ۱۴",
    "منطقه ۱۵",
    "منطقه ۱۶",
    "منطقه ۱۷",
    "منطقه ۱۸",
    "منطقه ۱۹",
    "منطقه ۲۰",
    "منطقه ۲۱",
    "منطقه ۲۲",
  ],
};

/** True when the support program covers this district. */
export function isSupportDistrict(district: string): boolean {
  return SUPPORT.coveredDistricts.includes(district);
}

/** True for uses that follow the commercial street-width step. */
export function isCommercial(usage: PropertyUsage): boolean {
  return usage === "commercial" || usage === "office";
}
