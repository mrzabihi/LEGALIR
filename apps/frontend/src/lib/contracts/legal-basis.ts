// ============================================================
// LEGALIR — Contract legal-basis catalog & report (§2)
// ============================================================
// A curated, human-reviewed map from a rendered CLAUSE to the REAL
// provisions it rests on. It exists so the contract can carry an honest,
// NON-BINDING annex — «مبنای حقوقی و گزارش بررسی» — instead of an
// invented one.
//
// HARD RULES (§2 of the contract brief):
//   • a provision is cited ONLY when it appears in this reviewed catalog;
//     an unmapped clause is left out, never guessed;
//   • every cited provision is either present in the official law catalog
//     (`LAW_SOURCES`) or already asserted elsewhere in this codebase — no
//     article number is ever fabricated;
//   • the annex is informational only; it is not part of the operative
//     contract text and is never a substitute for legal advice.
//
// The mapping is keyed by contract type then clause id, so it composes
// with the deterministic template engine: the same clause always carries
// the same citations.
// ============================================================

import type {
  ContractLegalBasisReport,
  ContractLegalBasisSection,
  ContractLegalCitation,
  ContractLegalCitationStatus,
  ContractPreSignTip,
  ContractTypeId,
  PropertyContract,
} from "@legalir/types";
import {
  CONTRACT_LEGAL_BASIS_DISCLAIMER_FA,
  CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA,
} from "@legalir/types";
import type { RenderedContract } from "./template";

export interface CatalogCitation {
  articleFa: string;
  lawTitleFa: string;
  noteFa: string;
  status: ContractLegalCitationStatus;
  /** Points at the official law catalog entry when one exists. */
  lawSourceId: string | null;
  /** The reviewed source's exact name, when it differs from `lawTitleFa`. */
  sourceNameFa?: string;
  /** Content version of the STORED record (absent on seed-only entries). */
  contentVersion?: number;
  /** ISO-8601 UTC of the human review (absent on seed-only entries). */
  reviewedAt?: string | null;
}

/** A catalog map: contract type → clause id → citations. */
export type LegalBasisCatalog = Partial<
  Record<ContractTypeId, Record<string, CatalogCitation[]>>
>;

const REVIEWED = (c: Omit<CatalogCitation, "status">): CatalogCitation => ({
  ...c,
  status: "reviewed",
});

// ------------------------------------------------------------
// Curated, reviewed mappings
// ------------------------------------------------------------
// Every `articleFa` below is a real provision: it is either present in
// `src/lib/law-catalog.ts` (linked via `lawSourceId`) or already asserted
// in this repo (ماده ۱۰، ۲۳۰، ۴۸۶ و ۵۲۲ قانون مدنی). Nothing is invented.

/**
 * The citation set shared by IaaS, PaaS and BaaS. The three types render
 * the same clause ids (`generic.service`, `generic.sla`, `generic.data`,
 * `generic.financial`, `generic.obligations`), so they cite the same
 * provisions. The resolver copies each entry, so sharing this constant
 * can never leak a mutation between types.
 */
const CLOUD_LEGAL_BASIS: Record<string, CatalogCitation[]> = {
  "common.parties": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعیین ارائه‌دهندهٔ خدمت، مشتری و نمایندگان آنان، در چارچوب ماده ۱۰ ق.م. معتبر است.",
      lawSourceId: null,
    }),
  ],
  "generic.service": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعیین دامنه و مشخصات خدمت ابری، توافقی و در چارچوب ماده ۱۰ ق.م. لازم‌الاجراست.",
      lawSourceId: null,
    }),
  ],
  "generic.sla": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعیین سطح سرویس، پشتیبانی و امنیت، در چارچوب اصل آزادی قراردادی معتبر است.",
      lawSourceId: null,
    }),
    REVIEWED({
      articleFa: "ماده ۲۳۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "اعتبارسنجی سطح سرویس (SLA) و جریمهٔ عدم تحقق آن، شرط کیفری معتبر است.",
      lawSourceId: "law-penalty-clause",
    }),
  ],
  "generic.financial": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعیین مبلغ، دورهٔ صورت‌حساب و روش پرداخت، توافقی و در چارچوب ماده ۱۰ ق.م. نافذ است.",
      lawSourceId: null,
    }),
  ],
  "generic.data": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعیین مالکیت داده، مدت نگهداری و الزام به بازگرداندن یا حذف آن، در چارچوب ماده ۱۰ ق.م. معتبر است.",
      lawSourceId: null,
    }),
  ],
  "generic.obligations": [
    REVIEWED({
      articleFa: "ماده ۱۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "تعهدات متقابل، محدودیت مسئولیت و شرایط فسخ، در چارچوب ماده ۱۰ ق.م. لازم‌الاتباع است.",
      lawSourceId: null,
    }),
    REVIEWED({
      articleFa: "ماده ۲۳۰ قانون مدنی",
      lawTitleFa: "قانون مدنی",
      noteFa: "وجه التزام توافق‌شده برای نقض تعهد، شرط کیفری معتبر و لازم‌الاجراست.",
      lawSourceId: "law-penalty-clause",
    }),
  ],
};

