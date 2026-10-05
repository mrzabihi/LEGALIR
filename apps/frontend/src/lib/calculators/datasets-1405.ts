// ============================================================
// LEGALIR — Versioned rate datasets for the 1405 calculation year
// ============================================================
// Every number a calculator multiplies by lives HERE, never inside a
// component or an engine. Each dataset carries full provenance so a
// result can be traced to the instrument that produced it.
//
// ── VERIFICATION POLICY (read before editing) ────────────────
//   Statutory *formulas and fixed coefficients* (e.g. «اضافه‌کاری
//   ۱.۴ برابر مزد»، «سهم کارگر ۷٪») are stable law and are encoded
//   directly. Statutory *annual figures* (حداقل مزد، دیه کامل، سقف
//   معافیت مالیاتی، شاخص قیمت) are set every year by an authority and
//   MUST be re-verified against the issuing body before release.
//
//   Where the official 1405 figure could not be confirmed at authoring
//   time, the dataset carries `verificationStatus: "pending"` and the
//   last verified figure, and the UI shows a prominent banner. A
//   `pending` dataset is a placeholder for the annual update — it is
//   NEVER silently presented as the confirmed 1405 rate.
//
//   To roll the year forward: copy this file to `datasets-1406.ts`,
//   update the annual figures, bump every `version`, set
//   `verificationStatus: "verified"`, and register the new datasets.
//   No UI or engine change is required.
//
// Pure data module — no I/O, importable from server and client.

import type { RateDataset } from "@legalir/types";

// ============================================================
// Shared authority strings (kept as consts so they never drift)
// ============================================================

const AUTHORITY_JUDICIARY = "قوه قضائیه جمهوری اسلامی ایران";
const AUTHORITY_PARLIAMENT = "مجلس شورای اسلامی";
const AUTHORITY_CENTRAL_BANK = "بانک مرکزی جمهوری اسلامی ایران";
const AUTHORITY_TAX_ORG = "سازمان امور مالیاتی کشور";
const AUTHORITY_NOTARY = "سازمان ثبت اسناد و املاک کشور";
const AUTHORITY_REALTORS = "اتحادیه صنف مشاوران املاک";

const JURISDICTION_IR = "جمهوری اسلامی ایران";

/** The calculation year every dataset in this module is stated for. */
export const CALCULATION_YEAR_1405 = 1405;

/** Gregorian date the 1405 datasets take effect (1405-01-01 Jalali). */
const EFFECTIVE_1405 = "1405-01-01";

/** Gregorian date a human last reviewed these datasets. */
const REVIEWED_AT = "2026-10-05";

/** Standard caveat appended to every `pending` dataset. */
const PENDING_NOTE =
  "ارقام سالانه این مجموعه در زمان تدوین از منبع رسمی سال ۱۴۰۵ تأیید نشده و بر مبنای آخرین مقدار تأییدشده (۱۴۰۴) نگه داشته شده است. پیش از اتکا به نتیجه، مقدار رسمی سال ۱۴۰۵ را از مرجع صادرکننده تأیید و در همین فایل به‌روزرسانی کنید.";

// ============================================================
// 1) قانون کار — labor rates & statutory premiums (۱۴۰۵)
// ============================================================
// Annual figures (حداقل مزد، حق مسکن، بن) are set by شورای عالی کار.
// The premium coefficients are fixed by the Labor Code itself:
//   • اضافه‌کاری  = ۱.۴ × مزد عادی            (ماده ۵۹)
//   • شب‌کاری     = فوق‌العاده مخصوص کار شب    (ماده ۵۸)
//   • جمعه‌کاری   = ۴۰٪ اضافه بر مزد عادی      (ماده ۶۲)
//   • تعطیل‌کاری  = ۴۰٪ اضافه بر مزد عادی      (ماده ۶۲)

