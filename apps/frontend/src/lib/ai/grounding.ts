// ============================================================
// LEGALIR — Legal Source Grounding (server-only)
// ============================================================
// Retrieves relevant verified legal sources from the existing
// Legal Library for RAG grounding of AI responses. Never invents
// citations — if no reliable source is found, an empty list is
// returned so the gateway can refrain from fabricating source
// numbers (§24 of the upgrade spec).
// ============================================================

import type {
  LegalContentType,
  SourceType,
  V1LegalLibraryListItem,
  V1LegalSourceDetail,
  V1Reference,
  VerificationStatus,
} from "@legalir/types";
import { readLegalLibrary } from "@/lib/legal-library-db";
import { LAW_SOURCES } from "@/lib/law-catalog";
import { retrieveCorpus } from "@/lib/legal-corpus";
import { getDemoDocument } from "@/lib/demo-seed";

// Map Legal Library content types to the Phase-8 reference source types.
const SOURCE_TYPE_MAP: Partial<Record<LegalContentType, SourceType>> = {
  LAW_ARTICLE: "law",
  REGULATION: "regulation",
  UNIFICATION_RULING: "precedent",
  JUDICIAL_DECISION: "precedent",
  LEGAL_GUIDE: "opinion",
};

export interface GroundedSource {
  id: string;
  title: string;
  sourceType: string;
  sourceTypeFa: string;
  authority: string;
  summary: string;
  excerpt: string | null;
  verificationStatus: string;
}

export interface GroundingResult {
  sources: GroundedSource[];
  /** Content block injected into the system prompt. */
  contextBlock: string;
  /** References that can be persisted alongside the assistant message. */
  references: V1Reference[];
}

// ============================================================
// Keyword extraction for Persian legal queries
// ============================================================

// Simple stopword + tokenizer for Persian legal text. Purely lexical
// (no ML) so it is deterministic, testable and dependency-free.
const STOPWORDS = new Set([
  "و", "در", "از", "به", "با", "برای", "که", "این", "آن", "را", "است",
  "هست", "می", "شود", "باشد", "من", "تو", "او", "ما", "شما", "چگونه",
  "چه", "چیست", "لطفا", "لطفاً", "کند", "کنم", "دارم", "هستم", "آیا",
]);

