// ============================================================
// LEGALIR — Versioned rate datasets for legal calculators
// ============================================================
// Every number a calculator multiplies by lives HERE, never inside a
// component or an engine. Each dataset carries full provenance so a
// result can be traced to the instrument that produced it.
//
// IMPORTANT — verification policy:
//   Statutory *formulas* (e.g. «یک ماه مزد به ازای هر سال سابقه»)
//   are stable and encoded in the engines. Statutory *rates* (دیه
//   سالانه، حداقل مزد، شاخص قیمت) change every year and MUST be
//   re-verified against the issuing authority before each release.
//   `source.verifiedAt` records the last human check; the dataset
//   `notes` record the caveats shown to the user.
//
// Pure data module — no I/O, importable from server and client.

import type { RateDataset } from "@legalir/types";

// ============================================================
// Shared authority strings (kept as consts so they never drift)
// ============================================================

const AUTHORITY_JUDICIARY = "قوه قضائیه جمهوری اسلامی ایران";
const AUTHORITY_PARLIAMENT = "مجلس شورای اسلامی";
const AUTHORITY_CENTRAL_BANK = "بانک مرکزی جمهوری اسلامی ایران";

const JURISDICTION_IR = "جمهوری اسلامی ایران";

// ============================================================
// 1) دیه — annual blood-money rate (قانون مجازات اسلامی، مواد ۵۴۹ و ۵۵۰)
// ============================================================
// The full diyeh for a free Muslim man in a non-sacred month is set
// annually by the judiciary. Fractions are statutory multipliers of
// this base (see DIYEH_FRACTIONS below).

export const DATASET_DIYEH_1404: RateDataset = {
  id: "diyeh-1404",
  titleFa: "نرخ دیه کامل سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle: "قانون مجازات اسلامی (کتاب چهارم — دیات)، مواد ۵۴۹ و ۵۵۰",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1392-02-01",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "diyeh-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "نرخ دیه هر سال توسط قوه قضائیه اعلام می‌شود. نرخ ماه‌های حرام (محرم، رجب، ذی‌القعده، ذی‌الحجه) یک‌سوم بیشتر است. پیش از استفاده در پرونده واقعی، نرخ اعلامی سال جاری را از پایگاه رسمی قوه قضائیه تأیید کنید.",
  },
  rates: {
    /** Full diyeh in Rial for a non-sacred month. */
    fullDiyehRial: 1_200_000_000_000,
    /** Multiplier applied during the four sacred months. */
    sacredMonthMultiplier: 4 / 3,
  },
};

// ============================================================
// 2) هزینه دادرسی — judicial service tariff
// ============================================================
// Tiered ad-valorem fee on the value of a monetary claim, plus the
// flat fees for non-monetary claims. Brackets are cumulative: each
// slice of the claim value is charged at its own rate.

export const DATASET_COURT_FEE_1404: RateDataset = {
  id: "court-fee-1404",
  titleFa: "تعرفه هزینه دادرسی سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle:
      "تعرفه خدمات قضایی و قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی)",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1399-01-01",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "court-fee-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "تعرفه خدمات قضایی هر سال به‌روزرسانی می‌شود. پله‌ها تجمعی است؛ هر بخش از ارزش خواسته با نرخ همان پله محاسبه می‌شود. هزینه تجدیدنظر و فرجام‌خواهی نصف هزینه بدوی است.",
  },
  rates: {
    /** Cumulative ad-valorem brackets. `upToRial: null` = open-ended top bracket. */
    brackets: [
      { upToRial: 100_000_000, rate: 0.03 },
      { upToRial: 1_000_000_000, rate: 0.04 },
      { upToRial: 2_000_000_000, rate: 0.05 },
      { upToRial: 5_000_000_000, rate: 0.06 },
      { upToRial: 10_000_000_000, rate: 0.07 },
      { upToRial: null, rate: 0.08 },
    ],
    /** Flat fee for non-monetary claims (Rial). */
    nonMonetaryFlatRial: 2_000_000,
    /** Appeal / cassation fee as a fraction of the first-instance fee. */
    appealMultiplier: 0.5,
    /** Fees are rounded to this many Rial. */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 3) خسارت تأخیر تأدیه — late-payment damages (ماده ۵۲۲ آیین دادرسی مدنی)
