// ============================================================
// LEGALIR — Regional property valuation engine (ارزش منطقه‌ای ملک)
// ============================================================
// Deterministic, exact, and instrument-backed. No LLM, no network, no
// clock: the same property census always yields the same value.
//
// Governing instrument: قانون مالیات‌های مستقیم (ماده ۶۴) و آیین‌نامه
// اجرایی آن — ارزش معاملاتی املاک؛ به‌همراه دفترچه ارزش منطقه‌ای
// سالانه سازمان امور مالیاتی.
//
// MODEL
//   عرصه (land)  = area × block land rate × street-width coefficient
//   اعیان (building) = area × block construction rate
//                      × stage × age × floor coefficients
//   gross        = land + building
//   net          = gross − support-program discount (first transfer)
//
// The block rates come from the versioned dataset; the coefficients
// come from `coefficients.ts`. Nothing is hard-coded here.
//
// Pure module — no React, no I/O.

import { money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { toPersianDigits } from "@/lib/persian-utils";
import {
  AGE,
  FLOORS,
  PARKING_COEFFICIENT_NON_RESIDENTIAL,
  STAGE_COEFFICIENT,
  STAGE_LABEL_FA,
  STREET_WIDTH,
  SUPPORT,
  isCommercial,
  isSupportDistrict,
} from "./coefficients";
import { findBlock, type LocationTree } from "./locations";
import type {
  PropertyInput,
  PropertyValuation,
  ValueRow,
  ValueSection,
} from "./types";

/** Shown when the location path does not resolve to a known block. */
export const UNKNOWN_LOCATION_FA =
  "برای این موقعیت، نرخ ارزش منطقه‌ای در نسخه فعلی ثبت نشده است.";

const USAGE_LABEL_FA: Record<PropertyInput["usage"], string> = {
  residential: "مسکونی",
  commercial: "تجاری",
  office: "اداری",
  industrial: "صنعتی",
};

// ============================================================
// Coefficients
// ============================================================

/**
 * Street-width coefficient. The base rate is quoted for a 12 m street;
 * each metre above (or below) moves the rate by a fixed step, capped
 * at the statutory ceiling. Commercial uses step faster.
 */
export function streetCoefficient(
  widthM: number,
  commercial: boolean
): number {
  const step = commercial
    ? STREET_WIDTH.commercialStepPercent
    : STREET_WIDTH.stepPercent;
  const cap = commercial
    ? STREET_WIDTH.commercialMaxWidthM
    : STREET_WIDTH.maxWidthM;

  const effective = Math.min(Math.max(widthM, STREET_WIDTH.minWidthM), cap);
  const delta = effective - STREET_WIDTH.baseWidthM;
  return 1 + delta * step;
}

/** Age depreciation coefficient: 1 − min(age × rate, ceiling). */
export function ageCoefficient(ageYears: number): number {
  const years = Math.max(0, ageYears);
  const depreciation = Math.min(
    years * AGE.annualDepreciation,
    AGE.maxDepreciation
  );
  return 1 - depreciation;
}

/** Floor coefficient: residential bonus above the free threshold. */
export function floorCoefficient(
  floors: number,
  commercial: boolean
): number {
  const n = Math.max(1, floors);
  if (commercial) {
    const above = n - 1;
    return Math.min(
      1 + above * FLOORS.commercialPerFloor,
      FLOORS.commercialMaxCoefficient
    );
  }
  const above = Math.max(0, n - FLOORS.residentialFreeFloors);
  return 1 + above * FLOORS.residentialPerFloorAbove;
}

// ============================================================
// Public entry point
// ============================================================

export function computePropertyValue(
  input: PropertyInput,
  tree: LocationTree
): PropertyValuation {
  const block = findBlock(
    tree,
    input.province,
    input.city,
    input.district,
    input.block
  );

  if (!block) {
    return {
      landValueRial: 0,
      buildingValueRial: 0,
      grossValueRial: 0,
      discountRial: 0,
      netValueRial: 0,
      landRatePerM2Rial: 0,
      buildingRatePerM2Rial: 0,
      streetCoefficient: 1,
      ageCoefficient: 1,
      stageCoefficient: 1,
      floorCoefficient: 1,
      sections: [],
      explanationFa: "",
      legalNotesFa: [],
      unsupportedFa: UNKNOWN_LOCATION_FA,
    };
  }

  const commercial = isCommercial(input.usage);

  // ---- عرصه ----
  const street = streetCoefficient(input.streetWidthM, commercial);
  const landRate = Math.round(block.landRatePerM2Rial * street);
  const landValue = Math.round(landRate * input.landAreaM2);

  // ---- اعیان ----
  const stage = STAGE_COEFFICIENT[input.stage];
  const age = ageCoefficient(input.ageYears);
  const floor = floorCoefficient(input.floors, commercial);
  // A parking space is valued at a fraction of the building rate for
  // non-residential uses only.
  const parking =
    input.hasParking && input.usage !== "residential"
      ? PARKING_COEFFICIENT_NON_RESIDENTIAL
      : 1;

  const buildingRate = Math.round(
    block.buildingRatePerM2Rial * stage * age * floor * parking
  );
  const buildingValue = input.hasBuilding
    ? Math.round(buildingRate * input.buildingAreaM2)
    : 0;

  const gross = landValue + buildingValue;

  // ---- برنامه حمایتی ----
  const districtName =
    tree[input.province]?.cities[input.city]?.districts[input.district]
      ?.nameFa ?? "";
  const supportApplies =
    input.supportProgram &&
    input.usage === "residential" &&
    isSupportDistrict(districtName);
  const discount = supportApplies
    ? Math.round(gross * (1 - SUPPORT.firstTransferCoefficient))
    : 0;
  const net = gross - discount;

  const sections = buildSections(input, {
    landRate,
    landValue,
    buildingRate,
    buildingValue,
    street,
    stage,
    age,
    floor,
    parking,
    gross,
    discount,
    net,
    supportApplies,
  });

  return {
    landValueRial: landValue,
    buildingValueRial: buildingValue,
    grossValueRial: gross,
    discountRial: discount,
    netValueRial: net,
    landRatePerM2Rial: landRate,
    buildingRatePerM2Rial: buildingRate,
    streetCoefficient: street,
    ageCoefficient: age,
    stageCoefficient: stage,
    floorCoefficient: floor,
    sections,
    explanationFa: buildExplanation(input, {
      street,
      stage,
      age,
      floor,
      commercial,
      supportApplies,
    }),
    legalNotesFa: [
      "ماده ۶۴ قانون مالیات‌های مستقیم — ارزش معاملاتی املاک",
      "آیین‌نامه اجرایی ماده ۶۴ — ضرایب عرض گذر، عمر بنا، طبقات و مرحله ساخت",
      "دفترچه ارزش منطقه‌ای املاک — سازمان امور مالیاتی",
    ],
  };
}

// ============================================================
// Display assembly
// ============================================================

interface Derived {
  landRate: number;
  landValue: number;
  buildingRate: number;
  buildingValue: number;
  street: number;
  stage: number;
  age: number;
  floor: number;
  parking: number;
  gross: number;
  discount: number;
  net: number;
  supportApplies: boolean;
}

function rial(v: number): string {
  return formatMoney(money(v, "IRR"), "IRT");
}

function buildSections(input: PropertyInput, d: Derived): ValueSection[] {
  const sections: ValueSection[] = [];

  // ---- عرصه ----
  sections.push({
    titleFa: "عرصه (زمین)",
    rows: [
      {
        labelFa: "مساحت عرصه",
        valueFa: `${toPersianDigits(input.landAreaM2)} مترمربع`,
      },
      {
        labelFa: "نرخ پایه عرصه (هر مترمربع)",
        valueFa: rial(Math.round(d.landRate / d.street)),
      },
      {
        labelFa: "ضریب عرض گذر",
        valueFa: formatPercentFa(d.street),
        noteFa: `عرض ${toPersianDigits(input.streetWidthM)} متر`,
      },
      {
        labelFa: "نرخ عرصه پس از ضریب",
        valueFa: rial(d.landRate),
      },
    ],
    totalFa: rial(d.landValue),
  });

  // ---- اعیان ----
  if (input.hasBuilding) {
    const baseRate = Math.round(
      d.buildingRate / (d.stage * d.age * d.floor * d.parking)
    );
    const buildingRows = [
      {
        labelFa: "مساحت اعیان",
        valueFa: `${toPersianDigits(input.buildingAreaM2)} مترمربع`,
      },
      {
        labelFa: "نرخ پایه ساخت (هر مترمربع)",
        valueFa: rial(baseRate),
      },
      {
        labelFa: "ضریب مرحله ساخت",
        valueFa: formatPercentFa(d.stage),
        noteFa: STAGE_LABEL_FA[input.stage],
      },
      {
        labelFa: "ضریب عمر بنا",
        valueFa: formatPercentFa(d.age),
        noteFa: `${toPersianDigits(input.ageYears)} سال`,
      },
      {
        labelFa: "ضریب طبقات",
        valueFa: formatPercentFa(d.floor),
        noteFa: `${toPersianDigits(input.floors)} طبقه`,
      },
    ];
    if (d.parking !== 1) {
      buildingRows.push({
        labelFa: "ضریب پارکینگ",
        valueFa: formatPercentFa(d.parking),
      });
    }
    buildingRows.push({
      labelFa: "نرخ اعیان پس از ضرایب",
      valueFa: rial(d.buildingRate),
    });
    sections.push({
      titleFa: "اعیان (ساختمان)",
      rows: buildingRows,
      totalFa: rial(d.buildingValue),
    });
  }

  // ---- جمع ----
  const totalRows: ValueRow[] = [
    { labelFa: "ارزش عرصه", valueFa: rial(d.landValue) },
    { labelFa: "ارزش اعیان", valueFa: rial(d.buildingValue) },
    { labelFa: "ارزش کل (پیش از تخفیف)", valueFa: rial(d.gross) },
  ];
  if (d.supportApplies) {
    totalRows.push({
      labelFa: "تخفیف برنامه حمایتی (انتقال اول)",
      valueFa: `− ${rial(d.discount)}`,
      noteFa: `معادل ${formatPercentFa(1 - SUPPORT.firstTransferCoefficient)} ارزش کل`,
    });
  }
  sections.push({
    titleFa: "جمع‌بندی ارزش",
    rows: totalRows,
    totalFa: rial(d.net),
  });

  return sections;
}

function buildExplanation(
  input: PropertyInput,
  d: {
    street: number;
    stage: number;
    age: number;
    floor: number;
    commercial: boolean;
    supportApplies: boolean;
  }
): string {
  const parts: string[] = [];
  parts.push(
    `ارزش عرصه از حاصل‌ضرب مساحت زمین در نرخ منطقه‌ای بلوک و ضریب عرض گذر (${formatPercentFa(d.street)}) به دست می‌آید.`
  );
  if (input.hasBuilding) {
    parts.push(
      `ارزش اعیان از حاصل‌ضرب مساحت بنا در نرخ ساخت منطقه‌ای و ضرایب مرحله ساخت (${formatPercentFa(d.stage)})، عمر بنا (${formatPercentFa(d.age)}) و طبقات (${formatPercentFa(d.floor)}) محاسبه می‌شود.`
    );
  }
  parts.push(
    `کاربری ملک «${USAGE_LABEL_FA[input.usage]}» در نظر گرفته شده است${d.commercial ? " و ضریب عرض گذر با نرخ تجاری اعمال شده است" : ""}.`
  );
  if (d.supportApplies) {
    parts.push(
      "برنامه حمایتی انتقال اول برای این منطقه اعمال و نیمی از ارزش کل به‌عنوان تخفیف کسر شد."
    );
  }
  return parts.join(" ");
}
