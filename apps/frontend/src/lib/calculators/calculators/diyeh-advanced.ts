// ============================================================
// دیه پیشرفته و ارش — advanced diyeh with arsh
// ============================================================
// Governing instrument: قانون مجازات اسلامی، کتاب چهارم (دیات).
//
// Formula:
//   diyeh = fullDiyeh × statutoryFraction × (sacred month ? 4/3 : 1)
//   total = diyeh + arsh
// This extends the base diyeh calculator with an optional ارش
// (compensation for an injury whose diyeh is not fixed by law, assessed
// by the court) and a count of the same injury, so a case with several
// identical injuries can be totalled in one pass.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset, DIYEH_FRACTIONS } from "../datasets";
import { bool, num, str, type Calculator, type CalculatorInput } from "../engine";

interface DiyehRates {
  fullDiyehRial: number;
  sacredMonthMultiplier: number;
}

const def: CalculatorDef = {
  id: "calc-diyeh-advanced",
  slug: "diyeh-advanced",
  titleFa: "دیه پیشرفته و ارش",
  subtitleFa: "محاسبه دیه چند صدمه به‌همراه ارش",
  descriptionFa:
    "دیه یک یا چند صدمه را به‌همراه ارش (خسارت صدمه‌ای که دیه آن در قانون تعیین نشده) محاسبه کنید. در ماه‌های حرام، دیه یک‌سوم افزایش می‌یابد.",
  category: "injury",
  icon: "🩹",
  gradient: "from-red-700 to-rose-600",
  legalBasisFa: "مواد ۵۴۹، ۵۵۰ و ۵۵۰ به بعد قانون مجازات اسلامی (دیات و ارش)",
  datasetIds: ["diyeh-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر دیه یک یا چند صدمه را بر پایه نرخ کامل سال جاری و ضریب قانونی هر صدمه محاسبه می‌کند و در صورت وجود، ارش را نیز به آن اضافه می‌نماید. در ماه‌های حرام دیه یک‌سوم افزایش می‌یابد.",
  howItWorksFa:
    "نرخ دیه کامل در ضریب قانونی صدمه و در تعداد صدمه ضرب می‌شود. در صورت وقوع در ماه حرام، یک‌سوم افزایش می‌یابد. سپس مبلغ ارش (در صورت ورود) به آن اضافه می‌گردد.",
  requiredInfoFa: "نوع صدمه، تعداد صدمه، وقوع در ماه حرام و در صورت وجود مبلغ ارش.",
  determinacyFa:
    "دیه بر پایه نرخ سالانه و ضرایب قانونی محاسبه می‌شود؛ اما مبلغ ارش به نظر کارشناس و دادگاه وابسته است و قطعی نیست.",
  disclaimerFa:
    "این محاسبه بر پایه نرخ دیه اعلامی و ضرایب قانونی انجام شده است. مبلغ ارش به نظر کارشناس و دادگاه وابسته است و ممکن است با ارقام واردشده متفاوت باشد.",
  faq: [
    {
      qFa: "ارش چیست؟",
      aFa: "ارش خسارتی است که برای صدمه‌ای که دیه آن در قانون به‌طور مشخص تعیین نشده، توسط کارشناس و دادگاه برآورد می‌شود.",
    },
    {
      qFa: "دیه در ماه حرام چقدر افزایش می‌یابد؟",
      aFa: "در چهار ماه حرام (محرم، رجب، ذی‌القعده و ذی‌الحجه) دیه یک‌سوم افزایش می‌یابد.",
    },
    {
      qFa: "آیا می‌توان چند صدمه را با هم محاسبه کرد؟",
      aFa: "بله؛ در این محاسبه‌گر می‌توانید تعداد صدمه هم‌نوع را وارد کنید تا دیه آن‌ها با هم جمع شود.",
    },
  ],
  relatedSlugs: ["diyeh", "vehicle-depreciation", "check-damages"],
  nextAction: {
    promptFa: "می‌خواهید دیه یک صدمه مشخص را محاسبه کنید؟",
    labelFa: "محاسبه دیه ساده",
    href: "/calculators/diyeh",
  },
  fields: [
    {
      key: "injuryType",
      labelFa: "نوع صدمه",
      type: "select",
      required: true,
      defaultValue: "full",
      options: DIYEH_FRACTIONS.map((f) => ({ value: f.key, labelFa: f.labelFa })),
    },
    {
      key: "injuryCount",
      labelFa: "تعداد صدمه",
      type: "number",
      required: false,
      defaultValue: 1,
      min: 1,
      max: 20,
      step: 1,
      helpFa: "تعداد صدمه هم‌نوع.",
    },
    {
      key: "sacredMonth",
      labelFa: "وقوع در ماه حرام",
      type: "boolean",
      required: false,
      defaultValue: false,
      helpFa: "محرم، رجب، ذی‌القعده و ذی‌الحجه.",
    },
    {
      key: "arshAmount",
      labelFa: "مبلغ ارش (اختیاری)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 0,
      min: 0,
      helpFa: "ارش برآوردی صدمه‌ای که دیه آن تعیین نشده است.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("diyeh-1405");
  const rates = ds.rates as unknown as DiyehRates;

  const injuryKey = str(input, "injuryType");
  const fraction =
    DIYEH_FRACTIONS.find((f) => f.key === injuryKey) ?? DIYEH_FRACTIONS[0]!;
  const injuryCount = Math.max(1, Math.round(num(input, "injuryCount")));
  const arsh = money(num(input, "arshAmount"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const full = money(rates.fullDiyehRial, "IRR");
  steps.push({
    labelFa: "دیه کامل سال جاری",
    valueFa: formatMoney(full, "IRT"),
  });

  let perInjury: Money = scaleMoney(full, fraction.fraction);
  steps.push({
    labelFa: `ضریب صدمه (${fraction.labelFa})`,
    valueFa: formatMoney(perInjury, "IRT"),
    noteFa: `${formatPercentFa(fraction.fraction)} از دیه کامل`,
  });

  if (bool(input, "sacredMonth")) {
    perInjury = scaleMoney(perInjury, rates.sacredMonthMultiplier);
    steps.push({
      labelFa: "افزایش ماه حرام (یک‌سوم)",
      valueFa: formatMoney(perInjury, "IRT"),
    });
  }

  const diyehTotal: Money = scaleMoney(perInjury, injuryCount);
  if (injuryCount > 1) {
    steps.push({
      labelFa: `جمع دیه ${formatNumberFa(injuryCount)} صدمه`,
      valueFa: formatMoney(diyehTotal, "IRT"),
    });
  }

  if (arsh.rial > 0) {
    steps.push({
      labelFa: "ارش",
      valueFa: formatMoney(arsh, "IRT"),
    });
  }

  const total: Money = money(diyehTotal.rial + arsh.rial, "IRR");
  steps.push({
    labelFa: "جمع کل دیه و ارش",
    valueFa: formatMoney(total, "IRT"),
  });

  if (arsh.rial > 0) {
    warningsFa.push("مبلغ ارش به نظر کارشناس و دادگاه وابسته است و قطعی نیست.");
  }

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "جمع دیه و ارش",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "دیه بر پایه نرخ کامل سال جاری و ضریب قانونی هر صدمه محاسبه می‌شود و در ماه‌های حرام یک‌سوم افزایش می‌یابد. در صورت وجود، مبلغ ارش نیز به آن اضافه می‌گردد. مبلغ ارش به نظر کارشناس و دادگاه وابسته است.",
    legalNotesFa: [
      "ماده ۵۴۹ قانون مجازات اسلامی: نرخ دیه کامل.",
      "ماده ۵۵۰ قانون مجازات اسلامی: دیه ماه‌های حرام یک‌سوم بیشتر است.",
      "ارش برای صدمه‌ای است که دیه آن در قانون تعیین نشده و به نظر کارشناس و دادگاه وابسته است.",
    ],
  };
}

export const diyehAdvancedCalculator: Calculator = { def, compute };