// ============================================================
// Damages track the change in the Central Bank price index between
// the due date and the actual payment date. The index series is
// published monthly; only the two endpoints matter for the formula.

export const DATASET_PRICE_INDEX_1404: RateDataset = {
  id: "price-index-1404",
  titleFa: "شاخص بهای کالاها و خدمات مصرفی سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle: "شاخص بهای کالاها و خدمات مصرفی — بانک مرکزی جمهوری اسلامی ایران",
    sourceAuthority: AUTHORITY_CENTRAL_BANK,
    sourceUrl: "https://www.cbi.ir",
    publicationDate: "1404-01-01",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "price-index-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "شاخص بانک مرکزی ماهانه منتشر می‌شود. برای محاسبه دقیق، شاخص ماه سررسید و شاخص ماه پرداخت را از آخرین گزارش رسمی وارد کنید. مقادیر پیش‌فرض صرفاً نمونه است.",
  },
  rates: {
    /** Base year the index is expressed against. */
    baseYear: 1400,
    /** Sample monthly index values (base 1400 = 100). Illustrative only. */
    monthlyIndex: {
      "1403-01": 100,
      "1403-06": 118,
      "1403-12": 141,
      "1404-01": 145,
      "1404-06": 168,
    },
  },
};

// ============================================================
// 4) عیدی و سنوات — employment (قانون کار، مواد ۲۴ و ۶۴)
// ============================================================
// Statutory formulas:
//   عیدی  = between 60 and 90 days' wage, capped at 3× the statutory
//           minimum monthly wage; pro-rated for partial years.
//   سنوات = one month's wage per completed year of service, based on
//           the LAST wage, pro-rated for partial years.
//   مرخصی = unused leave days × daily wage (monthly wage / 30).

export const DATASET_LABOR_1404: RateDataset = {
  id: "labor-1404",
  titleFa: "نرخ‌های قانون کار سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle: "قانون کار جمهوری اسلامی ایران، مواد ۲۴، ۶۴ و ۷۱",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1369-08-29",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "labor-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "حداقل مزد سالانه توسط شورای عالی کار تعیین می‌شود. سقف عیدی سه برابر حداقل مزد ماهانه است. روزهای کارکرد کمتر از یک سال به نسبت محاسبه می‌شود.",
  },
  rates: {
    /** Statutory minimum monthly wage (Rial) — set annually by شورای عالی کار. */
    minimumMonthlyWageRial: 104_000_000,
    /** عیدی floor, in days of wage. */
    bonusMinDays: 60,
    /** عیدی ceiling, in days of wage. */
    bonusMaxDays: 90,
    /** عیدی absolute cap, as a multiple of the minimum monthly wage. */
    bonusCapMultipleOfMinWage: 3,
    /** Days in the wage month used to derive a daily wage. */
    daysPerMonth: 30,
    /** Statutory annual leave entitlement, in days. */
    annualLeaveDays: 26,
    /** Months in a full service year. */
    monthsPerYear: 12,
  },
};

// ============================================================
// 5) مهریه به نرخ روز — dowry indexation
// ============================================================
// Dowry is revalued by the change in the price index between the
// marriage year and the present. Uses the same Central Bank series
// as late-payment damages.

export const DATASET_DOWRY_INDEX_1404: RateDataset = {
  id: "dowry-index-1404",
  titleFa: "شاخص تعدیل مهریه سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle: "شاخص بهای کالاها و خدمات مصرفی — بانک مرکزی (مبنای تعدیل مهریه)",
    sourceAuthority: AUTHORITY_CENTRAL_BANK,
    sourceUrl: "https://www.cbi.ir",
    publicationDate: "1404-01-01",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "dowry-index-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "تعدیل مهریه بر مبنای تغییر شاخص قیمت از سال وقوع عقد تا زمان مطالبه انجام می‌شود. رویه دادگاه‌ها در انتخاب سال پایه متفاوت است؛ مقدار شاخص را با آخرین گزارش رسمی تطبیق دهید.",
  },
  rates: {
    baseYear: 1400,
    /** Sample annual index values (base 1400 = 100). Illustrative only. */
    annualIndex: {
      "1390": 18,
      "1395": 42,
      "1400": 100,
      "1403": 141,
      "1404": 152,
    },
  },
};