/**
 * The in-code SEED of the reviewed catalog. It is not the runtime source of
 * truth: `legal-review-db.ts` merges a stored record over it whenever a
 * reviewer has saved one, so an admin edit always wins over this file.
 */
export const LEGAL_BASIS_SEED: LegalBasisCatalog = {
  property_rent: {
    "rent.late_penalty": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام توافق‌شده برای تأخیر یا تخلف از تعهد، شرط کیفری معتبر و لازم‌الاجراست.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
    "rent.termination": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام عدم تخلیه در پایان مدت، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
    "rent.costs": [
      REVIEWED({
        articleFa: "ماده ۴۸۶ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "هزینه‌های لازم برای نگه‌داشتن ملک در وضعیت قابل استفاده، اصولاً بر عهدهٔ مالک است مگر خلاف آن توافق شود.",
        lawSourceId: null,
      }),
    ],
  },

  property_sale: {
    "sale.obligations": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام عدم حضور در دفترخانه یا تأخیر در تحویل، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  // ----------------------------------------------------------
  // Commercial property (rent + sale)
  // ----------------------------------------------------------
  // Every citation here reuses a locator already asserted elsewhere in
  // the codebase. The commercial licence / official-registration clauses
  // are deliberately LEFT OUT: they rest on the trade-licensing and
  // notary regulations, which this repo has no reviewed source for, so
  // the annex stays silent about them rather than guessing an article.
  commercial_rent: {
    "common.parties": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعیین طرفین و نمایندهٔ قانونی آنان، در چارچوب اصل آزادی قراردادی (ماده ۱۰ ق.م.) معتبر است.",
        lawSourceId: null,
      }),
    ],
    "generic.financial": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعیین ودیعه، اجاره‌بها و نحوهٔ پرداخت، توافقی و در چارچوب ماده ۱۰ ق.م. لازم‌الاجراست.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام توافق‌شده برای تأخیر در پرداخت اجاره‌بها، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعهدات متقابل طرفین، شرایط فسخ و تخلیه، در چارچوب ماده ۱۰ ق.م. نافذ است.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام عدم تخلیه یا نقض تعهد، شرط کیفری معتبر و لازم‌الاجراست.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  commercial_sale: {
    "common.parties": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعیین طرفین معامله و نمایندهٔ قانونی آنان، در چارچوب ماده ۱۰ ق.م. معتبر است.",
        lawSourceId: null,
      }),
    ],
    "generic.financial": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعیین ثمن، پیش‌پرداخت و برنامهٔ پرداخت، توافقی و در چارچوب ماده ۱۰ ق.م. لازم‌الاجراست.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام تأخیر در پرداخت ثمن یا انجام تعهد، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام عدم حضور در دفترخانه یا تأخیر در تحویل، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  vehicle_sale: {
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام نقض تعهد فروشنده یا خریدار خودرو، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  debt: {
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام تأخیر در بازپرداخت قرض، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
      REVIEWED({
        articleFa: "ماده ۵۲۲ قانون آیین دادرسی مدنی",
        lawTitleFa: "قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی)",
        noteFa: "مطالبهٔ خسارت تأخیر تأدیه در تعهدات پولی، مشمول مقررات این ماده است.",
        lawSourceId: "law-delayed-payment",
      }),
    ],
  },

  freelance: {
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "توافق طرفین در چارچوب ماده ۱۰ ق.م. نافذ و لازم‌الاجراست.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام تأخیر در تحویل یا نقض تعهد، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  nda: {
    "generic.scope": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "توافقنامهٔ محرمانگی بر مبنای اصل آزادی قراردادی (ماده ۱۰ ق.م.) معتبر است.",
        lawSourceId: null,
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعهدات محرمانگی و عدم افشا در چارچوب ماده ۱۰ ق.م. لازم‌الاتباع است.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام نقض تعهد محرمانگی، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  saas: {
    "generic.data": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعیین مالکیت داده و تعهد محرمانگی، در چارچوب اصل آزادی قراردادی معتبر است.",
        lawSourceId: null,
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "تعهدات سطح سرویس و مالکیت فکری، در چارچوب ماده ۱۰ ق.م. نافذ است.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "جریمهٔ عدم تحقق سطح سرویس (SLA)، شرط کیفری معتبر است.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  // ----------------------------------------------------------
  // Cloud services (IaaS / PaaS / BaaS)
  // ----------------------------------------------------------
  // One clause set, three registered types. The service model is encoded
  // in the type id and printed in the title, so the same mapped clauses
  // stay accurate whatever model was bought. No data-protection statute
  // is cited: this repo holds no reviewed source for one, and an invented
  // article number is worse than a silent annex.
  cloud_iaas: CLOUD_LEGAL_BASIS,
  cloud_paas: CLOUD_LEGAL_BASIS,
  cloud_baas: CLOUD_LEGAL_BASIS,

  employment: {
    // Clause ids follow the schema-driven convention `generic.<stepId>`.
    // The parties clause is `common.parties` for EVERY type (it is emitted
    // by `partiesClause`, not by a wizard step), so the employer/employee
    // identity citations live there — a `generic.employer` /
    // `generic.employee` key would never match a rendered clause.
    "common.parties": [
      REVIEWED({
        articleFa: "ماده ۷ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "قرارداد کار رابطهٔ کارگر و کارفرما را تعریف می‌کند؛ تعیین هویت و سمت کارفرما از ارکان آن است.",
        lawSourceId: "law-labor",
      }),
      REVIEWED({
        articleFa: "ماده ۷ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "کارگر کسی است که در قبال حق‌السعی کاری را برای کارفرما انجام می‌دهد؛ مشخصات او باید دقیق درج شود.",
        lawSourceId: "law-labor",
      }),
    ],
    "generic.job": [
      REVIEWED({
        articleFa: "ماده ۷ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "ماهیت کار مورد توافق، موضوع اصلی قرارداد کار است و باید در قرارداد توصیف شود.",
        lawSourceId: "law-labor",
      }),
    ],
    "generic.term": [
      REVIEWED({
        articleFa: "ماده ۷ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "قرارداد کار می‌تواند برای مدت موقت یا غیرموقت منعقد شود؛ نوع و مدت آن باید صریح باشد.",
        lawSourceId: "law-labor",
      }),
    ],
    "generic.wages": [
      REVIEWED({
        articleFa: "ماده ۷ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "حق‌السعی در برابر کار انجام‌شده، یکی از دو تعهد اصلی قرارداد کار است و باید تعیین شود.",
        lawSourceId: "law-labor",
      }),
    ],
    "generic.hours": [
      REVIEWED({
        articleFa: "ماده ۵۱ قانون کار",
        lawTitleFa: "قانون کار جمهوری اسلامی ایران",
        noteFa: "ساعات کار کارگران در شبانه‌روز نباید از هشت ساعت و در هفته از چهل‌وچهار ساعت بیشتر باشد.",
        lawSourceId: null,
      }),
    ],
    "generic.insurance": [
      REVIEWED({
        articleFa: "ماده ۳۹ قانون تأمین اجتماعی",
        lawTitleFa: "قانون تأمین اجتماعی",
        noteFa: "کارفرما مسئول پرداخت حق بیمهٔ سهم خود و بیمه‌شده است و باید سهم کارگر را از مزد کسر و به سازمان ایصال کند.",
        lawSourceId: "law-social-security",
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "شروط و تعهدات متقابلی که طرفین در چارچوب ماده ۱۰ ق.م. بر آن توافق می‌کنند، نافذ و لازم‌الاجراست.",
        lawSourceId: null,
      }),
      REVIEWED({
        articleFa: "ماده ۲۳۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "وجه التزام توافق‌شده برای نقض تعهد، شرط کیفری معتبر و لازم‌الاجراست.",
        lawSourceId: "law-penalty-clause",
      }),
    ],
  },

  startup: {
    "generic.governance": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "نحوهٔ تصمیم‌گیری و تقسیم سود و زیان، توافقی و در چارچوب ماده ۱۰ ق.م. معتبر است.",
        lawSourceId: null,
      }),
    ],
    "generic.obligations": [
      REVIEWED({
        articleFa: "ماده ۱۰ قانون مدنی",
        lawTitleFa: "قانون مدنی",
        noteFa: "شرط عدم رقابت و تعهد محرمانگی، در چارچوب ماده ۱۰ ق.م. نافذ است.",
        lawSourceId: null,
      }),
    ],
  },
};

