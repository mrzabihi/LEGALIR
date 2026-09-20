// ============================================================
// عیدی و پاداش پایان سال — annual bonus
// ============================================================
// Governing instrument: ماده ۲۴ قانون کار و آیین‌نامه اجرایی آن.
//
// Formula:
//   fullYearBonus = wage × (bonusDays / daysPerMonth)
//   proRated      = fullYearBonus × (monthsWorked / monthsPerYear)
//   capped        = min(proRated, minimumMonthlyWage × capMultiple)
// The statutory range is 60–90 days' wage; the user picks the days
// within that range (defaults to the 90-day ceiling).

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatDaysFa, formatMoney, formatMonthsFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface LaborRates {
  minimumMonthlyWageRial: number;
  bonusMinDays: number;
  bonusMaxDays: number;
  bonusCapMultipleOfMinWage: number;
  daysPerMonth: number;
  monthsPerYear: number;
}

const def: CalculatorDef = {
  id: "calc-bonus",
  slug: "bonus",
  titleFa: "عیدی و پاداش",
  subtitleFa: "محاسبه عیدی پایان سال",
  descriptionFa:
    "عیدی پایان سال بین ۶۰ تا ۹۰ روز مزد است و برای کارکرد کمتر از یک سال، به نسبت محاسبه می‌شود. سقف قانونی، سه برابر حداقل مزد ماهانه است.",
  category: "employment",
  icon: "🎁",
  gradient: "from-emerald-600 to-green-500",
  legalBasisFa: "ماده ۲۴ قانون کار و آیین‌نامه اجرایی آن",
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
      key: "monthsWorked",
      labelFa: "ماه‌های کارکرد در سال",
      type: "number",
      required: true,
      defaultValue: 12,
      min: 0,
      max: 12,
      step: 0.5,
    },
    {
      key: "bonusDays",
      labelFa: "روزهای عیدی",
      type: "number",
      required: true,
      defaultValue: 90,
      min: 60,
      max: 90,
      helpFa: "حداقل ۶۰ و حداکثر ۹۰ روز مزد.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("labor-1404");
  const rates = ds.rates as unknown as LaborRates;

  const wage = money(num(input, "monthlyWage"), "IRT");
  const monthsWorked = Math.min(num(input, "monthsWorked"), rates.monthsPerYear);
  const bonusDays = num(input, "bonusDays");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  // Compute the final amount from unrounded intermediates so repeated
  // rounding of the daily wage cannot accumulate drift; the displayed
  // steps are rounded only for presentation.
  const dailyWageRial = wage.rial / rates.daysPerMonth;
  steps.push({
    labelFa: "مزد روزانه",
    valueFa: formatMoney(money(Math.round(dailyWageRial), "IRR"), "IRT"),
    noteFa: `مزد ماهانه تقسیم بر ${formatDaysFa(rates.daysPerMonth)}`,
  });

  const fullYearRial = dailyWageRial * bonusDays;
  steps.push({
    labelFa: `عیدی یک سال کامل (${formatDaysFa(bonusDays)})`,
    valueFa: formatMoney(money(Math.round(fullYearRial), "IRR"), "IRT"),
  });

  let result: Money = money(
    Math.round(fullYearRial * (monthsWorked / rates.monthsPerYear)),
    "IRR"
  );
  steps.push({
    labelFa: `عیدی به نسبت ${formatMonthsFa(monthsWorked)} کارکرد`,
    valueFa: formatMoney(result, "IRT"),
  });

  const cap = money(
    rates.minimumMonthlyWageRial * rates.bonusCapMultipleOfMinWage,
    "IRR"
  );
  if (result.rial > cap.rial) {
    result = cap;
    warningsFa.push(
      "مبلغ محاسبه‌شده از سقف قانونی (سه برابر حداقل مزد ماهانه) بیشتر بود و به سقف محدود شد."
    );
    steps.push({
      labelFa: "اعمال سقف قانونی",
      valueFa: formatMoney(cap, "IRT"),
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

export const bonusCalculator: Calculator = { def, compute };