// ============================================================
// 6) مالیات بر درآمد حقوق — payroll income tax
// ============================================================
// Progressive annual brackets applied to taxable payroll income
// (gross minus the employee's social-security share minus the
// statutory annual exemption). Brackets are cumulative.

export const DATASET_PAYROLL_TAX_1404: RateDataset = {
  id: "payroll-tax-1404",
  titleFa: "نرخ‌های مالیات بر درآمد حقوق سال ۱۴۰۴",
  calculationYear: 1404,
  source: {
    sourceTitle: "قانون مالیات‌های مستقیم، ماده ۸۴ و ۸۵ (جدول مالیات بر درآمد حقوق)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1366-12-03",
    effectiveFrom: "1404-01-01",
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1404,
    version: "payroll-tax-1404.1",
    verifiedAt: "2026-09-17",
    notes:
      "سقف معافیت سالانه و پله‌های مالیات هر سال در قانون بودجه تعیین می‌شود. این جدول صرفاً یک مدل ساده‌شده برای برآورد است و جایگزین محاسبه رسمی سازمان امور مالیاتی نیست.",
  },
  rates: {
    /** Annual exemption threshold (Rial) — income below this is untaxed. */
    annualExemptionRial: 240_000_000,
    /** Cumulative annual brackets. `upToRial: null` = open-ended top bracket. */
    brackets: [
      { upToRial: 400_000_000, rate: 0.1 },
      { upToRial: 800_000_000, rate: 0.15 },
      { upToRial: 1_200_000_000, rate: 0.2 },
      { upToRial: null, rate: 0.3 },
    ],
    /** Employee's social-security contribution, as a fraction of gross. */
    employeeInsuranceRate: 0.07,
    /** Months in the tax year. */
    monthsPerYear: 12,
  },
};

// ============================================================
// Registry
// ============================================================

export const RATE_DATASETS: RateDataset[] = [
  DATASET_DIYEH_1404,
  DATASET_COURT_FEE_1404,
  DATASET_PRICE_INDEX_1404,
  DATASET_LABOR_1404,
  DATASET_DOWRY_INDEX_1404,
  DATASET_PAYROLL_TAX_1404,
];

/** Look up a dataset by id. Returns undefined for unknown ids. */
export function getDataset(id: string): RateDataset | undefined {
  return RATE_DATASETS.find((d) => d.id === id);
}

/**
 * Look up a dataset by id, throwing when missing. Calculators use this
 * so a typo in `datasetIds` fails loudly at test time rather than
 * silently producing a zero.
 */
export function requireDataset(id: string): RateDataset {
  const ds = getDataset(id);
  if (!ds) throw new Error(`Rate dataset not found: ${id}`);
  return ds;
}

// ============================================================
// Statutory diyeh fractions (قانون مجازات اسلامی، مواد ۵۵۰ به بعد)
// ============================================================
// These are fixed multipliers of the full diyeh, not annual rates,
// so they live outside the versioned dataset.

export interface DiyehFraction {
  key: string;
  labelFa: string;
  /** Fraction of the full diyeh. */
  fraction: number;
}

export const DIYEH_FRACTIONS: DiyehFraction[] = [
  { key: "full", labelFa: "دیه کامل (قتل نفس)", fraction: 1 },
  { key: "one_eye", labelFa: "از بین بردن یک چشم", fraction: 0.5 },
  { key: "both_eyes", labelFa: "از بین بردن هر دو چشم", fraction: 1 },
  { key: "one_ear", labelFa: "قطع یک گوش", fraction: 0.5 },
  { key: "nose", labelFa: "از بین بردن تمام بینی", fraction: 1 },
  { key: "tongue", labelFa: "قطع تمام زبان", fraction: 1 },
  { key: "one_hand", labelFa: "قطع یک دست از مچ", fraction: 0.5 },
  { key: "one_foot", labelFa: "قطع یک پا از مچ", fraction: 0.5 },
  { key: "one_finger", labelFa: "قطع یک انگشت", fraction: 0.1 },
  { key: "tooth", labelFa: "کندن یک دندان", fraction: 0.05 },
  { key: "fracture_limb", labelFa: "شکستن استخوان عضو", fraction: 0.1 },
  { key: "wound_deep", labelFa: "جراحت عمیق (دیه جرح)", fraction: 0.1 },
];
