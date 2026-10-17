// ============================================================
// LEGALIR — Legal path discovery: shared analysis contract
// ============================================================
// The single source of truth for the «از کجا شروع کنم؟» analysis: the
// structured shape the language model must return, the zod schema that
// validates it, and the DETERMINISTIC rules fallback used when the model
// is unavailable, switched off, times out, or returns an invalid shape.
//
// Two invariants hold no matter which path produced the analysis:
//   1. It never invents a service, a link, an article or a lawyer. Every
//      path is clamped to ONE of the real, capability-enabled intents the
//      app already knows how to reach; the human name is derived here, not
//      taken from the model.
//   2. It separates what the USER stated from what the SYSTEM inferred, so
//      the guess is always shown as a guess.
//
// This module is pure (no I/O, no provider). The provider call lives in
// `discovery-engine.ts`, which is server-only.
// ============================================================

import { z } from "zod";
import {
  LEGAL_CATEGORY_FA,
  type DiscoveryIntent,
  type LegalRequestDiscovery,
  type LegalRequestDiscoveryPath,
} from "@legalir/types";
import { cardsBySlugs } from "@/lib/calculators/catalog";
import {
  INTAKE_CATEGORY_CHOICES,
  INTENT_FLAG_KEY,
  describeDestination,
  needsClarification,
  normalizeFa,
  offeredIntents,
  resolveDestination,
  suggestCategorySlug,
  suggestIntents,
  type IntakeIntent,
} from "./start-request";

/** Analysis schema version. Bump when the persisted shape changes. */
export const DISCOVERY_VERSION = 1;

/** The most ranked paths ever kept. */
export const DISCOVERY_MAX_PATHS = 4;

/** Upper bound on the description we feed a provider (chars). */
export const DISCOVERY_MAX_INPUT_CHARS = 2000;

/** The intents the engine may recommend, in a stable order. */
export const DISCOVERY_INTENTS: readonly IntakeIntent[] = [
  "legal_question",
  "document_review",
  "draft_document",
  "calculation",
  "next_step",
  "lawyer",
];

// ---------------------------------------------------------------------------
// Presentation maps (deterministic, no legal claims)
// ---------------------------------------------------------------------------

/** Why a path fits — a ROUTING rationale, never legal advice. */
export const INTENT_WHY_FA: Record<IntakeIntent, string> = {
  legal_question:
    "شرح شما یک پرسش حقوقی است؛ در گفت‌وگو می‌توانی پاسخ مستند بگیری و پرسش‌های بعدی را ادامه دهی.",
  document_review:
    "نوشتهٔ شما به بررسی یک سند یا قرارداد اشاره دارد؛ تحلیل سند بندها و ریسک‌ها را نشان می‌دهد.",
  draft_document:
    "می‌خواهی سندی تنظیم یا ویرایش شود؛ پرسش‌نامهٔ تنظیم سند پیش‌نویس رسمی می‌سازد.",
  calculation:
    "در متن تو نشانهٔ یک محاسبهٔ حقوقی دیده می‌شود؛ محاسبه‌گر عدد را همراه با مبنای قانونی می‌دهد.",
  next_step:
    "به دنبال قدم بعدی هستی؛ فهرست درخواست‌ها و پرونده‌های بازت کارهای ناتمام را نشان می‌دهد.",
  lawyer:
    "موضوع به کمک یک وکیل انسانی اشاره دارد؛ می‌توانی درخواست مشاوره ثبت کنی و وکیل انتخاب کنی.",
};

/** A short, honest goal statement used by the rules fallback. */
export const INTENT_GOAL_FA: Record<IntakeIntent, string> = {
  legal_question: "فهمیدن حق و تکلیف خود و گرفتن پاسخ مستند به یک پرسش حقوقی",
  document_review: "فهمیدن بندها و ریسک‌های یک سند یا قرارداد پیش از اقدام",
  draft_document: "تهیه یا اصلاح یک سند حقوقی آمادهٔ استفاده",
  calculation: "برآورد عددی یک موضوع حقوقی (خسارت، دیه، هزینه، حقوق)",
  next_step: "پیدا کردن قدم بعدی برای پیگیری کارهای باز",
  lawyer: "گرفتن بررسی تخصصی از یک وکیل انسانی",
};