export const DATASET_LABOR_1405: RateDataset = {
  id: "labor-1405",
  titleFa: "نرخ‌های قانون کار سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون کار جمهوری اسلامی ایران، مواد ۲۴، ۵۸، ۵۹، ۶۲، ۶۴ و ۷۱",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1369-08-29",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "labor-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
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
    /** Overtime multiplier of the normal hourly wage (ماده ۵۹). */
    overtimeMultiplier: 1.4,
    /** Night-work premium, as a fraction of the normal wage (ماده ۵۸). */
    nightWorkPremiumRate: 0.35,
    /** Friday-work premium, as a fraction of the normal wage (ماده ۶۲). */
    fridayWorkPremiumRate: 0.4,
    /** Official-holiday-work premium, as a fraction of the normal wage (ماده ۶۲). */
    holidayWorkPremiumRate: 0.4,
    /** حق اولاد per child, as a multiple of the minimum DAILY wage (ماده ۸۶ تأمین اجتماعی). */
    childAllowanceMultipleOfMinDailyWage: 3,
    /** Standard contractual daily working hours. */
    standardDailyHours: 8,
    /** Standard contractual weekly working hours. */
    standardWeeklyHours: 44,
  },
};

// ============================================================
// 2) مالیات بر درآمد حقوق — payroll income tax (۱۴۰۵)
// ============================================================
// Progressive annual brackets applied to taxable payroll income
// (gross minus the employee's social-security share minus the
// statutory annual exemption). Brackets are cumulative. The exemption
// ceiling and bracket edges are set annually in the budget law.

export const DATASET_PAYROLL_TAX_1405: RateDataset = {
  id: "payroll-tax-1405",
  titleFa: "نرخ‌های مالیات بر درآمد حقوق سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مالیات‌های مستقیم، مواد ۸۴ و ۸۵ (جدول مالیات بر درآمد حقوق)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1366-12-03",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "payroll-tax-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
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
// 3) تأمین اجتماعی — social-security contribution rates (۱۴۰۵)
// ============================================================
// Fixed by قانون تأمین اجتماعی، ماده ۲۸:
//   • سهم کارگر ۷٪
//   • سهم کارفرما ۲۰٪
//   • بیمه بیکاری ۳٪ (بر عهده کارفرما)
// The insurable-wage floor is the statutory minimum daily wage; the
// ceiling is a multiple of the minimum wage set annually.

export const DATASET_INSURANCE_1405: RateDataset = {
  id: "insurance-1405",
  titleFa: "نرخ‌های حق بیمه تأمین اجتماعی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون تأمین اجتماعی، ماده ۲۸ و قانون بیمه بیکاری",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1354-04-03",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "insurance-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Employee's share of the insurable wage. */
    employeeRate: 0.07,
    /** Employer's share of the insurable wage. */
    employerRate: 0.2,
    /** Unemployment-insurance rate, borne by the employer. */
    unemploymentRate: 0.03,
    /** Total contribution rate (employee + employer + unemployment). */
    totalRate: 0.3,
    /** Minimum insurable monthly wage (Rial) — the statutory minimum wage. */
    minInsurableMonthlyWageRial: 104_000_000,
    /** Maximum insurable monthly wage, as a multiple of the minimum wage. */
    maxInsurableMultipleOfMinWage: 7,
  },
};

// ============================================================
// 4) هزینه دادرسی — judicial service tariff (۱۴۰۵)
// ============================================================
// Tiered ad-valorem fee on the value of a monetary claim, plus flat
// fees for non-monetary claims. Brackets are cumulative: each slice of
// the claim value is charged at its own rate. Appeal/cassation pays
// half the first-instance fee.

