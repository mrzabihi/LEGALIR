// ============================================================
// نفقه (برآورد) — alimony estimate
// ============================================================
// Governing instrument: قانون مدنی، مواد ۱۱۰۶ تا ۱۱۱۱ و رویه قضایی.
//
// There is NO statutory formula for نفقه. It depends on the wife's
// needs and the husband's means, and is fixed by the competent
// authority. This calculator therefore produces an *estimate range*
// from reference baselines and never a definitive figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface AlimonyRates {
  adultMonthlyBaselineRial: number;
  childMonthlyBaselineRial: number;
  lowerBandFactor: number;
  upperBandFactor: number;
  cityFactor: Record<string, number>;
}

const CITY_LABEL_FA: Record<string, string> = {
  tehran: "تهران",
  metropolis: "کلان‌شهر",
  other: "سایر شهرها",
};

const def: CalculatorDef = {
  id: "calc-alimony",
  slug: "alimony",
  titleFa: "نفقه (برآورد)",
  subtitleFa: "برآورد محدوده نفقه ماهانه",
  descriptionFa:
    "محدوده تقریبی نفقه ماهانه را بر پایه تعداد فرزندان و شهر محل سکونت برآورد کنید. نفقه فرمول قانونی ثابت ندارد و به نیاز زوجه و وضعیت مالی زوج وابسته است؛ نتیجه یک محدوده برآورد است.",
  category: "family",
  icon: "🏠",
  gradient: "from-pink-700 to-rose-600",
  legalBasisFa: "مواد ۱۱۰۶ تا ۱۱۱۱ قانون مدنی (نفقه) و رویه قضایی",
  datasetIds: ["alimony-1405"],
  confidence: "low",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر محدوده تقریبی نفقه ماهانه را بر پایه تعداد فرزندان و شهر محل سکونت برآورد می‌کند. نفقه فرمول قانونی ثابت ندارد و به نیاز زوجه، وضعیت مالی زوج و عرف محل وابسته است.",
  howItWorksFa:
    "هزینه پایه ماهانه بزرگسال و هر فرزند در ضریب شهر ضرب می‌شود تا برآورد نقطه‌ای به دست آید. سپس این مقدار در دو ضریب (حد پایین و حد بالا) ضرب می‌شود تا محدوده برآورد حاصل گردد.",
  requiredInfoFa: "شهر محل سکونت و تعداد فرزندان.",
  determinacyFa:
    "نفقه با فرمول قانونی تعیین نمی‌شود و به نیاز زوجه، وضعیت مالی زوج، عرف محل و نظر مرجع صالح وابسته است. نتیجه فقط یک «محدوده برآورد» است.",
  disclaimerFa:
    "این محاسبه یک برآورد اولیه از محدوده نفقه است و مبلغ قطعی محسوب نمی‌شود. تعیین نفقه در صلاحیت مرجع قضایی و بر پایه نظر کارشناس است.",
  faq: [
    {
      qFa: "نفقه چگونه تعیین می‌شود؟",
      aFa: "نفقه فرمول قانونی ثابت ندارد و بر پایه نیاز زوجه، وضعیت مالی زوج و عرف محل توسط مرجع صالح تعیین می‌شود.",
    },
    {
      qFa: "چرا نتیجه یک محدوده است؟",
      aFa: "چون نفقه فرمول قانونی ندارد و به شرایط خاص هر پرونده وابسته است؛ بنابراین فقط می‌توان یک محدوده تقریبی ارائه کرد.",
    },
    {
      qFa: "آیا این مبلغ قابل استناد در دادگاه است؟",
      aFa: "خیر؛ این یک برآورد اولیه است. تعیین نفقه در صلاحیت مرجع قضایی و بر پایه نظر کارشناس است.",
    },
  ],
  relatedSlugs: ["mahr-service", "dowry", "inheritance"],
  nextAction: {
    promptFa: "می‌خواهید اجرت‌المثل ایام زوجیت را بررسی کنید؟",
    labelFa: "بررسی اجرت‌المثل",
    href: "/calculators/mahr-service",
  },
  fields: [
    {
      key: "city",
      labelFa: "شهر محل سکونت",
      type: "select",
      required: true,
      defaultValue: "tehran",
      options: [
        { value: "tehran", labelFa: "تهران" },
        { value: "metropolis", labelFa: "کلان‌شهر" },
        { value: "other", labelFa: "سایر شهرها" },
      ],
    },
    {
      key: "childrenCount",
      labelFa: "تعداد فرزندان",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      max: 20,
      step: 1,
      helpFa: "فرزندانی که نفقه آن‌ها نیز بر عهده است.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("alimony-1405");
  const rates = ds.rates as unknown as AlimonyRates;

  const city = str(input, "city") || "other";
  const childrenCount = Math.max(0, Math.round(num(input, "childrenCount")));
  const cityFactor = rates.cityFactor[city] ?? 1;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const adultRial = rates.adultMonthlyBaselineRial * cityFactor;
  const childrenRial = rates.childMonthlyBaselineRial * childrenCount * cityFactor;
  const pointRial = adultRial + childrenRial;

  const lowerRial = pointRial * rates.lowerBandFactor;
  const upperRial = pointRial * rates.upperBandFactor;

  const lower: Money = roundTo(money(Math.round(lowerRial), "IRR"), 1_000);
  const upper: Money = roundTo(money(Math.round(upperRial), "IRR"), 1_000);
  const point: Money = roundTo(money(Math.round(pointRial), "IRR"), 1_000);

  steps.push({
    labelFa: `هزینه پایه بزرگسال (${CITY_LABEL_FA[city] ?? city})`,
    valueFa: formatMoney(money(Math.round(adultRial), "IRR"), "IRT"),
  });
  if (childrenCount > 0) {
    steps.push({
      labelFa: `هزینه فرزندان (${formatNumberFa(childrenCount)} نفر)`,
      valueFa: formatMoney(money(Math.round(childrenRial), "IRR"), "IRT"),
    });
  }
  steps.push({
    labelFa: "برآورد نقطه‌ای ماهانه",
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

  warningsFa.push(
    "نفقه فرمول قانونی ثابت ندارد و به نیاز زوجه، وضعیت مالی زوج و عرف محل وابسته است؛ این نتیجه فقط یک محدوده برآورد است."
  );

  return {
    headlineFa: `${formatMoney(lower, "IRT")} تا ${formatMoney(upper, "IRT")}`,
    headlineValue: point.rial,
    unit: "IRT",
    headlineLabelFa: "محدوده برآورد نفقه ماهانه",
    status: "estimate",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "نفقه فرمول قانونی ثابت ندارد. این محاسبه‌گر با استفاده از هزینه‌های پایه مرجع و ضریب شهر، یک برآورد نقطه‌ای و سپس یک محدوده (حد پایین و حد بالا) ارائه می‌کند. مبلغ قطعی نفقه در صلاحیت مرجع قضایی است.",
    legalNotesFa: [
      "ماده ۱۱۰۶ قانون مدنی: نفقه زوجه بر عهده زوج است.",
      "ماده ۱۱۰۷ قانون مدنی: نفقه شامل مسکن، پوشاک، غذا و سایر نیازهای متعارف است.",
      "تعیین مبلغ نفقه در صلاحیت مرجع قضایی و بر پایه نظر کارشناس است.",
    ],
  };
}

export const alimonyCalculator: Calculator = { def, compute };
