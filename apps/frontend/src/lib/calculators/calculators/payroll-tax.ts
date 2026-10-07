// ============================================================
// مالیات بر درآمد حقوق — payroll income tax
// ============================================================
// Governing instrument: قانون مالیات‌های مستقیم، مواد ۸۴ و ۸۵.
//
// Formula:
//   insurance = gross × employeeInsuranceRate
//   taxable   = max(0, gross − insurance − annualExemption)
//   tax       = Σ over brackets of (slice of taxable × bracket rate)
// Brackets are cumulative and annual. The exemption ceiling and the
// bracket edges are set annually in the budget law.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface Bracket {
  upToRial: number | null;
  rate: number;
}

interface PayrollTaxRates {
  annualExemptionRial: number;
  brackets: Bracket[];
  employeeInsuranceRate: number;
  monthsPerYear: number;
}

const def: CalculatorDef = {
  id: "calc-payroll-tax",
  slug: "payroll-tax",
  titleFa: "مالیات بر درآمد حقوق",
  subtitleFa: "محاسبه مالیات حقوق به‌صورت پله‌ای",
  descriptionFa:
    "مالیات بر درآمد حقوق را بر پایه درآمد مشمول (پس از کسر بیمه و معافیت سالانه) و جدول پله‌ای مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم محاسبه کنید.",
  category: "employment",
  icon: "🏛️",
  gradient: "from-slate-600 to-gray-500",
  legalBasisFa: "مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم",
  datasetIds: ["payroll-tax-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر مالیات بر درآمد حقوق را به‌صورت پله‌ای و تجمعی محاسبه می‌کند. ابتدا سهم بیمه و معافیت سالانه از درآمد کسر می‌شود، سپس هر پله از درآمد مشمول با نرخ خود مشمول مالیات می‌گردد.",
  howItWorksFa:
    "درآمد مشمول از کسر بیمه کارگر و معافیت سالانه از حقوق ناخالص به دست می‌آید. سپس این مبلغ به‌صورت تجمعی در پله‌های ۱۰٪ تا ۳۰٪ ضرب و جمع می‌شود.",
  requiredInfoFa: "حقوق ماهانه ناخالص و دوره محاسبه (ماهانه یا سالانه).",
  determinacyFa:
    "ساختار پله‌ای قانونی است؛ اما سقف معافیت و مرز پله‌ها هر سال در قانون بودجه تعیین می‌شود و باید با مصوبه جاری تطبیق داده شود.",
  disclaimerFa:
    "این محاسبه یک برآورد بر پایه جدول ساده‌شده است و جایگزین محاسبه رسمی سازمان امور مالیاتی نیست. سقف معافیت و پله‌ها سالانه تغییر می‌کند.",
  faq: [
    {
      qFa: "درآمد مشمول مالیات چگونه محاسبه می‌شود؟",
      aFa: "از حقوق ناخالص، سهم بیمه تأمین اجتماعی کارگر و سقف معافیت سالانه کسر می‌شود؛ باقی‌مانده درآمد مشمول است.",
    },
    {
      qFa: "نرخ‌های مالیات حقوق چقدر است؟",
      aFa: "جدول پله‌ای از ۱۰٪ شروع و به ۳۰٪ می‌رسد؛ هر پله به‌صورت تجمعی محاسبه می‌شود.",
    },
    {
      qFa: "آیا معافیت سالانه به‌صورت ماهانه هم اعمال می‌شود؟",
      aFa: "بله؛ سقف معافیت سالانه بر ۱۲ تقسیم و به‌صورت ماهانه از درآمد کسر می‌شود.",
    },
  ],
  relatedSlugs: ["salary-benefits", "insurance", "salary", "overtime"],
  nextAction: {
    promptFa: "می‌خواهید کل فیش حقوقی خود را با مزایا محاسبه کنید؟",
    labelFa: "محاسبه فیش حقوقی کامل",
    href: "/calculators/salary-benefits",
  },
  fields: [
    {
      key: "period",
      labelFa: "دوره محاسبه",
      type: "select",
      required: true,
      defaultValue: "monthly",
      options: [
        { value: "monthly", labelFa: "ماهانه" },
        { value: "annual", labelFa: "سالانه" },
      ],
    },
    {
      key: "grossIncome",
      labelFa: "حقوق ناخالص",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
      helpFa: "مبلغ بر اساس دوره انتخاب‌شده.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("payroll-tax-1405");
  const rates = ds.rates as unknown as PayrollTaxRates;

  const period = str(input, "period");
  const entered = money(num(input, "grossIncome"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  // Normalise to an annual gross so the annual brackets apply directly.
  const annualGrossRial =
    period === "annual" ? entered.rial : entered.rial * rates.monthsPerYear;

  const insuranceRial = annualGrossRial * rates.employeeInsuranceRate;
  const taxableRial = Math.max(0, annualGrossRial - insuranceRial - rates.annualExemptionRial);

  steps.push({
    labelFa: "حقوق ناخالص سالانه",
    valueFa: formatMoney(money(Math.round(annualGrossRial), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: `بیمه تأمین اجتماعی (${formatPercentFa(rates.employeeInsuranceRate)})`,
    valueFa: `− ${formatMoney(money(Math.round(insuranceRial), "IRR"), "IRT")}`,
  });
  steps.push({
    labelFa: "معافیت سالانه",
    valueFa: `− ${formatMoney(money(rates.annualExemptionRial, "IRR"), "IRT")}`,
  });
  steps.push({
    labelFa: "درآمد مشمول مالیات",
    valueFa: formatMoney(money(Math.round(taxableRial), "IRR"), "IRT"),
  });

  // Cumulative brackets.
  let remaining = taxableRial;
  let lowerBound = 0;
  let taxRial = 0;
  for (const bracket of rates.brackets) {
    if (remaining <= 0) break;
    const upper = bracket.upToRial ?? Infinity;
    const slice = Math.min(remaining, upper - lowerBound);
    if (slice > 0) {
      const sliceTax = slice * bracket.rate;
      taxRial += sliceTax;
      steps.push({
        labelFa: `پله ${formatPercentFa(bracket.rate)}`,
        valueFa: formatMoney(money(Math.round(sliceTax), "IRR"), "IRT"),
        noteFa: `بر ${formatMoney(money(Math.round(slice), "IRR"), "IRT")} از درآمد مشمول`,
      });
      remaining -= slice;
    }
    lowerBound = upper;
  }

  const annualTax: Money = money(Math.round(taxRial), "IRR");
  steps.push({
    labelFa: "مالیات سالانه",
    valueFa: formatMoney(annualTax, "IRT"),
  });

  const monthlyTax = money(Math.round(taxRial / rates.monthsPerYear), "IRR");
  steps.push({
    labelFa: "مالیات ماهانه",
    valueFa: formatMoney(monthlyTax, "IRT"),
  });

  if (taxableRial <= 0) {
    warningsFa.push("درآمد مشمول صفر است؛ مالیاتی تعلق نمی‌گیرد.");
  }

  const headline = period === "annual" ? annualTax : monthlyTax;

  return {
    headlineFa: formatMoney(headline, "IRT"),
    headlineValue: headline.rial,
    unit: "IRT",
    headlineLabelFa: period === "annual" ? "مالیات سالانه" : "مالیات ماهانه",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "ابتدا سهم بیمه کارگر و سقف معافیت سالانه از حقوق ناخالص کسر می‌شود تا درآمد مشمول به دست آید. سپس درآمد مشمول به‌صورت تجمعی در پله‌های قانونی ضرب و جمع می‌گردد. نتیجه سالانه بر ۱۲ تقسیم می‌شود تا مالیات ماهانه حاصل شود.",
    legalNotesFa: [
      "ماده ۸۴ قانون مالیات‌های مستقیم: معافیت سالانه حقوق.",
      "ماده ۸۵ قانون مالیات‌های مستقیم: جدول نرخ‌های پله‌ای مالیات بر درآمد حقوق.",
    ],
  };
}

export const payrollTaxCalculator: Calculator = { def, compute };
