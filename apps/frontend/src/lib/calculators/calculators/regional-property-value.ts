// ============================================================
// محاسبه ارزش منطقه‌ای ملک — regional property value
// ============================================================
// UI binding for the regional valuation engine. All arithmetic lives
// in `../regional-property/engine.ts`; this module only maps the flat
// form input onto the property census and shapes the result for
// display.
//
// Governing instrument: قانون مالیات‌های مستقیم، ماده ۶۴ و آیین‌نامه
// اجرایی آن؛ دفترچه ارزش منطقه‌ای املاک.

import type {
  CalculationResult,
  CalculatorDef,
  CalculatorField,
} from "@legalir/types";
import { money } from "../money";
import { formatMoney } from "../format";
import { requireDataset } from "../datasets";
import { num, str, bool, type Calculator, type CalculatorInput } from "../engine";
import { computePropertyValue } from "../regional-property/engine";
import {
  LOCATION_TREE,
  locationTree,
} from "../regional-property/locations";
import type {
  ConstructionStage,
  PropertyInput,
  PropertyUsage,
} from "../regional-property/types";

// ============================================================
// Cascading location options
// ============================================================
// The full option lists are declared statically (so the engine can
// validate any value the parent permits); `optionFilter` narrows what
// the form actually shows for the current parent value.

function provinceOptions() {
  return Object.entries(LOCATION_TREE).map(([value, p]) => ({
    value,
    labelFa: p.nameFa,
  }));
}

function cityOptions() {
  const out: { value: string; labelFa: string }[] = [];
  for (const p of Object.values(LOCATION_TREE)) {
    for (const [value, c] of Object.entries(p.cities)) {
      if (!out.some((o) => o.value === value)) {
        out.push({ value, labelFa: c.nameFa });
      }
    }
  }
  return out;
}

function districtOptions() {
  const out: { value: string; labelFa: string }[] = [];
  for (const p of Object.values(LOCATION_TREE)) {
    for (const c of Object.values(p.cities)) {
      for (const [value, d] of Object.entries(c.districts)) {
        if (!out.some((o) => o.value === value)) {
          out.push({ value, labelFa: d.nameFa });
        }
      }
    }
  }
  return out;
}

function blockOptions() {
  const out: { value: string; labelFa: string }[] = [];
  for (const p of Object.values(LOCATION_TREE)) {
    for (const c of Object.values(p.cities)) {
      for (const d of Object.values(c.districts)) {
        for (const value of Object.keys(d.blocks)) {
          if (!out.some((o) => o.value === value)) {
            out.push({ value, labelFa: value });
          }
        }
      }
    }
  }
  return out;
}

// Parent → allowed children, derived once from the tree.
const CITY_BY_PROVINCE: Record<string, string[]> = {};
for (const [pk, p] of Object.entries(LOCATION_TREE)) {
  CITY_BY_PROVINCE[pk] = Object.keys(p.cities);
}

const DISTRICT_BY_CITY: Record<string, string[]> = {};
for (const p of Object.values(LOCATION_TREE)) {
  for (const [ck, c] of Object.entries(p.cities)) {
    DISTRICT_BY_CITY[ck] = Object.keys(c.districts);
  }
}

const BLOCK_BY_DISTRICT: Record<string, string[]> = {};
for (const p of Object.values(LOCATION_TREE)) {
  for (const c of Object.values(p.cities)) {
    for (const [dk, d] of Object.entries(c.districts)) {
      BLOCK_BY_DISTRICT[dk] = Object.keys(d.blocks);
    }
  }
}

// ============================================================
// Groups
// ============================================================

const G1 = "موقعیت ملک";
const G2 = "مشخصات عرصه (زمین)";
const G3 = "مشخصات اعیان (ساختمان)";
const G4 = "برنامه حمایتی";
const G5 = "اطلاعات تکمیلی گزارش (اختیاری)";

