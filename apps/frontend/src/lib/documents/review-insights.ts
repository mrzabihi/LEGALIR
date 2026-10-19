// ============================================================
// LEGALIR — Review insights (pure derivation for the review result)
// ============================================================
// The review surface answers six questions about a REAL analysis:
//
//   • what is this document about?          → `detectSubject`
//   • how is it structured?                 → `detectSections`
//   • which parts need attention, in what
//     order?                                → `buildAttentionList`
//   • what is NOT covered / not known?      → `reviewLimitations`
//   • what should we ask the user next?     → `buildFollowUpQuestions`
//   • what real LEGALIR service helps next? → `deriveNextSteps`
//
// HONESTY RULES:
//   • every value here is derived from data the pipeline already
//     produced (the report, the findings, the extracted text, the
//     document name) — nothing is invented;
//   • an unknown subject stays unknown (`null`) and the UI says so;
//   • a follow-up question exists only for a REAL gap (an
//     `incomplete_info` finding or a report with no citations), and a
//     question already answered is never asked again;
//   • a next step is offered only when a real template / lawyer
//     category / calculator genuinely matches, and each carries the
//     reason it was chosen;
//   • this module is React-free and side-effect-free.
// ============================================================

import type {
  DocumentFinding,
  LegalCategory,
  RiskLevel,
  RiskReport,
} from "@legalir/types";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { listCalculatorCards } from "@/lib/calculators/catalog";
import { normalizePersian, toPersianNumber } from "@/lib/persian-utils";

// ============================================================
// Matching primitives
// ============================================================

/**
 * The one normalisation used by every match below. `normalizePersian`
 * already folds Arabic letters/digits and drops ZWNJ, so a keyword is
 * always normalised with the same function as the text it is matched
 * against.
 */
function norm(text: string): string {
  return normalizePersian(text);
}

/** Everything the pipeline told us, as one searchable string. */
export function buildHaystack(input: {
  documentName?: string | null;
  report?: RiskReport | null;
  extractedText?: string | null;
}): string {
  const { documentName, report, extractedText } = input;
  return norm(
    [
      documentName ?? "",
      report?.summary ?? "",
      ...(report?.findings ?? []).map((finding) =>
        [finding.title, finding.reason, finding.locator, finding.recommendation].join(
          " "
        )
      ),
      extractedText ?? "",
    ].join(" ")
  );
}

// ============================================================
// Subject
// ============================================================

export interface SubjectMatch {
  typeId: string;
  titleFa: string;
  /** The real keywords found in the document, for the UI to show. */
  evidenceFa: string[];
  score: number;
}

/**
 * Real contract keywords per implemented template. These are narrower
 * than the registry's search keywords on purpose: the review should say
 * «this is a lease» only when the document actually talks like a lease,
 * not because the word «قرارداد» appears somewhere.
 */
const SUBJECT_RULES: { typeId: string; keywords: string[] }[] = [
  {
    typeId: "property_rent",
    keywords: [
      "اجاره",
      "رهن",
      "مستاجر",
      "موجر",
      "ودیعه",
      "اجاره بها",
      "اجاره نامه",
    ],
  },
  {
    typeId: "commercial_rent",
    keywords: ["اجاره تجاری", "مغازه", "دفتر کار", "پروانه کسب", "ملک تجاری"],
  },
  {
    typeId: "property_sale",
    keywords: [
      "مبایعه نامه",
      "خرید و فروش ملک",
      "خرید خانه",
      "آپارتمان",
      "مسکونی",
    ],
  },
  {
    typeId: "commercial_sale",
    keywords: ["ملک تجاری", "مغازه", "دفتر کار", "خرید و فروش تجاری"],
  },
  {
    typeId: "vehicle_sale",
    keywords: ["خودرو", "ماشین", "اتومبیل", "پلاک", "شاسی", "قولنامه"],
  },
  {
    typeId: "employment",
    keywords: [
      "استخدام",
      "قرارداد کار",
      "کارگر",
      "کارمند",
      "مزد",
      "حقوق و مزایا",
      "مرخصی",
      "پایان کار",
    ],
  },
  {
    typeId: "nda",
    keywords: ["محرمانگی", "محرمانه", "nda", "عدم افشا", "رازداری", "افشای اطلاعات"],
  },
  {
    typeId: "saas",
    keywords: ["saas", "نرم افزار به عنوان سرویس", "اشتراک نرم افزار", "لایسنس نرم افزار"],
  },
  {
    typeId: "cloud_iaas",
    keywords: ["iaas", "زیرساخت به عنوان سرویس", "سرور ابری", "ماشین مجازی"],
  },
  {
    typeId: "cloud_paas",
    keywords: ["paas", "بستر به عنوان سرویس", "پلتفرم ابری"],
  },
  {
    typeId: "cloud_baas",
    keywords: ["baas", "بک اند به عنوان سرویس", "پایگاه داده به عنوان سرویس"],
  },
  {
    typeId: "debt",
    keywords: ["قرض", "وام", "بدهی", "طلب", "بازپرداخت", "ضامن", "سفته", "چک"],
  },
  {
    typeId: "freelance",
    keywords: ["فریلنس", "فریلنسری", "پیمانکاری", "خدمات فنی", "دستمزد"],
  },
  {
    typeId: "startup",
    keywords: ["استارتاپ", "استارت آپ", "مشارکت", "سهام", "سرمایه گذار", "vesting"],
  },
];

