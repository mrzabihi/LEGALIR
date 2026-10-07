// ============================================================
// افت قیمت خودرو (برآورد) — vehicle depreciation estimate
// ============================================================
// Governing instrument: رویه کارشناسی ارزیابی خسارت خودرو (افت قیمت).
//
// There is NO statutory formula for افت قیمت. It is assessed by an
// official expert. This calculator produces an *estimate range* from
// reference factors (per-part base rate × severity × treatment) and
// never a definitive figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface VehicleDepreciationRates {
  baseRatePerPart: number;
  severityFactor: Record<string, number>;
  replacementFactor: number;
  paintFactor: number;
  lowerBandFactor: number;
  upperBandFactor: number;
}

const SEVERITY_LABEL_FA: Record<string, string> = {
  light: "جزئی",
  medium: "متوسط",
  severe: "شدید",
};

const TREATMENT_LABEL_FA: Record<string, string> = {
  repaired: "تعمیر",
  replaced: "تعویض",
  painted: "رنگ",
};

const def: CalculatorDef = {
  id: "calc-vehicle-depreciation",
  slug: "vehicle-depreciation",
  titleFa: "افت قیمت خودرو (برآورد)",
  subtitleFa: "برآورد محدوده افت قیمت پس از تصادف",
  descriptionFa:
    "محدوده تقریبی افت قیمت خودرو پس از تصادف را بر پایه ارزش خودرو، تعداد قطعات آسیب‌دیده و شدت آسیب برآورد کنید. افت قیمت فرمول قانونی ثابت ندارد و به نظر کارشناس رسمی وابسته است؛ نتیجه یک محدوده برآورد است.",
  category: "injury",
  icon: "🚗",
  gradient: "from-zinc-700 to-slate-600",
  legalBasisFa: "رویه کارشناسی ارزیابی خسارت خودرو (افت قیمت)",
  datasetIds: ["vehicle-depreciation-1405"],
  confidence: "low",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر محدوده تقریبی افت قیمت خودرو را بر پایه ارزش خودرو، تعداد قطعات آسیب‌دیده، شدت آسیب و نوع اقدام (تعمیر/تعویض/رنگ) برآورد می‌کند. افت قیمت فرمول قانونی ثابت ندارد.",
  howItWorksFa:
    "ارزش خودرو در نرخ پایه هر قطعه، تعداد قطعات، ضریب شدت و ضریب نوع اقدام ضرب می‌شود تا برآورد نقطه‌ای به دست آید. سپس این مقدار در دو ضریب (حد پایین و حد بالا) ضرب می‌شود تا محدوده برآورد حاصل گردد.",
  requiredInfoFa: "ارزش خودرو، تعداد قطعات آسیب‌دیده، شدت آسیب و نوع اقدام.",
  determinacyFa:
    "افت قیمت با فرمول قانونی تعیین نمی‌شود و به نظر کارشناس رسمی وابسته است. نتیجه فقط یک «محدوده برآورد» است.",
  disclaimerFa:
    "این محاسبه یک برآورد اولیه از محدوده افت قیمت است و مبلغ قطعی محسوب نمی‌شود. تعیین افت قیمت در صلاحیت کارشناس رسمی و مرجع صالح است.",
  faq: [
    {
      qFa: "افت قیمت خودرو چیست؟",
      aFa: "افت قیمت کاهش ارزش خودرو پس از تصادف است که حتی پس از تعمیر نیز باقی می‌ماند و توسط کارشناس ارزیابی می‌شود.",
    },
    {
      qFa: "افت قیمت چگونه تعیین می‌شود؟",
      aFa: "افت قیمت فرمول قانونی ثابت ندارد و بر پایه نظر کارشناس رسمی ارزیابی خسارت خودرو تعیین می‌شود.",
    },
    {
      qFa: "چرا نتیجه یک محدوده است؟",
      aFa: "چون افت قیمت فرمول قانونی ندارد و به نظر کارشناس و شرایط خودرو وابسته است؛ بنابراین فقط می‌توان یک محدوده تقریبی ارائه کرد.",
    },
  ],
  relatedSlugs: ["diyeh", "diyeh-advanced", "check-damages"],
  nextAction: {
    promptFa: "می‌خواهید دیه صدمات بدنی را محاسبه کنید؟",
    labelFa: "محاسبه دیه",
    href: "/calculators/diyeh",
  },
  fields: [
    {
      key: "vehicleValue",
      labelFa: "ارزش خودرو",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 2_000_000_000,
      min: 0,
      helpFa: "ارزش خودرو پیش از تصادف.",
    },
    {
      key: "damagedParts",
      labelFa: "تعداد قطعات آسیب‌دیده",
      type: "number",
      required: true,
      defaultValue: 3,
      min: 0,
      max: 50,
      step: 1,
      helpFa: "تعداد قطعاتی که آسیب دیده‌اند.",
    },
    {
      key: "severity",
      labelFa: "شدت آسیب",
      type: "select",
      required: true,
      defaultValue: "medium",
      options: [
        { value: "light", labelFa: "جزئی" },
        { value: "medium", labelFa: "متوسط" },
        { value: "severe", labelFa: "شدید" },
      ],
    },
    {
      key: "treatment",
      labelFa: "نوع اقدام",
      type: "select",
      required: true,
      defaultValue: "repaired",
      options: [
        { value: "repaired", labelFa: "تعمیر" },
        { value: "replaced", labelFa: "تعویض" },
        { value: "painted", labelFa: "رنگ" },
      ],
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("vehicle-depreciation-1405");
  const rates = ds.rates as unknown as VehicleDepreciationRates;

  const vehicleValue = money(num(input, "vehicleValue"), "IRT");
  const damagedParts = Math.max(0, Math.round(num(input, "damagedParts")));
  const severity = str(input, "severity") || "medium";
  const treatment = str(input, "treatment") || "repaired";

  const severityFactor = rates.severityFactor[severity] ?? 1;
  const treatmentFactor =
    treatment === "replaced"
      ? rates.replacementFactor
      : treatment === "painted"
        ? rates.paintFactor
        : 1;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const pointRial =
    vehicleValue.rial *
    rates.baseRatePerPart *
    damagedParts *
    severityFactor *
    treatmentFactor;

  const lowerRial = pointRial * rates.lowerBandFactor;
  const upperRial = pointRial * rates.upperBandFactor;

  const lower: Money = roundTo(money(Math.round(lowerRial), "IRR"), 1_000);
  const upper: Money = roundTo(money(Math.round(upperRial), "IRR"), 1_000);
  const point: Money = roundTo(money(Math.round(pointRial), "IRR"), 1_000);

  steps.push({
    labelFa: "ارزش خودرو",
    valueFa: formatMoney(vehicleValue, "IRT"),
  });
  steps.push({
    labelFa: `قطعات آسیب‌دیده (${formatNumberFa(damagedParts)} قطعه)`,
    valueFa: `${formatNumberFa(damagedParts)} قطعه`,
    noteFa: `شدت ${SEVERITY_LABEL_FA[severity] ?? severity} · ${TREATMENT_LABEL_FA[treatment] ?? treatment}`,
  });
  steps.push({
    labelFa: "برآورد نقطه‌ای افت قیمت",
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

  if (vehicleValue.rial === 0 || damagedParts === 0) {
    warningsFa.push("ارزش خودرو یا تعداد قطعات وارد نشده است؛ برآوردی محاسبه نشد.");
  }
  warningsFa.push(
    "افت قیمت فرمول قانونی ثابت ندارد و به نظر کارشناس رسمی وابسته است؛ این نتیجه فقط یک محدوده برآورد است."
  );

  return {
    headlineFa: `${formatMoney(lower, "IRT")} تا ${formatMoney(upper, "IRT")}`,
    headlineValue: point.rial,
    unit: "IRT",
    headlineLabelFa: "محدوده برآورد افت قیمت",
    status: "estimate",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "افت قیمت خودرو فرمول قانونی ثابت ندارد. این محاسبه‌گر با استفاده از ارزش خودرو، تعداد قطعات، شدت آسیب و نوع اقدام، یک برآورد نقطه‌ای و سپس یک محدوده (حد پایین و حد بالا) ارائه می‌کند. مبلغ قطعی در صلاحیت کارشناس رسمی است.",
    legalNotesFa: [
      "افت قیمت خودرو با فرمول قانونی ثابت تعیین نمی‌شود.",
      "تعیین افت قیمت در صلاحیت کارشناس رسمی ارزیابی خسارت خودرو است.",
      "نتیجه این محاسبه فقط یک برآورد اولیه است.",
    ],
  };
}

export const vehicleDepreciationCalculator: Calculator = { def, compute };
