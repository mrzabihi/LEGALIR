// ============================================================
// هزینه کامل معامله ملک — full property transaction cost
// ============================================================
// Composite calculator: it does NOT invent a new rate. It aggregates
// three independently-sourced components, each computed from its own
// dataset, so the total is traceable line by line:
//   1) مالیات نقل‌وانتقال  ← property-transfer-tax-1405
//   2) هزینه دفترخانه و ثبت ← notary-fees-1405
//   3) کمیسیون مشاور املاک  ← real-estate-commission-1405
//
// The transfer tax is levied on the assessed (منطقه‌ای) value, while
// the notary fee and the commission are levied on the transaction
// value. The two bases are therefore kept as separate inputs and never
// conflated.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface TransferTaxRates {
  landTransferTaxRate: number;
  buildingTransferTaxRate: number;
  vatRate: number;
  roundingStepRial: number;
}

interface NotaryRates {
  brackets: Bracket[];
  fixedStampDutyRial: number;
  roundingStepRial: number;
}

interface CommissionRates {
  saleRatePerParty: number;
  vatRate: number;
  minimumPerPartyRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-property-transaction-cost",
  slug: "property-transaction-cost",
  titleFa: "هزینه کامل معامله ملک",
  subtitleFa: "جمع مالیات، هزینه دفترخانه و کمیسیون",
  descriptionFa:
    "هزینه کامل یک معامله ملک را به‌صورت تفکیک‌شده محاسبه کنید: مالیات نقل‌وانتقال (بر پایه ارزش منطقه‌ای)، هزینه دفترخانه و ثبت، و کمیسیون مشاور املاک. هر جزء از منبع مستقل خود محاسبه و سپس جمع می‌شود.",
  category: "property",
  icon: "🧮",
  gradient: "from-emerald-700 to-teal-600",
  legalBasisFa:
    "مواد ۵۹ و ۶۴ قانون مالیات‌های مستقیم، تعرفه دفترخانه و تعرفه کمیسیون مشاوران املاک",
  datasetIds: [
    "property-transfer-tax-1405",
    "notary-fees-1405",
    "real-estate-commission-1405",
  ],
  confidence: "medium",
  available: true,
  status: "estimate",
  aboutFa:
    "این محاسبه‌گر هزینه کامل معامله ملک را از جمع سه جزء مستقل به دست می‌دهد: مالیات نقل‌وانتقال، هزینه دفترخانه و ثبت، و کمیسیون مشاور املاک. هر جزء بر پایه منبع خود محاسبه می‌شود و در نتیجه تفکیک می‌گردد.",
  howItWorksFa:
    "مالیات نقل‌وانتقال بر پایه ارزش منطقه‌ای عرصه و اعیان محاسبه می‌شود. هزینه دفترخانه بر پایه ارزش معامله و به‌صورت پله‌ای محاسبه می‌گردد. کمیسیون مشاور املاک نیز بر پایه ارزش معامله محاسبه و مالیات بر ارزش افزوده به آن اضافه می‌شود. سپس سه جزء جمع می‌گردند.",
  requiredInfoFa:
    "ارزش معامله، ارزش منطقه‌ای عرصه (زمین) و ارزش منطقه‌ای اعیان (ساختمان).",
  determinacyFa:
    "این نتیجه یک «برآورد» است؛ زیرا مبنای مالیات (ارزش منطقه‌ای) و نرخ کمیسیون (صنفی) ممکن است با ارقام واردشده متفاوت باشد و هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
  disclaimerFa:
    "این محاسبه یک برآورد از هزینه کامل معامله است. مالیات بر پایه ارزش منطقه‌ای اعلامی، هزینه دفترخانه بر پایه تعرفه رسمی و کمیسیون بر پایه تعرفه صنفی محاسبه شده است. پیش از معامله، ارقام را با مراجع مربوطه تطبیق دهید.",
  faq: [
    {
      qFa: "هزینه کامل معامله ملک شامل چه اجزایی است؟",
      aFa: "مالیات نقل‌وانتقال، هزینه دفترخانه و ثبت سند، و کمیسیون مشاور املاک. هر جزء جداگانه محاسبه و در نتیجه تفکیک می‌شود.",
    },
    {
      qFa: "چرا مبنای مالیات با مبنای کمیسیون متفاوت است؟",
      aFa: "مالیات نقل‌وانتقال بر پایه ارزش منطقه‌ای ملک محاسبه می‌شود، اما هزینه دفترخانه و کمیسیون بر پایه ارزش معامله (مبلغ قرارداد) محاسبه می‌گردند.",
    },
    {
      qFa: "آیا این مبلغ قطعی است؟",
      aFa: "خیر؛ این یک برآورد است. ارزش منطقه‌ای هر سال تغییر می‌کند، نرخ کمیسیون صنفی است و ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
    },
  ],
  relatedSlugs: ["property-transfer-tax", "notary-fees", "real-estate-commission"],
  nextAction: {
    promptFa: "می‌خواهید فقط مالیات نقل‌وانتقال را جداگانه محاسبه کنید؟",
    labelFa: "محاسبه مالیات نقل‌وانتقال",
    href: "/calculators/property-transfer-tax",
  },
  fields: [
    {
      key: "transactionValue",
      labelFa: "ارزش معامله",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 5_000_000_000,
      min: 0,
      helpFa: "مبلغ قرارداد؛ مبنای هزینه دفترخانه و کمیسیون.",
    },
    {
      key: "landValue",
      labelFa: "ارزش منطقه‌ای عرصه (زمین)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 2_000_000_000,
      min: 0,
      helpFa: "مبنای مالیات نقل‌وانتقال زمین.",
    },
    {
      key: "buildingValue",
      labelFa: "ارزش منطقه‌ای اعیان (ساختمان)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 3_000_000_000,
      min: 0,
      helpFa: "مبنای مالیات نقل‌وانتقال ساختمان.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const transferDs = requireDataset("property-transfer-tax-1405");
  const notaryDs = requireDataset("notary-fees-1405");
  const commissionDs = requireDataset("real-estate-commission-1405");

  const transfer = transferDs.rates as unknown as TransferTaxRates;
  const notary = notaryDs.rates as unknown as NotaryRates;
  const commission = commissionDs.rates as unknown as CommissionRates;

  const value = money(num(input, "transactionValue"), "IRT");
  const land = money(num(input, "landValue"), "IRT");
  const building = money(num(input, "buildingValue"), "IRT");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  // 1) Transfer tax on the assessed value.
  const landTaxRial = land.rial * transfer.landTransferTaxRate;
  const buildingTaxRial = building.rial * transfer.buildingTransferTaxRate;
  const vatOnBuildingRial = buildingTaxRial * transfer.vatRate;
  const transferTaxRial = landTaxRial + buildingTaxRial + vatOnBuildingRial;

  steps.push({
    labelFa: "مالیات نقل‌وانتقال",
    valueFa: formatMoney(money(Math.round(transferTaxRial), "IRR"), "IRT"),
    noteFa: `بر پایه ارزش منطقه‌ای (عرصه ${formatPercentFa(
      transfer.landTransferTaxRate
    )} + اعیان ${formatPercentFa(transfer.buildingTransferTaxRate)} + ارزش افزوده)`,
  });

  // 2) Notary & registration fee on the transaction value.
  const notaryBreakdown = applyBrackets(value.rial, notary.brackets);
  const notaryFeeRial = notaryBreakdown.totalRial + notary.fixedStampDutyRial;

  steps.push({
    labelFa: "هزینه دفترخانه و ثبت",
    valueFa: formatMoney(money(Math.round(notaryFeeRial), "IRR"), "IRT"),
    noteFa: "حق‌التحریر پله‌ای + هزینه ثابت ثبت",
  });

  // 3) Real-estate commission (sale) on the transaction value.
  const rawCommissionRial = value.rial * commission.saleRatePerParty;
  const commissionBaseRial = Math.max(rawCommissionRial, commission.minimumPerPartyRial);
  const commissionVatRial = commissionBaseRial * commission.vatRate;
  const commissionRial = commissionBaseRial + commissionVatRial;

  steps.push({
    labelFa: "کمیسیون مشاور املاک (هر طرف)",
    valueFa: formatMoney(money(Math.round(commissionRial), "IRR"), "IRT"),
    noteFa: `${formatPercentFa(commission.saleRatePerParty)} ارزش معامله + مالیات بر ارزش افزوده`,
  });

  const totalRial = transferTaxRial + notaryFeeRial + commissionRial;
  const total: Money = roundTo(
    money(Math.round(totalRial), "IRR"),
    transfer.roundingStepRial
  );

  steps.push({
    labelFa: "جمع هزینه کامل معامله",
    valueFa: formatMoney(total, "IRT"),
  });

  if (value.rial === 0 && land.rial === 0 && building.rial === 0) {
    warningsFa.push("هیچ ارزشی وارد نشده است؛ هزینه‌ای محاسبه نشد.");
  }
  warningsFa.push(
    "این مبلغ یک برآورد است؛ ارزش منطقه‌ای و نرخ کمیسیون ممکن است با ارقام واردشده متفاوت باشد."
  );

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "هزینه کامل معامله",
    status: "estimate",
    steps,
    warningsFa,
    source: transferDs.source,
    explanationFa:
      "هزینه کامل معامله از جمع سه جزء مستقل به دست می‌آید: مالیات نقل‌وانتقال بر پایه ارزش منطقه‌ای، هزینه دفترخانه و ثبت بر پایه ارزش معامله، و کمیسیون مشاور املاک بر پایه ارزش معامله. هر جزء از منبع خود محاسبه و در نتیجه تفکیک شده است.",
    legalNotesFa: [
      "مالیات نقل‌وانتقال بر پایه ارزش منطقه‌ای ملک محاسبه می‌شود، نه قیمت بازار.",
      "هزینه دفترخانه بر پایه تعرفه رسمی حق‌التحریر محاسبه می‌شود.",
      "کمیسیون مشاور املاک صنفی است و می‌تواند بر اساس شهر متفاوت باشد.",
      "ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
    ],
  };
}

export const propertyTransactionCostCalculator: Calculator = { def, compute };
