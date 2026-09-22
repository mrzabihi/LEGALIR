// ============================================================
// LEGALIR — Legal Source Grounding (server-only)
// ============================================================
// Retrieves relevant verified legal sources for RAG grounding of AI
// responses. The ranking, authority weighting and provenance all live in
// `lib/knowledge/retriever.ts`; this module adapts the engine's hits to
// the shape the AI gateway consumes and builds the answer contract.
//
// Never invents citations — if no reliable source is found, an empty list
// is returned and the contract forbids citation (the no-citation rule).
// ============================================================

import type {
  AnswerContract,
  RetrievalHit,
  V1Reference,
} from "@legalir/types";
import { getDemoDocument } from "@/lib/demo-seed";
import { retrieveHybrid } from "@/lib/knowledge/retriever";
import { buildAnswerContract } from "@/lib/knowledge/answer-contract";

export interface GroundedSource {
  id: string;
  title: string;
  sourceType: string;
  sourceTypeFa: string;
  authority: string;
  summary: string;
  excerpt: string | null;
  verificationStatus: string;
  /** The authority tier of the source, e.g. «قانون». */
  tier: string;
  tierFa: string;
  /** Article/provision locator, e.g. «ماده ۲۳۰». */
  locator: string;
}

export interface GroundingResult {
  sources: GroundedSource[];
  /** Content block injected into the system prompt. */
  contextBlock: string;
  /** References that can be persisted alongside the assistant message. */
  references: V1Reference[];
  /** The answer contract — grounded flag, tiers and the no-citation rule. */
  contract: AnswerContract;
}

// ============================================================
// Retrieval — delegated to the hybrid knowledge engine
// ============================================================

export function retrieveGroundedSources(
  query: string,
  maxSources = 3
): GroundingResult {
  const { hits } = retrieveHybrid(query, maxSources);
  const contract = buildAnswerContract(hits);

  const sources: GroundedSource[] = hits.map((h: RetrievalHit) => ({
    id: h.id,
    title: h.title,
    sourceType: h.sourceType,
    sourceTypeFa: h.sourceTypeFa,
    authority: h.provenance.authority,
    summary: h.summary,
    excerpt: h.excerpt,
    verificationStatus: h.provenance.verificationStatus,
    tier: h.provenance.tier,
    tierFa: h.provenance.tierFa,
    locator: h.provenance.locator,
  }));

  const references: V1Reference[] = hits.map((h: RetrievalHit) => ({
    id: crypto.randomUUID(),
    conversationId: "", // filled by the gateway
    messageId: "", // filled by the gateway
    sourceId: h.id,
    locator: h.provenance.locator,
    quote: (h.excerpt ?? h.summary).slice(0, 160),
    section: "منابع مرتبط",
    sourceType: h.sourceType,
    sourceTypeFa: h.sourceTypeFa,
  }));

  return {
    sources,
    contextBlock: contract.contextBlock,
    references,
    contract,
  };
}

// ============================================================
// Document grounding — chat about a specific uploaded document
// ============================================================
// When the user opens a chat scoped to one of their documents
// (e.g. a rental contract), inject the document's extracted text
// and risk findings into the system prompt so the AI can answer
// questions about that exact document. Returns an empty block if
// the document is missing or not ready.
// ============================================================

export interface DocumentContext {
  /** Persian label for the document type, e.g. "قرارداد اجاره". */
  kindLabel: string;
  /** The document's extracted text (may be truncated). */
  text: string;
  /** Risk findings formatted for the prompt. */
  findingsBlock: string;
  /** Full context block injected into the system prompt. */
  contextBlock: string;
}

export function retrieveDocumentContext(
  userId: string,
  documentId: string | undefined
): DocumentContext | null {
  if (!documentId) return null;
  const doc = getDemoDocument(userId, documentId);
  if (!doc || doc.status !== "ready") return null;

  const text = (doc.extractedText ?? "").trim();
  const findings = doc.report?.findings ?? [];

  const findingsBlock = findings.length
    ? [
        "ریسک‌های شناسایی‌شده در این سند:",
        ...findings.map(
          (f, i) =>
            `${i + 1}. [${f.severity}] ${f.title} (${f.locator})\n   دلیل: ${f.reason}\n   پیشنهاد: ${f.recommendation}`
        ),
      ].join("\n\n")
    : "ریسک خاصی در تحلیل اولیه شناسایی نشده است.";

  const contextBlock = [
    `سند کاربر: «${doc.name}»`,
    text ? `متن استخراج‌شده از سند:\n${text.slice(0, 4000)}` : "متن استخراج‌شده‌ای برای این سند موجود نیست.",
    findingsBlock,
    "هنگام پاسخ، صرفاً بر اساس محتوای همین سند و قوانین مرتبط پاسخ دهید. اگر اطلاعاتی در سند نیست، نگویید که هست.",
  ].join("\n\n");

  return {
    kindLabel: doc.name,
    text,
    findingsBlock,
    contextBlock,
  };
}
