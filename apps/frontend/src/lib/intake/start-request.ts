// ============================================================
// LEGALIR — «شروع درخواست حقوقی» routing logic
// ============================================================
// The client-side brain behind the smart intake panel on /new.
//
// It is deliberately DETERMINISTIC: it never calls an AI, never
// fabricates a legal answer, and never invents a route. Its only
// job is to take what the user typed (plus an optional attached
// document) and propose one of the REAL, already-existing LEGALIR
// destinations the app already has:
//
//   legal question  → /chat           (create a conversation)
//   document review → /documents[/upload]  (the analysis surface)
//   draft a document→ /contracts/new  (the drafting questionnaire)
//   calculation     → /calculators/[slug]
//   next step       → /consultations  (the case/request hub)
//   human lawyer    → /consultations/new (the real consultation wizard)
//
// Nothing here creates a parallel chat, form, tool or data model.
// Everything is a pointer at an existing flow. The keyword matching
// is a *suggestion* only — the user always confirms before we move.
// ============================================================

import type { ServiceType } from "@/lib/ai/service-context";
import { LEGAL_CATEGORY_FA } from "@legalir/types";

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

export type IntakeIntent =
  | "legal_question"
  | "document_review"
  | "draft_document"
  | "calculation"
  | "next_step"
  | "lawyer";

export interface IntakeIntentOption {
  id: IntakeIntent;
  titleFa: string;
  /** One line under the chip — what picking this actually does. */
  descriptionFa: string;
}

/**
 * The short, plain-language choices shown to the user. Each one only
 * decides the *destination*; it never spins up a subsystem.
 */
export const INTAKE_INTENT_OPTIONS: readonly IntakeIntentOption[] = [
  {
    id: "legal_question",
    titleFa: "پاسخ به پرسش حقوقی",
    descriptionFa: "شرح مسئله و دریافت تحلیل حقوقی مستند در گفت‌وگو",
  },
  {
    id: "document_review",
    titleFa: "بررسی سند یا قرارداد",
    descriptionFa: "بارگذاری یا انتخاب سند و دریافت تحلیل ریسک و بندها",
  },
  {
    id: "draft_document",
    titleFa: "تنظیم یا ویرایش سند",
    descriptionFa: "ساخت پیش‌نویس قرارداد، اظهارنامه، لایحه یا دادخواست",
  },
  {
    id: "calculation",
    titleFa: "محاسبهٔ حقوقی",
    descriptionFa: "محاسبهٔ هزینه، خسارت، دیه، مهریه و حقوق و دستمزد",
  },
  {
    id: "next_step",
    titleFa: "پیدا کردن قدم بعدی",
    descriptionFa: "مرور درخواست‌ها و پرونده‌های باز و ادامهٔ کار قبلی",
  },
  {
    id: "lawyer",
    titleFa: "کمک از وکیل",
    descriptionFa: "ثبت درخواست مشاوره و انتخاب وکیل مناسب",
  },
];

/** The categories offered as a progressive clarifying question. */
export const INTAKE_CATEGORY_CHOICES: readonly string[] = [
  "family",
  "contract",
  "real_estate",
  "labor",
  "checks",
  "criminal",
  "tax",
  "companies",
  "other",
];

// ---------------------------------------------------------------------------
// Text normalisation (Persian)
// ---------------------------------------------------------------------------

/**
 * Lower-cases, strips the zero-width non-joiner and unifies the Arabic
 * yeh/kaf with their Persian forms, so a keyword written either way
 * matches. Keeps the text otherwise untouched — we never rewrite what
 * the user actually submitted.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(/\u200c/g, " ") // ZWNJ → space
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Keyword tables (deterministic, ordered by specificity)
// ---------------------------------------------------------------------------

/** Calculator slugs (must exist in the calculator registry). */
const CALCULATOR_KEYWORDS: readonly { slug: string; keywords: readonly string[] }[] = [
  { slug: "dowry", keywords: ["مهریه"] },
  { slug: "diyeh", keywords: ["دیه"] },
  { slug: "court-fee", keywords: ["هزینه دادرسی", "دادرسی", "تمبر قضایی"] },
  { slug: "delayed-payment", keywords: ["خسارت تاخیر", "تاخیر تادیه", "خسارت دیرکرد"] },
  { slug: "severance", keywords: ["سنوات", "حق سنوات"] },
  { slug: "bonus", keywords: ["عیدی", "پاداش پایان سال"] },
  { slug: "leave-buyback", keywords: ["بازخرید مرخصی", "مرخصی استفاده"] },
  { slug: "salary", keywords: ["حقوق خالص", "حقوق ناخالص", "مالیات حقوق", "بیمه حقوق"] },
];