export const DATASET_COURT_FEE_1405: RateDataset = {
  id: "court-fee-1405",
  titleFa: "تعرفه هزینه دادرسی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle:
      "تعرفه خدمات قضایی و قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی)",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1399-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "court-fee-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
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
// 5) حق‌الوکاله — lawyer's fee tariff (۱۴۰۵)
// ============================================================
// The statutory tariff (تعرفه حق‌الوکاله) is a tiered percentage of
// the claim value, with a separate schedule per proceeding stage and a
// flat band for non-monetary matters. A contractual (توافقی) fee is a
// separate concept and is never mixed into the tariff figure.

export const DATASET_LAWYER_FEE_1405: RateDataset = {
  id: "lawyer-fee-1405",
  titleFa: "تعرفه حق‌الوکاله سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "تعرفه حق‌الوکاله وکلا و کارشناسان رسمی (قوه قضائیه)",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1403-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "lawyer-fee-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Cumulative ad-valorem brackets on the claim value. */
    brackets: [
      { upToRial: 100_000_000, rate: 0.1 },
      { upToRial: 500_000_000, rate: 0.07 },
      { upToRial: 1_000_000_000, rate: 0.05 },
      { upToRial: 5_000_000_000, rate: 0.04 },
      { upToRial: null, rate: 0.03 },
    ],
    /** Flat tariff for non-monetary matters (Rial). */
    nonMonetaryFlatRial: 30_000_000,
    /** Minimum tariff for a monetary matter (Rial). */
    minimumMonetaryRial: 10_000_000,
    /** Stage multipliers applied to the first-instance tariff. */
    stageMultiplier: {
      first: 1,
      appeal: 0.6,
      cassation: 0.5,
      enforcement: 0.3,
    },
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 6) هزینه کارشناسی رسمی — official expert fee (۱۴۰۵)
// ============================================================
// Expert fees follow a tiered percentage of the subject value with a
// statutory floor and ceiling, plus a per-expert multiplier.

export const DATASET_EXPERT_FEE_1405: RateDataset = {
  id: "expert-fee-1405",
  titleFa: "تعرفه کارشناسی رسمی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "تعرفه حق‌الزحمه کارشناسان رسمی دادگستری",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1403-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "expert-fee-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Cumulative ad-valorem brackets on the subject value. */
    brackets: [
      { upToRial: 100_000_000, rate: 0.05 },
      { upToRial: 1_000_000_000, rate: 0.03 },
      { upToRial: 5_000_000_000, rate: 0.02 },
      { upToRial: null, rate: 0.01 },
    ],
    /** Statutory floor for a single expert (Rial). */
    minimumRial: 5_000_000,
    /** Statutory ceiling for a single expert (Rial). */
    maximumRial: 500_000_000,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 7) حق‌الزحمه داوری — arbitration fee (۱۴۰۵)
// ============================================================
// Arbitration fees follow a tiered percentage of the amount in
// dispute, split across the panel. A party-agreed fee is shown
// separately and never conflated with the tariff.

export const DATASET_ARBITRATION_1405: RateDataset = {
  id: "arbitration-1405",
  titleFa: "تعرفه حق‌الزحمه داوری سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "تعرفه حق‌الزحمه داوری (قانون آیین دادرسی مدنی، مواد ۴۵۴ به بعد)",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1379-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "arbitration-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Cumulative ad-valorem brackets on the amount in dispute. */
    brackets: [
      { upToRial: 100_000_000, rate: 0.05 },
      { upToRial: 1_000_000_000, rate: 0.03 },
      { upToRial: 5_000_000_000, rate: 0.02 },
      { upToRial: null, rate: 0.01 },
    ],
    /** Statutory floor for the whole panel (Rial). */
    minimumRial: 10_000_000,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 8) هزینه اجرای حکم — enforcement fee (۱۴۰۵)
// ============================================================
// The enforcement fee (نیم‌عشر اجرایی) is a percentage of the amount
// recovered, distinct from the court fee. The two are never merged.

export const DATASET_EXECUTION_FEE_1405: RateDataset = {
  id: "execution-fee-1405",
  titleFa: "تعرفه هزینه اجرای حکم سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون اجرای احکام مدنی و تعرفه خدمات اجرایی",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1356-08-02",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "execution-fee-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Enforcement fee as a fraction of the amount recovered (نیم‌عشر = ۵٪). */
    enforcementRate: 0.05,
    /** Minimum enforcement fee (Rial). */
    minimumRial: 1_000_000,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 9) کمیسیون مشاور املاک — real-estate commission (۱۴۰۵)
// ============================================================
// Commission is set by the realtors' union tariff, not by statute, and
// can vary by city. Rates are therefore configurable and the result is
// labelled «تعرفه صنفی» rather than «قانونی».

export const DATASET_REAL_ESTATE_COMMISSION_1405: RateDataset = {
  id: "real-estate-commission-1405",
  titleFa: "تعرفه کمیسیون مشاوران املاک سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "تعرفه کمیسیون مشاوران املاک (اتحادیه صنف مشاوران املاک)",
    sourceAuthority: AUTHORITY_REALTORS,
    sourceUrl: null,
    publicationDate: "1403-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "real-estate-commission-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "تعرفه کمیسیون مشاوران املاک صنفی است و می‌تواند بر اساس شهر و مصوبه اتحادیه متفاوت باشد. ارقام این مجموعه نمونه‌ای است؛ نرخ جاری شهر خود را تأیید کنید.",
  },
  rates: {
    /** Sale: commission rate charged to each party. */
    saleRatePerParty: 0.0025,
    /** Rent: commission as a fraction of one month's rent, per party. */
    rentRatePerParty: 0.25,
    /** Rent: commission as a fraction of the deposit (رهن), per party. */
    depositRatePerParty: 0.01,
    /** Value-added tax applied to the commission. */
    vatRate: 0.1,
    /** Minimum commission per party (Rial). */
    minimumPerPartyRial: 1_000_000,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 10) تبدیل رهن و اجاره — rent/deposit conversion (۱۴۰۵)
// ============================================================
// The deposit↔rent conversion is a customary/contractual ratio, not a
// statutory rate. It is fully configurable and the result is labelled
// «عرفی/قراردادی».

export const DATASET_RENT_CONVERSION_1405: RateDataset = {
  id: "rent-conversion-1405",
  titleFa: "ضریب تبدیل رهن و اجاره سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "عرف بازار اجاره مسکن (ضریب تبدیل رهن و اجاره)",
    sourceAuthority: "عرف بازار و توافق طرفین",
    sourceUrl: null,
    publicationDate: "1405-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "rent-conversion-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "تبدیل رهن و اجاره یک محاسبه عرفی/قراردادی است و نرخ تبدیل می‌تواند بر اساس شرایط بازار، منطقه و توافق طرفین متفاوت باشد. ضریب پیش‌فرض صرفاً یک مقدار رایج است و «نرخ قانونی ثابت» نیست.",
  },
  rates: {
    /** Default conversion: Rial of deposit equivalent to 1 Rial of monthly rent. */
    defaultDepositPerRentRial: 200,
    /** Common alternative coefficient (30× monthly rent). */
    alternativeDepositPerRentRial: 30,
    /** Rounding step for the converted amount (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 11) مالیات نقل‌وانتقال ملک — property transfer tax (۱۴۰۵)
// ============================================================
// Transfer tax is levied on the assessed (منطقه‌ای) value, not the
// market price. Rates differ by asset (عرصه/اعیان) and by transfer
// type. VAT applies to the اعیان component.

export const DATASET_PROPERTY_TRANSFER_TAX_1405: RateDataset = {
  id: "property-transfer-tax-1405",
  titleFa: "نرخ مالیات نقل‌وانتقال املاک سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مالیات‌های مستقیم، مواد ۵۹ و ۶۴ و قانون مالیات بر ارزش افزوده",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1366-12-03",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "property-transfer-tax-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Transfer tax on the assessed value of the land (عرصه). */
    landTransferTaxRate: 0.05,
    /** Transfer tax on the assessed value of the building (اعیان). */
    buildingTransferTaxRate: 0.05,
    /** VAT applied to the building component. */
    vatRate: 0.1,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 12) هزینه‌های دفترخانه و ثبت — notary & registration fees (۱۴۰۵)
// ============================================================
// Notary and registration fees follow a tiered schedule on the
// transaction value, plus a fixed stamp duty.

export const DATASET_NOTARY_FEES_1405: RateDataset = {
  id: "notary-fees-1405",
  titleFa: "تعرفه هزینه‌های دفترخانه و ثبت سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "تعرفه حق‌التحریر دفاتر اسناد رسمی و هزینه‌های ثبت",
    sourceAuthority: AUTHORITY_NOTARY,
    sourceUrl: null,
    publicationDate: "1403-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "notary-fees-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Cumulative ad-valorem brackets on the transaction value. */
    brackets: [
      { upToRial: 100_000_000, rate: 0.01 },
      { upToRial: 1_000_000_000, rate: 0.007 },
      { upToRial: 5_000_000_000, rate: 0.005 },
      { upToRial: null, rate: 0.003 },
    ],
    /** Fixed stamp duty / registration fee (Rial). */
    fixedStampDutyRial: 2_000_000,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 13) مالیات ارث — inheritance tax (۱۴۰۵)
// ============================================================
// Inheritance tax is levied per asset class on the value received by
// each heir, with a statutory exemption. Rates are set by the Direct
// Taxes Act and the annual budget.

export const DATASET_INHERITANCE_TAX_1405: RateDataset = {
  id: "inheritance-tax-1405",
  titleFa: "نرخ مالیات ارث سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مالیات‌های مستقیم، مواد ۱۷ تا ۲۱ (مالیات بر ارث)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1366-12-03",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "inheritance-tax-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes: PENDING_NOTE,
  },
  rates: {
    /** Per-heir exemption on the inherited value (Rial). */
    perHeirExemptionRial: 300_000_000,
    /** Tax rate applied to the value above the exemption. */
    taxRate: 0.1,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 14) نفقه — alimony estimate factors (۱۴۰۵)
// ============================================================
// Alimony has no fixed statutory formula; it depends on the wife's
// needs and the husband's means. This dataset carries only the
// reference factors used to build an *estimate range*, never a
// definitive figure.

export const DATASET_ALIMONY_1405: RateDataset = {
  id: "alimony-1405",
  titleFa: "عوامل برآورد نفقه سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مدنی، مواد ۱۱۰۶ تا ۱۱۱۱ (نفقه) و رویه قضایی",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1307-02-18",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "alimony-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "مبلغ نفقه با فرمول ثابت قانونی تعیین نمی‌شود و به نیاز زوجه، وضعیت مالی زوج، عرف محل و نظر مرجع صالح/کارشناس وابسته است. این مجموعه فقط برای ساخت یک «محدوده برآورد» به کار می‌رود.",
  },
  rates: {
    /** Reference monthly cost per adult (Rial) — illustrative baseline. */
    adultMonthlyBaselineRial: 30_000_000,
    /** Reference monthly cost per child (Rial) — illustrative baseline. */
    childMonthlyBaselineRial: 15_000_000,
    /** Lower bound of the estimate band, as a fraction of the baseline. */
    lowerBandFactor: 0.7,
    /** Upper bound of the estimate band, as a fraction of the baseline. */
    upperBandFactor: 1.5,
    /** City cost-of-living multipliers. */
    cityFactor: {
      tehran: 1.4,
      metropolis: 1.15,
      other: 1,
    },
  },
};

