// ============================================================
// مالیات نقل‌وانتقال ملک — property transfer tax
// ============================================================
// Governing instruments: قانون مالیات‌های مستقیم، مواد ۵۹ و ۶۴ و
// قانون مالیات بر ارزش افزوده.
//
// Formula:
//   landTax     = assessedLandValue × landTransferTaxRate
//   buildingTax = assessedBuildingValue × buildingTransferTaxRate
//   vat         = buildingTax × vatRate
//   total       = landTax + buildingTax + vat
// Tax is levied on the assessed (منطقه‌ای) value, never the market
// price. The land (عرصه) and building (اعیان) components are kept
// separate because VAT applies only to the building.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface PropertyTransferTaxRates {
  landTransferTaxRate: number;
  buildingTransferTaxRate: number;
  vatRate: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-property-transfer-tax",
  slug: "property-transfer-tax",
  titleFa: "مالیات نقل‌وانتقال ملک",
  subtitleFa: "محاسبه مالیات انتقال عرصه و اعیان",
  descriptionFa:
    "مالیات نقل‌وانتقال ملک را بر پایه ارزش منطقه‌ای (نه قیمت بازار) و به تفکیک عرصه (زمین) و اعیان (ساختمان) محاسبه کنید. مالیات بر ارزش افزوده فقط به بخش اعیان تعلق می‌گیرد.",
  category: "property",
  icon: "🏛️",
  gradient: "from-stone-600 to-amber-600",
  legalBasisFa: "مواد ۵۹ و ۶۴ قانون مالیات‌های مستقیم و قانون مالیات بر ارزش افزوده",
  datasetIds: ["property-transfer-tax-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر مالیات نقل‌وانتقال ملک را بر پایه ارزش منطقه‌ای ملک محاسبه می‌کند. مالیات عرصه و اعیان جداگانه محاسبه می‌شود و مالیات بر ارزش افزوده فقط به بخش اعیان اضافه می‌گردد.",
  howItWorksFa:
    "ارزش منطقه‌ای عرصه در نرخ مالیات عرصه و ارزش منطقه‌ای اعیان در نرخ مالیات اعیان ضرب می‌شود. سپس مالیات بر ارزش افزوده به مالیات اعیان اضافه و همه با هم جمع می‌گردد.",
  requiredInfoFa:
    "ارزش منطقه‌ای عرصه (زمین) و ارزش منطقه‌ای اعیان (ساختمان).",
  determinacyFa:
    "نرخ‌های مالیات قانونی‌اند؛ اما مبنای محاسبه «ارزش منطقه‌ای» است که توسط سازمان امور مالیاتی تعیین می‌شود و ممکن است با قیمت بازار متفاوت باشد.",
  disclaimerFa:
    "این محاسبه بر پایه ارزش منطقه‌ای اعلامی انجام شده است. ارزش منطقه‌ای هر سال توسط سازمان امور مالیاتی تعیین می‌شود؛ پیش از اتکا، ارزش منطقه‌ای ملک خود را بررسی کنید.",
  faq: [
    {
      qFa: "مالیات نقل‌وانتقال بر چه مبنایی محاسبه می‌شود؟",
      aFa: "مالیات نقل‌وانتقال بر مبنای ارزش منطقه‌ای ملک (نه قیمت بازار) محاسبه می‌شود که توسط سازمان امور مالیاتی تعیین می‌گردد.",
    },
    {
      qFa: "تفاوت عرصه و اعیان چیست؟",
      aFa: "عرصه به زمین و اعیان به ساختمان گفته می‌شود. مالیات هرکدام جداگانه محاسبه می‌شود و مالیات بر ارزش افزوده فقط به اعیان تعلق می‌گیرد.",
    },
    {
      qFa: "آیا مالیات بر ارزش افزوده به کل ملک تعلق می‌گیرد؟",
      aFa: "خیر؛ مالیات بر ارزش افزوده فقط به بخش اعیان (ساختمان) تعلق می‌گیرد، نه به عرصه.",
    },
  ],
  relatedSlugs: ["property-transaction-cost", "notary-fees", "real-estate-commission"],
  nextAction: {
    promptFa: "می‌خواهید هزینه کامل معامله ملک را محاسبه کنید؟",
    labelFa: "محاسبه هزینه کامل معامله",
    href: "/calculators/property-transaction-cost",
  },
  fields: [
    {
      key: "landValue",
      labelFa: "ارزش منطقه‌ای عرصه (زمین)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 2_000_000_000,
      min: 0,
      helpFa: "ارزش منطقه‌ای زمین، نه قیمت بازار.",
    },
    {
      key: "buildingValue",
      labelFa: "ارزش منطقه‌ای اعیان (ساختمان)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 3_000_000_000,
      min: 0,
      helpFa: "ارزش منطقه‌ای ساختمان، نه قیمت بازار.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("property-transfer-tax-1405");
  const rates = ds.rates as unknown as PropertyTransferTaxRates;

  const land = money(num(input, "landValue"), "IRT");
  const building = money(num(input, "buildingValue"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const landTaxRial = land.rial * rates.landTransferTaxRate;
  const buildingTaxRial = building.rial * rates.buildingTransferTaxRate;
  const vatRial = buildingTaxRial * rates.vatRate;

  steps.push({
    labelFa: `مالیات عرصه (${formatPercentFa(rates.landTransferTaxRate)})`,
    valueFa: formatMoney(money(Math.round(landTaxRial), "IRR"), "IRT"),
    noteFa: `بر ${formatMoney(land, "IRT")}`,
  });
  steps.push({
    labelFa: `مالیات اعیان (${formatPercentFa(rates.buildingTransferTaxRate)})`,
    valueFa: formatMoney(money(Math.round(buildingTaxRial), "IRR"), "IRT"),
    noteFa: `بر ${formatMoney(building, "IRT")}`,
  });
  steps.push({
    labelFa: `مالیات بر ارزش افزوده اعیان (${formatPercentFa(rates.vatRate)})`,
    valueFa: formatMoney(money(Math.round(vatRial), "IRR"), "IRT"),
  });

  const totalRial = landTaxRial + buildingTaxRial + vatRial;
  const total: Money = roundTo(money(Math.round(totalRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "جمع مالیات نقل‌وانتقال",
    valueFa: formatMoney(total, "IRT"),
  });

  if (land.rial === 0 && building.rial === 0) {
    warningsFa.push("ارزش منطقه‌ای وارد نشده است؛ مالیاتی محاسبه نشد.");
  }

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "مالیات نقل‌وانتقال",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "مالیات نقل‌وانتقال بر پایه ارزش منطقه‌ای ملک محاسبه می‌شود. مالیات عرصه و اعیان جداگانه محاسبه می‌گردد و مالیات بر ارزش افزوده فقط به بخش اعیان اضافه می‌شود. مبنای محاسبه ارزش منطقه‌ای است، نه قیمت بازار.",
    legalNotesFa: [
      "ماده ۵۹ قانون مالیات‌های مستقیم: مالیات نقل‌وانتقال املاک.",
      "ماده ۶۴ قانون مالیات‌های مستقیم: نرخ مالیات انتقال.",
      "مالیات بر ارزش افزوده فقط به بخش اعیان تعلق می‌گیرد.",
    ],
  };
}

export const propertyTransferTaxCalculator: Calculator = { def, compute };
