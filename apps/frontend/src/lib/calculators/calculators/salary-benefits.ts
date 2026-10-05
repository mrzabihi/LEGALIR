// ============================================================
// حقوق و مزایا (فیش حقوقی) — full payroll slip
// ============================================================
// Governing instruments: قانون کار (مزد، حق اولاد، حق مسکن) +
// قانون تأمین اجتماعی (سهم کارگر) + قانون مالیات‌های مستقیم
// (ماده ۸۴ و ۸۵).
//
// Formula:
//   gross      = baseWage + housingAllowance + foodAllowance
//                + childAllowance + seniorityPay
//   insurance  = gross × employeeInsuranceRate
//   taxable    = max(0, gross − insurance − annualExemption/12)
//   tax        = monthly share of the annual progressive tax
//   net        = gross − insurance − tax
//
// حق اولاد is a statutory multiple of the minimum DAILY wage per child
// (ماده ۸۶ قانون تأمین اجتماعی). The minimum wage is an annual figure
// and comes from the dataset, never from the UI.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface Bracket {
  upToRial: number | null;
  rate: number;
}

interface LaborRates {
  minimumMonthlyWageRial: number;
  daysPerMonth: number;
  childAllowanceMultipleOfMinDailyWage: number;
}

interface PayrollTaxRates {
  annualExemptionRial: number;
  brackets: Bracket[];
  employeeInsuranceRate: number;
  monthsPerYear: number;
}

/** Cumulative annual tax on a taxable annual amount. */
function annualTax(taxableRial: number, rates: PayrollTaxRates): number {
  let remaining = taxableRial;
  let lowerBound = 0;
  let total = 0;
  for (const bracket of rates.brackets) {
    if (remaining <= 0) break;
    const upper = bracket.upToRial ?? Infinity;
    const slice = Math.min(remaining, upper - lowerBound);
    if (slice > 0) {
      total += slice * bracket.rate;
      remaining -= slice;
    }
    lowerBound = upper;
  }
  return total;
}

