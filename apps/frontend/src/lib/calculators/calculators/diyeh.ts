// ============================================================
// دیه — blood money
// ============================================================
// Governing instrument: قانون مجازات اسلامی، کتاب چهارم (دیات).
//
// Formula:
//   diyeh = fullDiyeh × statutoryFraction × (sacred month ? 4/3 : 1)
// The full diyeh is set annually by the judiciary; the fractions are
// statutory constants (see DIYEH_FRACTIONS).

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset, DIYEH_FRACTIONS } from "../datasets";
import { bool, str, type Calculator, type CalculatorInput } from "../engine";

interface DiyehRates {
  fullDiyehRial: number;
  sacredMonthMultiplier: number;
}

const def: CalculatorDef = {
  id: "calc-diyeh",
  slug: "diyeh",
  titleFa: "دیه",
  subtitleFa: "محاسبه دیه بر اساس نوع صدمه",
  descriptionFa:
    "دیه بر اساس نرخ کامل سال جاری و ضریب قانونی هر نوع صدمه محاسبه می‌شود. در ماه‌های حرام، دیه یک‌سوم افزایش می‌یابد.",
  category: "judicial",
  icon: "🩸",
  gradient: "from-rose-600 to-red-500",
  legalBasisFa: "مواد ۵۴۹، ۵۵۰ و ۵۵۰ به بعد قانون مجازات اسلامی",
  datasetIds: ["diyeh-1404"],
  confidence: "high",
  available: true,
  fields: [
    {
      key: "injuryType",
      labelFa: "نوع صدمه",
      type: "select",
      required: true,
      defaultValue: "full",
      options: DIYEH_FRACTIONS.map((f) => ({ value: f.key, labelFa: f.labelFa })),
    },
    {
      key: "sacredMonth",
      labelFa: "وقوع در ماه حرام",
      type: "boolean",
      required: false,
      defaultValue: false,
      helpFa: "محرم، رجب، ذی‌القعده و ذی‌الحجه.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("diyeh-1404");
  const rates = ds.rates as unknown as DiyehRates;

  const injuryKey = str(input, "injuryType");
  const fraction =
    DIYEH_FRACTIONS.find((f) => f.key === injuryKey) ?? DIYEH_FRACTIONS[0]!;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const full = money(rates.fullDiyehRial, "IRR");
  steps.push({
    labelFa: "دیه کامل سال جاری",
    valueFa: formatMoney(full, "IRT"),
  });

  let result: Money = scaleMoney(full, fraction.fraction);
  steps.push({
    labelFa: `ضریب صدمه (${fraction.labelFa})`,
    valueFa: formatMoney(result, "IRT"),
    noteFa: `${formatPercentFa(fraction.fraction)} از دیه کامل`,
  });

  if (bool(input, "sacredMonth")) {
    result = scaleMoney(result, rates.sacredMonthMultiplier);
    steps.push({
      labelFa: "افزایش ماه حرام (یک‌سوم)",
      valueFa: formatMoney(result, "IRT"),
    });
  }

  return {
    headlineFa: formatMoney(result, "IRT"),
    headlineValue: result.rial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const diyehCalculator: Calculator = { def, compute };