const fields: CalculatorField[] = [
  // ---- موقعیت ----
  {
    key: "province",
    labelFa: "استان",
    type: "select",
    required: true,
    defaultValue: "tehran",
    groupFa: G1,
    options: provinceOptions(),
  },
  {
    key: "city",
    labelFa: "شهر",
    type: "select",
    required: true,
    defaultValue: "tehran",
    groupFa: G1,
    options: cityOptions(),
    optionFilter: { parentKey: "province", allowed: CITY_BY_PROVINCE },
  },
  {
    key: "district",
    labelFa: "منطقه",
    type: "select",
    required: true,
    defaultValue: "district-1",
    groupFa: G1,
    options: districtOptions(),
    optionFilter: { parentKey: "city", allowed: DISTRICT_BY_CITY },
  },
  {
    key: "block",
    labelFa: "بلوک",
    type: "select",
    required: true,
    defaultValue: "block-101",
    groupFa: G1,
    options: blockOptions(),
    optionFilter: { parentKey: "district", allowed: BLOCK_BY_DISTRICT },
  },

  // ---- عرصه ----
  {
    key: "landAreaM2",
    labelFa: "مساحت عرصه (مترمربع)",
    type: "number",
    required: true,
    defaultValue: 200,
    min: 1,
    groupFa: G2,
  },
  {
    key: "streetWidthM",
    labelFa: "عرض گذر (متر)",
    type: "number",
    required: true,
    defaultValue: 12,
    min: 4,
    max: 30,
    groupFa: G2,
    helpFa: "نرخ پایه برای گذر ۱۲ متری است؛ عرض بیشتر یا کمتر، ضریب را تغییر می‌دهد.",
  },
  {
    key: "usage",
    labelFa: "کاربری ملک",
    type: "select",
    required: true,
    defaultValue: "residential",
    groupFa: G2,
    options: [
      { value: "residential", labelFa: "مسکونی" },
      { value: "commercial", labelFa: "تجاری" },
      { value: "office", labelFa: "اداری" },
      { value: "industrial", labelFa: "صنعتی" },
    ],
  },

  // ---- اعیان ----
  {
    key: "hasBuilding",
    labelFa: "آیا ملک دارای اعیان است؟",
    type: "boolean",
    required: false,
    defaultValue: true,
    groupFa: G3,
  },
  {
    key: "buildingAreaM2",
    labelFa: "مساحت اعیان (مترمربع)",
    type: "number",
    required: false,
    defaultValue: 160,
    min: 0,
    groupFa: G3,
    visibleWhen: [{ key: "hasBuilding", equals: true }],
  },
  {
    key: "floors",
    labelFa: "تعداد طبقات",
    type: "number",
    required: false,
    defaultValue: 3,
    min: 1,
    max: 60,
    groupFa: G3,
    visibleWhen: [{ key: "hasBuilding", equals: true }],
  },
  {
    key: "ageYears",
    labelFa: "عمر بنا (سال)",
    type: "number",
    required: false,
    defaultValue: 5,
    min: 0,
    max: 100,
    groupFa: G3,
    visibleWhen: [{ key: "hasBuilding", equals: true }],
  },
  {
    key: "stage",
    labelFa: "مرحله ساخت",
    type: "select",
    required: false,
    defaultValue: "completed",
    groupFa: G3,
    visibleWhen: [{ key: "hasBuilding", equals: true }],
    options: [
      { value: "completed", labelFa: "اتمام کامل" },
      { value: "finishing", labelFa: "نازک‌کاری" },
      { value: "skeleton", labelFa: "سفت‌کاری" },
      { value: "structure", labelFa: "اسکلت" },
      { value: "foundation", labelFa: "فوندانسیون" },
    ],
  },
  {
    key: "hasParking",
    labelFa: "دارای پارکینگ",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G3,
    visibleWhen: [{ key: "hasBuilding", equals: true }],
  },

  // ---- برنامه حمایتی ----
  {
    key: "supportProgram",
    labelFa: "مشمول برنامه حمایتی انتقال اول",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G4,
    helpFa: "برای واحدهای مسکونی در مناطق مشمول، انتقال اول با تخفیف ارزش‌گذاری می‌شود.",
  },

  // ---- اطلاعات گزارش (اختیاری، بدون اثر بر محاسبه) ----
  {
    key: "ownerName",
    labelFa: "نام مالک",
    type: "text",
    required: false,
    groupFa: G5,
    helpFa: "فقط برای درج در گزارش؛ بر محاسبه اثری ندارد.",
  },
  {
    key: "nationalId",
    labelFa: "کد ملی مالک",
    type: "text",
    required: false,
    groupFa: G5,
  },
  {
    key: "plaque",
    labelFa: "پلاک ثبتی",
    type: "text",
    required: false,
    groupFa: G5,
  },
  {
    key: "address",
    labelFa: "نشانی ملک",
    type: "text",
    required: false,
    groupFa: G5,
  },
];

