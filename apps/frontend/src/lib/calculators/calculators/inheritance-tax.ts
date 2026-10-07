// ============================================================
// مالیات ارث — inheritance tax
// ============================================================
// Governing instrument: قانون مالیات‌های مستقیم، مواد ۱۷ تا ۲۱.
//
// Formula:
//   taxablePerHeir = max(0, inheritedValue / heirCount − perHeirExemption)
//   tax            = taxablePerHeir × taxRate × heirCount
// The exemption is applied per heir, so the tax is computed on each
// heir's share above the exemption and then summed. This is distinct
// from the *shares* of inheritance (سهم‌الارث), which are governed by
// the Civil Code and computed by the inheritance calculator.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface InheritanceTaxRates {
  perHeirExemptionRial: number;
  taxRate: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-inheritance-tax",
  slug: "inheritance-tax",
  titleFa: "مالیات ارث",
  subtitleFa: "محاسبه مالیات بر ارزش ماترک هر وارث",
  descriptionFa:
    "مالیات ارث را بر پایه ارزش ماترک و تعداد وارثان محاسبه کنید. برای هر وارث یک معافیت قانونی اعمال می‌شود و مالیات بر مبلغ مازاد بر معافیت تعلق می‌گیرد.",
  category: "family",
  icon: "📜",
  gradient: "from-amber-700 to-orange-600",
  legalBasisFa: "مواد ۱۷ تا ۲۱ قانون مالیات‌های مستقیم (مالیات بر ارث)",
  datasetIds: ["inheritance-tax-1405"],
  confidence: "medium",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر مالیات ارث را بر پایه ارزش ماترک و تعداد وارثان محاسبه می‌کند. برای هر وارث یک معافیت قانونی در نظر گرفته می‌شود و مالیات بر مبلغ مازاد بر معافیت تعلق می‌گیرد.",
  howItWorksFa:
    "ارزش ماترک بر تعداد وارثان تقسیم می‌شود تا سهم هر وارث به دست آید. از سهم هر وارث، معافیت قانونی کسر و مبلغ باقی‌مانده در نرخ مالیات ضرب می‌شود. سپس مالیات همه وارثان جمع می‌گردد.",
  requiredInfoFa: "ارزش کل ماترک و تعداد وارثان.",
  determinacyFa:
    "نرخ مالیات و معافیت قانونی‌اند؛ اما ارزش ماترک باید بر پایه ارزیابی رسمی تعیین شود که ممکن است با برآورد اولیه متفاوت باشد.",
  disclaimerFa:
    "این محاسبه بر پایه ارزش اعلامی ماترک انجام شده است. ارزش ماترک برای محاسبه مالیات باید بر پایه ارزیابی رسمی تعیین شود و ممکن است با ارقام واردشده متفاوت باشد.",
  faq: [
    {
      qFa: "مالیات ارث چگونه محاسبه می‌شود؟",
      aFa: "برای هر وارث یک معافیت قانونی اعمال می‌شود و مالیات بر مبلغ مازاد بر معافیت تعلق می‌گیرد. سپس مالیات همه وارثان جمع می‌شود.",
    },
    {
      qFa: "آیا معافیت مالیات ارث برای هر وارث جداگانه است؟",
      aFa: "بله؛ معافیت به‌صورت جداگانه برای هر وارث اعمال می‌شود.",
    },
    {
      qFa: "تفاوت مالیات ارث و سهم‌الارث چیست؟",
      aFa: "سهم‌الارث تعیین سهم هر وارث از ماترک بر پایه قانون مدنی است، اما مالیات ارث مبلغی است که بر ارزش سهم هر وارث تعلق می‌گیرد.",
    },
  ],
  relatedSlugs: ["inheritance", "dowry", "mahr-service"],
  nextAction: {
    promptFa: "می‌خواهید سهم‌الارث هر وارث را محاسبه کنید؟",
    labelFa: "محاسبه سهم‌الارث",
    href: "/calculators/inheritance",
  },
  fields: [
    {
      key: "inheritedValue",
      labelFa: "ارزش کل ماترک",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 10_000_000_000,
      min: 0,
      helpFa: "ارزش کل دارایی به‌جامانده.",
    },
    {
      key: "heirCount",
      labelFa: "تعداد وارثان",
      type: "number",
      required: true,
      defaultValue: 3,
      min: 1,
      max: 50,
      step: 1,
      helpFa: "تعداد کل وارثان.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("inheritance-tax-1405");
  const rates = ds.rates as unknown as InheritanceTaxRates;

  const inheritedValue = money(num(input, "inheritedValue"), "IRT");
  const heirCount = Math.max(1, Math.round(num(input, "heirCount")));

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const sharePerHeirRial = inheritedValue.rial / heirCount;
  const taxablePerHeirRial = Math.max(0, sharePerHeirRial - rates.perHeirExemptionRial);
  const taxPerHeirRial = taxablePerHeirRial * rates.taxRate;
  const totalTaxRial = taxPerHeirRial * heirCount;

  steps.push({
    labelFa: "ارزش کل ماترک",
    valueFa: formatMoney(inheritedValue, "IRT"),
  });
  steps.push({
    labelFa: `سهم هر وارث (${formatNumberFa(heirCount)} وارث)`,
    valueFa: formatMoney(money(Math.round(sharePerHeirRial), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: "معافیت هر وارث",
    valueFa: formatMoney(money(rates.perHeirExemptionRial, "IRR"), "IRT"),
  });
  steps.push({
    labelFa: `مبلغ مشمول مالیات هر وارث (${formatPercentFa(rates.taxRate)})`,
    valueFa: formatMoney(money(Math.round(taxablePerHeirRial), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: "مالیات هر وارث",
    valueFa: formatMoney(money(Math.round(taxPerHeirRial), "IRR"), "IRT"),
  });

  const total: Money = roundTo(
    money(Math.round(totalTaxRial), "IRR"),
    rates.roundingStepRial
  );

  steps.push({
    labelFa: "جمع مالیات ارث",
    valueFa: formatMoney(total, "IRT"),
  });

  if (inheritedValue.rial === 0) {
    warningsFa.push("ارزش ماترک وارد نشده است؛ مالیاتی محاسبه نشد.");
  }
  if (taxablePerHeirRial === 0 && inheritedValue.rial > 0) {
    warningsFa.push("سهم هر وارث کمتر از معافیت قانونی است؛ مالیاتی تعلق نمی‌گیرد.");
  }

  return {
    headlineFa: formatMoney(total, "IRT"),
    headlineValue: total.rial,
    unit: "IRT",
    headlineLabelFa: "مالیات ارث",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "مالیات ارث بر پایه ارزش ماترک و تعداد وارثان محاسبه می‌شود. برای هر وارث یک معافیت قانونی اعمال و مالیات بر مبلغ مازاد بر معافیت محاسبه می‌گردد. سپس مالیات همه وارثان جمع می‌شود.",
    legalNotesFa: [
      "ماده ۱۷ قانون مالیات‌های مستقیم: مالیات بر ارث.",
      "معافیت مالیات ارث برای هر وارث جداگانه اعمال می‌شود.",
      "ارزش ماترک باید بر پایه ارزیابی رسمی تعیین شود.",
    ],
  };
}

export const inheritanceTaxCalculator: Calculator = { def, compute };
