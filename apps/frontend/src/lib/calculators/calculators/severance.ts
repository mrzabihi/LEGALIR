// ============================================================
// سنوات خدمت — end-of-service gratuity
// ============================================================
// Governing instrument: ماده ۲۴ قانون کار.
//
// Formula:
//   severance = lastMonthlyWage × (yearsOfService + monthsOfService/12)
// One month's wage per completed year of service, based on the LAST
// wage. Partial years are pro-rated by month.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatMonthsFa, formatYearsFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface LaborRates {
  monthsPerYear: number;
}

const def: CalculatorDef = {
  id: "calc-severance",
  slug: "severance",
  titleFa: "سنوات خدمت",
  subtitleFa: "محاسبه حق سنوات پایان کار",
  descriptionFa:
    "حق سنوات معادل یک ماه مزد به ازای هر سال کامل سابقه خدمت است و بر مبنای آخرین مزد محاسبه می‌شود. سال‌های ناقص به نسبت ماه محاسبه می‌گردد.",
  category: "employment",
  icon: "📅",
  gradient: "from-teal-600 to-emerald-500",
  legalBasisFa: "ماده ۲۴ قانون کار",
  datasetIds: ["labor-1404"],
  confidence: "high",
  available: true,
  fields: [
    {
      key: "lastMonthlyWage",
      labelFa: "آخرین مزد ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
    },
    {
      key: "yearsOfService",
      labelFa: "سابقه خدمت (سال)",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 0,
      step: 1,
    },
    {
      key: "extraMonths",
      labelFa: "ماه‌های مازاد بر سال کامل",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      max: 11,
      step: 1,
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("labor-1404");
  const rates = ds.rates as unknown as LaborRates;

  const wage = money(num(input, "lastMonthlyWage"), "IRT");
  const years = num(input, "yearsOfService");
  const extraMonths = num(input, "extraMonths");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  steps.push({
    labelFa: "آخرین مزد ماهانه",
    valueFa: formatMoney(wage, "IRT"),
  });

  const totalYears = years + extraMonths / rates.monthsPerYear;
  const result: Money = scaleMoney(wage, totalYears);

  steps.push({
    labelFa: "سابقه کل",
    valueFa: `${formatYearsFa(years)} و ${formatMonthsFa(extraMonths)}`,
  });
  steps.push({
    labelFa: "حق سنوات",
    valueFa: formatMoney(result, "IRT"),
    noteFa: "یک ماه مزد به ازای هر سال کامل سابقه",
  });

  return {
    headlineFa: formatMoney(result, "IRT"),
    headlineValue: result.rial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const severanceCalculator: Calculator = { def, compute };
