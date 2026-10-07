// ============================================================
// حق‌الوکاله — lawyer's fee (statutory tariff)
// ============================================================
// Governing instrument: تعرفه حق‌الوکاله وکلا (قوه قضائیه).
//
// Formula (cumulative ad-valorem on the claim value):
//   tariff = Σ over brackets of (slice of claim value × bracket rate)
//   stage  = tariff × stageMultiplier[stage]
//   fee    = max(minimumMonetaryRial, stage)
// Non-monetary matters pay a flat tariff. A contractual (توافقی) fee
// is a separate concept and is never mixed into the tariff figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface LawyerFeeRates {
  brackets: Bracket[];
  nonMonetaryFlatRial: number;
  minimumMonetaryRial: number;
  stageMultiplier: Record<string, number>;
  roundingStepRial: number;
}

const STAGE_LABEL_FA: Record<string, string> = {
  first: "بدوی",
  appeal: "تجدیدنظر",
  cassation: "فرجام‌خواهی",
  enforcement: "اجرای حکم",
};

const def: CalculatorDef = {
  id: "calc-lawyer-fee",
  slug: "lawyer-fee",
  titleFa: "حق‌الوکاله وکیل",
  subtitleFa: "محاسبه تعرفه حق‌الوکاله بر اساس ارزش خواسته",
  descriptionFa:
    "تعرفه حق‌الوکاله وکیل را بر اساس ارزش خواسته و به‌صورت پله‌ای محاسبه کنید. برای دعاوی غیرمالی تعرفه مقطوع و برای هر مرحله رسیدگی ضریب مربوط به همان مرحله اعمال می‌شود.",
  category: "judicial",
  icon: "👨‍⚖️",
  gradient: "from-slate-700 to-slate-500",
  legalBasisFa: "تعرفه حق‌الوکاله وکلا و کارشناسان رسمی (قوه قضائیه)",
  datasetIds: ["lawyer-fee-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر تعرفه حق‌الوکاله وکیل را بر پایه ارزش خواسته و جدول پله‌ای تعرفه محاسبه می‌کند. برای هر مرحله رسیدگی (بدوی، تجدیدنظر، فرجام‌خواهی، اجرای حکم) ضریب همان مرحله اعمال می‌شود. این مبلغ «تعرفه» است و با حق‌الوکاله توافقی متفاوت است.",
  howItWorksFa:
    "ارزش خواسته به‌صورت تجمعی در پله‌های تعرفه ضرب و جمع می‌شود تا تعرفه پایه به دست آید. سپس ضریب مرحله رسیدگی اعمال و در نهایت با حداقل تعرفه مقایسه می‌گردد.",
  requiredInfoFa:
    "نوع دعوا (مالی یا غیرمالی)، ارزش خواسته و مرحله رسیدگی.",
  determinacyFa:
    "تعرفه حق‌الوکاله رسمی است؛ اما حق‌الوکاله توافقی می‌تواند متفاوت باشد. این محاسبه فقط «تعرفه» را نشان می‌دهد، نه مبلغ توافق‌شده با وکیل.",
  disclaimerFa:
    "این محاسبه تعرفه رسمی حق‌الوکاله را نشان می‌دهد و با حق‌الوکاله توافقی متفاوت است. تعرفه هر سال توسط قوه قضائیه اعلام می‌شود؛ پیش از اتکا، تعرفه جاری را بررسی کنید.",
  faq: [
    {
      qFa: "حق‌الوکاله چگونه محاسبه می‌شود؟",
      aFa: "تعرفه حق‌الوکاله بر اساس ارزش خواسته و به‌صورت پله‌ای محاسبه می‌شود؛ هر پله از ارزش خواسته با نرخ خود مشمول تعرفه می‌گردد.",
    },
    {
      qFa: "تفاوت تعرفه و حق‌الوکاله توافقی چیست؟",
      aFa: "تعرفه، مبلغ رسمی مصوب قوه قضائیه است؛ اما طرفین می‌توانند مبلغ دیگری (توافقی) را توافق کنند. این محاسبه‌گر فقط تعرفه رسمی را نشان می‌دهد.",
    },
    {
      qFa: "آیا حق‌الوکاله تجدیدنظر کمتر از بدوی است؟",
      aFa: "بله؛ برای هر مرحله رسیدگی ضریب متفاوتی اعمال می‌شود و مراحل بالاتر معمولاً ضریب کمتری از مرحله بدوی دارند.",
    },
  ],
  relatedSlugs: ["court-fee", "expert-fee", "arbitration-fee"],
  nextAction: {
    promptFa: "می‌خواهید هزینه دادرسی را هم محاسبه کنید؟",
    labelFa: "محاسبه هزینه دادرسی",
    href: "/calculators/court-fee",
  },
  fields: [
    {
      key: "claimType",
      labelFa: "نوع دعوا",
      type: "select",
      required: true,
      defaultValue: "monetary",
      options: [
        { value: "monetary", labelFa: "مالی (بر اساس ارزش خواسته)" },
        { value: "non_monetary", labelFa: "غیرمالی (مقطوع)" },
      ],
    },
    {
      key: "claimValue",
      labelFa: "ارزش خواسته",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 500_000_000,
      min: 0,
      helpFa: "فقط برای دعاوی مالی لازم است.",
      visibleWhen: [{ key: "claimType", equals: "monetary" }],
    },
    {
      key: "stage",
      labelFa: "مرحله رسیدگی",
      type: "select",
      required: true,
      defaultValue: "first",
      options: [
        { value: "first", labelFa: "بدوی" },
        { value: "appeal", labelFa: "تجدیدنظر" },
        { value: "cassation", labelFa: "فرجام‌خواهی" },
        { value: "enforcement", labelFa: "اجرای حکم" },
      ],
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("lawyer-fee-1405");
  const rates = ds.rates as unknown as LawyerFeeRates;

  const claimType = str(input, "claimType");
  const stage = str(input, "stage");
  const stageMultiplier = rates.stageMultiplier[stage] ?? 1;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  let baseRial: number;

  if (claimType === "non_monetary") {
    baseRial = rates.nonMonetaryFlatRial;
    steps.push({
      labelFa: "تعرفه دعوای غیرمالی (مقطوع)",
      valueFa: formatMoney(money(baseRial, "IRR"), "IRT"),
    });
  } else {
    const claim = money(num(input, "claimValue"), "IRT");
    const breakdown = applyBrackets(claim.rial, rates.brackets);

    for (const slice of breakdown.slices) {
      steps.push({
        labelFa: `پله ${formatPercentFa(slice.rate)}`,
        valueFa: formatMoney(money(Math.round(slice.feeRial), "IRR"), "IRT"),
        noteFa: `بر ${formatMoney(money(Math.round(slice.sliceRial), "IRR"), "IRT")} از ارزش خواسته`,
      });
    }

    baseRial = breakdown.totalRial;
    steps.push({
      labelFa: "تعرفه پایه (بدوی)",
      valueFa: formatMoney(money(Math.round(baseRial), "IRR"), "IRT"),
    });

    if (baseRial < rates.minimumMonetaryRial) {
      baseRial = rates.minimumMonetaryRial;
      steps.push({
        labelFa: "حداقل تعرفه دعوای مالی",
        valueFa: formatMoney(money(rates.minimumMonetaryRial, "IRR"), "IRT"),
        noteFa: "تعرفه محاسبه‌شده کمتر از حداقل تعرفه بود.",
      });
    }
  }

  let finalRial = baseRial;
  if (stage !== "first") {
    finalRial = baseRial * stageMultiplier;
    steps.push({
      labelFa: `ضریب مرحله ${STAGE_LABEL_FA[stage] ?? stage} (${formatPercentFa(stageMultiplier)})`,
      valueFa: formatMoney(money(Math.round(finalRial), "IRR"), "IRT"),
    });
  }

  const final: Money = roundTo(money(Math.round(finalRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "تعرفه نهایی حق‌الوکاله",
    valueFa: formatMoney(final, "IRT"),
  });

  warningsFa.push(
    "این مبلغ «تعرفه رسمی» است و با حق‌الوکاله توافقی طرفین متفاوت می‌باشد."
  );

  return {
    headlineFa: formatMoney(final, "IRT"),
    headlineValue: final.rial,
    unit: "IRT",
    headlineLabelFa: "تعرفه حق‌الوکاله",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "تعرفه حق‌الوکاله بر پایه ارزش خواسته و به‌صورت تجمعی در پله‌های تعرفه محاسبه می‌شود. سپس ضریب مرحله رسیدگی اعمال و مبلغ با حداقل تعرفه مقایسه می‌گردد. این مبلغ تعرفه رسمی است و با حق‌الوکاله توافقی متفاوت است.",
    legalNotesFa: [
      "تعرفه حق‌الوکاله هر سال توسط قوه قضائیه اعلام می‌شود.",
      "برای هر مرحله رسیدگی ضریب متفاوتی اعمال می‌گردد.",
      "حق‌الوکاله توافقی مفهومی جدا از تعرفه رسمی است.",
    ],
  };
}

export const lawyerFeeCalculator: Calculator = { def, compute };
