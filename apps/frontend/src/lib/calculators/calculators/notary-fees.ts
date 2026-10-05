// ============================================================
// هزینه‌های دفترخانه و ثبت — notary & registration fees
// ============================================================
// Governing instrument: تعرفه حق‌التحریر دفاتر اسناد رسمی و
// هزینه‌های ثبت (سازمان ثبت اسناد و املاک).
//
// Formula (cumulative ad-valorem on the transaction value):
//   notaryFee = Σ over brackets of (slice × bracket rate)
//   total     = notaryFee + fixedStampDuty
// The stamp duty is a fixed registration charge, separate from the
// ad-valorem notary fee.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface NotaryFeesRates {
  brackets: Bracket[];
  fixedStampDutyRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-notary-fees",
  slug: "notary-fees",
  titleFa: "هزینه‌های دفترخانه و ثبت",
  subtitleFa: "محاسبه حق‌التحریر و هزینه ثبت سند",
  descriptionFa:
    "هزینه‌های دفترخانه و ثبت سند را بر پایه ارزش معامله و به‌صورت پله‌ای محاسبه کنید. حق‌التحریر دفترخانه و هزینه ثابت ثبت، جداگانه محاسبه و جمع می‌شوند.",
  category: "property",
  icon: "📜",
  gradient: "from-amber-700 to-yellow-600",
  legalBasisFa: "تعرفه حق‌التحریر دفاتر اسناد رسمی و هزینه‌های ثبت",
  datasetIds: ["notary-fees-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر هزینه‌های دفترخانه و ثبت سند را محاسبه می‌کند. حق‌التحریر دفترخانه بر پایه ارزش معامله و به‌صورت پله‌ای محاسبه می‌شود و هزینه ثابت ثبت به آن اضافه می‌گردد.",
  howItWorksFa:
    "ارزش معامله به‌صورت تجمعی در پله‌های تعرفه حق‌التحریر ضرب و جمع می‌شود. سپس هزینه ثابت ثبت به آن اضافه می‌گردد.",
  requiredInfoFa: "ارزش معامله (مبلغ سند).",
  determinacyFa:
    "تعرفه حق‌التحریر رسمی است؛ اما ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد. نتیجه یک «تعرفه رسمی» است.",
  disclaimerFa:
    "این محاسبه بر پایه تعرفه رسمی حق‌التحریر انجام شده است. تعرفه هر سال اعلام می‌شود و ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
  faq: [
    {
      qFa: "حق‌التحریر دفترخانه چگونه محاسبه می‌شود؟",
      aFa: "حق‌التحریر بر اساس ارزش معامله و به‌صورت پله‌ای محاسبه می‌شود؛ هر پله از ارزش معامله با نرخ خود مشمول حق‌التحریر می‌گردد.",
    },
    {
      qFa: "هزینه ثبت سند چقدر است؟",
      aFa: "هزینه ثبت یک مبلغ ثابت است که جدا از حق‌التحریر دفترخانه محاسبه و به آن اضافه می‌شود.",
    },
    {
      qFa: "آیا هزینه دفترخانه قابل مذاکره است؟",
      aFa: "خیر؛ حق‌التحریر دفترخانه بر پایه تعرفه رسمی محاسبه می‌شود و قابل مذاکره نیست.",
    },
  ],
  relatedSlugs: ["property-transfer-tax", "property-transaction-cost", "real-estate-commission"],
  nextAction: {
    promptFa: "می‌خواهید هزینه کامل معامله ملک را محاسبه کنید؟",
    labelFa: "محاسبه هزینه کامل معامله",
    href: "/calculators/property-transaction-cost",
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
      helpFa: "مبلغی که سند بر اساس آن تنظیم می‌شود.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("notary-fees-1405");
  const rates = ds.rates as unknown as NotaryFeesRates;

  const value = money(num(input, "transactionValue"), "IRT");
  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const breakdown = applyBrackets(value.rial, rates.brackets);

  for (const slice of breakdown.slices) {
    steps.push({
      labelFa: `پله ${formatPercentFa(slice.rate)}`,
      valueFa: formatMoney(money(Math.round(slice.feeRial), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(money(Math.round(slice.sliceRial), "IRR"), "IRT")} از ارزش معامله`,
    });
  }

  const notaryFee = money(Math.round(breakdown.totalRial), "IRR");
  steps.push({
    labelFa: "حق‌التحریر دفترخانه",
    valueFa: formatMoney(notaryFee, "IRT"),
  });

  const stampDuty = money(rates.fixedStampDutyRial, "IRR");
  steps.push({
    labelFa: "هزینه ثبت سند (ثابت)",
    valueFa: formatMoney(stampDuty, "IRT"),
  });

  const total: Money = roundTo(
    money(notaryFee.rial + stampDuty.rial, "IRR"),
    rates.roundingStepRial
  );
  steps.push({
    labelFa: "جمع هزینه‌های دفترخانه و ثبت",
    valueFa: formatMoney(total, "IRT"),
  });

  if (value.rial === 0) {
    warningsFa.push("ارزش معامله وارد نشده است؛ فقط هزینه ثابت ثبت محاسبه شد.");
  }

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "هزینه دفترخانه و ثبت",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "حق‌التحریر دفترخانه بر پایه ارزش معامله و به‌صورت تجمعی در پله‌های تعرفه محاسبه می‌شود. سپس هزینه ثابت ثبت سند به آن اضافه می‌گردد تا جمع هزینه‌های دفترخانه و ثبت به دست آید.",
    legalNotesFa: [
      "تعرفه حق‌التحریر دفاتر اسناد رسمی هر سال اعلام می‌شود.",
      "هزینه ثبت سند مبلغی ثابت و جدا از حق‌التحریر است.",
      "ممکن است هزینه‌های جانبی دیگری نیز وجود داشته باشد.",
    ],
  };
}

export const notaryFeesCalculator: Calculator = { def, compute };