// ============================================================
// 15) اجرت‌المثل ایام زوجیت — mahr-service factors (۱۴۰۵)
// ============================================================
// اجرت‌المثل is decided by the court on expert advice; there is no
// statutory formula. This dataset carries only the assessment factors.

export const DATASET_MAHR_SERVICE_1405: RateDataset = {
  id: "mahr-service-1405",
  titleFa: "عوامل بررسی اجرت‌المثل ایام زوجیت سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مدنی و رویه قضایی (اجرت‌المثل ایام زوجیت)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1307-02-18",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "mahr-service-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "اجرت‌المثل ایام زوجیت با فرمول ثابت تعیین نمی‌شود و به نظر کارشناس و دادگاه وابسته است. این مجموعه فقط عوامل مؤثر را برای بررسی اولیه فراهم می‌کند.",
  },
  rates: {
    /** Reference monthly value of domestic services (Rial) — illustrative. */
    monthlyServiceBaselineRial: 20_000_000,
    /** Lower bound of the estimate band. */
    lowerBandFactor: 0.5,
    /** Upper bound of the estimate band. */
    upperBandFactor: 1.2,
  },
};

// ============================================================
// 16) دیه — annual blood-money rate (۱۴۰۵)
// ============================================================
// The full diyeh for a free Muslim man in a non-sacred month is set
// annually by the judiciary. Fractions are statutory multipliers of
// this base (see DIYEH_FRACTIONS).

