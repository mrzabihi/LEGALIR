// ============================================================
// مهریه به نرخ روز — dowry indexation
// ============================================================
// Governing instrument: رویه قضایی و بخشنامه‌های قوه قضائیه بر
// مبنای شاخص بهای کالاها و خدمات مصرفی بانک مرکزی.
//
// Formula:
//   revalued = nominalDowry × (indexAtClaim / indexAtMarriage)
// The user supplies both index values so the calculation is
// reproducible and auditable against the official series.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface DowryRates {
  baseYear: number;
  annualIndex: Record<string, number>;
}

const def: CalculatorDef = {
  id: "calc-dowry",
  slug: "dowry",
  titleFa: "مهریه به نرخ روز",
  subtitleFa: "تعدیل مهریه بر مبنای شاخص قیمت",
  descriptionFa:
    "مهریه با نسبت تغییر شاخص بهای کالاها و خدمات مصرفی، از سال وقوع عقد تا زمان مطالبه، به نرخ روز تعدیل می‌شود.",
  category: "family",
  icon: "💍",
  gradient: "from-pink-600 to-rose-500",
  legalBasisFa: "رویه قضایی و شاخص بانک مرکزی (تعدیل مهریه)",
  datasetIds: ["dowry-index-1404"],
  confidence: "medium",
  available: true,
  fields: [
    {
      key: "nominalDowry",
      labelFa: "مبلغ اسمی مهریه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 114_000_000,
      min: 0,
    },
    {
      key: "indexAtMarriage",
      labelFa: "شاخص سال وقوع عقد",
      type: "number",
      required: true,
      defaultValue: 42,
      min: 0,
      helpFa: "شاخص سال عقد از گزارش رسمی بانک مرکزی.",
    },
    {
      key: "indexAtClaim",
      labelFa: "شاخص سال مطالبه",
      type: "number",
      required: true,
      defaultValue: 152,
      min: 0,
      helpFa: "شاخص سال مطالبه از گزارش رسمی بانک مرکزی.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("dowry-index-1404");
  const rates = ds.rates as unknown as DowryRates;

  const nominal = money(num(input, "nominalDowry"), "IRT");
  const indexAtMarriage = num(input, "indexAtMarriage");
  const indexAtClaim = num(input, "indexAtClaim");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  steps.push({
    labelFa: "مبلغ اسمی مهریه",
    valueFa: formatMoney(nominal, "IRT"),
  });
  steps.push({
    labelFa: "شاخص سال عقد",
    valueFa: formatNumberFa(indexAtMarriage, 2),
    noteFa: `مبنا: سال ${formatNumberFa(rates.baseYear)}`,
  });
  steps.push({
    labelFa: "شاخص سال مطالبه",
    valueFa: formatNumberFa(indexAtClaim, 2),
  });

  let revalued: Money = nominal;

  if (indexAtMarriage <= 0) {
    warningsFa.push("شاخص سال عقد باید بزرگ‌تر از صفر باشد؛ تعدیلی اعمال نشد.");
  } else {
    const ratio = indexAtClaim / indexAtMarriage;
    revalued = scaleMoney(nominal, ratio);
    steps.push({
      labelFa: "ضریب تعدیل",
      valueFa: formatPercentFa(ratio, 1),
      noteFa: "نسبت شاخص مطالبه به شاخص عقد",
    });
    steps.push({
      labelFa: "مهریه به نرخ روز",
      valueFa: formatMoney(revalued, "IRT"),
    });
  }

  return {
    headlineFa: formatMoney(revalued, "IRT"),
    headlineValue: revalued.rial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const dowryCalculator: Calculator = { def, compute };
