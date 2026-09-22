// ============================================================
// LEGALIR — Hybrid Retrieval Engine (server-only)
// ============================================================
// One retriever, three signals, fused into a single ranked list:
//
//   lexical      — how well the query tokens match the source text
//   authority    — the source's tier in the authority hierarchy
//   verification — how trustworthy the source is (official > demo)
//   popularity   — a small tie-breaker for frequently-used sources
//
// The three passes over the knowledge base (Legal Library, the official
// law catalog, the ingested corpus) are FUSED rather than concatenated:
// a source surfaced by more than one pass accumulates its lexical score,
// so a law that is both catalogued and ingested ranks above one that is
// only catalogued.
//
// Every hit carries its provenance — origin, tier, authority, locator,
// verification status and content hash — so the answer can be audited
// back to the exact provision it relied on.
//
// The retriever NEVER invents a source. If nothing matches, it returns
// an empty list and the answer contract forbids citation.
// ============================================================

import type {
  LegalContentType,
  RetrievalHit,
  SourceStatus,
  SourceType,
  VerificationStatus,
} from "@legalir/types";
import { readLegalLibrary } from "@/lib/legal-library-db";
import { LAW_SOURCES } from "@/lib/law-catalog";
import { retrieveCorpus } from "@/lib/legal-corpus";
import {
  statusWeight,
  tierForSource,
  tierLabelFa,
  tierRank,
  tierWeight,
  verificationWeight,
} from "./authority";

// ============================================================
// Persian tokenizer (lexical, dependency-free, deterministic)
// ============================================================

const STOPWORDS = new Set([
  "و", "در", "از", "به", "با", "برای", "که", "این", "آن", "را", "است",
  "هست", "می", "شود", "باشد", "من", "تو", "او", "ما", "شما", "چگونه",
  "چه", "چیست", "لطفا", "لطفاً", "کند", "کنم", "دارم", "هستم", "آیا",
]);

export function tokenizeQuery(text: string): string[] {
  return text
    .replace(/[۰-۹0-9]+/g, " ")
    // Arabic-block punctuation (، ؛ ؟ ٫ ٬ ٭ ۔) lives inside \u0600-\u06FF,
    // so it must be stripped explicitly before the general filter.
    .replace(/[\u060C\u061B\u061F\u066B\u066C\u066D\u06D4]/g, " ")
    .replace(/[^\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ============================================================
// Candidate accumulation
// ============================================================

interface Candidate {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceTypeFa: string;
  summary: string;
  excerpt: string | null;
  authority: string;
  locator: string;
  verificationStatus: VerificationStatus;
  status: SourceStatus;
  textHash: string | null;
  origin: RetrievalHit["provenance"]["origin"];
  lexical: number;
  popularity: number;
}

/** Map a Legal Library content type to a Phase-8 source type. */
const SOURCE_TYPE_MAP: Partial<Record<LegalContentType, SourceType>> = {
  LAW_ARTICLE: "law",
  REGULATION: "regulation",
  UNIFICATION_RULING: "precedent",
  JUDICIAL_DECISION: "precedent",
  LEGAL_GUIDE: "opinion",
};

/** Count how many query tokens appear in a haystack. */
function lexicalScore(haystack: string, tokens: string[]): number {
  const lower = haystack.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token.toLowerCase())) score += 1;
  }
  return score;
}

// ============================================================
// Retrieval
// ============================================================

export interface HybridRetrievalResult {
  hits: RetrievalHit[];
  /** The query tokens actually used (empty when the query was all stopwords). */
  tokens: string[];
}

/**
 * Retrieve the most relevant, most authoritative legal sources for a query.
 *
 * @param query      the user's question
 * @param maxSources the maximum number of hits to return
 */