// ------------------------------------------------------------
// §7 — pre-sign tips (a separate, NON-COMPULSORY surface)
// ------------------------------------------------------------
// «قبل از امضا بدانید» — practical points a party should be aware of for
// this contract type. They are NOT part of the contract text, are never
// acknowledged, and are printed as their own informational annex.
//
// A tip that reuses an already-reviewed provision is `reviewed`; a tip
// with no reviewed source behind it stays `pending` so the admin report
// flags it instead of presenting it as settled law.

export interface PreSignTipSeed {
  titleFa: string;
  bodyFa: string;
  /** The exact source name the tip rests on. */
  sourceNameFa: string;
  status: ContractLegalCitationStatus;
}

const LEGALIR_POLICY_SOURCE = "سیاست انتشار و امضای LEGALIR";

const CLOUD_PRE_SIGN_TIPS: PreSignTipSeed[] = [
  {
    titleFa: "امضای الکترونیکی با امضای رسمی یکی نیست",
    bodyFa:
      "امضای این قرارداد در لیگالیر «تأیید و امضای الکترونیکی» است و با «امضای الکترونیکی مطمئن» یا «امضای دیجیتال رسمی» یکسان نیست. اگر برای موضوع قرارداد امضای رسمی یا ثبت نزد مرجع صلاحیت‌دار لازم است، جداگانه اقدام کنید.",
    sourceNameFa: LEGALIR_POLICY_SOURCE,
    status: "reviewed",
  },
  {
    titleFa: "سطح سرویس و جریمهٔ آن را بخوانید",
    bodyFa:
      "اگر برای عدم تحقق سطح سرویس (SLA) وجه التزام توافق شده، مبلغ، نحوهٔ محاسبه و شرایط مطالبهٔ آن را بررسی کنید. شرط کیفری در چارچوب ماده ۲۳۰ قانون مدنی معتبر است.",
    sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
    status: "reviewed",
  },
  {
    titleFa: "مالکیت داده و خروج از سرویس",
    bodyFa:
      "مالکیت داده، مدت نگهداری و تکلیف بازگرداندن یا حذف داده پس از پایان قرارداد از موضوعات مهم این نوع قرارداد است. پیش از امضا مطمئن شوید این بخش‌ها با نیاز واقعی شما هم‌خوان است.",
    sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
    status: "reviewed",
  },
];