let templateTitles: Map<string, string> | null = null;

function titleForTemplate(typeId: string): string | null {
  if (!templateTitles) {
    templateTitles = new Map(
      implementedContractDefinitions().map((def) => [def.id as string, def.typeFa])
    );
  }
  return templateTitles.get(typeId) ?? null;
}

/**
 * The document's subject, as the best-matching implemented template.
 * Returns `null` when no rule matched — the caller must show «مشخص
 * نشد» rather than a guess. The score decides the winner; ties keep
 * the earlier, more specific rule in the table.
 */
export function detectSubject(haystack: string): SubjectMatch | null {
  const text = norm(haystack);
  if (!text) return null;

  let best: SubjectMatch | null = null;

  for (const rule of SUBJECT_RULES) {
    const hits: string[] = [];
    const seen = new Set<string>();
    for (const keyword of rule.keywords) {
      const key = norm(keyword);
      if (!key || seen.has(key)) continue;
      if (text.includes(key)) {
        seen.add(key);
        hits.push(keyword);
      }
    }
    if (hits.length === 0) continue;

    const titleFa = titleForTemplate(rule.typeId);
    if (!titleFa) continue;

    const candidate: SubjectMatch = {
      typeId: rule.typeId,
      titleFa,
      evidenceFa: hits.slice(0, 4),
      score: hits.length,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

// ============================================================
// Structure
// ============================================================

export interface SectionHint {
  /** The heading as it appears in the document, trimmed for display. */
  labelFa: string;
}

const HEADING_WORDS = ["بند", "ماده", "فصل", "بخش", "تبصره", "ضمیمه", "پیوست", "مقدمه"];

/**
 * Headings the extraction can SEE. This is not a legal interpretation:
 * it is a list of the lines that look like headings in the real
 * extracted text (a numbered clause, an enumerated item, or a short
 * line ending in a colon). When the text has no such line, the list is
 * empty and the UI says the structure could not be read.
 */
export function detectSections(extractedText: string | null | undefined): SectionHint[] {
  if (!extractedText) return [];
  const out: SectionHint[] = [];
  const seen = new Set<string>();

  for (const rawLine of extractedText.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    if (!line || line.length > 90) continue;

    const startsWithHeadingWord = HEADING_WORDS.some((word) => line.startsWith(word));
    const startsWithNumber = /^[0-9\u06F0-\u06F9]+\s*[.)\-–—:]/.test(line);
    const shortLabel = line.length <= 60 && line.endsWith(":");

    if (!startsWithHeadingWord && !startsWithNumber && !shortLabel) continue;

    const key = norm(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ labelFa: line.replace(/[:.]$/, "") });
    if (out.length >= 8) break;
  }

  return out;
}

// ============================================================
// Attention list
// ============================================================

const SEVERITY_RANK: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface AttentionItem {
  findingId: string;
  titleFa: string;
  locatorFa: string;
  severity: RiskLevel;
}

/**
 * The findings a reader should look at first: ordered by real severity,
 * with located findings ahead of unlocated ones at the same severity.
 * This re-orders the pipeline's own findings — it never adds a new
 * judgement.
 */
export function buildAttentionList(
  findings: DocumentFinding[],
  limit = 5
): AttentionItem[] {
  return [...findings]
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      const aLocated = a.locator.trim() ? 0 : 1;
      const bLocated = b.locator.trim() ? 0 : 1;
      return aLocated - bLocated;
    })
    .slice(0, limit)
    .map((finding) => ({
      findingId: finding.id,
      titleFa: finding.title,
      locatorFa: finding.locator.trim() || "محل نامشخص",
      severity: finding.severity,
    }));
}

