// ============================================================
// حق‌الزحمه داوری — arbitration fee
// ============================================================
// Governing instrument: قانون آیین دادرسی مدنی، مواد ۴۵۴ به بعد.
//
// Formula (cumulative ad-valorem on the amount in dispute):
//   baseFee = Σ over brackets of (slice × bracket rate)
//   fee     = max(baseFee, minimumRial)
// The tariff covers the whole panel; a party-agreed fee is a separate
// concept and is never conflated with the tariff figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface ArbitrationRates {
  brackets: Bracket[];
  minimumRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-arbitration-fee",
  slug: "arbitration-fee",
  titleFa: "حق‌الزحمه داوری",
  subtitleFa: "محاسبه تعرفه داوری بر پایه مبلغ اختلاف",
  descriptionFa:
    "حق‌الزحمه داوری را بر پایه مبلغ مورد اختلاف و به‌صورت پله‌ای محاسبه کنید. تعرفه داوری برای کل هیئت محاسبه می‌شود و با حق‌الزحمه توافقی متفاوت است.",
  category: "judicial",
  icon: "🤝",
  gradient: "from-blue-700 to-indigo-600",
  legalBasisFa: "قانون آیین دادرسی مدنی، مواد ۴۵۴ به بعد (داوری)",
  datasetIds: ["arbitration-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر حق‌الزحمه داوری را بر پایه مبلغ مورد اختلاف و به‌صورت پله‌ای محاسبه می‌کند. تعرفه داوری برای کل هیئت محاسبه می‌شود و حداقل قانونی دارد.",
  howItWorksFa:
    "مبلغ مورد اختلاف به‌صورت تجمعی در پله‌های تعرفه داوری ضرب و جمع می‌شود. اگر مبلغ حاصل از حداقل قانونی کمتر باشد، حداقل قانونی اعمال می‌گردد.",
  requiredInfoFa: "مبلغ مورد اختلاف (مبلغ داوری).",
  determinacyFa:
    "تعرفه داوری رسمی است؛ اما طرفین می‌توانند حق‌الزحمه توافقی تعیین کنند که با تعرفه متفاوت است.",
  disclaimerFa:
    "این محاسبه بر پایه تعرفه رسمی داوری انجام شده است. در صورت توافق طرفین بر حق‌الزحمه متفاوت، مبلغ توافقی ملاک است.",
  faq: [
    {
      qFa: "حق‌الزحمه داوری چگونه محاسبه می‌شود؟",
      aFa: "بر پایه مبلغ مورد اختلاف و به‌صورت پله‌ای محاسبه می‌شود؛ هر پله از مبلغ با نرخ خود مشمول حق‌الزحمه می‌گردد.",
    },
    {
      qFa: "آیا طرفین می‌توانند حق‌الزحمه متفاوتی توافق کنند؟",
      aFa: "بله؛ طرفین می‌توانند حق‌الزحمه توافقی تعیین کنند. در این صورت مبلغ توافقی ملاک است، نه تعرفه.",
    },
    {
      qFa: "تعرفه داوری برای کل هیئت است یا هر داور؟",
      aFa: "تعرفه داوری برای کل هیئت محاسبه می‌شود.",
    },
  ],
  relatedSlugs: ["court-fee", "lawyer-fee", "expert-fee"],
  nextAction: {
    promptFa: "می‌خواهید هزینه دادرسی را نیز محاسبه کنید؟",
    labelFa: "محاسبه هزینه دادرسی",
    href: "/calculators/court-fee",
  },
  fields: [
    {
      key: "disputeAmount",
      labelFa: "مبلغ مورد اختلاف",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 1_000_000_000,
      min: 0,
      helpFa: "مبلغی که موضوع داوری است.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("arbitration-1405");
  const rates = ds.rates as unknown as ArbitrationRates;

  const dispute = money(num(input, "disputeAmount"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const breakdown = applyBrackets(dispute.rial, rates.brackets);

  for (const slice of breakdown.slices) {
    steps.push({
      labelFa: `پله ${formatPercentFa(slice.rate)}`,
      valueFa: formatMoney(money(Math.round(slice.feeRial), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(money(Math.round(slice.sliceRial), "IRR"), "IRT")} از مبلغ اختلاف`,
    });
  }

  const rawFeeRial = breakdown.totalRial;
  const feeRial = Math.max(rawFeeRial, rates.minimumRial);

  if (rawFeeRial < rates.minimumRial) {
    steps.push({
      labelFa: "حداقل قانونی",
      valueFa: formatMoney(money(rates.minimumRial, "IRR"), "IRT"),
      noteFa: "چون مبلغ محاسبه‌شده کمتر از حداقل قانونی است.",
    });
  }

  const fee: Money = roundTo(money(Math.round(feeRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "حق‌الزحمه داوری",
    valueFa: formatMoney(fee, "IRT"),
  });

  if (dispute.rial === 0) {
    warningsFa.push("مبلغ مورد اختلاف وارد نشده است؛ حداقل تعرفه اعمال شد.");
  }

  return {
    headlineFa: formatMoney(fee, "IRT"),
    headlineValue: fee.rial,
    unit: "IRT",
    headlineLabelFa: "حق‌الزحمه داوری",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "حق‌الزحمه داوری بر پایه مبلغ مورد اختلاف و به‌صورت تجمعی در پله‌های تعرفه محاسبه می‌شود. اگر مبلغ محاسبه‌شده کمتر از حداقل قانونی باشد، حداقل قانونی اعمال می‌گردد.",
    legalNotesFa: [
      "تعرفه حق‌الزحمه داوری در قانون آیین دادرسی مدنی تعیین شده است.",
      "طرفین می‌توانند حق‌الزحمه توافقی تعیین کنند.",
      "تعرفه برای کل هیئت داوری محاسبه می‌شود.",
    ],
  };
}

export const arbitrationFeeCalculator: Calculator = { def, compute };
