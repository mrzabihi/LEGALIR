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

  return { sources, contextBlock, references };
}
