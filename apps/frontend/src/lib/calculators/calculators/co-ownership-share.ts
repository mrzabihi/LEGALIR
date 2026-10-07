// ============================================================
// سهم مشاعی — co-ownership share
// ============================================================
// Governing instrument: قانون مدنی، مواد ۵۷۱ تا ۵۷۴ (مالکیت مشاعی).
//
// Formula (a pure fraction — no statutory rate is involved):
//   shareValue = propertyValue × (ownedDangs / totalDangs)
// The Iranian convention expresses a share in «دانگ» (sixths of a
// property), so the inputs are the number of dangs owned and the total
// dangs of the property (normally 6).

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatNumberFa } from "../format";
import { requireDataset } from "../datasets";
import { num, type Calculator, type CalculatorInput } from "../engine";

interface CoOwnershipRates {
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-co-ownership-share",
  slug: "co-ownership-share",
  titleFa: "سهم مشاعی ملک",
  subtitleFa: "محاسبه ارزش سهم مشاعی بر پایه دانگ",
  descriptionFa:
    "ارزش سهم مشاعی خود از یک ملک را بر پایه تعداد دانگ محاسبه کنید. سهم مشاعی صرفاً کسری از ارزش کل ملک است و نرخ قانونی ندارد.",
  category: "property",
  icon: "🔗",
  gradient: "from-cyan-700 to-sky-600",
  legalBasisFa: "مواد ۵۷۱ تا ۵۷۴ قانون مدنی (مالکیت مشاعی)",
  datasetIds: ["co-ownership-1405"],
  confidence: "high",
  available: true,
  status: "legal_basis",
  aboutFa:
    "این محاسبه‌گر ارزش سهم مشاعی یک ملک را بر پایه تعداد دانگ محاسبه می‌کند. در عرف ایران، ملک به شش دانگ تقسیم می‌شود و هر شریک به نسبت دانگ خود در ملک سهیم است.",
  howItWorksFa:
    "ارزش کل ملک در نسبت دانگ تحت مالکیت به کل دانگ‌های ملک ضرب می‌شود تا ارزش سهم مشاعی به دست آید.",
  requiredInfoFa: "ارزش کل ملک، تعداد دانگ تحت مالکیت و کل دانگ‌های ملک.",
  determinacyFa:
    "محاسبه سهم مشاعی یک نسبت ریاضی قطعی است؛ به شرط آنکه ارزش کل ملک و تعداد دانگ‌ها درست وارد شده باشند.",
  disclaimerFa:
    "این محاسبه بر پایه ارزش اعلامی ملک و تعداد دانگ انجام شده است. ارزش واقعی ملک ممکن است با ارقام واردشده متفاوت باشد.",
  faq: [
    {
      qFa: "دانگ چیست؟",
      aFa: "دانگ واحد تقسیم مالکیت ملک در عرف ایران است. هر ملک معمولاً شش دانگ دارد و هر شریک به نسبت دانگ خود سهیم است.",
    },
    {
      qFa: "سهم مشاعی چگونه محاسبه می‌شود؟",
      aFa: "ارزش کل ملک در نسبت دانگ تحت مالکیت به کل دانگ‌ها ضرب می‌شود. مثلاً دو دانگ از شش دانگ معادل یک‌سوم ارزش ملک است.",
    },
    {
      qFa: "آیا سهم مشاعی نرخ قانونی دارد؟",
      aFa: "خیر؛ سهم مشاعی صرفاً کسری از ارزش ملک است و نرخ قانونی ندارد.",
    },
  ],
  relatedSlugs: ["property-transaction-cost", "property-transfer-tax", "regional-property-value"],
  nextAction: {
    promptFa: "می‌خواهید هزینه انتقال این سهم را محاسبه کنید؟",
    labelFa: "محاسبه هزینه کامل معامله",
    href: "/calculators/property-transaction-cost",
  },
  fields: [
    {
      key: "propertyValue",
      labelFa: "ارزش کل ملک",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 6_000_000_000,
      min: 0,
      helpFa: "ارزش کل ملک پیش از تقسیم.",
    },
    {
      key: "ownedDangs",
      labelFa: "تعداد دانگ تحت مالکیت",
      type: "number",
      required: true,
      defaultValue: 2,
      min: 0,
      max: 6,
      step: 0.5,
      helpFa: "تعداد دانگ متعلق به شما.",
    },
    {
      key: "totalDangs",
      labelFa: "کل دانگ‌های ملک",
      type: "number",
      required: false,
      defaultValue: 6,
      min: 1,
      max: 6,
      step: 0.5,
      helpFa: "معمولاً شش دانگ.",
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("co-ownership-1405");
  const rates = ds.rates as unknown as CoOwnershipRates;

  const propertyValue = money(num(input, "propertyValue"), "IRT");
  const ownedDangs = num(input, "ownedDangs");
  const totalDangs = num(input, "totalDangs");

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  const denominator = totalDangs > 0 ? totalDangs : 1;
  const ratio = ownedDangs / denominator;
  const shareRial = propertyValue.rial * ratio;

  steps.push({
    labelFa: "نسبت سهم",
    valueFa: `${formatNumberFa(ownedDangs, 2)} از ${formatNumberFa(denominator, 2)} دانگ`,
    noteFa: `معادل ${formatNumberFa(ratio * 100, 2)}٪ ارزش ملک`,
  });

  steps.push({
    labelFa: "ارزش کل ملک",
    valueFa: formatMoney(propertyValue, "IRT"),
  });

  const share: Money = roundTo(money(Math.round(shareRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "ارزش سهم مشاعی",
    valueFa: formatMoney(share, "IRT"),
  });

  if (propertyValue.rial === 0) {
    warningsFa.push("ارزش ملک وارد نشده است؛ سهم مشاعی صفر محاسبه شد.");
  }
  if (ownedDangs > denominator) {
    warningsFa.push("تعداد دانگ تحت مالکیت از کل دانگ‌های ملک بیشتر است؛ ورودی را بررسی کنید.");
  }

  return {
    headlineFa: formatMoney(share, "IRT"),
    headlineValue: share.rial,
    unit: "IRT",
    headlineLabelFa: "ارزش سهم مشاعی",
    status: "legal_basis",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "ارزش سهم مشاعی از ضرب ارزش کل ملک در نسبت دانگ تحت مالکیت به کل دانگ‌ها به دست می‌آید. سهم مشاعی صرفاً کسری از ارزش ملک است و نرخ قانونی ندارد.",
    legalNotesFa: [
      "ماده ۵۷۱ قانون مدنی: مالکیت مشاعی، مالکیت بخش معیّنی از ملک نیست بلکه سهمی از کل است.",
      "در عرف ایران ملک به شش دانگ تقسیم می‌شود.",
      "ارزش سهم به ارزش کل ملک و نسبت دانگ وابسته است.",
    ],
  };
}

export const coOwnershipShareCalculator: Calculator = { def, compute };