/** Keyword → legal-category slug (LEGAL_CATEGORY_FA keys). */
const CATEGORY_KEYWORDS: readonly { slug: string; keywords: readonly string[] }[] = [
  { slug: "family", keywords: ["خانواده", "مهریه", "طلاق", "نفقه", "حضانت", "زناشویی", "ازدواج"] },
  { slug: "checks", keywords: ["چک", "سفته", "برات"] },
  { slug: "real_estate", keywords: ["ملک", "ملکی", "املاک", "اجاره", "مالک", "مستاجر", "مستأجر", "ودیعه", "رهن", "مسکن"] },
  { slug: "labor", keywords: ["کارگر", "کارفرما", "اخراج", "بیمه کار", "سنوات", "مرخصی", "دستمزد"] },
  { slug: "criminal", keywords: ["کیفری", "جرم", "شکایت کیفری", "دادسرا", "کلاهبرداری", "سرقت"] },
  { slug: "tax", keywords: ["مالیات", "دارایی", "مالیاتی"] },
  { slug: "companies", keywords: ["شرکت", "سهامدار", "هیئت مدیره", "ثبت شرکت"] },
  { slug: "immigration", keywords: ["مهاجرت", "ویزا", "اقامت"] },
  { slug: "cyber", keywords: ["رایانه", "اینترنت", "هک", "رمزارز", "رمز ارز"] },
  { slug: "commerce", keywords: ["تجارت", "بازرگانی", "تعهد تجاری"] },
  { slug: "contract", keywords: ["قرارداد", "تعهدنامه", "مشارکت‌نامه", "پیمان"] },
];

/** Keyword → intent, used only to ORDER the suggestions. */
const INTENT_KEYWORDS: readonly { intent: IntakeIntent; keywords: readonly string[] }[] = [
  { intent: "lawyer", keywords: ["وکیل", "وکالت", "مشاوره با وکیل", "طرح دعوا"] },
  { intent: "calculation", keywords: ["محاسبه"] },
  { intent: "document_review", keywords: ["بررسی سند", "بررسی قرارداد", "ریسک", "بند", "بندها", "شروط", "اشکال قرارداد"] },
  { intent: "draft_document", keywords: ["تنظیم", "بنویس", "بساز", "پیش‌نویس", "اظهارنامه", "دادخواست", "لایحه", "شکایت نامه"] },
  { intent: "next_step", keywords: ["قدم بعدی", "مرحله بعد", "چه کار کنم", "پیگیری", "تایم لاین"] },
];

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => containsTerm(haystack, n));
}

