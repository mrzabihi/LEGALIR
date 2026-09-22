// ============================================================
// محاسبه سهم‌الارث — inheritance shares
// ============================================================
// UI binding for the inheritance engine. All arithmetic lives in
// `../inheritance/engine.ts`; this module only maps the flat form
// input onto the heir census and shapes the result for display.
//
// Governing instrument: قانون مدنی، باب دوم (در ارث)، مواد ۸۶۲–۹۵۰.

import type {
  CalculationResult,
  CalculatorDef,
  CalculatorField,
} from "@legalir/types";
import { money } from "../money";
import { formatMoney } from "../format";
import { toPersianDigits } from "@/lib/persian-utils";
import { requireDataset } from "../datasets";
import { num, str, bool, type Calculator, type CalculatorInput } from "../engine";
import { computeInheritance } from "../inheritance/engine";
import type { HeirInput, SpouseKind } from "../inheritance/types";

// ============================================================
// Progressive-disclosure predicates
// ============================================================

/** No heir from طبقه اول is present. */
const NO_CLASS_1 = [
  { key: "father", equals: false },
  { key: "mother", equals: false },
  { key: "sons", equals: 0 },
  { key: "daughters", equals: 0 },
  { key: "deceasedSons", equals: 0 },
  { key: "deceasedDaughters", equals: 0 },
];

/** No heir from طبقه دوم is present. */
const NO_CLASS_2 = [
  { key: "paternalGrandfather", equals: false },
  { key: "paternalGrandmother", equals: false },
  { key: "maternalGrandfather", equals: false },
  { key: "maternalGrandmother", equals: false },
  { key: "brothers", equals: 0 },
  { key: "sisters", equals: 0 },
];

const G1 = "همسر";
const G2 = "طبقه اول — پدر و مادر";
const G3 = "طبقه اول — فرزندان";
const G4 = "طبقه اول — فرزندانِ فوت‌شده و نوه‌ها";
const G5 = "طبقه دوم — اجداد و خواهر و برادر";
const G6 = "طبقه سوم — عمو، عمه، دایی، خاله";
const G7 = "ارزش ماترک";

