// ============================================================
// خسارت تأخیر تأدیه — late-payment damages
// ============================================================
// Governing instrument: ماده ۵۲۲ قانون آیین دادرسی دادگاه‌های
// عمومی و انقلاب (در امور مدنی).
//
// Formula:
//   damages = principal × (indexAtPayment / indexAtDue − 1)
// The index is the Central Bank CPI. When the payment index is not
// greater than the due index, no damages accrue (the statute only
// compensates for a *rise* in the index).

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface PriceIndexRates {
  baseYear: number;
  monthlyIndex: Record<string, number>;
}

const def: CalculatorDef = {
  id: "calc-delayed-payment",
  slug: "delayed-payment",
  titleFa: "خسارت تأخیر تأدیه",
  subtitleFa: "محاسبه خسارت بر مبنای شاخص قیمت",
  descriptionFa:
    "خسارت تأخیر تأدیه بر اساس تغییر شاخص بهای کالاها و خدمات مصرفی بانک مرکزی، از تاریخ سررسید تا تاریخ پرداخت محاسبه می‌شود.",
  category: "civil",
  icon: "📈",
  gradient: "from-cyan-600 to-blue-500",
  legalBasisFa: "ماده ۵۲۲ قانون آیین دادرسی مدنی",
  datasetIds: ["price-index-1404"],
  confidence: "high",
  available: true,
  fields: [
    {
      key: "principal",
      labelFa: "مبلغ اصل دین",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 100_000_000,
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
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("price-index-1404");
  const rates = ds.rates as unknown as PriceIndexRates;

  const principal = money(num(input, "principal"), "IRT");
  const indexAtDue = num(input, "indexAtDue");
  const indexAtPayment = num(input, "indexAtPayment");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  steps.push({
    labelFa: "مبلغ اصل دین",
    valueFa: formatMoney(principal, "IRT"),
  });
  steps.push({
    labelFa: "شاخص سررسید",
    valueFa: formatNumberFa(indexAtDue, 2),
    noteFa: `مبنا: سال ${formatNumberFa(rates.baseYear)}`,
  });
  steps.push({
    labelFa: "شاخص پرداخت",
    valueFa: formatNumberFa(indexAtPayment, 2),
  });

  let damages: Money = { rial: 0 };

  if (indexAtDue <= 0) {
    warningsFa.push("شاخص سررسید باید بزرگ‌تر از صفر باشد؛ خسارتی محاسبه نشد.");
  } else if (indexAtPayment <= indexAtDue) {
    warningsFa.push(
      "شاخص پرداخت از شاخص سررسید بیشتر نیست؛ طبق ماده ۵۲۲ خسارتی تعلق نمی‌گیرد."
    );
  } else {
    const ratio = indexAtPayment / indexAtDue;
    damages = scaleMoney(principal, ratio - 1);
    steps.push({
      labelFa: "نسبت افزایش شاخص",
      valueFa: formatPercentFa(ratio - 1),
    });
    steps.push({
      labelFa: "خسارت تأخیر تأدیه",
      valueFa: formatMoney(damages, "IRT"),
    });
  }

  return {
    headlineFa: formatMoney(damages, "IRT"),
    headlineValue: damages.rial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const delayedPaymentCalculator: Calculator = { def, compute };
