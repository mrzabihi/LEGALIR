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
  ContractTypeId,
  PropertyContract,
} from "@legalir/types";
import { CONTRACT_LEGAL_BASIS_DISCLAIMER_FA } from "@legalir/types";
import type { RenderedContract } from "./template";

interface CatalogCitation {
  articleFa: string;
  lawTitleFa: string;
  noteFa: string;
  status: ContractLegalCitationStatus;
  /** Points at the official law catalog entry when one exists. */
  lawSourceId: string | null;
}

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

const LEGAL_BASIS_CATALOG: Partial<Record<ContractTypeId, Record<string, CatalogCitation[]>>> = {
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
// Resolver
// ------------------------------------------------------------

/** The catalogued citations for a contract type's clause, if any. */
export function catalogCitationsForClause(
  typeId: ContractTypeId,
  clauseId: string
): ContractLegalCitation[] {
  const entries = LEGAL_BASIS_CATALOG[typeId]?.[clauseId];
  if (!entries || entries.length === 0) return [];
  // Only genuinely catalogued entries reach here — a provision is never
  // synthesised, so this list is the whole truth for the clause.
  return entries.map((e) => ({ ...e }));
}

/**
 * Build the NON-BINDING legal-basis annex for a contract version from its
 * rendered clauses. Clauses with no reviewed citation are omitted; their
 * count is reported so the reader knows the annex is deliberately partial.
 */
export function buildLegalBasisReport(
  contract: PropertyContract,
  rendered: RenderedContract
): ContractLegalBasisReport {
  const sections: ContractLegalBasisSection[] = [];
  let citedClauseCount = 0;
  let uncitedClauseCount = 0;
  let hasPendingCitations = false;

  for (const clause of rendered.clauses) {
    const citations = catalogCitationsForClause(contract.type, clause.id);
    if (citations.length === 0) {
      uncitedClauseCount += 1;
      continue;
    }
    if (citations.some((c) => c.status === "pending")) hasPendingCitations = true;
    if (citations.some((c) => c.status === "reviewed")) citedClauseCount += 1;
    sections.push({ clauseId: clause.id, clauseHeadingFa: clause.headingFa, citations });
  }

  return {
    disclaimerFa: CONTRACT_LEGAL_BASIS_DISCLAIMER_FA,
    citedClauseCount,
    uncitedClauseCount,
    sections,
    hasPendingCitations,
  };
}

/**
 * The clause ids this type catalogues. Exposed read-only so a test can
 * assert that every catalogued id is one `renderContract` actually emits —
 * a catalogued-but-unreachable key is a silent coverage hole.
 */
export function cataloguedClauseIds(typeId: ContractTypeId): string[] {
  return Object.keys(LEGAL_BASIS_CATALOG[typeId] ?? {});
}

/** True when the contract type carries at least one catalogued citation. */
export function hasLegalBasis(typeId: ContractTypeId): boolean {
  const catalog = LEGAL_BASIS_CATALOG[typeId];
  return !!catalog && Object.values(catalog).some((entries) => entries.length > 0);
}

/**
 * Flatten the annex into lines for the PDF/.docx renderers, which only
 * accept plain text. The disclaimer leads the block so a printed copy
 * always carries the "not binding" framing.
 */
export function legalBasisReportLines(report: ContractLegalBasisReport): string[] {
  if (report.sections.length === 0) return [];
  const lines: string[] = [report.disclaimerFa];
  for (const section of report.sections) {
    for (const c of section.citations) {
      const statusFa = c.status === "reviewed" ? "بازبینی‌شده" : "در انتظار بازبینی";
      lines.push(`${section.clauseHeadingFa} — ${c.articleFa} (${c.lawTitleFa})؛ ${c.noteFa} [${statusFa}]`);
    }
  }
  return lines;
}
