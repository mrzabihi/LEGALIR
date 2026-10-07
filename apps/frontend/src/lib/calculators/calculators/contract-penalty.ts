// ============================================================
// وجه التزام قراردادی — contractual penalty
// ============================================================
// Governing instrument: قانون مدنی، ماده ۲۳۰ (وجه التزام / شرط کیفری).
//
// Formula:
//   penalty = contractAmount × monthlyPenaltyRate × delayMonths
// A contractual penalty is a matter of the parties' agreement; there is
// NO statutory rate. The calculator therefore applies the rate the user
// supplies and never invents one. The result is labelled «قراردادی».

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface PenaltyRates {
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-contract-penalty",
  slug: "contract-penalty",
  titleFa: "وجه التزام قراردادی",
  subtitleFa: "محاسبه خسارت توافقی تأخیر در انجام تعهد",
  descriptionFa:
    "وجه التزام (خسارت توافقی تأخیر) را بر پایه مبلغ قرارداد، نرخ توافق‌شده و مدت تأخیر محاسبه کنید. وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد.",
  category: "contracts",
  icon: "📝",
  gradient: "from-lime-700 to-green-600",
  legalBasisFa: "ماده ۲۳۰ قانون مدنی (وجه التزام / شرط کیفری)",
  datasetIds: ["penalty-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر وجه التزام قراردادی را بر پایه مبلغ قرارداد، نرخ توافق‌شده و مدت تأخیر محاسبه می‌کند. وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد.",
  howItWorksFa:
    "مبلغ قرارداد در نرخ توافق‌شده ماهانه و در تعداد ماه‌های تأخیر ضرب می‌شود تا مبلغ وجه التزام به دست آید.",
  requiredInfoFa: "مبلغ قرارداد، نرخ وجه التزام ماهانه و مدت تأخیر (بر حسب ماه).",
  determinacyFa:
    "وجه التزام تابع توافق طرفین است؛ بنابراین مبلغ آن به نرخ و شرایط قرارداد وابسته است و نرخ قانونی ثابت ندارد.",
  disclaimerFa:
    "این محاسبه بر پایه نرخ توافق‌شده در قرارداد انجام شده است. وجه التزام تابع توافق طرفین است و در صورت اختلاف، به تشخیص مرجع صالح وابسته است.",
  faq: [
    {
      qFa: "وجه التزام چیست؟",
      aFa: "وجه التزام مبلغی است که طرفین در قرارداد توافق می‌کنند در صورت تأخیر یا تخلف از تعهد پرداخت شود.",
    },
    {
      qFa: "آیا وجه التزام نرخ قانونی دارد؟",
      aFa: "خیر؛ وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد.",
    },
    {
      qFa: "وجه التزام چگونه محاسبه می‌شود؟",
      aFa: "بر پایه مبلغ قرارداد، نرخ توافق‌شده و مدت تأخیر محاسبه می‌شود. در این محاسبه‌گر نرخ ماهانه در تعداد ماه‌های تأخیر ضرب می‌گردد.",
    },
  ],
  relatedSlugs: ["delayed-payment", "check-damages", "lawyer-fee"],
  nextAction: {
    promptFa: "می‌خواهید خسارت تأخیر تأدیه را محاسبه کنید؟",
    labelFa: "محاسبه خسارت تأخیر تأدیه",
    href: "/calculators/delayed-payment",
  },
  fields: [
    {
      key: "contractAmount",
      labelFa: "مبلغ قرارداد",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 1_000_000_000,
      min: 0,
      helpFa: "مبلغ موضوع قرارداد.",
    },
    {
      key: "monthlyPenaltyRate",
      labelFa: "نرخ وجه التزام ماهانه",
      type: "percent",
      required: true,
      defaultValue: 2,
      min: 0,
      max: 100,
      step: 0.1,
      helpFa: "درصد توافق‌شده در قرارداد به‌صورت ماهانه.",
    },
    {
      key: "delayMonths",
      labelFa: "مدت تأخیر (ماه)",
      type: "number",
      required: true,
      defaultValue: 3,
      min: 0,
      max: 120,
      step: 1,
      helpFa: "مدت تأخیر در انجام تعهد.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("penalty-1405");
  const rates = ds.rates as unknown as PenaltyRates;

  const contractAmount = money(num(input, "contractAmount"), "IRT");
  const monthlyRatePercent = num(input, "monthlyPenaltyRate");
  const delayMonths = Math.max(0, num(input, "delayMonths"));

  const monthlyRate = monthlyRatePercent / 100;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const penaltyRial = contractAmount.rial * monthlyRate * delayMonths;

  steps.push({
    labelFa: "مبلغ قرارداد",
    valueFa: formatMoney(contractAmount, "IRT"),
  });
  steps.push({
    labelFa: `نرخ وجه التزام ماهانه (${formatPercentFa(monthlyRate)})`,
    valueFa: `${formatNumberFa(monthlyRatePercent, 2)}٪`,
  });
  steps.push({
    labelFa: `مدت تأخیر (${formatNumberFa(delayMonths)} ماه)`,
    valueFa: `${formatNumberFa(delayMonths)} ماه`,
  });

  const penalty: Money = roundTo(
    money(Math.round(penaltyRial), "IRR"),
    rates.roundingStepRial
  );

  steps.push({
    labelFa: "وجه التزام قراردادی",
    valueFa: formatMoney(penalty, "IRT"),
  });

  if (contractAmount.rial === 0 || delayMonths === 0) {
    warningsFa.push("مبلغ قرارداد یا مدت تأخیر وارد نشده است؛ وجه التزامی محاسبه نشد.");
  }
  warningsFa.push(
    "وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد؛ این محاسبه بر پایه نرخ واردشده انجام شده است."
  );

  return {
    headlineFa: formatMoney(penalty, "IRT"),
    headlineValue: penalty.rial,
    unit: "IRT",
    headlineLabelFa: "وجه التزام قراردادی",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "وجه التزام قراردادی از ضرب مبلغ قرارداد در نرخ توافق‌شده ماهانه و در تعداد ماه‌های تأخیر به دست می‌آید. وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد.",
    legalNotesFa: [
      "ماده ۲۳۰ قانون مدنی: وجه التزام / شرط کیفری.",
      "وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد.",
      "در صورت اختلاف، تعیین مبلغ به تشخیص مرجع صالح وابسته است.",
    ],
  };
}

export const contractPenaltyCalculator: Calculator = { def, compute };