export const DATASET_DIYEH_1405: RateDataset = {
  id: "diyeh-1405",
  titleFa: "نرخ دیه کامل سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مجازات اسلامی (کتاب چهارم — دیات)، مواد ۵۴۹ و ۵۵۰",
    sourceAuthority: AUTHORITY_JUDICIARY,
    sourceUrl: null,
    publicationDate: "1392-02-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "diyeh-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "نرخ دیه هر سال توسط قوه قضائیه اعلام می‌شود. نرخ ماه‌های حرام (محرم، رجب، ذی‌القعده، ذی‌الحجه) یک‌سوم بیشتر است. " +
      PENDING_NOTE,
  },
  rates: {
    /** Full diyeh in Rial for a non-sacred month. */
    fullDiyehRial: 1_200_000_000_000,
    /** Multiplier applied during the four sacred months. */
    sacredMonthMultiplier: 4 / 3,
  },
};

// ============================================================
// 17) افت قیمت خودرو — vehicle depreciation factors (۱۴۰۵)
// ============================================================
// Vehicle depreciation after an accident is assessed by an expert;
// there is no statutory formula. This dataset carries only the
// reference factors used to build an *estimate range*.

export const DATASET_VEHICLE_DEPRECIATION_1405: RateDataset = {
  id: "vehicle-depreciation-1405",
  titleFa: "عوامل برآورد افت قیمت خودرو سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "رویه کارشناسی ارزیابی خسارت خودرو (افت قیمت)",
    sourceAuthority: "کارشناسی رسمی ارزیابی خسارت خودرو",
    sourceUrl: null,
    publicationDate: "1405-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "vehicle-depreciation-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "افت قیمت خودرو با فرمول ثابت قانونی تعیین نمی‌شود و به نظر کارشناس رسمی وابسته است. این مجموعه فقط یک «برآورد اولیه» فراهم می‌کند.",
  },
  rates: {
    /** Base depreciation rate per damaged part, as a fraction of vehicle value. */
    baseRatePerPart: 0.01,
    /** Severity multipliers. */
    severityFactor: {
      light: 0.6,
      medium: 1,
      severe: 1.6,
    },
    /** Multiplier for a replaced (تعویض) part vs a repaired one. */
    replacementFactor: 1.3,
    /** Multiplier for a painted (رنگ) part. */
    paintFactor: 0.8,
    /** Lower bound of the estimate band, as a fraction of the point estimate. */
    lowerBandFactor: 0.7,
    /** Upper bound of the estimate band. */
    upperBandFactor: 1.4,
  },
};

