// ============================================================
// تبدیل رهن و اجاره — deposit ↔ rent conversion
// ============================================================
// Governing instrument: عرف بازار و توافق طرفین (no statutory rate).
//
// Formula:
//   deposit = monthlyRent × depositPerRentRial
//   monthlyRent = deposit / depositPerRentRial
// The conversion coefficient is a customary/contractual ratio, not a
// legal rate. The user may override the default coefficient; the
// result is therefore labelled «عرفی/قراردادی», never «قانونی».

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface RentConversionRates {
  defaultDepositPerRentRial: number;
  alternativeDepositPerRentRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-rent-converter",
  slug: "rent-converter",
  titleFa: "تبدیل رهن و اجاره",
  subtitleFa: "تبدیل ودیعه به اجاره ماهانه و برعکس",
  descriptionFa:
    "با استفاده از ضریب تبدیل عرفی، ودیعه (رهن) را به اجاره ماهانه و اجاره ماهانه را به ودیعه تبدیل کنید. ضریب پیش‌فرض قابل تغییر است.",
  category: "property",
  icon: "🏠",
  gradient: "from-amber-600 to-orange-500",
  legalBasisFa: "عرف بازار و توافق طرفین (ضریب تبدیل رهن و اجاره)",
  datasetIds: ["rent-conversion-1405"],
  confidence: "medium",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر ودیعه و اجاره ماهانه را با یک ضریب تبدیل عرفی به یکدیگر تبدیل می‌کند. این ضریب نرخ قانونی ثابت نیست و بر اساس بازار، منطقه و توافق طرفین متفاوت است.",
  howItWorksFa:
    "برای تبدیل اجاره به ودیعه، اجاره ماهانه در ضریب تبدیل ضرب می‌شود. برای تبدیل ودیعه به اجاره، ودیعه بر ضریب تبدیل تقسیم می‌گردد.",
  requiredInfoFa: "مبلغ ودیعه یا اجاره ماهانه و ضریب تبدیل مورد توافق.",
  determinacyFa:
    "این محاسبه «برآورد عرفی» است و قطعی نیست؛ ضریب تبدیل باید بر اساس توافق طرفین یا عرف منطقه تعیین شود.",
  disclaimerFa:
    "ضریب تبدیل رهن و اجاره نرخ قانونی ثابت ندارد و بر اساس عرف بازار و توافق طرفین تعیین می‌شود. نتیجه این محاسبه صرفاً یک برآورد اولیه است.",
  faq: [
    {
      qFa: "ضریب تبدیل رهن و اجاره چقدر است؟",
      aFa: "ضریب تبدیل نرخ قانونی ثابت ندارد؛ در عرف معمولاً هر واحد اجاره ماهانه معادل چند برابر ودیعه در نظر گرفته می‌شود. مقدار پیش‌فرض صرفاً یک مقدار رایج است.",
    },
    {
      qFa: "آیا این محاسبه قانونی است؟",
      aFa: "خیر؛ تبدیل رهن و اجاره یک محاسبه عرفی/قراردادی است و تابع توافق طرفین است، نه یک نرخ قانونی.",
    },
  ],
  relatedSlugs: ["real-estate-commission", "property-transfer-tax", "property-transaction-cost"],
  nextAction: {
    promptFa: "می‌خواهید کمیسیون مشاور املاک را هم محاسبه کنید؟",
    labelFa: "محاسبه کمیسیون املاک",
    href: "/calculators/real-estate-commission",
  },
  fields: [
    {
      key: "direction",
      labelFa: "جهت تبدیل",
      type: "select",
      required: true,
      defaultValue: "rent_to_deposit",
      options: [
        { value: "rent_to_deposit", labelFa: "از اجاره ماهانه به ودیعه" },
        { value: "deposit_to_rent", labelFa: "از ودیعه به اجاره ماهانه" },
      ],
    },
    {
      key: "amount",
      labelFa: "مبلغ ورودی",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 20_000_000,
      min: 0,
      helpFa: "اجاره ماهانه یا ودیعه، بر اساس جهت تبدیل.",
    },
    {
      key: "coefficient",
      labelFa: "ضریب تبدیل",
      type: "number",
      required: false,
      defaultValue: 200,
      min: 1,
      step: 1,
      helpFa: "هر واحد اجاره ماهانه معادل چند واحد ودیعه. مقدار پیش‌فرض عرفی است.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("rent-conversion-1405");
  const rates = ds.rates as unknown as RentConversionRates;

  const direction = str(input, "direction");
  const amount = money(num(input, "amount"), "IRT");
  const coefficient = num(input, "coefficient") || rates.defaultDepositPerRentRial;

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  steps.push({
    labelFa: "ضریب تبدیل",
    valueFa: formatNumberFa(coefficient),
    noteFa: "هر واحد اجاره ماهانه معادل این مقدار ودیعه",
  });

  let result: Money;
  let label: string;

  if (direction === "deposit_to_rent") {
    steps.push({ labelFa: "ودیعه (رهن)", valueFa: formatMoney(amount, "IRT") });
    result = roundTo(money(Math.round(amount.rial / coefficient), "IRR"), rates.roundingStepRial);
    label = "اجاره ماهانه";
    steps.push({
      labelFa: "اجاره ماهانه",
      valueFa: formatMoney(result, "IRT"),
      noteFa: "ودیعه ÷ ضریب تبدیل",
    });
  } else {
    steps.push({ labelFa: "اجاره ماهانه", valueFa: formatMoney(amount, "IRT") });
    result = roundTo(money(Math.round(amount.rial * coefficient), "IRR"), rates.roundingStepRial);
    label = "ودیعه (رهن)";
    steps.push({
      labelFa: "ودیعه (رهن)",
      valueFa: formatMoney(result, "IRT"),
      noteFa: "اجاره ماهانه × ضریب تبدیل",
    });
  }

  warningsFa.push(
    "ضریب تبدیل رهن و اجاره نرخ قانونی ثابت ندارد و بر اساس عرف بازار و توافق طرفین تعیین می‌شود."
  );

  return {
    headlineFa: formatMoney(result, "IRT"),
    headlineValue: result.rial,
    unit: "IRT",
    headlineLabelFa: label,
    status: "estimate",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "تبدیل رهن و اجاره با یک ضریب عرفی انجام می‌شود: برای تبدیل اجاره به ودیعه، اجاره ماهانه در ضریب ضرب می‌شود؛ برای تبدیل ودیعه به اجاره، ودیعه بر ضریب تقسیم می‌گردد. این ضریب تابع توافق طرفین و عرف منطقه است.",
    legalNotesFa: [
      "تبدیل رهن و اجاره نرخ قانونی ثابت ندارد و عرفی/قراردادی است.",
      "ضریب تبدیل باید بر اساس توافق طرفین یا عرف منطقه تعیین شود.",
    ],
  };
}

export const rentConverterCalculator: Calculator = { def, compute };