function tokenize(text: string): string[] {
  return text
    .replace(/[۰-۹0-9]+/g, " ")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreSource(
  item: V1LegalLibraryListItem,
  detail: V1LegalSourceDetail | undefined,
  tokens: string[]
): number {
  let score = 0;
  const haystack = [
    item.title,
    item.summary,
    item.authority,
    detail?.body ?? "",
    detail?.simpleExplanation ?? "",
    detail?.keyPoints?.join(" ") ?? "",
    detail?.lawName ?? "",
    detail?.articleNumber ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const token of tokens) {
    if (haystack.includes(token.toLowerCase())) score += 2;
  }

  const VERIFIED: VerificationStatus[] = [
    "VERIFIED_OFFICIAL",
    "VERIFIED_SECONDARY",
    "DEMO_VERIFIED",
  ];
  if (VERIFIED.includes(item.verificationStatus)) score += 1;
  if (item.popular) score += 1;

  return score;
}

// ============================================================
// Retrieval
// ============================================================

export function retrieveGroundedSources(
  query: string,
  maxSources = 3
): GroundingResult {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return { sources: [], contextBlock: "", references: [] };
  }

  const table = readLegalLibrary();
  const details = table.details ?? {};

  const scored = table.items
    .map((item) => ({
      item,
      detail: details[item.id],
      score: scoreSource(item, details[item.id], tokens),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources);

  // --- Official law catalog matches (16 files) ---
  // Each law contributes its own source/reference with a real article
  // locator and verbatim-ish quote, so the chat «مستندات»/«ارجاعات»
  // tabs surface the matching provision directly.
  const lawMatches = LAW_SOURCES.map((def) => {
    const haystack = [
      def.title,
      def.summary,
      def.articleSection,
      def.excerpt,
      def.keywords.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token.toLowerCase())) score += 3;
    }
    return { def, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources);

  const sources: GroundedSource[] = scored.map(({ item, detail }) => ({
    id: item.id,
    title: item.title,
    sourceType: item.sourceType,
    sourceTypeFa: item.sourceTypeFa,
    authority: item.authority,
    summary: item.summary,
    excerpt: detail?.body ?? detail?.simpleExplanation ?? item.summary,
    verificationStatus: item.verificationStatus,
  }));

  const contextBlock = sources.length
    ? [
        "منابع حقوقی مرتبط (برای استناد در پاسخ):",
        ...sources.map(
          (s, i) =>
            `${i + 1}. ${s.title} — ${s.authority} (${s.sourceTypeFa})\n${s.excerpt ?? ""}`
        ),
      ].join("\n\n")
    : "";

  const references: V1Reference[] = sources.map((s) => {
    const mappedType = SOURCE_TYPE_MAP[s.sourceType as LegalContentType];
    return {
      id: crypto.randomUUID(),
      conversationId: "", // filled by the gateway
      messageId: "", // filled by the gateway
      sourceId: s.id,
      locator: "",
      quote: (s.excerpt ?? s.summary).slice(0, 160),
      section: "منابع مرتبط",
      ...(mappedType ? { sourceType: mappedType } : {}),
      sourceTypeFa: s.sourceTypeFa,
    };
  });

  // Merge law matches into the returned sources/references. Laws are
  // appended after library sources; the gateway keeps the order.
  for (const { def } of lawMatches) {
    sources.push({
      id: def.id,
      title: def.title,
      sourceType: def.sourceType,
      sourceTypeFa: def.sourceTypeFa,
      authority: def.publicationAuthority,
      summary: def.summary,
      excerpt: def.excerpt,
      verificationStatus: "VERIFIED_OFFICIAL",
    });
    references.push({
      id: crypto.randomUUID(),
      conversationId: "",
      messageId: "",
      sourceId: def.id,
      locator: def.articleSection,
      quote: def.excerpt.slice(0, 160),
      section: "منابع مرتبط",
      sourceType: def.sourceType,
      sourceTypeFa: def.sourceTypeFa,
    });
  }

  // --- Local legal knowledge corpus (ingested .data/legal-corpus.json) ---
  // The corpus is the actually-indexed artifact of the 16 official law
  // files (SHA-256 fingerprinted, chunked, inverted-indexed). Hits that
  // map to an already-surfaced catalog law (via lawId) are skipped; hits
  // for files with no catalog entry (e.g. the .docx variants) surface as
  // their own citable source so the ingested corpus is never dropped.
  const existingIds = new Set(sources.map((s) => s.id));
  for (const hit of retrieveCorpus(query, maxSources)) {
    const sourceId = hit.source.lawId ?? hit.source.id;
    if (existingIds.has(sourceId)) continue;
    existingIds.add(sourceId);

    const sourceType = SOURCE_TYPE_MAP[hit.source.sourceType] ?? "law";
    const excerpt = hit.excerpt || hit.source.excerpt || null;

    sources.push({
      id: sourceId,
      title: hit.source.title,
      sourceType,
      sourceTypeFa: hit.source.sourceTypeFa,
      authority: hit.source.authority,
      summary: hit.source.summary,
      excerpt,
      verificationStatus: hit.source.verificationStatus,
    });
    references.push({
      id: crypto.randomUUID(),
      conversationId: "",
      messageId: "",
      sourceId,
      locator: hit.locator ?? hit.source.articleSection ?? "",
      quote: (excerpt ?? hit.source.summary).slice(0, 160),
      section: "منابع مرتبط",
      sourceType,
      sourceTypeFa: hit.source.sourceTypeFa,
    });
  }

  return { sources, contextBlock, references };
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