// ============================================================
// 18) وجه التزام قراردادی — contractual penalty (۱۴۰۵)
// ============================================================
// A contractual penalty is a matter of the parties' agreement; there
// is no statutory rate. This dataset carries only the statutory
// ceiling reference (ماده ۲۳۰ قانون مدنی) and rounding.

export const DATASET_PENALTY_1405: RateDataset = {
  id: "penalty-1405",
  titleFa: "مبنای محاسبه وجه التزام قراردادی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مدنی، ماده ۲۳۰ (وجه التزام / شرط کیفری)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1307-02-18",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "penalty-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "وجه التزام تابع توافق طرفین است و نرخ قانونی ثابت ندارد. این محاسبه‌گر فقط مبلغ توافق‌شده را بر اساس مدت تأخیر محاسبه می‌کند.",
  },
  rates: {
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 19) شاخص قیمت — CPI for late-payment damages (۱۴۰۵)
// ============================================================
// Damages track the change in the Central Bank price index between the
// due date and the payment date. The index series is published monthly.

export const DATASET_PRICE_INDEX_1405: RateDataset = {
  id: "price-index-1405",
  titleFa: "شاخص بهای کالاها و خدمات مصرفی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "شاخص بهای کالاها و خدمات مصرفی — بانک مرکزی جمهوری اسلامی ایران",
    sourceAuthority: AUTHORITY_CENTRAL_BANK,
    sourceUrl: "https://www.cbi.ir",
    publicationDate: "1405-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "price-index-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
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
      "1405-01": 180,
    },
  },
};

// ============================================================
// 20) شاخص تعدیل مهریه — dowry indexation (۱۴۰۵)
// ============================================================
// Dowry is revalued by the change in the price index between the
// marriage year and the claim year.

export const DATASET_DOWRY_INDEX_1405: RateDataset = {
  id: "dowry-index-1405",
  titleFa: "شاخص تعدیل مهریه سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "شاخص بهای کالاها و خدمات مصرفی — بانک مرکزی (مبنای تعدیل مهریه)",
    sourceAuthority: AUTHORITY_CENTRAL_BANK,
    sourceUrl: "https://www.cbi.ir",
    publicationDate: "1405-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "dowry-index-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
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
      "1405": 165,
    },
  },
};

// ============================================================
// 21) چک برگشتی — bounced-check reference (۱۴۰۵)
// ============================================================
// A bounced check's claim is the principal plus late-payment damages
// (ماده ۵۲۲) plus judicial/enforcement costs. This dataset carries the
// reference for the damages index and the cost components.

