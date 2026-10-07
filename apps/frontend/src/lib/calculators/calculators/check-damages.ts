// ============================================================
// چک برگشتی — bounced-check claim
// ============================================================
// Governing instruments: قانون صدور چک (اصلاحی ۱۳۹۷) و ماده ۵۲۲
// قانون آیین دادرسی مدنی.
//
// A bounced-check claim has three *separate* components that must
// never be merged into one number:
//   1) اصل چک        — the face value of the check
//   2) خسارت تأخیر   — principal × (indexAtPayment / indexAtDue − 1)
//   3) هزینه‌های قضایی — court fee + enforcement fee (optional)
// The late-payment component follows ماده ۵۲۲ (CPI-index based); when
// the index has not risen, no damages accrue.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { applyBrackets, type Bracket } from "../brackets";
import { num, bool, type Calculator, type CalculatorInput } from "../engine";

interface CheckRates {
  baseYear: number;
  monthlyIndex: Record<string, number>;
}

interface CourtFeeRates {
  brackets: Bracket[];
  roundingStepRial: number;
}

interface ExecutionFeeRates {
  enforcementRate: number;
  minimumRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-check-damages",
  slug: "check-damages",
  titleFa: "مطالبات چک برگشتی",
  subtitleFa: "محاسبه اصل چک، خسارت تأخیر و هزینه‌های قضایی",
  descriptionFa:
    "مطالبات ناشی از چک برگشتی را در سه بخش جداگانه محاسبه کنید: اصل مبلغ چک، خسارت تأخیر تأدیه بر مبنای شاخص قیمت (ماده ۵۲۲) و هزینه‌های قضایی و اجرایی.",
  category: "civil",
  icon: "🧾",
  gradient: "from-rose-600 to-red-500",
  legalBasisFa: "قانون صدور چک (اصلاحی ۱۳۹۷) و ماده ۵۲۲ قانون آیین دادرسی مدنی",
  datasetIds: ["check-1405", "court-fee-1405", "execution-fee-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر مطالبات چک برگشتی را در سه بخش جداگانه نشان می‌دهد: اصل مبلغ چک، خسارت تأخیر تأدیه بر مبنای تغییر شاخص قیمت، و هزینه‌های قضایی و اجرایی. این سه مفهوم با هم جمع نمی‌شوند و هرکدام جداگانه محاسبه می‌گردد.",
  howItWorksFa:
    "خسارت تأخیر از تغییر شاخص قیمت بین تاریخ سررسید و تاریخ پرداخت محاسبه می‌شود. هزینه دادرسی از جدول پله‌ای تعرفه و هزینه اجرا از درصد مبلغ محاسبه می‌گردد. اصل چک بدون تغییر باقی می‌ماند.",
  requiredInfoFa:
    "مبلغ چک، شاخص قیمت در تاریخ سررسید و تاریخ پرداخت، و انتخاب محاسبه هزینه‌های قضایی.",
  determinacyFa:
    "اصل چک و خسارت تأخیر بر پایه شاخص رسمی قابل محاسبه است؛ اما هزینه‌های قضایی و اجرایی به رویه و مرحله رسیدگی وابسته است و ممکن است متفاوت باشد.",
  disclaimerFa:
    "این محاسبه یک برآورد است. خسارت تأخیر بر مبنای شاخص قیمت بانک مرکزی محاسبه می‌شود و هزینه‌های قضایی/اجرایی به مرحله رسیدگی و رویه دادگاه وابسته است. پیش از اقدام، با وکیل مشورت کنید.",
  faq: [
    {
      qFa: "خسارت تأخیر تأدیه چک چگونه محاسبه می‌شود؟",
      aFa: "طبق ماده ۵۲۲ قانون آیین دادرسی مدنی، خسارت تأخیر بر مبنای تغییر شاخص بهای کالاها و خدمات مصرفی بانک مرکزی از تاریخ سررسید تا تاریخ پرداخت محاسبه می‌شود.",
    },
    {
      qFa: "آیا اصل چک و خسارت تأخیر با هم جمع می‌شوند؟",
      aFa: "این دو مفهوم جدا هستند؛ مبلغ قابل مطالبه معمولاً جمع اصل چک و خسارت تأخیر است، اما هرکدام جداگانه محاسبه و نمایش داده می‌شود.",
    },
    {
      qFa: "هزینه‌های قضایی چک برگشتی چقدر است؟",
      aFa: "هزینه دادرسی بر اساس ارزش خواسته و به‌صورت پله‌ای محاسبه می‌شود و هزینه اجرا درصدی از مبلغ محکوم‌به است.",
    },
  ],
  relatedSlugs: ["delayed-payment", "court-fee", "execution-fee"],
  nextAction: {
    promptFa: "می‌خواهید خسارت تأخیر تأدیه را جداگانه محاسبه کنید؟",
    labelFa: "محاسبه خسارت تأخیر تأدیه",
    href: "/calculators/delayed-payment",
  },
  fields: [
    {
      key: "checkAmount",
      labelFa: "مبلغ چک",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 200_000_000,
      min: 0,
    },
    {
      key: "indexAtDue",
      labelFa: "شاخص در تاریخ سررسید",
      type: "number",
      required: true,
      defaultValue: 100,
      min: 0,
      helpFa: "شاخص ماه سررسید از گزارش رسمی بانک مرکزی.",
    },
    {
      key: "indexAtPayment",
      labelFa: "شاخص در تاریخ پرداخت",
      type: "number",
      required: true,
      defaultValue: 168,
      min: 0,
      helpFa: "شاخص ماه پرداخت از گزارش رسمی بانک مرکزی.",
    },
    {
      key: "includeCosts",
      labelFa: "احتساب هزینه‌های قضایی و اجرایی",
      type: "boolean",
      required: false,
      defaultValue: true,
      helpFa: "در صورت فعال بودن، هزینه دادرسی و هزینه اجرا نیز محاسبه می‌شود.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const checkDs = requireDataset("check-1405");
  const checkRates = checkDs.rates as unknown as CheckRates;
  const courtRates = requireDataset("court-fee-1405").rates as unknown as CourtFeeRates;
  const execRates = requireDataset("execution-fee-1405").rates as unknown as ExecutionFeeRates;

  const principal = money(num(input, "checkAmount"), "IRT");
  const indexAtDue = num(input, "indexAtDue");
  const indexAtPayment = num(input, "indexAtPayment");
  const includeCosts = bool(input, "includeCosts");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  steps.push({
    labelFa: "اصل مبلغ چک",
    valueFa: formatMoney(principal, "IRT"),
  });

  // ---- 1) Late-payment damages (ماده ۵۲۲) ----
  let damages: Money = { rial: 0 };
  if (indexAtDue <= 0) {
    warningsFa.push("شاخص سررسید باید بزرگ‌تر از صفر باشد؛ خسارت تأخیر محاسبه نشد.");
  } else if (indexAtPayment <= indexAtDue) {
    warningsFa.push(
      "شاخص پرداخت از شاخص سررسید بیشتر نیست؛ طبق ماده ۵۲۲ خسارت تأخیری تعلق نمی‌گیرد."
    );
  } else {
    const ratio = indexAtPayment / indexAtDue;
    damages = money(Math.round(principal.rial * (ratio - 1)), "IRR");
    steps.push({
      labelFa: "نسبت افزایش شاخص",
      valueFa: formatPercentFa(ratio - 1),
      noteFa: `مبنا: سال ${formatNumberFa(checkRates.baseYear)}`,
    });
    steps.push({
      labelFa: "خسارت تأخیر تأدیه (ماده ۵۲۲)",
      valueFa: formatMoney(damages, "IRT"),
    });
  }

  // ---- 2) Judicial & enforcement costs (optional) ----
  let courtFee: Money = { rial: 0 };
  let execFee: Money = { rial: 0 };

  if (includeCosts) {
    const claimRial = principal.rial + damages.rial;
    const courtBreakdown = applyBrackets(claimRial, courtRates.brackets);
    courtFee = roundTo(money(Math.round(courtBreakdown.totalRial), "IRR"), courtRates.roundingStepRial);
    steps.push({
      labelFa: "هزینه دادرسی",
      valueFa: formatMoney(courtFee, "IRT"),
      noteFa: `بر ارزش خواسته ${formatMoney(money(claimRial, "IRR"), "IRT")}`,
    });

    let execRial = claimRial * execRates.enforcementRate;
    if (execRial < execRates.minimumRial) execRial = execRates.minimumRial;
    execFee = roundTo(money(Math.round(execRial), "IRR"), execRates.roundingStepRial);
    steps.push({
      labelFa: `هزینه اجرا (${formatPercentFa(execRates.enforcementRate)})`,
      valueFa: formatMoney(execFee, "IRT"),
    });
  }

  const totalClaim = money(principal.rial + damages.rial, "IRR");
  steps.push({
    labelFa: "جمع اصل چک و خسارت تأخیر",
    valueFa: formatMoney(totalClaim, "IRT"),
  });

  const grandTotal = money(totalClaim.rial + courtFee.rial + execFee.rial, "IRR");
  if (includeCosts) {
    steps.push({
      labelFa: "جمع کل با هزینه‌های قضایی و اجرایی",
      valueFa: formatMoney(grandTotal, "IRT"),
    });
  }

  warningsFa.push(
    "اصل چک، خسارت تأخیر و هزینه‌های قضایی سه مفهوم جدا هستند و در نتیجه تفکیک شده‌اند."
  );

  return {
    headlineFa: formatMoney(totalClaim, "IRT"),
    headlineValue: totalClaim.rial,
    unit: "IRT",
    headlineLabelFa: "اصل چک و خسارت تأخیر",
    status: "legal_basis",
    steps,
    warningsFa,
    source: checkDs.source,
    explanationFa:
      "مطالبات چک برگشتی سه بخش دارد: اصل مبلغ چک، خسارت تأخیر تأدیه بر مبنای تغییر شاخص قیمت (ماده ۵۲۲)، و هزینه‌های قضایی و اجرایی. خسارت تأخیر تنها زمانی تعلق می‌گیرد که شاخص قیمت افزایش یافته باشد. هزینه دادرسی از جدول پله‌ای و هزینه اجرا از درصد مبلغ محاسبه می‌شود.",
    legalNotesFa: [
      "ماده ۵۲۲ قانون آیین دادرسی مدنی: خسارت تأخیر تأدیه بر مبنای شاخص قیمت.",
      "قانون صدور چک (اصلاحی ۱۳۹۷): شرایط و آثار چک برگشتی.",
      "هزینه دادرسی و هزینه اجرا مفاهیمی جدا از اصل چک و خسارت تأخیر هستند.",
    ],
  };
}

export const checkDamagesCalculator: Calculator = { def, compute };