/** The Persian title of an intent's destination (clamped to a real one). */
export function discoveryPathTitle(intent: IntakeIntent, hasDocument: boolean, text: string): string {
  // resolveDestination only consults documentId for truthiness on review.
  const dest = resolveDestination({
    intent,
    text,
    documentId: hasDocument ? "__attached__" : null,
    category: null,
  });
  if (dest.kind === "calculator" && dest.slug) {
    const card = cardsBySlugs([dest.slug])[0];
    if (card) return card.title;
  }
  return describeDestination(dest).titleFa;
}

/** The Persian label of an intent (mirrors the intake chips). */
export function discoveryIntentLabel(intent: IntakeIntent): string {
  const labels: Record<IntakeIntent, string> = {
    legal_question: "پاسخ به پرسش حقوقی",
    document_review: "بررسی سند یا قرارداد",
    draft_document: "تنظیم یا ویرایش سند",
    calculation: "محاسبهٔ حقوقی",
    next_step: "پیدا کردن قدم بعدی",
    lawyer: "کمک از وکیل",
  };
  return labels[intent];
}

export function discoveryCategoryLabel(slug: string | null): string | null {
  if (!slug) return null;
  return LEGAL_CATEGORY_FA[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

/** Strip control chars, collapse whitespace and clamp length. */
export function cleanText(input: string, max: number): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A category slug clamped to the supported set, or the fallback. */
function clampCategory(raw: string | null | undefined, fallback: string | null): string | null {
  if (!raw) return fallback;
  return INTAKE_CATEGORY_CHOICES.includes(raw) ? raw : fallback;
}

/** A one-line restatement of the description (first sentence, clamped). */
export function summarizeDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstSentence = clean.split(/[.!؟?\n]/)[0]?.trim() || clean;
  return firstSentence.length > max ? `${firstSentence.slice(0, max - 1)}…` : firstSentence;
}

// ---------------------------------------------------------------------------
// The model's output contract (validated)
// ---------------------------------------------------------------------------

const intentEnum = z.enum([
  "legal_question",
  "document_review",
  "draft_document",
  "calculation",
  "next_step",
  "lawyer",
]);

/**
 * The EXACT shape the model must return. Kept deliberately narrow: the model
 * may only pick an intent from the enum and attach a short rationale; it may
 * never name a service, a URL or an article. Anything else is discarded by
 * `buildAnalysisFromModel`.
 */
export const discoveryModelOutputSchema = z.object({
  summaryFa: z.string().min(1).max(600),
  goalFa: z.string().max(400).optional(),
  inferredCategory: z.string().max(60).nullable().optional(),
  paths: z
    .array(
      z.object({
        intent: intentEnum,
        rationaleFa: z.string().max(400).optional(),
        confidence: z.number().min(0).max(100).nullable().optional(),
      })
    )
    .min(1)
    .max(6),
  ambiguitiesFa: z.array(z.string().max(240)).max(4).optional(),
  needsLawyer: z.boolean().optional(),
  confidence: z.number().min(0).max(100).nullable().optional(),
});

export type DiscoveryModelOutput = z.infer<typeof discoveryModelOutputSchema>;

/**
 * The persisted discovery record (mirror of `LegalRequestDiscovery`). The API
 * validates the client-supplied object with THIS before storing it, so a
 * tampered or malformed payload can never be written onto a request.
 */
export const discoveryRecordSchema = z.object({
  description: z.string().max(DISCOVERY_MAX_INPUT_CHARS),
  explicitIntent: intentEnum.nullable(),
  explicitCategory: z.string().max(60).nullable(),
  inferredCategory: z.string().max(60).nullable(),
  summaryFa: z.string().max(600),
  goalFa: z.string().max(400),
  ambiguitiesFa: z.array(z.string().max(240)).max(4),
  confidence: z.number().min(0).max(100).nullable(),
  needsLawyer: z.boolean(),
  hasDocument: z.boolean(),
  paths: z
    .array(
      z.object({
        intent: intentEnum,
        titleFa: z.string().max(200),
        rationaleFa: z.string().max(400),
        primary: z.boolean().optional(),
        selected: z.boolean(),
      })
    )
    .max(DISCOVERY_MAX_PATHS),
  source: z.enum(["ai", "rules"]),
  version: z.number().int().min(1),
});

/** The user-supplied facts the analysis runs on. */
export interface DiscoveryInput {
  text: string;
  intent: IntakeIntent | null;
  category: string | null;
  hasDocument: boolean;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build the ranked, labelled path list from an ordered intent list. */
function buildPathList(
  intents: readonly IntakeIntent[],
  input: DiscoveryInput,
  rationales: Partial<Record<IntakeIntent, string>> = {},
  primary: IntakeIntent | null = null
): LegalRequestDiscoveryPath[] {
  return intents.slice(0, DISCOVERY_MAX_PATHS).map((intent) => ({
    intent,
    titleFa: discoveryPathTitle(intent, input.hasDocument, input.text),
    rationaleFa: rationales[intent] ?? INTENT_WHY_FA[intent],
    // `primary` marks the recommended first path; `selected` is set only when
    // the user actually commits to a path (see `markSelectedPath`).
    selected: false,
    ...(intent === primary ? { primary: true } : {}),
  }));
}

/** Apply the user's chosen intent to a path list (for the persisted record). */
export function markSelectedPath(
  paths: readonly LegalRequestDiscoveryPath[],
  chosen: IntakeIntent
): LegalRequestDiscoveryPath[] {
  return paths.map((p) => ({ ...p, selected: p.intent === chosen }));
}

// ---------------------------------------------------------------------------
// Deterministic rules fallback
// ---------------------------------------------------------------------------

/**
 * A valid analysis derived purely from the deterministic keyword tables — no
 * model, no fabrication. Used when the provider is off/unavailable/invalid so
 * the user's request is NEVER lost and a real set of paths is always offered.
 * `confidence` is left null on purpose: rules do not estimate confidence.
 */
export function buildRulesAnalysis(
  input: DiscoveryInput,
  isEnabled: (flagKey: string) => boolean
): LegalRequestDiscovery {
  const suggestions = suggestIntents(input.text, { hasDocument: input.hasDocument });
  const intents = offeredIntents(input.intent, suggestions, isEnabled);

  const inferredCategory = suggestCategorySlug(input.text) ?? input.category ?? null;
  const top = intents[0] ?? null;

  const ambiguities: string[] = [];
  if (needsClarification(input.text)) {
    ambiguities.push("شرح کوتاه است؛ اگر می‌توانی جزئیات بیشتر (زمان، طرف مقابل، سند) بنویس.");
  }
  if (!input.category && !suggestCategorySlug(input.text)) {
    ambiguities.push("حوزهٔ حقوقی به روشنی مشخص نشد؛ می‌توانی حوزه را خودت انتخاب کنی.");
  }

  return {
    description: input.text.trim(),
    explicitIntent: input.intent,
    explicitCategory: input.category,
    inferredCategory,
    summaryFa: summarizeDescription(input.text) || input.text.trim().slice(0, 160),
    goalFa: top ? INTENT_GOAL_FA[top] : "",
    ambiguitiesFa: ambiguities.slice(0, 4),
    confidence: null,
    needsLawyer: top === "lawyer",
    hasDocument: input.hasDocument,
    paths: buildPathList(intents, input, {}, top),
    source: "rules",
    version: DISCOVERY_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Model output → validated analysis
// ---------------------------------------------------------------------------

/**
 * Turn an untrusted model payload into a valid analysis, or `null` when the
 * payload is unusable (in which case the caller falls back to the rules).
 *
 * Every returned path is clamped to a real, capability-enabled intent; a model
 * intent that is switched off or unknown is simply dropped rather than shown.
 */
export function buildAnalysisFromModel(
  raw: unknown,
  input: DiscoveryInput,
  isEnabled: (flagKey: string) => boolean
): LegalRequestDiscovery | null {
  const parsed = discoveryModelOutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const out = parsed.data;

  // Explicit user pick first, then the model's ordering, then the ever-present
  // legal question; de-duplicated and clamped to enabled capabilities.
  const ordered: IntakeIntent[] = [];
  const push = (i: IntakeIntent | null | undefined) => {
    if (i && DISCOVERY_INTENTS.includes(i) && !ordered.includes(i)) ordered.push(i);
  };
  push(input.intent);
  for (const p of out.paths) push(p.intent as IntakeIntent);
  push("legal_question");

  const intents = ordered
    .filter((i) => isEnabled(INTENT_FLAG_KEY[i]))
    .slice(0, DISCOVERY_MAX_PATHS);
  if (intents.length === 0) return null;

  const rationales: Partial<Record<IntakeIntent, string>> = {};
  for (const p of out.paths) {
    const intent = p.intent as IntakeIntent;
    const rationale = cleanText(p.rationaleFa ?? "", 300);
    if (rationale && !rationales[intent]) rationales[intent] = rationale;
  }

  // The recommended primary: the user's explicit pick when it survived the
  // capability clamp, otherwise the model's top surviving path.
  const primary = input.intent && intents.includes(input.intent) ? input.intent : intents[0]!;

  const inferredCategory = clampCategory(
    out.inferredCategory,
    suggestCategorySlug(input.text) ?? input.category ?? null
  );

  return {
    description: input.text.trim(),
    explicitIntent: input.intent,
    explicitCategory: input.category,
    inferredCategory,
    summaryFa: cleanText(out.summaryFa, 300),
    goalFa: cleanText(out.goalFa ?? "", 200),
    ambiguitiesFa: (out.ambiguitiesFa ?? [])
      .map((s) => cleanText(s, 200))
      .filter(Boolean)
      .slice(0, 4),
    confidence: typeof out.confidence === "number" ? Math.round(out.confidence) : null,
    needsLawyer: out.needsLawyer ?? intents.includes("lawyer"),
    hasDocument: input.hasDocument,
    paths: buildPathList(intents, input, rationales, primary),
    source: "ai",
    version: DISCOVERY_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const DISCOVERY_SYSTEM_PROMPT = [
  "تو دستیار مسیریابی «LEGALIR» هستی؛ کارت فقط این است که بفهمی کاربر به کدام سرویسِ موجودِ همین محصول نیاز دارد.",
  "قواعد الزامی:",
  "۱) فقط از میان مسیرهای مجاز زیر یکی یا چند مسیر را انتخاب کن و هیچ سرویس، لینک، آدرس، نام وکیل یا مادهٔ قانونی از خود نساز.",
  "۲) خروجی را فقط به شکل JSON معتبر و دقیقاً با همین کلیدها بنویس و هیچ متن اضافه‌ای بیرون JSON نگذار.",
  "۳) متن‌ها فارسی، کوتاه و غیرقطعی باشند؛ درباره نتیجه دعوا، اعتبار سند یا موفقیت تضمین نده.",
  "۴) اگر اطلاعات کافی نیست، در ambiguitiesFa حداکثر ۳ پرسشِ کوتاه و واقعاً لازم بنویس.",
  `۵) مسیرهای مجاز: ${DISCOVERY_INTENTS.join(", ")}.`,
  `۶) دسته‌های مجاز: ${INTAKE_CATEGORY_CHOICES.join(", ")}.`,
  "ساختار JSON:",
  '{"summaryFa":"...","goalFa":"...","inferredCategory":"<یکی از دسته‌ها یا null>","paths":[{"intent":"<یکی از مسیرهای مجاز>","rationaleFa":"...","confidence":0}],"ambiguitiesFa":["..."],"needsLawyer":false,"confidence":0}',
].join("\n");

/** The user turn fed to the model. Truncated, and never includes the file. */
export function buildDiscoveryPrompt(input: DiscoveryInput): string {
  const description = input.text.slice(0, DISCOVERY_MAX_INPUT_CHARS).trim();
  const lines = [
    `شرح کاربر: «${description}»`,
    `نوع کمکی که کاربر انتخاب کرده: ${input.intent ? discoveryIntentLabel(input.intent) : "انتخاب نشده"}`,
    `حوزهٔ اعلام‌شدهٔ کاربر: ${input.category ? discoveryCategoryLabel(input.category) ?? input.category : "انتخاب نشده"}`,
    `سند پیوست: ${input.hasDocument ? "دارد (فقط وجودش را در نظر بگیر؛ محتوایش بررسی نمی‌شود)" : "ندارد"}`,
    "اکنون تنها JSON معتبر را برگردان.",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

/**
 * Pull the first JSON object out of a model completion — tolerating fenced
 * code blocks and surrounding prose. Returns null when nothing parses; the
 * caller then falls back to the rules.
 */
export function parseDiscoveryJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Title + persistence helpers
// ---------------------------------------------------------------------------

/** A stable title for the discovery draft, from the user's own words. */
export function discoveryTitle(text: string): string {
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const clean = first.replace(/\s+/g, " ").trim();
  if (!clean) return "مسیر پیشنهادی حقوقی";
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

/** Clamp an intent to the discovery enum, or null. */
export function asDiscoveryIntent(value: unknown): IntakeIntent | null {
  return typeof value === "string" && DISCOVERY_INTENTS.includes(value as IntakeIntent)
    ? (value as IntakeIntent)
    : null;
}

/** Whether the text is too thin to route on (mirrors the intake hook). */
export { needsClarification, normalizeFa };

/** Re-exported for convenience so callers import from a single place. */
export type { DiscoveryIntent, LegalRequestDiscovery, LegalRequestDiscoveryPath };