export const PRE_SIGN_TIPS_SEED: Partial<Record<ContractTypeId, PreSignTipSeed[]>> = {
  property_rent: [
    {
      titleFa: "مدت، مبلغ و زمان پرداخت اجاره",
      bodyFa:
        "تاریخ شروع و پایان مدت اجاره، مبلغ اجاره‌بها و نحوهٔ پرداخت را با توافق واقعی خود مقایسه کنید. هر تغییری در این موارد باید به‌صورت یک نسخهٔ جدید در سند ثبت شود و دو طرف دوباره آن را تأیید کنند.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "وجه التزام و شرایط تخلیه",
      bodyFa:
        "اگر برای تأخیر در پرداخت یا عدم تخلیه وجه التزام توافق شده، مبلغ و شرایط مطالبهٔ آن را دقیق بخوانید. وجه التزام توافق‌شده در چارچوب ماده ۲۳۰ قانون مدنی شرط کیفری معتبر است.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
    {
      titleFa: "هزینه‌های نگهداری ملک",
      bodyFa:
        "هزینه‌های لازم برای نگه‌داشتن ملک در وضعیت قابل استفاده اصولاً بر عهدهٔ مالک است، مگر خلاف آن توافق شود؛ بند مربوط را در قرارداد بخوانید و بدانید چه هزینه‌ای بر عهدهٔ شماست.",
      sourceNameFa: "قانون مدنی — ماده ۴۸۶",
      status: "reviewed",
    },
    {
      titleFa: "ثبت رسمی و اثر امضای الکترونیکی",
      bodyFa:
        "امضای این قرارداد در لیگالیر «تأیید و امضای الکترونیکی» است و جای ثبت رسمی در دفترخانه را نمی‌گیرد. اگر برای این اجاره ثبت رسمی لازم است، جداگانه اقدام کنید.",
      sourceNameFa: LEGALIR_POLICY_SOURCE,
      status: "reviewed",
    },
  ],

  property_sale: [
    {
      titleFa: "مشخصات ملک و سند مالکیت",
      bodyFa:
        "پیش از امضا، مشخصات ثبتی ملک و سند مالکیت را با آنچه در قرارداد آمده مقایسه کنید. هر مغایرتی باید پیش از امضا اصلاح شود.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "شرط حضور در دفترخانه",
      bodyFa:
        "اگر برای عدم حضور در دفترخانه یا تأخیر در تحویل وجه التزام توافق شده، مبلغ و شرایط آن را بخوانید؛ شرط کیفری در چارچوب ماده ۲۳۰ قانون مدنی معتبر است.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
    {
      titleFa: "انتقال رسمی سند",
      bodyFa:
        "امضای الکترونیکی این قرارداد مالکیت را منتقل نمی‌کند؛ انتقال رسمی سند مراحل و هزینه‌های خود را دارد و باید جداگانه انجام شود.",
      sourceNameFa: LEGALIR_POLICY_SOURCE,
      status: "reviewed",
    },
  ],

  commercial_rent: [
    {
      titleFa: "مجوز فعالیت و کاربری ملک",
      bodyFa:
        "اگر برای کسب‌وکار خود ملک تجاری اجاره می‌کنید، پیش از امضا مطمئن شوید کاربری ملک و مجوز فعالیت شما با هم هم‌خوان‌اند. این موضوع ممکن است مقررات اختصاصی داشته باشد که در این سند بررسی نشده است.",
      sourceNameFa: "در انتظار تعیین منبع بازبینی‌شده",
      status: "pending",
    },
    {
      titleFa: "ودیعه، اجاره‌بها و وجه التزام",
      bodyFa:
        "مبلغ ودیعه، اجاره‌بها و وجه التزام تأخیر را با توافق واقعی مقایسه کنید؛ شرط کیفری در چارچوب ماده ۲۳۰ قانون مدنی معتبر است.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
    {
      titleFa: "ثبت رسمی قرارداد تجاری",
      bodyFa:
        "برای پاره‌ای از قراردادهای تجاری ثبت رسمی یا تشریفات خاص لازم است؛ این سند جای آن تشریفات را نمی‌گیرد. پیش از امضا شرایط خود را با مشاور حقوقی بررسی کنید.",
      sourceNameFa: "در انتظار تعیین منبع بازبینی‌شده",
      status: "pending",
    },
  ],

  commercial_sale: [
    {
      titleFa: "مجوزها و تشریفات انتقال",
      bodyFa:
        "خرید و فروش ملک تجاری ممکن است مجوزها و تشریفات انتقال اختصاصی داشته باشد؛ این موارد در متن سند بررسی نشده‌اند و باید جداگانه کنترل شوند.",
      sourceNameFa: "در انتظار تعیین منبع بازبینی‌شده",
      status: "pending",
    },
    {
      titleFa: "ثمن و برنامهٔ پرداخت",
      bodyFa:
        "مبلغ ثمن، پیش‌پرداخت و زمان‌بندی پرداخت را دقیق بخوانید؛ تعیین آن‌ها در چارچوب ماده ۱۰ قانون مدنی نافذ است.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "وجه التزام تحویل و حضور در دفترخانه",
      bodyFa:
        "برای تأخیر در تحویل یا عدم حضور در دفترخانه ممکن است وجه التزام تعیین شده باشد؛ مبلغ و شرایط مطالبهٔ آن را بررسی کنید.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
  ],

  vehicle_sale: [
    {
      titleFa: "مشخصات خودرو و وضعیت سند",
      bodyFa:
        "شمارهٔ شاسی، شمارهٔ موتور و وضعیت سند و پلاک خودرو را با آنچه در قرارداد آمده مقایسه کنید.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "تعلیق و تخلیهٔ خودرو",
      bodyFa:
        "پیش از امضا از وضعیت تعلیق، خلافی و تخلیهٔ خودرو اطلاع پیدا کنید؛ تعهدات مربوط به آن‌ها باید روشن باشد.",
      sourceNameFa: "در انتظار تعیین منبع بازبینی‌شده",
      status: "pending",
    },
    {
      titleFa: "انتقال رسمی مالکیت",
      bodyFa:
        "امضای این قرارداد جای انتقال رسمی مالکیت در مراکز مربوط را نمی‌گیرد و آن انتقال باید جداگانه انجام شود.",
      sourceNameFa: LEGALIR_POLICY_SOURCE,
      status: "reviewed",
    },
  ],

  debt: [
    {
      titleFa: "مبلغ، موعد و نحوهٔ بازپرداخت",
      bodyFa:
        "مبلغ قرض، موعد و تعداد اقساط را با توافق واقعی مقایسه کنید و بدانید چه چیزی در صورت تأخیر اعمال می‌شود.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "وجه التزام تأخیر",
      bodyFa:
        "وجه التزام تأخیر در بازپرداخت، شرط کیفری است و مبلغ و شرایط آن باید روشن باشد.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
    {
      titleFa: "خسارت تأخیر تأدیه",
      bodyFa:
        "مطالبهٔ خسارت تأخیر تأدیه در تعهدات پولی مشمول مقررات ماده ۵۲۲ قانون آیین دادرسی مدنی است؛ اگر قرار است شرط متفاوتی اعمال شود، آن را با مشاور حقوقی بررسی کنید.",
      sourceNameFa: "قانون آیین دادرسی مدنی — ماده ۵۲۲",
      status: "reviewed",
    },
  ],

  freelance: [
    {
      titleFa: "دامنهٔ کار و معیار تحویل",
      bodyFa:
        "مشخص کنید چه چیزی تحویل می‌شود، چه زمانی و با چه معیاری پذیرفته می‌شود؛ برداشت متفاوت از «تحویل» شایع‌ترین منشأ اختلاف است.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "حق‌الزحمه و شرایط پرداخت",
      bodyFa:
        "مبلغ، زمان‌بندی و شرایط پرداخت حق‌الزحمه را دقیق بخوانید و بدانید پرداخت به چه تحویلی گره خورده است.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "مالکیت خروجی و محرمانگی",
      bodyFa:
        "مالکیت فکری خروجی کار و تعهدات محرمانگی باید روشن باشد؛ اگر روی این موارد توافقی نیست، پیش از امضا آن را ثبت کنید.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
  ],

  nda: [
    {
      titleFa: "دامنهٔ اطلاعات محرمانه",
      bodyFa:
        "مشخص کنید چه اطلاعاتی محرمانه است و چه چیزی خارج از این دامنه می‌ماند؛ تعریف مبهم می‌تواند تعهد شما را بیش از انتظار گسترش دهد.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "مدت تعهد و استثناها",
      bodyFa:
        "مدت تعهد محرمانگی و استثناهایی مانند اطلاعات عمومی را بررسی کنید. مدت نامحدود یا مبهم می‌تواند در عمل محدودکننده باشد.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "وجه التزام نقض محرمانگی",
      bodyFa:
        "اگر برای نقض تعهد محرمانگی وجه التزام تعیین شده، مبلغ و شرایط آن را بخوانید؛ شرط کیفری در چارچوب ماده ۲۳۰ قانون مدنی معتبر است.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
  ],

  saas: [
    {
      titleFa: "سطح سرویس و دسترس‌پذیری",
      bodyFa:
        "سطح سرویس (SLA)، زمان دسترس‌پذیری و جریمهٔ عدم تحقق آن را با نیاز واقعی خود مقایسه کنید.",
      sourceNameFa: "قانون مدنی — ماده ۲۳۰ (شرط کیفری)",
      status: "reviewed",
    },
    {
      titleFa: "مالکیت داده و خروج از سرویس",
      bodyFa:
        "مالکیت داده، مدت نگهداری و امکان خروج داده پس از پایان قرارداد را بررسی کنید؛ این موارد بر تداوم کسب‌وکار شما اثر مستقیم دارند.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "امضای الکترونیکی",
      bodyFa:
        "امضای این قرارداد «تأیید و امضای الکترونیکی» است و با «امضای الکترونیکی مطمئن» یا «امضای دیجیتال رسمی» یکسان نیست.",
      sourceNameFa: LEGALIR_POLICY_SOURCE,
      status: "reviewed",
    },
  ],

  cloud_iaas: CLOUD_PRE_SIGN_TIPS,
  cloud_paas: CLOUD_PRE_SIGN_TIPS,
  cloud_baas: CLOUD_PRE_SIGN_TIPS,

  startup: [
    {
      titleFa: "سهم، سود و زیان",
      bodyFa:
        "نحوهٔ تقسیم سهم، سود و زیان و سازوکار تصمیم‌گیری را با توافق واقعی مقایسه کنید؛ این‌ها در چارچوب ماده ۱۰ قانون مدنی توافقی و نافذند.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "شرط عدم رقابت",
      bodyFa:
        "دامنه و مدت شرط عدم رقابت را دقیق بخوانید؛ شرطی که بیش از حد گسترده باشد می‌تواند در عمل فعالیت شما را محدود کند.",
      sourceNameFa: "قانون مدنی — ماده ۱۰ (اصل آزادی قراردادی)",
      status: "reviewed",
    },
    {
      titleFa: "ساختار حقوقی شرکت",
      bodyFa:
        "این توافقنامه جایگزین اساس‌نامه و تشریفات ثبت شرکت نیست؛ ساختار حقوقی شرکت باید جداگانه و با مشاور حقوقی تنظیم شود.",
      sourceNameFa: LEGALIR_POLICY_SOURCE,
      status: "reviewed",
    },
  ],

  employment: [
    {
      titleFa: "ساعات کار و اضافه‌کاری",
      bodyFa:
        "ساعات کار در شبانه‌روز نباید از هشت ساعت و در هفته از چهل‌وچهار ساعت بیشتر باشد؛ اگر اضافه‌کاری پیش‌بینی شده، شرایط پرداخت آن را بخوانید.",
      sourceNameFa: "قانون کار — ماده ۵۱",
      status: "reviewed",
    },
    {
      titleFa: "حق‌السعی و مزایا",
      bodyFa:
        "حق‌السعی، مزایا و زمان پرداخت را با توافق واقعی مقایسه کنید؛ حق‌السعی در برابر کار انجام‌شده یکی از دو تعهد اصلی قرارداد کار است.",
      sourceNameFa: "قانون کار — ماده ۷",
      status: "reviewed",
    },
    {
      titleFa: "بیمهٔ تأمین اجتماعی",
      bodyFa:
        "کارفرما مسئول پرداخت حق بیمهٔ سهم خود و بیمه‌شده است. پیش از امضا بدانید بیمه از چه زمانی آغاز می‌شود و سهم کارگر چگونه کسر می‌شود.",
      sourceNameFa: "قانون تأمین اجتماعی — ماده ۳۹",
      status: "reviewed",
    },
    {
      titleFa: "پایان قرارداد و حق سنوات",
      bodyFa:
        "شرایط خاتمهٔ قرارداد، حق سنوات و مزایای پایان کار از موضوعات حساس قرارداد کار است؛ مقررات آمرهٔ قانون کار ممکن است بر توافق طرفین مقدم باشد.",
      sourceNameFa: "در انتظار تعیین منبع بازبینی‌شده",
      status: "pending",
    },
  ],
};

/**
 * The seed tips for a type, materialised as printable rows. Used when no
 * reviewed record has been stored yet; the stored rows always win.
 */
export function seedPreSignTips(typeId: ContractTypeId): ContractPreSignTip[] {
  const seeds = PRE_SIGN_TIPS_SEED[typeId] ?? [];
  return seeds.map((seed, index) => ({
    id: `tip-seed-${typeId}-${index + 1}`,
    contractType: typeId,
    order: index + 1,
    titleFa: seed.titleFa,
    bodyFa: seed.bodyFa,
    sourceNameFa: seed.sourceNameFa,
    contentVersion: 1,
    status: seed.status,
    reviewedAt: null,
    reviewedBy: null,
    reviewedByLabelFa: null,
    createdAt: "",
    updatedAt: "",
  }));
}

// ------------------------------------------------------------
// Resolver
// ------------------------------------------------------------

/**
 * The catalogued citations for a contract type's clause, if any.
 *
 * `catalog` defaults to the reviewed seed; the runtime passes the merged
 * catalog from `legal-review-db.ts` so a stored, versioned record wins.
 */
export function catalogCitationsForClause(
  typeId: ContractTypeId,
  clauseId: string,
  catalog: LegalBasisCatalog = LEGAL_BASIS_SEED
): ContractLegalCitation[] {
  const entries = catalog[typeId]?.[clauseId];
  if (!entries || entries.length === 0) return [];
  // Only genuinely catalogued entries reach here — a provision is never
  // synthesised, so this list is the whole truth for the clause.
  return entries.map((e) => ({ ...e }));
}

/**
 * Build the NON-BINDING legal-basis annex for a contract version from its
 * rendered clauses. Clauses with no reviewed citation are omitted from the
 * citation list and FLAGGED for legal review instead — they are never
 * presented as definitively grounded.
 */
export function buildLegalBasisReport(
  contract: PropertyContract,
  rendered: RenderedContract,
  catalog: LegalBasisCatalog = LEGAL_BASIS_SEED
): ContractLegalBasisReport {
  const sections: ContractLegalBasisSection[] = [];
  const flaggedClauses: ContractLegalBasisReport["flaggedClauses"] = [];
  let citedClauseCount = 0;
  let uncitedClauseCount = 0;
  let hasPendingCitations = false;

  for (const clause of rendered.clauses) {
    const citations = catalogCitationsForClause(contract.type, clause.id, catalog);
    if (citations.length === 0) {
      uncitedClauseCount += 1;
      flaggedClauses.push({ clauseId: clause.id, clauseHeadingFa: clause.headingFa });
      continue;
    }
    if (citations.some((c) => c.status !== "reviewed")) hasPendingCitations = true;
    if (citations.some((c) => c.status === "reviewed")) citedClauseCount += 1;
    sections.push({ clauseId: clause.id, clauseHeadingFa: clause.headingFa, citations });
  }

  return {
    disclaimerFa: CONTRACT_LEGAL_BASIS_DISCLAIMER_FA,
    citedClauseCount,
    uncitedClauseCount,
    sections,
    hasPendingCitations,
    flaggedClauses,
  };
}

/**
 * The clause ids this type catalogues. Exposed read-only so a test can
 * assert that every catalogued id is one `renderContract` actually emits —
 * a catalogued-but-unreachable key is a silent coverage hole.
 */
export function cataloguedClauseIds(
  typeId: ContractTypeId,
  catalog: LegalBasisCatalog = LEGAL_BASIS_SEED
): string[] {
  return Object.keys(catalog[typeId] ?? {});
}

/** True when the contract type carries at least one catalogued citation. */
export function hasLegalBasis(
  typeId: ContractTypeId,
  catalog: LegalBasisCatalog = LEGAL_BASIS_SEED
): boolean {
  const entries = catalog[typeId];
  return !!entries && Object.values(entries).some((list) => list.length > 0);
}

const CITATION_STATUS_FA: Record<ContractLegalCitationStatus, string> = {
  reviewed: "بازبینی‌شده",
  pending: "در انتظار بررسی حقوقی",
  needs_revision: "نیازمند اصلاح حقوقی",
};

/**
 * Flatten the annex into lines for the PDF/.docx renderers, which only
 * accept plain text. The disclaimer leads the block so a printed copy
 * always carries the "not binding" framing.
 *
 * §7 — every line names its source and content version, and a clause with
 * no reviewed citation is listed under an explicit «for legal review»
 * heading rather than silently omitted.
 */
export function legalBasisReportLines(report: ContractLegalBasisReport): string[] {
  if (report.sections.length === 0 && report.flaggedClauses.length === 0) return [];
  const lines: string[] = [report.disclaimerFa];
  for (const section of report.sections) {
    for (const c of section.citations) {
      const sourceFa = c.sourceNameFa ?? c.lawTitleFa;
      const versionFa = c.contentVersion ? ` — نسخهٔ محتوا ${c.contentVersion}` : "";
      lines.push(
        `${section.clauseHeadingFa} — ${c.articleFa} (${sourceFa})؛ ${c.noteFa} [${CITATION_STATUS_FA[c.status]}${versionFa}]`
      );
    }
  }
  if (report.flaggedClauses.length > 0) {
    lines.push(
      "بندهای زیر هنوز استناد حقوقی بازبینی‌شده‌ای ندارند و برای بررسی حقوقی علامت‌گذاری شده‌اند؛ به‌عنوان متن قطعی ارائه نمی‌شوند:"
    );
    for (const clause of report.flaggedClauses) {
      lines.push(`• ${clause.clauseHeadingFa}`);
    }
  }
  return lines;
}

/**
 * §7 — the pre-sign tips as printable lines. The block opens with its own
 * disclaimer so no reader mistakes it for contract text, and each tip
 * carries its source, content version and review state verbatim.
 */
export function preSignTipsAnnexLines(tips: ContractPreSignTip[]): string[] {
  if (tips.length === 0) return [];
  const lines: string[] = [CONTRACT_PRE_SIGN_TIPS_DISCLAIMER_FA];
  for (const tip of tips) {
    lines.push(
      `${tip.titleFa} — ${tip.bodyFa} (منبع: ${tip.sourceNameFa} — نسخهٔ محتوا ${tip.contentVersion}) [${CITATION_STATUS_FA[tip.status]}]`
    );
  }
  return lines;
}
