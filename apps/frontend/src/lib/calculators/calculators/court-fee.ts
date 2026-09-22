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
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface Bracket {
  upToRial: number | null;
  rate: number;
}

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
  datasetIds: ["court-fee-1404"],
  confidence: "high",
  available: true,
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
  const ds = requireDataset("court-fee-1404");
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
    let remaining = claim.rial;
    let lowerBound = 0;
    let total = 0;

    for (const bracket of rates.brackets) {
      if (remaining <= 0) break;
      const upper = bracket.upToRial ?? Infinity;
      const slice = Math.min(remaining, upper - lowerBound);
      if (slice <= 0) {
        lowerBound = upper;
        continue;
      }
      const sliceFee = slice * bracket.rate;
      total += sliceFee;
      steps.push({
        labelFa: `پله ${formatPercentFa(bracket.rate)}`,
        valueFa: formatMoney(money(Math.round(sliceFee), "IRR"), "IRT"),
        noteFa: `بر ${formatMoney(money(slice, "IRR"), "IRT")} از ارزش خواسته`,
      });
      remaining -= slice;
      lowerBound = upper;
    }

    base = money(Math.round(total), "IRR");
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
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const courtFeeCalculator: Calculator = { def, compute };