export function retrieveHybrid(query: string, maxSources = 3): HybridRetrievalResult {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return { hits: [], tokens: [] };

  const candidates = new Map<string, Candidate>();

  const upsert = (c: Candidate) => {
    const existing = candidates.get(c.id);
    if (existing) {
      // A source surfaced by more than one pass accumulates its lexical
      // score — corroboration is a real relevance signal.
      existing.lexical += c.lexical;
      if (!existing.excerpt && c.excerpt) existing.excerpt = c.excerpt;
      if (!existing.locator && c.locator) existing.locator = c.locator;
      return;
    }
    candidates.set(c.id, c);
  };

  // --- Pass 1: the Legal Library (curated, verified sources) ---
  const library = readLegalLibrary();
  const details = library.details ?? {};
  for (const item of library.items) {
    const detail = details[item.id];
    const haystack = [
      item.title,
      item.summary,
      item.authority,
      detail?.body ?? "",
      detail?.simpleExplanation ?? "",
      detail?.keyPoints?.join(" ") ?? "",
      detail?.lawName ?? "",
      detail?.articleNumber ?? "",
    ].join(" ");
    const lexical = lexicalScore(haystack, tokens);
    if (lexical === 0) continue;

    upsert({
      id: item.id,
      title: item.title,
      sourceType: SOURCE_TYPE_MAP[item.sourceType] ?? "law",
      sourceTypeFa: item.sourceTypeFa,
      summary: item.summary,
      excerpt: detail?.body ?? detail?.simpleExplanation ?? item.summary,
      authority: item.authority,
      locator: detail?.articleNumber ?? "",
      verificationStatus: item.verificationStatus,
      status: (detail?.status as SourceStatus) ?? "valid",
      textHash: null,
      origin: "LIBRARY",
      lexical,
      popularity: item.popular ? 1 : 0,
    });
  }

  // --- Pass 2: the official law catalog (16 curated law files) ---
  for (const def of LAW_SOURCES) {
    const haystack = [
      def.title,
      def.summary,
      def.articleSection,
      def.excerpt,
      def.keywords.join(" "),
    ].join(" ");
    const lexical = lexicalScore(haystack, tokens);
    if (lexical === 0) continue;

    upsert({
      id: def.id,
      title: def.title,
      sourceType: def.sourceType,
      sourceTypeFa: def.sourceTypeFa,
      summary: def.summary,
      excerpt: def.excerpt,
      authority: def.publicationAuthority,
      locator: def.articleSection,
      verificationStatus: "VERIFIED_OFFICIAL",
      status: (def.status as SourceStatus) ?? "valid",
      textHash: null,
      origin: "CATALOG",
      lexical,
      popularity: 0,
    });
  }

  // --- Pass 3: the ingested corpus (SHA-256 fingerprinted, chunked) ---
  for (const hit of retrieveCorpus(query, maxSources * 2)) {
    const sourceId = hit.source.lawId ?? hit.source.id;
    const excerpt = hit.excerpt || hit.source.excerpt || null;

    upsert({
      id: sourceId,
      title: hit.source.title,
      sourceType: SOURCE_TYPE_MAP[hit.source.sourceType] ?? "law",
      sourceTypeFa: hit.source.sourceTypeFa,
      summary: hit.source.summary,
      excerpt,
      authority: hit.source.authority,
      locator: hit.locator ?? hit.source.articleSection ?? "",
      verificationStatus: hit.source.verificationStatus,
      status: (hit.source.status as SourceStatus) ?? "valid",
      textHash: hit.source.textHash,
      origin: "CORPUS",
      lexical: hit.score,
      popularity: 0,
    });
  }

  // --- Fuse the signals into one score ---
  const hits: RetrievalHit[] = [...candidates.values()].map((c) => {
    const tier = tierForSource({
      sourceType: c.sourceType,
      title: c.title,
      authority: c.authority,
    });
    const authority = tierWeight(tier);
    const verification = verificationWeight(c.verificationStatus);
    const validity = statusWeight(c.status);
    const popularity = c.popularity;

    return {
      id: c.id,
      title: c.title,
      sourceType: c.sourceType,
      sourceTypeFa: c.sourceTypeFa,
      summary: c.summary,
      excerpt: c.excerpt,
      score: c.lexical * 2 + authority + verification + validity + popularity,
      signals: { lexical: c.lexical, authority, verification, popularity },
      provenance: {
        origin: c.origin,
        tier,
        tierFa: tierLabelFa(tier),
        authority: c.authority,
        locator: c.locator,
        verificationStatus: c.verificationStatus,
        textHash: c.textHash,
        status: c.status,
      },
    };
  });

  // Rank by score, then by authority tier, then by title for determinism.
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const rank = tierRank(a.provenance.tier) - tierRank(b.provenance.tier);
    if (rank !== 0) return rank;
    return a.title.localeCompare(b.title, "fa");
  });

  return { hits: hits.slice(0, maxSources), tokens };
}