// ============================================================
// Limitations — what the analysis could NOT establish
// ============================================================

export interface ReviewLimitations {
  /** No finding carries a legal citation. */
  noSources: boolean;
  /** The pipeline's own confidence is low. */
  lowConfidence: boolean;
  /** No readable text was extracted from the document. */
  noExtractedText: boolean;
  /** Findings the pipeline itself marked as missing information. */
  incompleteCount: number;
  /** True when there is no report at all. */
  noReport: boolean;
}

export function reviewLimitations(input: {
  report?: RiskReport | null;
  extractedText?: string | null;
}): ReviewLimitations {
  const { report, extractedText } = input;
  const findings = report?.findings ?? [];
  return {
    noSources: findings.length > 0 && findings.every((f) => !f.citation),
    lowConfidence:
      typeof report?.confidence === "number" ? report.confidence < 50 : false,
    noExtractedText: !extractedText || extractedText.trim().length === 0,
    incompleteCount: findings.filter((f) => f.kind === "incomplete_info").length,
    noReport: !report || findings.length === 0,
  };
}

// ============================================================
// Follow-up questions
// ============================================================

export interface FollowUpQuestion {
  id: string;
  promptFa: string;
  /** Why this is being asked, taken from the finding itself. */
  contextFa: string | null;
  /** The finding this question fills a gap in, when there is one. */
  findingId: string | null;
}

/**
 * Questions worth asking the user, derived ONLY from real gaps:
 *   • a finding the pipeline classified as `incomplete_info`;
 *   • a report with findings but no legal citation at all.
 *
 * Questions already answered (`answeredIds`) are never asked again,
 * and there are at most four, so the user is never interrogated.
 */
export function buildFollowUpQuestions(
  report: RiskReport | null | undefined,
  answeredIds: ReadonlySet<string> = new Set()
): FollowUpQuestion[] {
  if (!report) return [];
  const questions: FollowUpQuestion[] = [];
  const add = (question: FollowUpQuestion) => {
    if (answeredIds.has(question.id)) return;
    if (questions.some((q) => q.id === question.id)) return;
    questions.push(question);
  };

  for (const finding of report.findings) {
    if (finding.kind !== "incomplete_info") continue;
    add({
      id: `finding:${finding.id}`,
      promptFa: `مقدار یا توضیح دقیق «${finding.title}» در این قرارداد چیست؟`,
      contextFa:
        [finding.locator.trim() ? `محل: ${finding.locator.trim()}` : "", finding.reason]
          .filter(Boolean)
          .join(" — ") || null,
      findingId: finding.id,
    });
    if (questions.length >= 4) return questions;
  }

  const noSources =
    report.findings.length > 0 && report.findings.every((f) => !f.citation);
  if (noSources) {
    add({
      id: "sources:governing-law",
      promptFa: "این قرارداد تابع کدام قانون یا حوزهٔ قضایی است؟",
      contextFa:
        "تحلیل فعلی به منبع قانونی مشخصی ارجاع نداده است؛ با مشخص‌کردن قانون حاکم، بررسی دقیق‌تر می‌شود.",
      findingId: null,
    });
  }

  return questions.slice(0, 4);
}

export interface FollowUpAnswer {
  promptFa: string;
  answerFa: string;
}

/**
 * The single message sent to the document chat after the questions.
 * It contains only the user's own answers and explicitly tells the
 * model not to repeat the questions it has now answered.
 */
export function composeFollowUpMessage(answers: FollowUpAnswer[]): string {
  const answered = answers.filter((a) => a.answerFa.trim().length > 0);
  if (answered.length === 0) return "";

  const lines = answered.map(
    (a, index) => `${toPersianNumber(index + 1)}. ${a.promptFa} → ${a.answerFa.trim()}`
  );

  return [
    "این اطلاعات تکمیلی را در بررسی همین سند لحاظ کن:",
    ...lines,
    "پرسش‌هایی که پاسخ داده شده‌اند را دوباره تکرار نکن. اگر برای بخشی هنوز اطلاعات یا منبع کافی نیست، صریح بگو.",
  ].join("\n");
}

// ============================================================
// Next steps (§5)
// ============================================================

