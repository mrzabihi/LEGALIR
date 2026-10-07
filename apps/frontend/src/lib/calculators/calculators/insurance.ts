// ============================================================
// حق بیمه تأمین اجتماعی — social-security contribution
// ============================================================
// Governing instrument: قانون تأمین اجتماعی، ماده ۲۸ و قانون بیمه
// بیکاری.
//
// Formula:
//   insurableWage = clamp(monthlyWage, floor, ceiling)
//   employee      = insurableWage × 7%
//   employer      = insurableWage × 20%
//   unemployment  = insurableWage × 3%   (borne by the employer)
//   total         = insurableWage × 30%
//
// The floor is the statutory minimum wage; the ceiling is a multiple
// of it. Both are annual figures and come from the dataset.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface InsuranceRates {
  employeeRate: number;
  employerRate: number;
  unemploymentRate: number;
  totalRate: number;
  minInsurableMonthlyWageRial: number;
  maxInsurableMultipleOfMinWage: number;
}

const def: CalculatorDef = {
  id: "calc-insurance",
  slug: "insurance",
  titleFa: "حق بیمه تأمین اجتماعی",
  subtitleFa: "محاسبه سهم کارگر و کارفرما از حق بیمه",
  descriptionFa:
    "حق بیمه تأمین اجتماعی را بر پایه مزد ماهانه و سهم‌های قانونی کارگر (۷٪)، کارفرما (۲۰٪) و بیمه بیکاری (۳٪) محاسبه کنید. مزد مشمول بیمه بین کف و سقف قانونی محدود می‌شود.",
  category: "employment",
  icon: "🛡️",
  gradient: "from-emerald-600 to-green-500",
  legalBasisFa: "ماده ۲۸ قانون تأمین اجتماعی و قانون بیمه بیکاری",
  datasetIds: ["insurance-1405"],
  confidence: "high",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر حق بیمه تأمین اجتماعی را به تفکیک سهم کارگر، کارفرما و بیمه بیکاری محاسبه می‌کند. نرخ‌ها ثابت و قانونی‌اند؛ فقط کف و سقف مزد مشمول بیمه سالانه تعیین می‌شود.",
  howItWorksFa:
    "ابتدا مزد ماهانه در بازه کف و سقف قانونی محدود می‌شود. سپس هر سهم با نرخ قانونی خود (۷٪ کارگر، ۲۰٪ کارفرما، ۳٪ بیمه بیکاری) محاسبه و جمع می‌گردد.",
  requiredInfoFa: "مزد ماهانه مشمول بیمه.",
  determinacyFa:
    "نرخ‌های بیمه ثابت و قانونی‌اند و نتیجه قطعی است؛ به شرط آنکه مزد مشمول بیمه درست تعیین شده باشد.",
  disclaimerFa:
    "این محاسبه بر پایه مزد اعلامی و نرخ‌های قانونی انجام شده است. کف و سقف مزد مشمول بیمه هر سال توسط سازمان تأمین اجتماعی اعلام می‌شود.",
  faq: [
    {
      qFa: "سهم کارگر و کارفرما از بیمه چقدر است؟",
      aFa: "طبق ماده ۲۸ قانون تأمین اجتماعی، سهم کارگر ۷٪ و سهم کارفرما ۲۰٪ است و ۳٪ بیمه بیکاری نیز بر عهده کارفرماست.",
    },
    {
      qFa: "سقف مزد مشمول بیمه چقدر است؟",
      aFa: "سقف مزد مشمول بیمه معادل هفت برابر حداقل مزد ماهانه است و سالانه اعلام می‌شود.",
    },
    {
      qFa: "آیا بیمه بیکاری از کارگر کسر می‌شود؟",
      aFa: "خیر؛ ۳٪ بیمه بیکاری بر عهده کارفرماست و از مزد کارگر کسر نمی‌شود.",
    },
  ],
  relatedSlugs: ["salary-benefits", "payroll-tax", "overtime", "salary"],
  nextAction: {
    promptFa: "می‌خواهید حقوق خالص خود را پس از کسر بیمه و مالیات ببینید؟",
    labelFa: "محاسبه فیش حقوقی کامل",
    href: "/calculators/salary-benefits",
  },
  fields: [
    {
      key: "monthlyWage",
      labelFa: "مزد ماهانه مشمول بیمه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
      helpFa: "مزد مشمول بیمه؛ بین کف و سقف قانونی محدود می‌شود.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("insurance-1405");
  const rates = ds.rates as unknown as InsuranceRates;

  const wage = money(num(input, "monthlyWage"), "IRT");
  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const floorRial = rates.minInsurableMonthlyWageRial;
  const ceilingRial = floorRial * rates.maxInsurableMultipleOfMinWage;

  let insurableRial = wage.rial;
  if (insurableRial < floorRial) {
    insurableRial = floorRial;
    warningsFa.push(
      "مزد واردشده کمتر از کف قانونی بود و به حداقل مزد مشمول بیمه افزایش یافت."
    );
  } else if (insurableRial > ceilingRial) {
    insurableRial = ceilingRial;
    warningsFa.push(
      "مزد واردشده بیشتر از سقف قانونی بود و به سقف مزد مشمول بیمه محدود شد."
    );
  }

  const insurable = money(insurableRial, "IRR");
  steps.push({
    labelFa: "مزد مشمول بیمه",
    valueFa: formatMoney(insurable, "IRT"),
    noteFa: `کف: ${formatMoney(money(floorRial, "IRR"), "IRT")} — سقف: ${formatMoney(money(ceilingRial, "IRR"), "IRT")}`,
  });

  const employeeRial = insurableRial * rates.employeeRate;
  const employerRial = insurableRial * rates.employerRate;
  const unemploymentRial = insurableRial * rates.unemploymentRate;
  const totalRial = insurableRial * rates.totalRate;

  steps.push({
    labelFa: `سهم کارگر (${formatPercentFa(rates.employeeRate)})`,
    valueFa: formatMoney(money(Math.round(employeeRial), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: `سهم کارفرما (${formatPercentFa(rates.employerRate)})`,
    valueFa: formatMoney(money(Math.round(employerRial), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: `بیمه بیکاری (${formatPercentFa(rates.unemploymentRate)})`,
    valueFa: formatMoney(money(Math.round(unemploymentRial), "IRR"), "IRT"),
    noteFa: "بر عهده کارفرما",
  });

  const total: Money = money(Math.round(totalRial), "IRR");
  steps.push({
    labelFa: `جمع کل حق بیمه (${formatPercentFa(rates.totalRate)})`,
    valueFa: formatMoney(total, "IRT"),
  });

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "جمع حق بیمه ماهانه",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "مزد مشمول بیمه ابتدا در بازه کف و سقف قانونی محدود می‌شود. سپس سهم کارگر (۷٪)، سهم کارفرما (۲۰٪) و بیمه بیکاری (۳٪) محاسبه و جمع می‌گردد. سهم کارگر از حقوق کسر می‌شود و سهم کارفرما و بیمه بیکاری بر عهده کارفرماست.",
    legalNotesFa: [
      "ماده ۲۸ قانون تأمین اجتماعی: سهم کارگر ۷٪ و سهم کارفرما ۲۰٪.",
      "قانون بیمه بیکاری: ۳٪ بر عهده کارفرما.",
      "سقف مزد مشمول بیمه معادل هفت برابر حداقل مزد ماهانه.",
    ],
  };
}

export const insuranceCalculator: Calculator = { def, compute };