const def: CalculatorDef = {
  id: "calc-regional-property-value",
  slug: "regional-property-value",
  titleFa: "محاسبه ارزش منطقه‌ای ملک",
  subtitleFa: "برآورد ارزش معاملاتی عرصه و اعیان بر پایه نرخ‌های منطقه‌ای",
  descriptionFa:
    "ارزش معاملاتی ملک را بر اساس موقعیت (استان، شهر، منطقه و بلوک)، مساحت عرصه و اعیان و ضرایب قانونی عرض گذر، عمر بنا، طبقات و مرحله ساخت محاسبه کنید.",
  category: "civil",
  icon: "🏙️",
  gradient: "from-sky-600 to-indigo-500",
  legalBasisFa: "ماده ۶۴ قانون مالیات‌های مستقیم و آیین‌نامه اجرایی آن",
  datasetIds: ["regional-property-1404"],
  confidence: "medium",
  available: true,
  fields,
};

// ============================================================
// Input mapping
// ============================================================

function toProperty(input: CalculatorInput): PropertyInput {
  return {
    province: str(input, "province"),
    city: str(input, "city"),
    district: str(input, "district"),
    block: str(input, "block"),
    landAreaM2: num(input, "landAreaM2"),
    streetWidthM: num(input, "streetWidthM"),
    usage: (str(input, "usage") || "residential") as PropertyUsage,
    hasBuilding: bool(input, "hasBuilding"),
    buildingAreaM2: num(input, "buildingAreaM2"),
    floors: num(input, "floors"),
    ageYears: num(input, "ageYears"),
    stage: (str(input, "stage") || "completed") as ConstructionStage,
    hasParking: bool(input, "hasParking"),
    supportProgram: bool(input, "supportProgram"),
  };
}

// ============================================================
// Compute
// ============================================================

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("regional-property-1404");
  const tree = locationTree(ds);
  const outcome = computePropertyValue(toProperty(input), tree);

  if (outcome.unsupportedFa) {
    return {
      headlineFa: "—",
      headlineValue: 0,
      unit: "IRT",
      steps: [],
      warningsFa: [],
      source: ds.source,
      explanationFa: outcome.explanationFa || undefined,
      legalNotesFa: outcome.legalNotesFa,
      unsupportedFa: outcome.unsupportedFa,
    };
  }

  const steps: CalculationResult["steps"] = [
    {
      labelFa: "ارزش عرصه",
      valueFa: formatMoney(money(outcome.landValueRial, "IRR"), "IRT"),
    },
    {
      labelFa: "ارزش اعیان",
      valueFa: formatMoney(money(outcome.buildingValueRial, "IRR"), "IRT"),
    },
    {
      labelFa: "ارزش کل",
      valueFa: formatMoney(money(outcome.grossValueRial, "IRR"), "IRT"),
    },
  ];
  if (outcome.discountRial > 0) {
    steps.push({
      labelFa: "تخفیف برنامه حمایتی",
      valueFa: `− ${formatMoney(money(outcome.discountRial, "IRR"), "IRT")}`,
    });
  }

  const warningsFa: string[] = [];
  if (outcome.discountRial > 0) {
    warningsFa.push(
      "برنامه حمایتی انتقال اول اعمال شد؛ این تخفیف تنها برای اولین انتقال واحد مسکونی مشمول است."
    );
  }

  return {
    headlineFa: formatMoney(money(outcome.netValueRial, "IRR"), "IRT"),
    headlineValue: outcome.netValueRial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
    sections: outcome.sections,
    explanationFa: outcome.explanationFa,
    legalNotesFa: outcome.legalNotesFa,
  };
}

export const regionalPropertyValueCalculator: Calculator = { def, compute };

/** Exposed for the report/PDF layer and tests. */
export { toProperty };
