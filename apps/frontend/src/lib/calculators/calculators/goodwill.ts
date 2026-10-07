// ============================================================
// سرقفلی — goodwill / key money estimate
// ============================================================
// Governing instrument: قانون روابط موجر و مستأجر و عرف بازار.
//
// There is NO statutory rate for سرقفلی. It is a negotiated amount,
// commonly expressed as a multiple of the monthly rent. This
// calculator therefore produces an *estimate range* (lower/upper
// multiples of the monthly rent) and never a definitive figure.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface GoodwillRates {
  lowerMultipleOfRent: number;
  upperMultipleOfRent: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-goodwill",
  slug: "goodwill",
  titleFa: "سرقفلی (برآورد)",
  subtitleFa: "برآورد محدوده سرقفلی بر پایه اجاره ماهانه",
  descriptionFa:
    "محدوده تقریبی سرقفلی یک ملک تجاری را بر پایه مضربی از اجاره ماهانه برآورد کنید. سرقفلی مبلغی توافقی است و نرخ قانونی ثابت ندارد؛ نتیجه یک محدوده برآورد است.",
  category: "property",
  icon: "🏪",
  gradient: "from-violet-700 to-purple-600",
  legalBasisFa: "قانون روابط موجر و مستأجر و عرف بازار (سرقفلی)",
  datasetIds: ["goodwill-1405"],
  confidence: "low",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر محدوده تقریبی سرقفلی را بر پایه مضربی از اجاره ماهانه برآورد می‌کند. سرقفلی مبلغی توافقی میان طرفین است و نرخ قانونی ثابت ندارد.",
  howItWorksFa:
    "اجاره ماهانه در دو ضریب مرجع (حد پایین و حد بالا) ضرب می‌شود تا محدوده برآورد سرقفلی به دست آید. مقدار میانی این محدوده به‌عنوان برآورد نقطه‌ای نمایش داده می‌شود.",
  requiredInfoFa: "اجاره ماهانه ملک تجاری.",
  determinacyFa:
    "سرقفلی با فرمول قانونی تعیین نمی‌شود و به توافق طرفین، موقعیت ملک و عرف بازار وابسته است. نتیجه فقط یک «محدوده برآورد» است.",
  disclaimerFa:
    "این محاسبه یک برآورد اولیه از محدوده سرقفلی است و مبلغ قطعی محسوب نمی‌شود. سرقفلی تابع توافق طرفین و شرایط بازار است.",
  faq: [
    {
      qFa: "سرقفلی چگونه تعیین می‌شود؟",
      aFa: "سرقفلی مبلغی توافقی میان موجر و مستأجر است و نرخ قانونی ثابت ندارد. معمولاً بر پایه مضربی از اجاره ماهانه و موقعیت ملک تعیین می‌شود.",
    },
    {
      qFa: "چرا نتیجه یک محدوده است؟",
      aFa: "چون سرقفلی فرمول قانونی ندارد و به شرایط بازار و توافق طرفین وابسته است؛ بنابراین فقط می‌توان یک محدوده تقریبی ارائه کرد.",
    },
    {
      qFa: "آیا این مبلغ قابل استناد در دادگاه است؟",
      aFa: "خیر؛ این یک برآورد اولیه است. تعیین سرقفلی در اختلافات به نظر کارشناس و مرجع صالح وابسته است.",
    },
  ],
  relatedSlugs: ["rent-converter", "real-estate-commission", "property-transaction-cost"],
  nextAction: {
    promptFa: "می‌خواهید تبدیل رهن و اجاره را محاسبه کنید؟",
    labelFa: "محاسبه تبدیل رهن و اجاره",
    href: "/calculators/rent-converter",
  },
  fields: [
    {
      key: "monthlyRent",
      labelFa: "اجاره ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 50_000_000,
      min: 0,
      helpFa: "اجاره ماهانه ملک تجاری.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("goodwill-1405");
  const rates = ds.rates as unknown as GoodwillRates;

  const rent = money(num(input, "monthlyRent"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const lowerRial = rent.rial * rates.lowerMultipleOfRent;
  const upperRial = rent.rial * rates.upperMultipleOfRent;
  const midRial = (lowerRial + upperRial) / 2;

  const lower: Money = roundTo(money(Math.round(lowerRial), "IRR"), rates.roundingStepRial);
  const upper: Money = roundTo(money(Math.round(upperRial), "IRR"), rates.roundingStepRial);
  const mid: Money = roundTo(money(Math.round(midRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "اجاره ماهانه",
    valueFa: formatMoney(rent, "IRT"),
  });
  steps.push({
    labelFa: `حد پایین (${formatNumberFa(rates.lowerMultipleOfRent)} برابر اجاره)`,
    valueFa: formatMoney(lower, "IRT"),
  });
  steps.push({
    labelFa: `حد بالا (${formatNumberFa(rates.upperMultipleOfRent)} برابر اجاره)`,
    valueFa: formatMoney(upper, "IRT"),
  });
  steps.push({
    labelFa: "برآورد میانی",
    valueFa: formatMoney(mid, "IRT"),
  });

  if (rent.rial === 0) {
    warningsFa.push("اجاره ماهانه وارد نشده است؛ برآوردی محاسبه نشد.");
  }
  warningsFa.push(
    "سرقفلی مبلغی توافقی است و نرخ قانونی ثابت ندارد؛ این نتیجه فقط یک محدوده برآورد است."
  );

  return {
    headlineFa: `${formatMoney(lower, "IRT")} تا ${formatMoney(upper, "IRT")}`,
    headlineValue: mid.rial,
    unit: "IRT",
    headlineLabelFa: "محدوده برآورد سرقفلی",
    status: "estimate",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "سرقفلی نرخ قانونی ثابت ندارد و مبلغی توافقی است. این محاسبه‌گر با ضرب اجاره ماهانه در دو ضریب مرجع، یک محدوده برآورد ارائه می‌کند. مقدار میانی این محدوده به‌عنوان برآورد نقطه‌ای نمایش داده می‌شود.",
    legalNotesFa: [
      "سرقفلی مبلغی توافقی میان موجر و مستأجر است.",
      "نرخ قانونی ثابتی برای سرقفلی وجود ندارد.",
      "تعیین سرقفلی در اختلافات به نظر کارشناس و مرجع صالح وابسته است.",
    ],
  };
}

export const goodwillCalculator: Calculator = { def, compute };
