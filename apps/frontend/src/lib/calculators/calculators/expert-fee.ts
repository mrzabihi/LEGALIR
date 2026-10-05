// ============================================================
// حق‌الزحمه کارشناسی رسمی — official expert fee
// ============================================================
// Governing instrument: تعرفه حق‌الزحمه کارشناسان رسمی دادگستری.
//
// Formula (cumulative ad-valorem on the subject value):
//   baseFee = Σ over brackets of (slice × bracket rate)
//   fee     = clamp(baseFee, minimumRial, maximumRial) × expertCount
// The tariff is per expert; a multi-expert panel multiplies the
// single-expert fee by the number of experts.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface ExpertFeeRates {
  brackets: Bracket[];
  minimumRial: number;
  maximumRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-expert-fee",
  slug: "expert-fee",
  titleFa: "حق‌الزحمه کارشناسی رسمی",
  subtitleFa: "محاسبه تعرفه کارشناسی بر پایه ارزش موضوع",
  descriptionFa:
    "حق‌الزحمه کارشناسی رسمی دادگستری را بر پایه ارزش موضوع کارشناسی و به‌صورت پله‌ای محاسبه کنید. تعرفه برای هر کارشناس محاسبه می‌شود و در صورت چند کارشناس، در تعداد آن‌ها ضرب می‌گردد.",
  category: "judicial",
  icon: "🔬",
  gradient: "from-indigo-700 to-blue-600",
  legalBasisFa: "تعرفه حق‌الزحمه کارشناسان رسمی دادگستری",
  datasetIds: ["expert-fee-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر حق‌الزحمه کارشناسی رسمی را بر پایه ارزش موضوع کارشناسی و به‌صورت پله‌ای محاسبه می‌کند. تعرفه دارای حداقل و حداکثر قانونی است و در صورت چند کارشناس، در تعداد آن‌ها ضرب می‌شود.",
  howItWorksFa:
    "ارزش موضوع کارشناسی به‌صورت تجمعی در پله‌های تعرفه ضرب و جمع می‌شود. سپس نتیجه بین حداقل و حداکثر قانونی محدود و در تعداد کارشناسان ضرب می‌گردد.",
  requiredInfoFa: "ارزش موضوع کارشناسی و تعداد کارشناسان.",
  determinacyFa:
    "تعرفه کارشناسی رسمی است؛ اما ممکن است هزینه‌های جانبی (ایاب‌وذهاب، هزینه‌های آزمایشگاهی) نیز وجود داشته باشد.",
  disclaimerFa:
    "این محاسبه بر پایه تعرفه رسمی کارشناسی انجام شده است. ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد که در این محاسبه لحاظ نشده است.",
  faq: [
    {
      qFa: "حق‌الزحمه کارشناسی چگونه محاسبه می‌شود؟",
      aFa: "بر پایه ارزش موضوع کارشناسی و به‌صورت پله‌ای محاسبه می‌شود؛ هر پله از ارزش موضوع با نرخ خود مشمول حق‌الزحمه می‌گردد.",
    },
    {
      qFa: "آیا تعرفه کارشناسی حداقل و حداکثر دارد؟",
      aFa: "بله؛ تعرفه کارشناسی دارای حداقل و حداکثر قانونی است و مبلغ محاسبه‌شده در این محدوده قرار می‌گیرد.",
    },
    {
      qFa: "در صورت چند کارشناس، تعرفه چگونه است؟",
      aFa: "تعرفه برای هر کارشناس محاسبه و در تعداد کارشناسان ضرب می‌شود.",
    },
  ],
  relatedSlugs: ["court-fee", "lawyer-fee", "arbitration-fee"],
  nextAction: {
    promptFa: "می‌خواهید هزینه دادرسی را نیز محاسبه کنید؟",
    labelFa: "محاسبه هزینه دادرسی",
    href: "/calculators/court-fee",
  },
  fields: [
    {
      key: "subjectValue",
      labelFa: "ارزش موضوع کارشناسی",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 1_000_000_000,
      min: 0,
      helpFa: "ارزش مالی موضوعی که کارشناسی می‌شود.",
    },
    {
      key: "expertCount",
      labelFa: "تعداد کارشناسان",
      type: "number",
      required: false,
      defaultValue: 1,
      min: 1,
      max: 5,
      step: 1,
      helpFa: "تعداد کارشناسان هیئت.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("expert-fee-1405");
  const rates = ds.rates as unknown as ExpertFeeRates;

  const subjectValue = money(num(input, "subjectValue"), "IRT");
  const expertCount = Math.max(1, Math.round(num(input, "expertCount")));

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const breakdown = applyBrackets(subjectValue.rial, rates.brackets);

  for (const slice of breakdown.slices) {
    steps.push({
      labelFa: `پله ${formatPercentFa(slice.rate)}`,
      valueFa: formatMoney(money(Math.round(slice.feeRial), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(money(Math.round(slice.sliceRial), "IRR"), "IRT")} از ارزش موضوع`,
    });
  }

  const rawFeeRial = breakdown.totalRial;
  const clampedRial = Math.min(Math.max(rawFeeRial, rates.minimumRial), rates.maximumRial);

  if (rawFeeRial < rates.minimumRial) {
    steps.push({
      labelFa: "حداقل قانونی",
      valueFa: formatMoney(money(rates.minimumRial, "IRR"), "IRT"),
      noteFa: "چون مبلغ محاسبه‌شده کمتر از حداقل قانونی است.",
    });
  } else if (rawFeeRial > rates.maximumRial) {
    steps.push({
      labelFa: "حداکثر قانونی",
      valueFa: formatMoney(money(rates.maximumRial, "IRR"), "IRT"),
      noteFa: "چون مبلغ محاسبه‌شده بیشتر از حداکثر قانونی است.",
    });
  }

  const perExpert: Money = roundTo(
    money(Math.round(clampedRial), "IRR"),
    rates.roundingStepRial
  );

  steps.push({
    labelFa: "حق‌الزحمه هر کارشناس",
    valueFa: formatMoney(perExpert, "IRT"),
  });

  const totalRial = perExpert.rial * expertCount;
  const total: Money = roundTo(money(Math.round(totalRial), "IRR"), rates.roundingStepRial);

  if (expertCount > 1) {
    steps.push({
      labelFa: `جمع برای ${formatNumberFa(expertCount)} کارشناس`,
      valueFa: formatMoney(total, "IRT"),
    });
  }

  if (subjectValue.rial === 0) {
    warningsFa.push("ارزش موضوع وارد نشده است؛ حداقل تعرفه اعمال شد.");
  }

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "حق‌الزحمه کارشناسی",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "حق‌الزحمه کارشناسی بر پایه ارزش موضوع و به‌صورت تجمعی در پله‌های تعرفه محاسبه می‌شود. نتیجه بین حداقل و حداکثر قانونی محدود و در تعداد کارشناسان ضرب می‌گردد.",
    legalNotesFa: [
      "تعرفه حق‌الزحمه کارشناسان رسمی دادگستری هر سال اعلام می‌شود.",
      "تعرفه دارای حداقل و حداکثر قانونی است.",
      "ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
    ],
  };
}

export const expertFeeCalculator: Calculator = { def, compute };
