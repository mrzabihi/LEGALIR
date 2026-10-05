// ============================================================
// اجرت‌المثل ایام زوجیت (برآورد) — mahr-service estimate
// ============================================================
// Governing instrument: قانون مدنی و رویه قضایی (اجرت‌المثل ایام زوجیت).
//
// There is NO statutory formula for اجرت‌المثل. It is decided by the
// court on expert advice. This calculator produces an *estimate range*
// from a reference monthly value of domestic services over the years
// of marriage, and never a definitive figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface MahrServiceRates {
  monthlyServiceBaselineRial: number;
  lowerBandFactor: number;
  upperBandFactor: number;
}

const def: CalculatorDef = {
  id: "calc-mahr-service",
  slug: "mahr-service",
  titleFa: "اجرت‌المثل ایام زوجیت (برآورد)",
  subtitleFa: "برآورد محدوده اجرت‌المثل بر پایه سال‌های زوجیت",
  descriptionFa:
    "محدوده تقریبی اجرت‌المثل ایام زوجیت را بر پایه مدت زوجیت برآورد کنید. اجرت‌المثل فرمول قانونی ثابت ندارد و به نظر کارشناس و دادگاه وابسته است؛ نتیجه یک محدوده برآورد است.",
  category: "family",
  icon: "🧾",
  gradient: "from-fuchsia-700 to-pink-600",
  legalBasisFa: "قانون مدنی و رویه قضایی (اجرت‌المثل ایام زوجیت)",
  datasetIds: ["mahr-service-1405"],
  confidence: "low",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر محدوده تقریبی اجرت‌المثل ایام زوجیت را بر پایه مدت زوجیت برآورد می‌کند. اجرت‌المثل فرمول قانونی ثابت ندارد و به نظر کارشناس و دادگاه وابسته است.",
  howItWorksFa:
    "ارزش پایه خدمات خانگی ماهانه در تعداد ماه‌های زوجیت ضرب می‌شود تا برآورد نقطه‌ای به دست آید. سپس این مقدار در دو ضریب (حد پایین و حد بالا) ضرب می‌شود تا محدوده برآورد حاصل گردد.",
  requiredInfoFa: "مدت زوجیت (بر حسب سال).",
  determinacyFa:
    "اجرت‌المثل با فرمول قانونی تعیین نمی‌شود و به نظر کارشناس و دادگاه وابسته است. نتیجه فقط یک «محدوده برآورد» است.",
  disclaimerFa:
    "این محاسبه یک برآورد اولیه از محدوده اجرت‌المثل است و مبلغ قطعی محسوب نمی‌شود. تعیین اجرت‌المثل در صلاحیت دادگاه و بر پایه نظر کارشناس است.",
  faq: [
    {
      qFa: "اجرت‌المثل ایام زوجیت چیست؟",
      aFa: "اجرت‌المثل مبلغی است که در صورت مطالبه زوجه، برای کارهای خانگی انجام‌شده در طول زوجیت در نظر گرفته می‌شود.",
    },
    {
      qFa: "اجرت‌المثل چگونه تعیین می‌شود؟",
      aFa: "اجرت‌المثل فرمول قانونی ثابت ندارد و بر پایه نظر کارشناس و تشخیص دادگاه تعیین می‌شود.",
    },
    {
      qFa: "چرا نتیجه یک محدوده است؟",
      aFa: "چون اجرت‌المثل فرمول قانونی ندارد و به نظر کارشناس و شرایط پرونده وابسته است؛ بنابراین فقط می‌توان یک محدوده تقریبی ارائه کرد.",
    },
  ],
  relatedSlugs: ["alimony", "dowry", "inheritance"],
  nextAction: {
    promptFa: "می‌خواهید مهریه به نرخ روز را محاسبه کنید؟",
    labelFa: "محاسبه مهریه به نرخ روز",
    href: "/calculators/dowry",
  },
  fields: [
    {
      key: "marriageYears",
      labelFa: "مدت زوجیت (سال)",
      type: "number",
      required: true,
      defaultValue: 10,
      min: 0,
      max: 60,
      step: 1,
      helpFa: "مدت زندگی مشترک بر حسب سال.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("mahr-service-1405");
  const rates = ds.rates as unknown as MahrServiceRates;

  const years = Math.max(0, num(input, "marriageYears"));
  const months = years * 12;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const pointRial = rates.monthlyServiceBaselineRial * months;
  const lowerRial = pointRial * rates.lowerBandFactor;
  const upperRial = pointRial * rates.upperBandFactor;

  const lower: Money = roundTo(money(Math.round(lowerRial), "IRR"), 1_000);
  const upper: Money = roundTo(money(Math.round(upperRial), "IRR"), 1_000);
  const point: Money = roundTo(money(Math.round(pointRial), "IRR"), 1_000);

  steps.push({
    labelFa: "ارزش پایه خدمات ماهانه",
    valueFa: formatMoney(money(rates.monthlyServiceBaselineRial, "IRR"), "IRT"),
  });
  steps.push({
    labelFa: `مدت زوجیت (${formatNumberFa(months)} ماه)`,
    valueFa: `${formatNumberFa(years)} سال`,
  });
  steps.push({
    labelFa: "برآورد نقطه‌ای",
    valueFa: formatMoney(point, "IRT"),
  });
  steps.push({
    labelFa: "حد پایین محدوده",
    valueFa: formatMoney(lower, "IRT"),
  });
  steps.push({
    labelFa: "حد بالای محدوده",
    valueFa: formatMoney(upper, "IRT"),
  });

  if (years === 0) {
    warningsFa.push("مدت زوجیت وارد نشده است؛ برآوردی محاسبه نشد.");
  }
  warningsFa.push(
    "اجرت‌المثل فرمول قانونی ثابت ندارد و به نظر کارشناس و دادگاه وابسته است؛ این نتیجه فقط یک محدوده برآورد است."
  );

  return {
    headlineFa: `${formatMoney(lower, "IRT")} تا ${formatMoney(upper, "IRT")}`,
    headlineValue: point.rial,
    unit: "IRT",
    headlineLabelFa: "محدوده برآورد اجرت‌المثل",
    status: "estimate",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "اجرت‌المثل فرمول قانونی ثابت ندارد. این محاسبه‌گر با استفاده از ارزش پایه خدمات خانگی و مدت زوجیت، یک برآورد نقطه‌ای و سپس یک محدوده (حد پایین و حد بالا) ارائه می‌کند. مبلغ قطعی در صلاحیت دادگاه و بر پایه نظر کارشناس است.",
    legalNotesFa: [
      "اجرت‌المثل ایام زوجیت در قانون مدنی و رویه قضایی مطرح شده است.",
      "تعیین مبلغ اجرت‌المثل در صلاحیت دادگاه و بر پایه نظر کارشناس است.",
      "نرخ قانونی ثابتی برای اجرت‌المثل وجود ندارد.",
    ],
  };
}

export const mahrServiceCalculator: Calculator = { def, compute };