export const DATASET_CHECK_1405: RateDataset = {
  id: "check-1405",
  titleFa: "مبنای محاسبه مطالبات چک برگشتی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون صدور چک (اصلاحی ۱۳۹۷) و ماده ۵۲۲ قانون آیین دادرسی مدنی",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1397-08-13",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "check-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "خسارت تأخیر تأدیه چک بر مبنای تغییر شاخص قیمت (ماده ۵۲۲) محاسبه می‌شود. اصل مبلغ چک، خسارت تأخیر و هزینه‌های قضایی/اجرایی سه مفهوم جدا هستند و در نتیجه تفکیک می‌شوند.",
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
      "1405-01": 180,
    },
  },
};

// ============================================================
// 22) سهم مشاعی — co-ownership share (۱۴۰۵)
// ============================================================
// A co-ownership share is a pure fraction of the property value; no
// statutory rate is involved. This dataset carries only the rounding
// convention so the result matches the notary's presentation.

export const DATASET_CO_OWNERSHIP_1405: RateDataset = {
  id: "co-ownership-1405",
  titleFa: "مبنای محاسبه سهم مشاعی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون مدنی، مواد ۵۷۱ تا ۵۷۴ (مالکیت مشاعی)",
    sourceAuthority: AUTHORITY_PARLIAMENT,
    sourceUrl: null,
    publicationDate: "1307-02-18",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "co-ownership-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "سهم مشاعی صرفاً کسری از ارزش ملک است و نرخ قانونی ندارد. این مجموعه فقط گام گرد کردن را تعیین می‌کند.",
  },
  rates: {
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// 23) سرقفلی — goodwill / key money (۱۴۰۵)
// ============================================================
// Goodwill (سرقفلی) is a negotiated amount with no statutory rate. It
// is commonly expressed as a multiple of the monthly rent. This
// dataset carries only reference factors for an *estimate range*.

export const DATASET_GOODWILL_1405: RateDataset = {
  id: "goodwill-1405",
  titleFa: "عوامل برآورد سرقفلی سال ۱۴۰۵",
  calculationYear: 1405,
  source: {
    sourceTitle: "قانون روابط موجر و مستأجر و عرف بازار (سرقفلی)",
    sourceAuthority: "عرف بازار و توافق طرفین",
    sourceUrl: null,
    publicationDate: "1405-01-01",
    effectiveFrom: EFFECTIVE_1405,
    effectiveTo: null,
    jurisdiction: JURISDICTION_IR,
    calculationYear: 1405,
    version: "goodwill-1405.1",
    verifiedAt: REVIEWED_AT,
    verificationStatus: "pending",
    notes:
      "سرقفلی مبلغی توافقی است و نرخ قانونی ثابت ندارد. این مجموعه فقط یک «محدوده برآورد» بر پایه مضربی از اجاره ماهانه فراهم می‌کند.",
  },
  rates: {
    /** Reference multiple of the monthly rent, lower bound. */
    lowerMultipleOfRent: 12,
    /** Reference multiple of the monthly rent, upper bound. */
    upperMultipleOfRent: 36,
    /** Rounding step (Rial). */
    roundingStepRial: 1_000,
  },
};

// ============================================================
// Registry
// ============================================================

export const RATE_DATASETS_1405: RateDataset[] = [
  DATASET_LABOR_1405,
  DATASET_PAYROLL_TAX_1405,
  DATASET_INSURANCE_1405,
  DATASET_COURT_FEE_1405,
  DATASET_LAWYER_FEE_1405,
  DATASET_EXPERT_FEE_1405,
  DATASET_ARBITRATION_1405,
  DATASET_EXECUTION_FEE_1405,
  DATASET_REAL_ESTATE_COMMISSION_1405,
  DATASET_RENT_CONVERSION_1405,
  DATASET_PROPERTY_TRANSFER_TAX_1405,
  DATASET_NOTARY_FEES_1405,
  DATASET_INHERITANCE_TAX_1405,
  DATASET_ALIMONY_1405,
  DATASET_MAHR_SERVICE_1405,
  DATASET_DIYEH_1405,
  DATASET_VEHICLE_DEPRECIATION_1405,
  DATASET_PENALTY_1405,
  DATASET_PRICE_INDEX_1405,
  DATASET_DOWRY_INDEX_1405,
  DATASET_CHECK_1405,
  DATASET_CO_OWNERSHIP_1405,
  DATASET_GOODWILL_1405,
];
