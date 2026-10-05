// ============================================================
// کمیسیون مشاور املاک — real-estate agency commission
// ============================================================
// Governing instrument: تعرفه اتحادیه صنف مشاوران املاک (صنفی، نه
// قانونی). The rate is set by the realtors' union and can vary by
// city, so the result is labelled «تعرفه صنفی» and the rate is
// configurable — never presented as a statutory rate.
//
// Formula (per party):
//   sale:  commission = price × saleRatePerParty
//   rent:  commission = (monthlyRent × rentRatePerParty)
//                     + (deposit × depositRatePerParty)
//   vat    = commission × vatRate
//   total  = commission + vat
// Each party (buyer/seller or landlord/tenant) pays its own share.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, roundTo, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface RealEstateCommissionRates {
  saleRatePerParty: number;
  rentRatePerParty: number;
  depositRatePerParty: number;
  vatRate: number;
  minimumPerPartyRial: number;
  roundingStepRial: number;
}

const def: CalculatorDef = {
  id: "calc-real-estate-commission",
  slug: "real-estate-commission",
  titleFa: "کمیسیون مشاور املاک",
  subtitleFa: "محاسبه کمیسیون خرید، فروش و اجاره ملک",
  descriptionFa:
    "کمیسیون مشاور املاک را برای معامله خرید و فروش یا اجاره، به تفکیک سهم هر طرف و با احتساب مالیات بر ارزش افزوده محاسبه کنید. نرخ کمیسیون صنفی است و می‌تواند بر اساس شهر متفاوت باشد.",
  category: "property",
  icon: "🏘️",
  gradient: "from-teal-600 to-emerald-500",
  legalBasisFa: "تعرفه کمیسیون مشاوران املاک (اتحادیه صنف مشاوران املاک)",
  datasetIds: ["real-estate-commission-1405"],
  confidence: "medium",
  available: true,
  status: "official_tariff",
  aboutFa:
    "این محاسبه‌گر کمیسیون مشاور املاک را برای معامله خرید و فروش یا اجاره محاسبه می‌کند. در معامله خرید و فروش، کمیسیون درصدی از قیمت ملک است؛ در اجاره، ترکیبی از درصدی از اجاره ماهانه و درصدی از ودیعه (رهن). مالیات بر ارزش افزوده به کمیسیون اضافه می‌شود.",
  howItWorksFa:
    "برای خرید و فروش، قیمت ملک در نرخ کمیسیون هر طرف ضرب می‌شود. برای اجاره، اجاره ماهانه و ودیعه هرکدام در نرخ مربوط به خود ضرب و جمع می‌شوند. سپس مالیات بر ارزش افزوده به مبلغ کمیسیون اضافه می‌گردد.",
  requiredInfoFa:
    "نوع معامله (خرید و فروش یا اجاره) و مبلغ معامله (قیمت ملک یا اجاره ماهانه و ودیعه).",
  determinacyFa:
    "نرخ کمیسیون صنفی است و نرخ قانونی ثابت ندارد؛ ممکن است بر اساس شهر و مصوبه اتحادیه متفاوت باشد. نتیجه یک «تعرفه صنفی» است، نه مبلغ قانونی قطعی.",
  disclaimerFa:
    "نرخ کمیسیون مشاوران املاک صنفی است و بر اساس شهر و مصوبه اتحادیه صنف متفاوت است. ارقام این محاسبه نمونه‌ای است؛ نرخ جاری شهر خود را از اتحادیه مربوطه تأیید کنید.",
  faq: [
    {
      qFa: "کمیسیون مشاور املاک چند درصد است؟",
      aFa: "نرخ کمیسیون توسط اتحادیه صنف مشاوران املاک تعیین می‌شود و نرخ قانونی ثابت ندارد؛ معمولاً درصدی از قیمت ملک (خرید و فروش) یا ترکیبی از اجاره ماهانه و ودیعه (اجاره) است.",
    },
    {
      qFa: "کمیسیون را خریدار می‌دهد یا فروشنده؟",
      aFa: "معمولاً هر طرف معامله سهم کمیسیون خود را می‌پردازد؛ این محاسبه‌گر سهم هر طرف را جداگانه نشان می‌دهد.",
    },
    {
      qFa: "آیا به کمیسیون مالیات بر ارزش افزوده تعلق می‌گیرد؟",
      aFa: "بله؛ در صورت مشمول بودن، مالیات بر ارزش افزوده به مبلغ کمیسیون اضافه می‌شود.",
    },
  ],
  relatedSlugs: ["rent-converter", "property-transfer-tax", "property-transaction-cost"],
  nextAction: {
    promptFa: "می‌خواهید هزینه کامل معامله ملک را محاسبه کنید؟",
    labelFa: "محاسبه هزینه کامل معامله",
    href: "/calculators/property-transaction-cost",
  },
  fields: [
    {
      key: "dealType",
      labelFa: "نوع معامله",
      type: "select",
      required: true,
      defaultValue: "sale",
      options: [
        { value: "sale", labelFa: "خرید و فروش" },
        { value: "rent", labelFa: "اجاره" },
      ],
    },
    {
      key: "price",
      labelFa: "قیمت ملک",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 5_000_000_000,
      min: 0,
      helpFa: "فقط برای معامله خرید و فروش.",
      visibleWhen: [{ key: "dealType", equals: "sale" }],
    },
    {
      key: "monthlyRent",
      labelFa: "اجاره ماهانه",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 20_000_000,
      min: 0,
      helpFa: "فقط برای معامله اجاره.",
      visibleWhen: [{ key: "dealType", equals: "rent" }],
    },
    {
      key: "deposit",
      labelFa: "ودیعه (رهن)",
      type: "money",
      unit: "IRT",
      required: false,
      defaultValue: 500_000_000,
      min: 0,
      helpFa: "فقط برای معامله اجاره.",
      visibleWhen: [{ key: "dealType", equals: "rent" }],
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("real-estate-commission-1405");
  const rates = ds.rates as unknown as RealEstateCommissionRates;

  const dealType = str(input, "dealType");
  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  let commissionRial = 0;

  if (dealType === "rent") {
    const rent = money(num(input, "monthlyRent"), "IRT");
    const deposit = money(num(input, "deposit"), "IRT");

    const rentShare = rent.rial * rates.rentRatePerParty;
    const depositShare = deposit.rial * rates.depositRatePerParty;
    commissionRial = rentShare + depositShare;

    steps.push({
      labelFa: `کمیسیون از اجاره ماهانه (${formatPercentFa(rates.rentRatePerParty)})`,
      valueFa: formatMoney(money(Math.round(rentShare), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(rent, "IRT")}`,
    });
    steps.push({
      labelFa: `کمیسیون از ودیعه (${formatPercentFa(rates.depositRatePerParty)})`,
      valueFa: formatMoney(money(Math.round(depositShare), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(deposit, "IRT")}`,
    });
  } else {
    const price = money(num(input, "price"), "IRT");
    commissionRial = price.rial * rates.saleRatePerParty;
    steps.push({
      labelFa: `کمیسیون خرید و فروش (${formatPercentFa(rates.saleRatePerParty)})`,
      valueFa: formatMoney(money(Math.round(commissionRial), "IRR"), "IRT"),
      noteFa: `بر ${formatMoney(price, "IRT")}`,
    });
  }

  // Union floor per party.
  if (commissionRial < rates.minimumPerPartyRial) {
    commissionRial = rates.minimumPerPartyRial;
    steps.push({
      labelFa: "حداقل کمیسیون هر طرف",
      valueFa: formatMoney(money(rates.minimumPerPartyRial, "IRR"), "IRT"),
      noteFa: "کمیسیون محاسبه‌شده کمتر از حداقل تعرفه بود.",
    });
  }

  const vatRial = commissionRial * rates.vatRate;
  const totalRial = commissionRial + vatRial;

  steps.push({
    labelFa: `مالیات بر ارزش افزوده (${formatPercentFa(rates.vatRate)})`,
    valueFa: formatMoney(money(Math.round(vatRial), "IRR"), "IRT"),
  });

  const perParty = roundTo(money(Math.round(totalRial), "IRR"), rates.roundingStepRial);

  steps.push({
    labelFa: "کمیسیون هر طرف (با ارزش افزوده)",
    valueFa: formatMoney(perParty, "IRT"),
  });

  const bothParties = money(perParty.rial * 2, "IRR");
  steps.push({
    labelFa: "جمع کمیسیون دو طرف",
    valueFa: formatMoney(bothParties, "IRT"),
  });

  warningsFa.push(
    "نرخ کمیسیون مشاوران املاک صنفی است و بر اساس شهر و مصوبه اتحادیه متفاوت می‌باشد."
  );

  return {
    headlineFa: formatMoney(perParty, "IRT"),
    headlineValue: perParty.rial,
    unit: "IRT",
    headlineLabelFa: "کمیسیون هر طرف",
    status: "official_tariff",
    steps,
    warningsFa,
    source: ds.source,
    explanationFa:
      "در معامله خرید و فروش، کمیسیون درصدی از قیمت ملک است. در معامله اجاره، کمیسیون از جمع درصدی از اجاره ماهانه و درصدی از ودیعه به دست می‌آید. مالیات بر ارزش افزوده به کمیسیون اضافه می‌شود و هر طرف معامله سهم خود را می‌پردازد.",
    legalNotesFa: [
      "نرخ کمیسیون مشاوران املاک توسط اتحادیه صنف تعیین می‌شود و نرخ قانونی ثابت ندارد.",
      "نرخ می‌تواند بر اساس شهر و مصوبه اتحادیه متفاوت باشد.",
      "مالیات بر ارزش افزوده در صورت مشمول بودن به کمیسیون اضافه می‌گردد.",
    ],
  };
}

export const realEstateCommissionCalculator: Calculator = { def, compute };