/** How many Persian/Latin letters a term carries, ignoring spaces. */
function letterCount(term: string): number {
  return term.replace(/[^\u0600-\u06FFA-Za-z]/g, "").length;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `haystack` (already normalised) contains `term`.
 *
 * SUBSTRING matching is unsafe for short Persian keywords: «دیه» is a
 * substring of «تادیه» (delayed payment) and «ملک» of «ملکی». So a term
 * with fewer than four letters must sit on a word boundary; longer terms
 * are distinctive enough to match as a substring (which also lets
 * «ریسک» match «پرریسک»). Both inputs are normalised first.
 */
function containsTerm(haystack: string, term: string): boolean {
  const t = normalizeFa(term).trim();
  if (!t) return false;
  if (letterCount(t) >= 4) return haystack.includes(t);
  const boundary = "[^\\u0600-\\u06FFA-Za-z]";
  const re = new RegExp(`(?:^|${boundary})${escapeRe(t)}(?:${boundary}|$)`);
  return re.test(haystack);
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/**
 * The calculator whose formula the text points at, or null when the
 * text gives no clear signal. Only ever returns a slug that exists.
 */
export function suggestCalculatorSlug(text: string): string | null {
  const hay = normalizeFa(text);
  for (const { slug, keywords } of CALCULATOR_KEYWORDS) {
    if (matchesAny(hay, keywords)) return slug;
  }
  return null;
}

/** The most likely legal-category slug for the text, or null. */
export function suggestCategorySlug(text: string): string | null {
  const hay = normalizeFa(text);
  for (const { slug, keywords } of CATEGORY_KEYWORDS) {
    if (matchesAny(hay, keywords)) return slug;
  }
  return null;
}

/**
 * Ordered route suggestions for the text, most-likely first. Always ends
 * with `legal_question` so there is never an empty suggestion list. An
 * attached document nudges toward document review.
 *
 * This is a *hint list*, not a verdict — the user confirms the route.
 */
export function suggestIntents(
  text: string,
  options: { hasDocument?: boolean } = {}
): IntakeIntent[] {
  const hay = normalizeFa(text);
  const ordered: IntakeIntent[] = [];
  const push = (i: IntakeIntent) => {
    if (!ordered.includes(i)) ordered.push(i);
  };

  // A short description that reads as a calculation is usually a
  // calculation; keep that signal high.
  if (suggestCalculatorSlug(text)) push("calculation");

  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (matchesAny(hay, keywords)) push(intent);
  }

  if (options.hasDocument) push("document_review");

  push("legal_question");
  return ordered.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Title derivation
// ---------------------------------------------------------------------------

/** A short, user-authored title for the new conversation/request. */
export function deriveTitle(text: string, fallback = "درخواست حقوقی"): string {
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const clean = first.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

// ---------------------------------------------------------------------------
// Destination resolution
// ---------------------------------------------------------------------------

export interface IntakeInput {
  intent: IntakeIntent;
  /** The user's own description. */
  text: string;
  /** The id of an already-uploaded document, if the user attached one. */
  documentId: string | null;
  /** A category the user picked on the clarifying step, if any. */
  category: string | null;
}

/** Where a confirmed request should go — a pointer, never a payload. */
export type IntakeDestination =
  | { kind: "chat"; serviceType: ServiceType }
  | { kind: "document"; documentId: string }
  | { kind: "document_upload" }
  | { kind: "contracts_new" }
  | { kind: "calculator"; slug: string | null }
  | { kind: "consultations_list" }
  | { kind: "consultation_wizard"; category: string | null };

/**
 * Map a confirmed intent to a real destination.
 *
 * `document_review` with a document opens that document's analysis; with
 * none, it opens the upload flow (which also lets the user pick an
 * existing document). A chat destination carries the description and any
 * attachment via the chat surface's existing `ask` / attachment params.
 */
export function resolveDestination(input: IntakeInput): IntakeDestination {
  const { intent, text, documentId, category } = input;

  switch (intent) {
    case "legal_question":
      return { kind: "chat", serviceType: "legal_consultation" };
    case "document_review":
      return documentId
        ? { kind: "document", documentId }
        : { kind: "document_upload" };
    case "draft_document":
      return { kind: "contracts_new" };
    case "calculation":
      return { kind: "calculator", slug: suggestCalculatorSlug(text) };
    case "next_step":
      return { kind: "consultations_list" };
    case "lawyer":
      return { kind: "consultation_wizard", category: category ?? suggestCategorySlug(text) };
  }
}

export interface DestinationSummary {
  /** The real page the user will land on. */
  titleFa: string;
  /** What will happen there, in plain language. */
  detailFa: string;
  /** True only when we have evidence this step spends allowance. */
  usesDailyQuota: boolean;
}

/** A human summary of a destination for the confirm step. */
export function describeDestination(dest: IntakeDestination): DestinationSummary {
  switch (dest.kind) {
    case "chat":
      return {
        titleFa: "گفت‌وگوی حقوقی",
        detailFa:
          "یک گفتگوی جدید ساخته می‌شود و شرح شما در کادر پرسش قرار می‌گیرد؛ خودتان تصمیم می‌گیرید آن را بفرستید.",
        usesDailyQuota: true,
      };
    case "document":
      return {
        titleFa: "تحلیل سند",
        detailFa: "سند پیوست‌شده باز می‌شود تا نتیجهٔ تحلیل و بندهای ریسک را ببینید.",
        usesDailyQuota: false,
      };
    case "document_upload":
      return {
        titleFa: "افزودن و تحلیل سند",
        detailFa: "سند را بارگذاری یا از اسناد موجود انتخاب می‌کنید و تحلیل آن آغاز می‌شود.",
        usesDailyQuota: false,
      };
    case "contracts_new":
      return {
        titleFa: "تنظیم سند",
        detailFa: "با پاسخ به پرسش‌نامهٔ کوتاه، پیش‌نویس قرارداد یا سند ساخته می‌شود.",
        usesDailyQuota: false,
      };
    case "calculator":
      return {
        titleFa: "محاسبه‌گر حقوقی",
        detailFa: "محاسبه‌گرها رایگان‌اند و نتیجه بلافاصله با مستندات نمایش داده می‌شود.",
        usesDailyQuota: false,
      };
    case "consultations_list":
      return {
        titleFa: "درخواست‌ها و پرونده‌ها",
        detailFa: "فهرست درخواست‌های شما باز می‌شود تا کارهای باز را ببینید و ادامه دهید.",
        usesDailyQuota: false,
      };
    case "consultation_wizard":
      return {
        titleFa: "درخواست مشاوره با وکیل",
        detailFa:
          "فرم درخواست مشاوره با شرح شما پیش‌پر می‌شود؛ انتخاب وکیل و ثبت نهایی در همان صفحه انجام می‌گیرد.",
        usesDailyQuota: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Carrying data forward
// ---------------------------------------------------------------------------

/**
 * The chat surface already reads `?ask=` as a one-shot composer prefill
 * (it seeds the box, never auto-sends) and `?attachedDocument*` as a
 * pre-selected attachment tray. We reuse exactly those params so the
 * user's text and file travel to the destination without re-entry.
 */
export function chatQuery(input: {
  serviceType: ServiceType;
  text: string;
  document?: { id: string; name: string; mime: string; sizeBytes: number } | null;
}): string {
  const params = new URLSearchParams();
  params.set("service", input.serviceType);
  const ask = input.text.trim();
  if (ask) params.set("ask", ask);
  if (input.document) {
    params.set("attachedDocumentId", input.document.id);
    params.set("attachedDocumentName", input.document.name);
    params.set("attachedDocumentMime", input.document.mime);
    params.set("attachedDocumentSize", String(input.document.sizeBytes));
  }
  return params.toString();
}

/** The calculator list URL, or a specific calculator when we have one. */
export function calculatorHref(slug: string | null): string {
  return slug ? `/calculators/${slug}` : "/calculators";
}

// ---------------------------------------------------------------------------
// Consultation draft prefill
// ---------------------------------------------------------------------------

/**
 * The localStorage key the consultation wizard (`ConsultationWizard`)
 * reads on mount. Kept here as the single source of truth so the intake
 * panel and the wizard can never drift apart.
 */
export const CONSULTATION_DRAFT_KEY = "legalir-consultation-draft";

export interface ConsultationDraftSeed {
  step: number;
  category: string;
  title: string;
  description: string;
  urgency: string;
  lawyerId: string | null;
  attachmentIds: string[];
}

/**
 * Build the draft object the wizard expects. The wizard merges this over
 * its own EMPTY_DRAFT, so the shape is intentionally complete.
 */
export function buildConsultationDraft(input: {
  text: string;
  category: string | null;
  attachmentIds?: string[];
}): ConsultationDraftSeed {
  return {
    step: 0,
    category: input.category ?? "",
    title: deriveTitle(input.text, "درخواست مشاوره"),
    description: input.text.trim(),
    urgency: "normal",
    lawyerId: null,
    attachmentIds: input.attachmentIds ?? [],
  };
}

/**
 * Persist a prefill for the consultation wizard. Wrapped in try/catch so
 * a disabled/full storage never blocks navigation — the user simply
 * fills the form by hand.
 */
export function writeConsultationDraft(seed: ConsultationDraftSeed): void {
  try {
    localStorage.setItem(CONSULTATION_DRAFT_KEY, JSON.stringify(seed));
  } catch {
    // Storage unavailable — the wizard still opens, just empty.
  }
}

/** Whether the description is too thin to route on its own. */
export function needsClarification(text: string): boolean {
  return normalizeFa(text).trim().replace(/\s+/g, " ").length < 15;
}

/** Persian label for a category slug, falling back to the raw slug. */
export function categoryLabel(slug: string | null): string | null {
  if (!slug) return null;
  return LEGAL_CATEGORY_FA[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// /Suggest_law — the page that continues the /new flow
// ---------------------------------------------------------------------------
// The smart intake on /new no longer jumps straight to a destination. It
// hands the user's request to `/Suggest_law`, which shows how LEGALIR
// understood the request and which REAL, currently-enabled routes it can
// offer. The hand-off reuses the SAME safe, architecture-consistent
// mechanism the consultation wizard already uses for its draft: a guarded
// localStorage write, never a query string (so a description or a document
// name can never end up in the URL / history / server logs).

/** The route the «دریافت مسیر پیشنهادی» action now lands on. */
export const SUGGEST_LAW_PATH = "/Suggest_law";

/** localStorage key for the /Suggest_law hand-off. */
export const SUGGEST_LAW_DRAFT_KEY = "legalir-suggest-law-draft";

export interface SuggestLawDraftDocument {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

/**
 * The request carried from /new to /Suggest_law. Kept intentionally small:
 * only what the panel actually collected and the platform supports.
 */
export interface SuggestLawDraft {
  /** The user's own description. */
  text: string;
  /** The user's explicit help-type pick, or null when they let us infer. */
  intent: IntakeIntent | null;
  /** The user's explicit legal-area pick from the clarifying step, or null. */
  category: string | null;
  /** An already-uploaded document (id into the real document store), or null. */
  document: SuggestLawDraftDocument | null;
  /** ISO timestamp of the write, so a stale draft can be told apart. */
  savedAt: string;
}

export function buildSuggestLawDraft(input: {
  text: string;
  intent?: IntakeIntent | null;
  category?: string | null;
  document?: SuggestLawDraftDocument | null;
}): SuggestLawDraft {
  return {
    text: input.text.trim(),
    intent: input.intent ?? null,
    category: input.category ?? null,
    document: input.document ?? null,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Persist the hand-off. Wrapped in try/catch so a disabled/full storage never
 * blocks navigation — the caller falls back to a clear message rather than
 * silently dropping the request.
 * @returns true when the write succeeded.
 */
export function writeSuggestLawDraft(draft: SuggestLawDraft): boolean {
  try {
    localStorage.setItem(SUGGEST_LAW_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the hand-off, validating the shape so a corrupted/foreign value is
 * treated as absent rather than crashing the page. Returns null when there is
 * no usable draft.
 */
export function readSuggestLawDraft(): SuggestLawDraft | null {
  try {
    const raw = localStorage.getItem(SUGGEST_LAW_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SuggestLawDraft>;
    if (typeof parsed.text !== "string") return null;
    const doc = parsed.document;
    const document: SuggestLawDraftDocument | null =
      doc && typeof doc.id === "string" && typeof doc.name === "string"
        ? {
            id: doc.id,
            name: doc.name,
            mime: typeof doc.mime === "string" ? doc.mime : "",
            sizeBytes: typeof doc.sizeBytes === "number" ? doc.sizeBytes : 0,
          }
        : null;
    return {
      text: parsed.text,
      intent: (parsed.intent as IntakeIntent | null) ?? null,
      category: typeof parsed.category === "string" ? parsed.category : null,
      document,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Drop the hand-off once it has been consumed (or the user leaves the flow). */
export function clearSuggestLawDraft(): void {
  try {
    localStorage.removeItem(SUGGEST_LAW_DRAFT_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

// ---------------------------------------------------------------------------
// Capability gating — never offer a service the platform has switched off
// ---------------------------------------------------------------------------
// Each intent is backed by a REAL feature flag (mirrored from
// `lib/admin/flags`). /Suggest_law only offers an intent whose flag evaluates
// enabled for the caller, so an operator disabling a service in
// /admin/services removes it here too — no fabricated, dead destination.

/** The feature-flag key that gates each intent's destination. */
export const INTENT_FLAG_KEY: Record<IntakeIntent, string> = {
  legal_question: "ai_consultation",
  document_review: "document_analysis",
  draft_document: "contract_generation",
  calculation: "calculators",
  next_step: "case_management",
  lawyer: "lawyer_referral",
};

/**
 * The intents to OFFER, in order (the explicit pick first, then the hints),
 * filtered to those whose backing capability is enabled. A disabled service is
 * dropped entirely rather than shown as a dead button. Fails closed: when the
 * capability set is unknown, the list is empty and the caller shows a
 * loading/unavailable state.
 */
export function offeredIntents(
  explicit: IntakeIntent | null,
  suggestions: readonly IntakeIntent[],
  isEnabled: (flagKey: string) => boolean
): IntakeIntent[] {
  const ordered: IntakeIntent[] = [];
  const push = (i: IntakeIntent) => {
    if (!ordered.includes(i)) ordered.push(i);
  };
  if (explicit) push(explicit);
  for (const s of suggestions) push(s);
  push("legal_question"); // a legal question is always a candidate
  return ordered.filter((i) => isEnabled(INTENT_FLAG_KEY[i]));
}

/**
 * The real href for a confirmed destination, carrying the request through the
 * SAME params the destination already understands. `carry` supplies the text
 * and attachment the chat composer and the wizard already accept.
 */
export function destinationHref(
  dest: IntakeDestination,
  carry?: { text?: string; document?: SuggestLawDraftDocument | null }
): string {
  switch (dest.kind) {
    case "chat":
      return `/chat/new?${chatQuery({
        serviceType: dest.serviceType,
        text: carry?.text ?? "",
        document: carry?.document ?? null,
      })}`;
    case "document":
      return `/documents/${dest.documentId}`;
    case "document_upload":
      return "/documents/upload";
    case "contracts_new":
      return "/contracts/new";
    case "calculator":
      return calculatorHref(dest.slug);
    case "consultations_list":
      return "/consultations";
    case "consultation_wizard":
      // The wizard reads its own localStorage draft (written by the caller).
      return "/consultations/new";
  }
}