const fields: CalculatorField[] = [
  // ---- همسر ----
  {
    key: "spouse",
    labelFa: "همسر متوفی",
    type: "select",
    required: true,
    defaultValue: "none",
    groupFa: G1,
    options: [
      { value: "none", labelFa: "ندارد" },
      { value: "husband", labelFa: "زوج (شوهر)" },
      { value: "wife", labelFa: "زوجه (همسر)" },
    ],
    helpFa: "زوج و زوجه در هر حال ارث می‌برند (ماده ۸۶۳).",
  },
  {
    key: "wifeCount",
    labelFa: "تعداد همسران",
    type: "number",
    required: false,
    defaultValue: 1,
    min: 1,
    max: 4,
    groupFa: G1,
    visibleWhen: [{ key: "spouse", equals: "wife" }],
    helpFa: "سهم زوجه میان همسران به‌طور مساوی تقسیم می‌شود (ماده ۹۴۷).",
  },

  // ---- طبقه اول: پدر و مادر ----
  {
    key: "father",
    labelFa: "پدر در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G2,
  },
  {
    key: "mother",
    labelFa: "مادر در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G2,
  },

  // ---- طبقه اول: فرزندان ----
  {
    key: "sons",
    labelFa: "تعداد پسران",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G3,
  },
  {
    key: "daughters",
    labelFa: "تعداد دختران",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G3,
  },

  // ---- طبقه اول: فرزندانِ فوت‌شده و نوه‌ها ----
  {
    key: "deceasedSons",
    labelFa: "تعداد پسرانی که پیش از متوفی فوت کرده‌اند",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
    helpFa: "فرزندان این پسران، قائم‌مقام او می‌شوند (ماده ۸۸۴).",
  },
  {
    key: "grandsonsViaSon",
    labelFa: "تعداد نوه‌های پسر (از این پسران)",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
    visibleWhen: [{ key: "deceasedSons", gt: 0 }],
  },
  {
    key: "granddaughtersViaSon",
    labelFa: "تعداد نوه‌های دختر (از این پسران)",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
    visibleWhen: [{ key: "deceasedSons", gt: 0 }],
  },
  {
    key: "deceasedDaughters",
    labelFa: "تعداد دخترانی که پیش از متوفی فوت کرده‌اند",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
  },
  {
    key: "grandsonsViaDaughter",
    labelFa: "تعداد نوه‌های پسر (از این دختران)",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
    visibleWhen: [{ key: "deceasedDaughters", gt: 0 }],
  },
  {
    key: "granddaughtersViaDaughter",
    labelFa: "تعداد نوه‌های دختر (از این دختران)",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G4,
    visibleWhen: [{ key: "deceasedDaughters", gt: 0 }],
  },

  // ---- طبقه دوم ----
  {
    key: "paternalGrandfather",
    labelFa: "پدربزرگ پدری در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },
  {
    key: "paternalGrandmother",
    labelFa: "مادربزرگ پدری در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },
  {
    key: "maternalGrandfather",
    labelFa: "پدربزرگ مادری در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },
  {
    key: "maternalGrandmother",
    labelFa: "مادربزرگ مادری در قید حیات است",
    type: "boolean",
    required: false,
    defaultValue: false,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },
  {
    key: "brothers",
    labelFa: "تعداد برادران",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },
  {
    key: "sisters",
    labelFa: "تعداد خواهران",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G5,
    visibleWhen: NO_CLASS_1,
  },

  // ---- طبقه سوم ----
  {
    key: "paternalUncles",
    labelFa: "تعداد عموها",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G6,
    visibleWhen: [...NO_CLASS_1, ...NO_CLASS_2],
  },
  {
    key: "paternalAunts",
    labelFa: "تعداد عمه‌ها",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G6,
    visibleWhen: [...NO_CLASS_1, ...NO_CLASS_2],
  },
  {
    key: "maternalUncles",
    labelFa: "تعداد دایی‌ها",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G6,
    visibleWhen: [...NO_CLASS_1, ...NO_CLASS_2],
  },
  {
    key: "maternalAunts",
    labelFa: "تعداد خاله‌ها",
    type: "number",
    required: false,
    defaultValue: 0,
    min: 0,
    groupFa: G6,
    visibleWhen: [...NO_CLASS_1, ...NO_CLASS_2],
  },

  // ---- ارزش ماترک ----
  {
    key: "estateValue",
    labelFa: "ارزش خالص ماترک قابل تقسیم",
    type: "money",
    unit: "IRT",
    required: true,
    defaultValue: 500_000_000,
    min: 0,
    groupFa: G7,
    helpFa:
      "ارزش خالص ماترک پس از کسر دیون و تعهدات. اگر دیون هنوز کسر نشده، ابتدا آن‌ها را کنار بگذارید.",
  },
];

const def: CalculatorDef = {
  id: "calc-inheritance",
  slug: "inheritance",
  titleFa: "محاسبه سهم‌الارث",
  subtitleFa: "محاسبه سهم قانونی وراث بر اساس ترکیب وراث و ارزش ماترک",
  descriptionFa:
    "سهم هر یک از وراث را بر اساس ترکیب وراث و ارزش خالص ماترک محاسبه کنید. محاسبه بر پایه طبقات ارث، حجب و فرض‌های قانون مدنی و به‌صورت دقیق انجام می‌شود.",
  category: "family",
  icon: "🧬",
  gradient: "from-emerald-600 to-teal-500",
  legalBasisFa: "قانون مدنی، مواد ۸۶۲ تا ۹۵۰ (طبقات ارث، حجب و فرض)",
  datasetIds: ["inheritance-1404"],
  confidence: "medium",
  available: true,
  fields,
};

// ============================================================
// Input mapping
// ============================================================

function toHeirs(input: CalculatorInput): HeirInput {
  const spouse = str(input, "spouse");
  return {
    spouse: (spouse === "husband" || spouse === "wife" ? spouse : "none") as SpouseKind,
    wifeCount: Math.max(1, num(input, "wifeCount") || 1),
    father: bool(input, "father"),
    mother: bool(input, "mother"),
    sons: num(input, "sons"),
    daughters: num(input, "daughters"),
    deceasedSons: num(input, "deceasedSons"),
    deceasedDaughters: num(input, "deceasedDaughters"),
    grandsonsViaSon: num(input, "grandsonsViaSon"),
    granddaughtersViaSon: num(input, "granddaughtersViaSon"),
    grandsonsViaDaughter: num(input, "grandsonsViaDaughter"),
    granddaughtersViaDaughter: num(input, "granddaughtersViaDaughter"),
    paternalGrandfather: bool(input, "paternalGrandfather"),
    paternalGrandmother: bool(input, "paternalGrandmother"),
    maternalGrandfather: bool(input, "maternalGrandfather"),
    maternalGrandmother: bool(input, "maternalGrandmother"),
    brothers: num(input, "brothers"),
    sisters: num(input, "sisters"),
    paternalUncles: num(input, "paternalUncles"),
    paternalAunts: num(input, "paternalAunts"),
    maternalUncles: num(input, "maternalUncles"),
    maternalAunts: num(input, "maternalAunts"),
  };
}

// ============================================================
// Compute
// ============================================================

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("inheritance-1404");
  const estateRial = money(num(input, "estateValue"), "IRT").rial;
  const outcome = computeInheritance(toHeirs(input), estateRial);

  const warningsFa: string[] = [];
  if (outcome.remainderRial !== 0 && !outcome.unsupportedFa) {
    warningsFa.push(
      `مانده تقسیم‌نشده: ${formatMoney(money(outcome.remainderRial, "IRR"), "IRT")}`
    );
  }

  // ---- Unsupported combination: no number, just the honest message ----
  if (outcome.unsupportedFa) {
    return {
      headlineFa: "—",
      headlineValue: 0,
      unit: "IRT",
      steps: [],
      warningsFa,
      source: ds.source,
      explanationFa: outcome.explanationFa || undefined,
      legalNotesFa: outcome.legalNotesFa,
      unsupportedFa: outcome.unsupportedFa,
    };
  }

  // ---- Result table: one row per heir group ----
  const table = {
    titleFa: "نتیجه تقسیم ماترک",
    columnsFa: ["وارث", "تعداد", "سهم قانونی", "مبلغ کل", "مبلغ هر نفر"],
    rows: outcome.shares.map((s) => ({
      cells: [
        s.labelFa,
        toPersianDigits(s.count),
        s.fractionFa,
        formatMoney(money(s.amountRial, "IRR"), "IRT"),
        s.count > 1 ? formatMoney(money(s.amountPerPersonRial, "IRR"), "IRT") : "—",
      ],
      emphasis: s.isSpouse,
    })),
    footerFa: [
      "مجموع",
      "",
      "",
      formatMoney(money(outcome.distributedRial, "IRR"), "IRT"),
      "",
    ],
  };

  const steps: CalculationResult["steps"] = [
    {
      labelFa: "مجموع ماترک",
      valueFa: formatMoney(money(outcome.totalRial, "IRR"), "IRT"),
    },
    {
      labelFa: "مجموع تقسیم‌شده",
      valueFa: formatMoney(money(outcome.distributedRial, "IRR"), "IRT"),
    },
    {
      labelFa: "مانده",
      valueFa: formatMoney(money(outcome.remainderRial, "IRR"), "IRT"),
    },
  ];

  return {
    headlineFa: formatMoney(money(outcome.distributedRial, "IRR"), "IRT"),
    headlineValue: outcome.distributedRial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
    tables: [table],
    explanationFa: outcome.explanationFa,
    legalNotesFa: outcome.legalNotesFa,
  };
}

export const inheritanceCalculator: Calculator = { def, compute };
