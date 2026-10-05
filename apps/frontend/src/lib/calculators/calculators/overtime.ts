// ============================================================
// اضافه‌کاری و فوق‌العاده‌ها — overtime & statutory premiums
// ============================================================
// Governing instrument: قانون کار، مواد ۵۸، ۵۹ و ۶۲.
//
// Formula (all premiums are *in addition to* the base wage already
// included in the monthly salary):
//   hourlyWage    = monthlyWage / (daysPerMonth × standardDailyHours)
//   اضافه‌کاری     = hourlyWage × overtimeHours × 1.4      (ماده ۵۹)
//   شب‌کاری        = hourlyWage × nightHours    × 0.35     (ماده ۵۸)
//   جمعه‌کاری      = hourlyWage × fridayHours   × 0.40     (ماده ۶۲)
//   تعطیل‌کاری     = hourlyWage × holidayHours  × 0.40     (ماده ۶۲)
//
// The multipliers are statutory constants; only the minimum wage is an
// annual figure, and it is not needed here because the user supplies
// the actual monthly wage.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, type Money } from "../money";
import { formatDaysFa, formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface LaborRates {
  daysPerMonth: number;
  standardDailyHours: number;
  overtimeMultiplier: number;
  nightWorkPremiumRate: number;
  fridayWorkPremiumRate: number;
  holidayWorkPremiumRate: number;
}

const def: CalculatorDef = {
  id: "calc-overtime",
  slug: "overtime",
  titleFa: "اضافه‌کاری و فوق‌العاده‌ها",
  subtitleFa: "محاسبه اضافه‌کاری، شب‌کاری، جمعه‌کاری و تعطیل‌کاری",
  descriptionFa:
    "مبلغ اضافه‌کاری و فوق‌العاده‌های قانونی کار (شب‌کاری، جمعه‌کاری و تعطیل‌کاری) را بر پایه مزد ساعتی و ضرایب مواد ۵۸، ۵۹ و ۶۲ قانون کار محاسبه کنید.",
  category: "employment",
  icon: "⏱️",
  gradient: "from-orange-600 to-amber-500",
  legalBasisFa: "مواد ۵۸، ۵۹ و ۶۲ قانون کار",
  datasetIds: ["labor-1405"],
  confidence: "high",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر مبلغ اضافه‌کاری و فوق‌العاده‌های قانونی کار را بر اساس مزد ماهانه و ساعات کار محاسبه می‌کند. ضرایب اضافه‌کاری (۱.۴)، شب‌کاری (۳۵٪)، جمعه‌کاری (۴۰٪) و تعطیل‌کاری (۴۰٪) ثابت و برگرفته از قانون کار هستند.",
  howItWorksFa:
    "ابتدا مزد ساعتی از تقسیم مزد ماهانه بر حاصل‌ضرب روزهای ماه (۳۰) در ساعات روزانه (۸) به دست می‌آید. سپس هر نوع ساعت کار در ضریب قانونی خود ضرب و با هم جمع می‌شود.",
  requiredInfoFa:
    "مزد ماهانه، تعداد ساعات اضافه‌کاری و در صورت وجود، ساعات شب‌کاری، جمعه‌کاری و تعطیل‌کاری.",
  determinacyFa:
    "مبلغ اضافه‌کاری و فوق‌العاده‌ها بر پایه ضرایب ثابت قانون کار قطعی است؛ به شرط آنکه مزد ماهانه و ساعات اعلام‌شده درست باشند.",
  disclaimerFa:
    "این محاسبه بر پایه مزد اعلامی شما و ضرایب قانون کار انجام شده است. در صورت وجود قرارداد کار، آیین‌نامه داخلی یا رویه کارگاه، ممکن است شرایط متفاوت باشد.",
  faq: [
    {
      qFa: "ضریب اضافه‌کاری چند است؟",
      aFa: "طبق ماده ۵۹ قانون کار، هر ساعت اضافه‌کاری معادل ۱.۴ برابر مزد عادی (یعنی ۴۰٪ بیشتر) محاسبه می‌شود.",
    },
    {
      qFa: "شب‌کاری چه زمانی محسوب می‌شود؟",
      aFa: "کار بین ساعت ۲۲ تا ۶ بامداد شب‌کاری است و طبق ماده ۵۸، فوق‌العاده‌ای معادل ۳۵٪ مزد به آن تعلق می‌گیرد.",
    },
    {
      qFa: "آیا جمعه‌کاری و تعطیل‌کاری با هم جمع می‌شوند؟",
      aFa: "خیر؛ هر ساعت کار تنها در یک عنوان طبقه‌بندی می‌شود. اگر روزی هم جمعه و هم تعطیل رسمی باشد، یک‌بار فوق‌العاده اعمال می‌گردد.",
    },
  ],
  relatedSlugs: ["salary-benefits", "insurance", "payroll-tax", "leave-buyback"],
  nextAction: {
    promptFa: "می‌خواهید کل حقوق و مزایای ماهانه خود را یک‌جا محاسبه کنید؟",
    labelFa: "محاسبه فیش حقوقی کامل",
    href: "/calculators/salary-benefits",
  },
  fields: [
    {
      key: "monthlyWage",
      labelFa: "مزد ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
      helpFa: "مزد پایه ماهانه؛ مبنای محاسبه مزد ساعتی.",
    },
    {
      key: "overtimeHours",
      labelFa: "ساعات اضافه‌کاری",
      type: "number",
      required: false,
      defaultValue: 20,
      min: 0,
      step: 0.5,
      helpFa: "ساعات کار مازاد بر ساعات موظفی روزانه.",
    },
    {
      key: "nightHours",
      labelFa: "ساعات شب‌کاری",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      step: 0.5,
      helpFa: "کار بین ساعت ۲۲ تا ۶ بامداد.",
    },
    {
      key: "fridayHours",
      labelFa: "ساعات جمعه‌کاری",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      step: 0.5,
    },
    {
      key: "holidayHours",
      labelFa: "ساعات تعطیل‌کاری",
      type: "number",
      required: false,
      defaultValue: 0,
      min: 0,
      step: 0.5,
      helpFa: "کار در تعطیلات رسمی.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("labor-1405");
  const rates = ds.rates as unknown as LaborRates;

  const wage = money(num(input, "monthlyWage"), "IRT");
  const overtimeHours = num(input, "overtimeHours");
  const nightHours = num(input, "nightHours");
  const fridayHours = num(input, "fridayHours");
  const holidayHours = num(input, "holidayHours");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const hoursPerMonth = rates.daysPerMonth * rates.standardDailyHours;
  const hourlyRial = wage.rial / hoursPerMonth;

  steps.push({
    labelFa: "مزد ساعتی",
    valueFa: formatMoney(money(Math.round(hourlyRial), "IRR"), "IRT"),
    noteFa: `مزد ماهانه ÷ (${formatDaysFa(rates.daysPerMonth)} × ${formatNumberFa(rates.standardDailyHours)} ساعت)`,
  });

  let totalRial = 0;

  if (overtimeHours > 0) {
    const pay = hourlyRial * overtimeHours * rates.overtimeMultiplier;
    totalRial += pay;
    steps.push({
      labelFa: `اضافه‌کاری (${formatNumberFa(overtimeHours, 1)} ساعت)`,
      valueFa: formatMoney(money(Math.round(pay), "IRR"), "IRT"),
      noteFa: `${formatPercentFa(rates.overtimeMultiplier)} مزد عادی (ماده ۵۹)`,
    });
  }

  if (nightHours > 0) {
    const pay = hourlyRial * nightHours * rates.nightWorkPremiumRate;
    totalRial += pay;
    steps.push({
      labelFa: `فوق‌العاده شب‌کاری (${formatNumberFa(nightHours, 1)} ساعت)`,
      valueFa: formatMoney(money(Math.round(pay), "IRR"), "IRT"),
      noteFa: `${formatPercentFa(rates.nightWorkPremiumRate)} مزد عادی (ماده ۵۸)`,
    });
  }

  if (fridayHours > 0) {
    const pay = hourlyRial * fridayHours * rates.fridayWorkPremiumRate;
    totalRial += pay;
    steps.push({
      labelFa: `فوق‌العاده جمعه‌کاری (${formatNumberFa(fridayHours, 1)} ساعت)`,
      valueFa: formatMoney(money(Math.round(pay), "IRR"), "IRT"),
      noteFa: `${formatPercentFa(rates.fridayWorkPremiumRate)} مزد عادی (ماده ۶۲)`,
    });
  }

  if (holidayHours > 0) {
    const pay = hourlyRial * holidayHours * rates.holidayWorkPremiumRate;
    totalRial += pay;
    steps.push({
      labelFa: `فوق‌العاده تعطیل‌کاری (${formatNumberFa(holidayHours, 1)} ساعت)`,
      valueFa: formatMoney(money(Math.round(pay), "IRR"), "IRT"),
      noteFa: `${formatPercentFa(rates.holidayWorkPremiumRate)} مزد عادی (ماده ۶۲)`,
    });
  }

  if (totalRial === 0) {
    warningsFa.push("هیچ ساعتی وارد نشده است؛ مبلغی برای اضافه‌کاری یا فوق‌العاده محاسبه نشد.");
  }

  const total: Money = money(Math.round(totalRial), "IRR");

  steps.push({
    labelFa: "جمع کل فوق‌العاده‌ها",
    valueFa: formatMoney(total, "IRT"),
    noteFa: "علاوه بر مزد پایه ماهانه",
  });

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "جمع اضافه‌کاری و فوق‌العاده‌ها",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "مزد ساعتی از تقسیم مزد ماهانه بر ۲۴۰ ساعت (۳۰ روز × ۸ ساعت) به دست می‌آید. هر ساعت اضافه‌کاری ۱.۴ برابر، شب‌کاری ۳۵٪، و جمعه‌کاری و تعطیل‌کاری هرکدام ۴۰٪ مزد عادی فوق‌العاده دارند. این مبالغ جدا از مزد پایه‌ای است که در حقوق ماهانه پرداخت می‌شود.",
    legalNotesFa: [
      "ماده ۵۹ قانون کار: اضافه‌کاری معادل ۴۰٪ اضافه بر مزد عادی.",
      "ماده ۵۸ قانون کار: فوق‌العاده شب‌کاری معادل ۳۵٪ مزد.",
      "ماده ۶۲ قانون کار: فوق‌العاده کار در روز جمعه و تعطیلات رسمی معادل ۴۰٪ مزد.",
    ],
  };
}

export const overtimeCalculator: Calculator = { def, compute };