export interface DraftSuggestion {
  typeId: string;
  titleFa: string;
  reasonFa: string;
}

export interface CalculatorSuggestion {
  slug: string;
  titleFa: string;
  reasonFa: string;
}

export interface NextStepModel {
  subject: SubjectMatch | null;
  draft: DraftSuggestion | null;
  lawyerCategory: LegalCategory | null;
  calculator: CalculatorSuggestion | null;
}

/** The marketplace category a given template naturally belongs to. */
const LAWYER_CATEGORY: Record<string, LegalCategory> = {
  property_rent: "real_estate",
  property_sale: "real_estate",
  commercial_rent: "real_estate",
  commercial_sale: "real_estate",
  vehicle_sale: "contract",
  employment: "labor",
  debt: "contract",
  freelance: "contract",
  nda: "contract",
  saas: "contract",
  cloud_iaas: "contract",
  cloud_paas: "contract",
  cloud_baas: "contract",
  startup: "companies",
};

interface CalculatorSignal {
  slug: string;
  keywords: string[];
  /** The subject must be one of these, when the signal is subject-driven. */
  requiresSubject?: string[];
  reasonFa: string;
}

/**
 * A calculator is suggested only when the document itself carries the
 * thing it computes. Order is priority: an explicit penalty clause is
 * a stronger signal than the contract's general type.
 */
const CALCULATOR_SIGNALS: CalculatorSignal[] = [
  {
    slug: "contract-penalty",
    keywords: ["وجه التزام", "جریمه", "خسارت قراردادی"],
    reasonFa: "در متن یا یافته‌های سند به وجه التزام یا جریمه اشاره شده است.",
  },
  {
    slug: "delayed-payment",
    keywords: ["تاخیر", "دیرکرد", "تادیه", "خسارت تاخیر"],
    reasonFa: "در سند از تأخیر یا دیرکرد پرداخت صحبت شده است.",
  },
  {
    slug: "rent-converter",
    keywords: [],
    requiresSubject: ["property_rent", "commercial_rent"],
    reasonFa: "این سند دربارهٔ ودیعه و اجاره است و مبالغ آن قابل تبدیل است.",
  },
  {
    slug: "property-transaction-cost",
    keywords: [],
    requiresSubject: ["property_sale", "commercial_sale"],
    reasonFa: "این سند خرید و فروش ملک است و هزینه‌های معامله در آن مطرح می‌شود.",
  },
  {
    slug: "salary-benefits",
    keywords: [],
    requiresSubject: ["employment"],
    reasonFa: "این سند قرارداد کار است و حقوق و مزایا در آن تعیین می‌شود.",
  },
];

function pickCalculator(
  subject: SubjectMatch | null,
  haystack: string
): CalculatorSuggestion | null {
  const cards = new Map(listCalculatorCards().map((card) => [card.slug, card] as const));

  for (const signal of CALCULATOR_SIGNALS) {
    if (signal.requiresSubject) {
      if (!subject || !signal.requiresSubject.includes(subject.typeId)) continue;
    }
    if (signal.keywords.length > 0) {
      const matched = signal.keywords.some((keyword) =>
        haystack.includes(norm(keyword))
      );
      if (!matched) continue;
    }

    const card = cards.get(signal.slug);
    if (!card || !card.available) continue;

    return {
      slug: card.slug,
      titleFa: card.title,
      reasonFa: signal.reasonFa,
    };
  }

  return null;
}

/**
 * The whole next-step model. Each branch is independent: a missing
 * template match removes the draft suggestion, a subject with no
 * marketplace category removes the lawyer suggestion, and a document
 * with no matching calculator removes only that card.
 */
export function deriveNextSteps(input: {
  documentName?: string | null;
  report?: RiskReport | null;
  extractedText?: string | null;
}): NextStepModel {
  const haystack = buildHaystack(input);
  const subject = detectSubject(haystack);

  const draft = subject
    ? {
        typeId: subject.typeId,
        titleFa: subject.titleFa,
        reasonFa: `موضوع این سند با قالب «${subject.titleFa}» در لیگالیر هم‌خوان است؛ می‌توانید پیش‌نویس آن را بسازید.`,
      }
    : null;

  return {
    subject,
    draft,
    lawyerCategory: subject ? LAWYER_CATEGORY[subject.typeId] ?? null : null,
    calculator: pickCalculator(subject, haystack),
  };
}
