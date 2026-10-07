// ============================================================
// هزینه دادرسی — judicial service fee
// ============================================================
// Governing instrument: تعرفه خدمات قضایی + قانون آیین دادرسی
// دادگاه‌های عمومی و انقلاب (در امور مدنی).
//
// Formula (cumulative ad-valorem):
//   fee = Σ over brackets of (slice of claim value in bracket × bracket rate)
// Non-monetary claims pay a flat fee. Appeal/cassation pays half the
// first-instance fee. The result is rounded to the tariff's step.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface CourtFeeRates {
  brackets: Bracket[];
  nonMonetaryFlatRial: number;
  appealMultiplier: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-court-fee",
  slug: "court-fee",
  titleFa: "هزینه دادرسی",
  subtitleFa: "محاسبه هزینه ثبت دادخواست و تجدیدنظر",
  descriptionFa:
    "هزینه دادرسی بر اساس ارزش خواسته و به‌صورت پله‌ای محاسبه می‌شود. برای دعاوی غیرمالی، هزینه مقطوع و برای تجدیدنظر، نصف هزینه بدوی اعمال می‌گردد.",
  category: "judicial",
  icon: "⚖️",
  gradient: "from-amber-600 to-yellow-500",
  legalBasisFa: "تعرفه خدمات قضایی و ماده ۵۰۵ قانون آیین دادرسی مدنی",
  datasetIds: ["court-fee-1405"],
  confidence: "high",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر هزینه دادرسی را بر پایه ارزش خواسته و جدول پله‌ای تعرفه محاسبه می‌کند. برای دعاوی مالی، هر پله از ارزش خواسته با نرخ خود مشمول هزینه می‌شود؛ برای دعاوی غیرمالی هزینه مقطوع اعمال می‌گردد.",
  howItWorksFa:
    "ارزش خواسته به‌صورت تجمعی در پله‌های تعرفه ضرب و جمع می‌شود. برای مرحله تجدیدنظر یا فرجام‌خواهی، نصف هزینه بدوی اعمال می‌گردد. نتیجه به نزدیک‌ترین مضرب گام گرد کردن تعرفه گرد می‌شود.",
  requiredInfoFa:
    "نوع دعوا (مالی یا غیرمالی)، ارزش خواسته (برای دعاوی مالی) و مرحله رسیدگی.",
  determinacyFa:
    "تعرفه هزینه دادرسی رسمی و مصوب است و نتیجه قطعی است؛ به شرط آنکه ارزش خواسته درست تعیین شده باشد.",
  disclaimerFa:
    "این محاسبه بر پایه تعرفه رسمی خدمات قضایی انجام شده است. تعرفه هر سال اعلام می‌شود و ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
  faq: [
    {
      qFa: "هزینه دادرسی چگونه محاسبه می‌شود؟",
      aFa: "هزینه دادرسی بر اساس ارزش خواسته و به‌صورت پله‌ای محاسبه می‌شود؛ هر پله از ارزش خواسته با نرخ خود مشمول هزینه می‌گردد.",
    },
    {
      qFa: "هزینه تجدیدنظر چقدر است؟",
      aFa: "هزینه مرحله تجدیدنظر و فرجام‌خواهی معمولاً نصف هزینه مرحله بدوی است.",
    },
    {
      qFa: "برای دعاوی غیرمالی چه هزینه‌ای اعمال می‌شود؟",
      aFa: "برای دعاوی غیرمالی، هزینه مقطوعی بر اساس تعرفه خدمات قضایی اعمال می‌شود که به ارزش خواسته وابسته نیست.",
    },
  ],
  relatedSlugs: ["lawyer-fee", "execution-fee", "expert-fee"],
  nextAction: {
    promptFa: "می‌خواهید تعرفه حق‌الوکاله را هم محاسبه کنید؟",
    labelFa: "محاسبه حق‌الوکاله",
    href: "/calculators/lawyer-fee",
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
        { value: "appeal", labelFa: "تجدیدنظر / فرجام‌خواهی" },
      ],
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("court-fee-1405");
  const rates = ds.rates as unknown as CourtFeeRates;

  const claimType = str(input, "claimType");
  const stage = str(input, "stage");
  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  let base: Money;

  if (claimType === "non_monetary") {
    base = money(rates.nonMonetaryFlatRial, "IRR");
    steps.push({
      labelFa: "هزینه دعوای غیرمالی (مقطوع)",
      valueFa: formatMoney(base, "IRT"),
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

    base = money(Math.round(breakdown.totalRial), "IRR");
    steps.push({
      labelFa: "جمع هزینه بدوی",
      valueFa: formatMoney(base, "IRT"),
    });
  }

  let final = base;
  if (stage === "appeal") {
    final = scaleMoney(base, rates.appealMultiplier);
    steps.push({
      labelFa: "هزینه تجدیدنظر (نصف بدوی)",
      valueFa: formatMoney(final, "IRT"),
    });
  }

  final = roundTo(final, rates.roundingStepRial);

  return {
    headlineFa: formatMoney(final, "IRT"),
    headlineValue: final.rial,
    unit: "IRT",
    headlineLabelFa: "هزینه دادرسی",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "هزینه دادرسی بر پایه ارزش خواسته و به‌صورت تجمعی در پله‌های تعرفه محاسبه می‌شود. برای دعاوی غیرمالی هزینه مقطوع و برای مرحله تجدیدنظر نصف هزینه بدوی اعمال می‌گردد.",
    legalNotesFa: [
      "تعرفه خدمات قضایی هر سال اعلام می‌شود.",
      "هزینه مرحله تجدیدنظر و فرجام‌خواهی نصف هزینه بدوی است.",
      "برای دعاوی غیرمالی هزینه مقطوع اعمال می‌گردد.",
    ],
  };
}

export const courtFeeCalculator: Calculator = { def, compute };
