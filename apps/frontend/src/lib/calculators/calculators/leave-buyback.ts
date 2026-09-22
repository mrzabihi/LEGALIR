// ============================================================
// بازخرید مرخصی — unused-leave buyback
// ============================================================
// Governing instrument: مواد ۶۴ و ۷۱ قانون کار.
//
// Formula:
//   dailyWage = monthlyWage / daysPerMonth
//   buyback   = dailyWage × unusedDays × (1 + premiumRate)
// The statute entitles the worker to pay for unused leave; the
// premium (default 0) lets the user model a contractual uplift.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatDaysFa, formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface LaborRates {
  daysPerMonth: number;
  annualLeaveDays: number;
}

const def: CalculatorDef = {
  id: "calc-leave-buyback",
  slug: "leave-buyback",
  titleFa: "بازخرید مرخصی",
  subtitleFa: "محاسبه ارزش مرخصی استفاده‌نشده",
  descriptionFa:
    "مرخصی استفاده‌نشده بر مبنای مزد روزانه محاسبه و بازخرید می‌شود. در صورت وجود توافق یا مقررات داخلی، می‌توانید ضریب افزایش را نیز اعمال کنید.",
  category: "employment",
  icon: "🏖️",
  gradient: "from-sky-600 to-cyan-500",
  legalBasisFa: "مواد ۶۴ و ۷۱ قانون کار",
  datasetIds: ["labor-1404"],
  confidence: "high",
  available: true,
  fields: [
    {
      key: "monthlyWage",
      labelFa: "مزد ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
    },
    {
      key: "unusedDays",
      labelFa: "روزهای مرخصی استفاده‌نشده",
      type: "number",
      required: true,
      defaultValue: 15,
      min: 0,
      step: 1,
    },
    {
      key: "premiumPercent",
      labelFa: "ضریب افزایش (درصد)",
      type: "percent",
      required: false,
      defaultValue: 0,
      min: 0,
      max: 100,
      helpFa: "در صورت وجود توافق یا مقررات داخلی کارفرما.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("labor-1404");
  const rates = ds.rates as unknown as LaborRates;

  const wage = money(num(input, "monthlyWage"), "IRT");
  const unusedDays = num(input, "unusedDays");
  const premium = num(input, "premiumPercent") / 100;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  // Derive the final amount from unrounded intermediates; the displayed
  // steps are rounded only for presentation.
  const dailyWageRial = wage.rial / rates.daysPerMonth;
  steps.push({
    labelFa: "مزد روزانه",
    valueFa: formatMoney(money(Math.round(dailyWageRial), "IRR"), "IRT"),
    noteFa: `مزد ماهانه تقسیم بر ${formatDaysFa(rates.daysPerMonth)}`,
  });

  const baseRial = dailyWageRial * unusedDays;
  steps.push({
    labelFa: `ارزش ${formatDaysFa(unusedDays)} مرخصی`,
    valueFa: formatMoney(money(Math.round(baseRial), "IRR"), "IRT"),
  });

  let result: Money = money(Math.round(baseRial), "IRR");
  if (premium > 0) {
    result = money(Math.round(baseRial * (1 + premium)), "IRR");
    steps.push({
      labelFa: `اعمال ضریب افزایش ${formatPercentFa(premium)}`,
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

export const leaveBuybackCalculator: Calculator = { def, compute };