const def: CalculatorDef = {
  id: "calc-salary-benefits",
  slug: "salary-benefits",
  titleFa: "حقوق و مزایا (فیش حقوقی)",
  subtitleFa: "محاسبه کامل حقوق ناخالص، بیمه، مالیات و خالص",
  descriptionFa:
    "فیش حقوقی کامل را با احتساب مزد پایه، حق مسکن، بن، حق اولاد و پایه سنوات محاسبه کنید؛ سپس سهم بیمه تأمین اجتماعی و مالیات بر درآمد حقوق کسر و حقوق خالص به دست می‌آید.",
  category: "employment",
  icon: "🧾",
  gradient: "from-indigo-600 to-violet-500",
  legalBasisFa: "قانون کار، قانون تأمین اجتماعی (ماده ۸۶) و مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم",
  datasetIds: ["labor-1405", "payroll-tax-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر یک فیش حقوقی کامل می‌سازد: مزد پایه و مزایا را جمع می‌کند، حق اولاد را بر پایه حداقل مزد روزانه محاسبه می‌کند، سپس سهم بیمه کارگر و مالیات بر درآمد حقوق را کسر می‌کند.",
  howItWorksFa:
    "حقوق ناخالص از جمع مزد پایه و مزایا به دست می‌آید. حق اولاد معادل سه برابر حداقل مزد روزانه به ازای هر فرزند است. سپس ۷٪ بیمه کارگر و مالیات پله‌ای بر درآمد مشمول کسر می‌شود.",
  requiredInfoFa:
    "مزد پایه، حق مسکن، بن، تعداد فرزندان، پایه سنوات و مزایای دیگر.",
  determinacyFa:
    "ساختار محاسبه بر پایه قانون است؛ اما مبالغ مزایا (حق مسکن، بن) سالانه تعیین می‌شوند و باید با مصوبه جاری تطبیق داده شوند.",
  disclaimerFa:
    "این محاسبه بر پایه ارقام واردشده و نرخ‌های سال جاری انجام شده است. مبالغ مزایا و سقف معافیت مالیاتی هر سال تغییر می‌کند؛ پیش از اتکا، مصوبه رسمی سال را بررسی کنید.",
  faq: [
    {
      qFa: "حق اولاد چقدر است؟",
      aFa: "طبق ماده ۸۶ قانون تأمین اجتماعی، حق اولاد معادل سه برابر حداقل مزد روزانه به ازای هر فرزند است.",
    },
    {
      qFa: "سهم بیمه کارگر چند درصد است؟",
      aFa: "سهم کارگر از حق بیمه تأمین اجتماعی ۷٪ حقوق مشمول بیمه است؛ سهم کارفرما جداگانه ۲۰٪ و بیمه بیکاری ۳٪ است.",
    },
    {
      qFa: "مالیات بر درآمد حقوق چگونه محاسبه می‌شود؟",
      aFa: "پس از کسر بیمه و معافیت سالانه، درآمد مشمول به‌صورت پله‌ای و تجمعی مشمول نرخ‌های ۱۰٪ تا ۳۰٪ می‌شود.",
    },
  ],
  relatedSlugs: ["overtime", "insurance", "payroll-tax", "salary"],
  nextAction: {
    promptFa: "می‌خواهید فقط مالیات حقوق خود را جداگانه بررسی کنید؟",
    labelFa: "محاسبه مالیات بر درآمد حقوق",
    href: "/calculators/payroll-tax",
  },
  fields: [
    {
      key: "baseWage",
      labelFa: "مزد پایه ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 100_000_000,
      min: 0,
    },
    {
      key: "housingAllowance",
      labelFa: "حق مسکن ماهانه",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 9_000_000,
      min: 0,
    },
    {
      key: "foodAllowance",
      labelFa: "بن (کمک‌هزینه خواربار) ماهانه",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 14_000_000,
      min: 0,
    },
    {
      key: "childrenCount",
      labelFa: "تعداد فرزندان مشمول حق اولاد",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      max: 20,
      step: 1,
      helpFa: "حق اولاد معادل سه برابر حداقل مزد روزانه به ازای هر فرزند.",
    },
    {
      key: "seniorityPay",
      labelFa: "پایه سنوات ماهانه",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 0,
      min: 0,
    },
    {
      key: "otherAllowances",
      labelFa: "سایر مزایای ماهانه",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 0,
      min: 0,
      helpFa: "مزایای مشمول بیمه و مالیات.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const labor = requireDataset("labor-1405").rates as unknown as LaborRates;
  const tax = requireDataset("payroll-tax-1405");
  const rates = tax.rates as unknown as PayrollTaxRates;

  const baseWage = money(num(input, "baseWage"), "IRT");
  const housing = money(num(input, "housingAllowance"), "IRT");
  const food = money(num(input, "foodAllowance"), "IRT");
  const seniority = money(num(input, "seniorityPay"), "IRT");
  const other = money(num(input, "otherAllowances"), "IRT");
  const children = num(input, "childrenCount");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  // حق اولاد — statutory multiple of the minimum DAILY wage.
  const minDailyWageRial = labor.minimumMonthlyWageRial / labor.daysPerMonth;
  const childAllowanceRial =
    children * minDailyWageRial * labor.childAllowanceMultipleOfMinDailyWage;
  const childAllowance = money(Math.round(childAllowanceRial), "IRR");

  steps.push({
    labelFa: "مزد پایه",
    valueFa: formatMoney(baseWage, "IRT"),
  });
  if (housing.rial > 0) {
    steps.push({ labelFa: "حق مسکن", valueFa: formatMoney(housing, "IRT") });
  }
  if (food.rial > 0) {
    steps.push({ labelFa: "بن", valueFa: formatMoney(food, "IRT") });
  }
  if (children > 0) {
    steps.push({
      labelFa: `حق اولاد (${formatNumberFa(children)} فرزند)`,
      valueFa: formatMoney(childAllowance, "IRT"),
      noteFa: `${formatNumberFa(labor.childAllowanceMultipleOfMinDailyWage)} برابر حداقل مزد روزانه به ازای هر فرزند`,
    });
  }
  if (seniority.rial > 0) {
    steps.push({ labelFa: "پایه سنوات", valueFa: formatMoney(seniority, "IRT") });
  }
  if (other.rial > 0) {
    steps.push({ labelFa: "سایر مزایا", valueFa: formatMoney(other, "IRT") });
  }

  const grossRial =
    baseWage.rial +
    housing.rial +
    food.rial +
    childAllowance.rial +
    seniority.rial +
    other.rial;
  const gross = money(grossRial, "IRR");

  steps.push({
    labelFa: "جمع حقوق ناخالص ماهانه",
    valueFa: formatMoney(gross, "IRT"),
  });

  // Insurance — employee's share of the insurable wage.
  const insuranceRial = grossRial * rates.employeeInsuranceRate;
  steps.push({
    labelFa: `بیمه تأمین اجتماعی (${formatPercentFa(rates.employeeInsuranceRate)})`,
    valueFa: `− ${formatMoney(money(Math.round(insuranceRial), "IRR"), "IRT")}`,
  });

  // Tax — monthly share of the annual progressive tax.
  const monthlyExemption = rates.annualExemptionRial / rates.monthsPerYear;
  const taxableMonthly = Math.max(0, grossRial - insuranceRial - monthlyExemption);
  const taxMonthlyRial = annualTax(taxableMonthly * rates.monthsPerYear, rates) / rates.monthsPerYear;

  steps.push({
    labelFa: "درآمد مشمول مالیات (ماهانه)",
    valueFa: formatMoney(money(Math.round(taxableMonthly), "IRR"), "IRT"),
    noteFa: "پس از کسر بیمه و سهم ماهانه معافیت سالانه",
  });
  steps.push({
    labelFa: "مالیات بر درآمد حقوق (ماهانه)",
    valueFa: `− ${formatMoney(money(Math.round(taxMonthlyRial), "IRR"), "IRT")}`,
  });

  const netRial = grossRial - insuranceRial - taxMonthlyRial;
  const net: Money = money(Math.round(netRial), "IRR");

  steps.push({
    labelFa: "حقوق خالص ماهانه",
    valueFa: formatMoney(net, "IRT"),
  });

  if (grossRial <= 0) {
    warningsFa.push("مبلغی برای حقوق وارد نشده است.");
  }

  return {
    headlineFa: formatMoney(net, "IRT"),
    headlineValue: net.rial,
    unit: "IRT",
    headlineLabelFa: "حقوق خالص ماهانه",
    status: "legal_basis",
    steps,
    warningsFa,
    source: tax.source,
    explanationFa:
      "حقوق ناخالص از جمع مزد پایه و مزایا (حق مسکن، بن، حق اولاد، پایه سنوات و سایر مزایا) به دست می‌آید. حق اولاد معادل سه برابر حداقل مزد روزانه به ازای هر فرزند است. سپس ۷٪ بیمه کارگر و مالیات پله‌ای بر درآمد مشمول کسر می‌شود تا حقوق خالص حاصل گردد.",
    legalNotesFa: [
      "ماده ۸۶ قانون تأمین اجتماعی: حق اولاد معادل سه برابر حداقل مزد روزانه.",
      "ماده ۲۸ قانون تأمین اجتماعی: سهم کارگر ۷٪ حق بیمه.",
      "مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم: جدول مالیات بر درآمد حقوق.",
    ],
  };
}

export const salaryBenefitsCalculator: Calculator = { def, compute };
