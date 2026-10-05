// ============================================================
// هزینه اجرای حکم — enforcement fee (نیم‌عشر اجرایی)
// ============================================================
// Governing instrument: قانون اجرای احکام مدنی و تعرفه خدمات اجرایی.
//
// Formula:
//   enforcementFee = amountRecovered × enforcementRate   (نیم‌عشر = ۵٪)
//   total          = max(enforcementFee, minimumRial)
// The enforcement fee is a percentage of the amount actually recovered
// and is a distinct concept from the court fee (هزینه دادرسی); the two
// are never merged.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface ExecutionFeeRates {
  enforcementRate: number;
  minimumRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-execution-fee",
  slug: "execution-fee",
  titleFa: "هزینه اجرای حکم",
  subtitleFa: "محاسبه نیم‌عشر اجرایی بر پایه مبلغ وصول‌شده",
  descriptionFa:
    "هزینه اجرای حکم (نیم‌عشر اجرایی) را بر پایه مبلغ وصول‌شده محاسبه کنید. این هزینه جدا از هزینه دادرسی است و بر مبلغی که واقعاً وصول می‌شود تعلق می‌گیرد.",
  category: "judicial",
  icon: "⚖️",
  gradient: "from-slate-700 to-gray-600",
  legalBasisFa: "قانون اجرای احکام مدنی و تعرفه خدمات اجرایی",
  datasetIds: ["execution-fee-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر هزینه اجرای حکم را بر پایه مبلغ وصول‌شده محاسبه می‌کند. نیم‌عشر اجرایی درصدی از مبلغ وصول‌شده است و با هزینه دادرسی متفاوت است.",
  howItWorksFa:
    "مبلغ وصول‌شده در نرخ نیم‌عشر اجرایی ضرب می‌شود. اگر مبلغ حاصل از حداقل قانونی کمتر باشد، حداقل قانونی اعمال می‌گردد.",
  requiredInfoFa: "مبلغ وصول‌شده (مبلغی که از محکوم‌علیه وصول می‌شود).",
  determinacyFa:
    "نرخ نیم‌عشر اجرایی قانونی است؛ اما مبلغ نهایی به مبلغ واقعی وصول‌شده وابسته است که ممکن است با مبلغ محکوم‌به متفاوت باشد.",
  disclaimerFa:
    "این محاسبه بر پایه مبلغ وصول‌شده اعلامی و تعرفه اجرایی انجام شده است. هزینه اجرا بر مبلغ واقعی وصول‌شده تعلق می‌گیرد که ممکن است کمتر از مبلغ محکوم‌به باشد.",
  faq: [
    {
      qFa: "نیم‌عشر اجرایی چیست؟",
      aFa: "نیم‌عشر اجرایی هزینه‌ای است که برای اجرای حکم بر مبلغ وصول‌شده تعلق می‌گیرد و معمولاً معادل ۵٪ مبلغ وصول‌شده است.",
    },
    {
      qFa: "تفاوت هزینه اجرا و هزینه دادرسی چیست؟",
      aFa: "هزینه دادرسی هنگام طرح دعوا پرداخت می‌شود، اما هزینه اجرا هنگام اجرای حکم و بر مبلغ وصول‌شده تعلق می‌گیرد. این دو مفهوم جدا هستند.",
    },
    {
      qFa: "آیا هزینه اجرا بر کل مبلغ محکوم‌به تعلق می‌گیرد؟",
      aFa: "خیر؛ هزینه اجرا بر مبلغی تعلق می‌گیرد که واقعاً وصول می‌شود، نه لزوماً کل مبلغ محکوم‌به.",
    },
  ],
  relatedSlugs: ["court-fee", "check-damages", "lawyer-fee"],
  nextAction: {
    promptFa: "می‌خواهید هزینه دادرسی را نیز محاسبه کنید؟",
    labelFa: "محاسبه هزینه دادرسی",
    href: "/calculators/court-fee",
  },
  fields: [
    {
      key: "amountRecovered",
      labelFa: "مبلغ وصول‌شده",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 500_000_000,
      min: 0,
      helpFa: "مبلغی که از محکوم‌علیه وصول می‌شود.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("execution-fee-1405");
  const rates = ds.rates as unknown as ExecutionFeeRates;

  const recovered = money(num(input, "amountRecovered"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const rawFeeRial = recovered.rial * rates.enforcementRate;
  const feeRial = Math.max(rawFeeRial, rates.minimumRial);

  steps.push({
    labelFa: "مبلغ وصول‌شده",
    valueFa: formatMoney(recovered, "IRT"),
  });
  steps.push({
    labelFa: `نیم‌عشر اجرایی (${formatPercentFa(rates.enforcementRate)})`,
    valueFa: formatMoney(money(Math.round(rawFeeRial), "IRR"), "IRT"),
  });

  if (rawFeeRial < rates.minimumRial) {
    steps.push({
      labelFa: "حداقل قانونی هزینه اجرا",
      valueFa: formatMoney(money(rates.minimumRial, "IRR"), "IRT"),
      noteFa: "چون مبلغ محاسبه‌شده کمتر از حداقل قانونی است.",
    });
  }

  const fee: Money = roundTo(money(Math.round(feeRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "هزینه اجرای حکم",
    valueFa: formatMoney(fee, "IRT"),
  });

  if (recovered.rial === 0) {
    warningsFa.push("مبلغ وصول‌شده وارد نشده است؛ حداقل هزینه اجرا اعمال شد.");
  }

  return {
    headlineFa: formatMoney(fee, "IRT"),
    headlineValue: fee.rial,
    unit: "IRT",
    headlineLabelFa: "هزینه اجرای حکم",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "هزینه اجرای حکم (نیم‌عشر اجرایی) درصدی از مبلغ وصول‌شده است. اگر مبلغ محاسبه‌شده کمتر از حداقل قانونی باشد، حداقل قانونی اعمال می‌شود. این هزینه جدا از هزینه دادرسی است.",
    legalNotesFa: [
      "نیم‌عشر اجرایی بر مبلغ وصول‌شده تعلق می‌گیرد.",
      "هزینه اجرا با هزینه دادرسی متفاوت است.",
      "مبلغ نهایی به مبلغ واقعی وصول‌شده وابسته است.",
    ],
  };
}

export const executionFeeCalculator: Calculator = { def, compute };
