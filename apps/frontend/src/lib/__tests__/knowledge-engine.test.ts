// ============================================================
// LEGALIR — Legal Knowledge Engine tests (Phase 6)
// ============================================================
// Covers the four load-bearing pieces of the engine:
//
//   1. the authority hierarchy (tier derivation, ranking, weights)
//   2. the Persian query tokenizer
//   3. hybrid retrieval (fusion, ranking, provenance)
//   4. the answer contract + the no-citation rule
//
// The three knowledge passes are mocked so the tests are hermetic and
// deterministic — no `.data/*.json` reads, no filesystem.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  CorpusHit,
  CorpusSource,
} from "@/lib/legal-corpus/corpus";
import type { LawSourceDef } from "@/lib/law-catalog";
import type {
  V1LegalLibraryListItem,
  V1LegalSourceDetail,
} from "@legalir/types";

// ------------------------------------------------------------
// Mocked knowledge passes (hoisted so vi.mock can close over them)
// ------------------------------------------------------------

const state = vi.hoisted(() => ({
  library: {
    items: [] as unknown[],
    topics: [] as unknown[],
    details: {} as Record<string, unknown>,
  },
  lawSources: [] as unknown[],
  corpusHits: [] as unknown[],
}));

vi.mock("@/lib/legal-library-db", () => ({
  readLegalLibrary: () => state.library,
}));

vi.mock("@/lib/law-catalog", () => ({
  get LAW_SOURCES() {
    return state.lawSources;
  },
}));

vi.mock("@/lib/legal-corpus", () => ({
  retrieveCorpus: () => state.corpusHits,
}));

// Imported AFTER the mocks are registered.
import {
  AUTHORITY_TIERS,
  outranks,
  statusWeight,
  tierForSource,
  tierLabelFa,
  tierRank,
  tierWeight,
  verificationWeight,
} from "@/lib/knowledge/authority";
import { tokenizeQuery, retrieveHybrid } from "@/lib/knowledge/retriever";
import {
  NO_CITATION_RULE,
  buildAnswerContract,
} from "@/lib/knowledge/answer-contract";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function libraryItem(
  over: Partial<V1LegalLibraryListItem> & { id: string; title: string }
): V1LegalLibraryListItem {
  return {
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانونی",
    topic: null,
    topicSlug: null,
    summary: "",
    authority: "مجلس شورای اسلامی",
    verificationStatus: "VERIFIED_OFFICIAL",
    publishedDate: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    readingTime: 3,
    popular: false,
    featured: false,
    ...over,
  };
}

function libraryDetail(
  over: Partial<V1LegalSourceDetail> & { id: string }
): V1LegalSourceDetail {
  return {
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانونی",
    title: "",
    shortTitle: null,
    lawName: null,
    articleNumber: null,
    judgmentNumber: null,
    authority: "مجلس شورای اسلامی",
    jurisdiction: "ایران",
    publicationDate: null,
    effectiveDate: null,
    lastAmendmentDate: null,
    status: "valid",
    summary: "",
    body: null,
    simpleExplanation: null,
    practicalApplication: null,
    keyPoints: null,
    examples: null,
    sourceUrl: null,
    officialSourceUrl: null,
    sourceProvider: null,
    sourceDomain: null,
    verificationStatus: "VERIFIED_OFFICIAL",
    lastVerifiedAt: null,
    version: 1,
    relatedSources: [],
    relatedGuides: [],
    relatedServices: [],
    legalReviewStatus: "REVIEWED",
    isBookmarked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function lawSource(
  over: Partial<LawSourceDef> & { id: string; title: string }
): LawSourceDef {
  return {
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "ایران",
    effectiveDate: "2026-01-01",
    versionDate: null,
    excerpt: "",
    url: null,
    documentIdentifier: "",
    status: "valid",
    availability: "available",
    fileName: "",
    mime: "text/plain",
    fileSizeBytes: 0,
    summary: "",
    keywords: [],
    ...over,
  };
}

function corpusSource(
  over: Partial<CorpusSource> & { id: string; title: string }
): CorpusSource {
  return {
    lawId: null,
    fileName: "",
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانونی",
    authority: "مجلس شورای اسلامی",
    jurisdiction: "ایران",
    articleSection: "",
    excerpt: "",
    summary: "",
    keywords: [],
    verificationStatus: "VERIFIED_OFFICIAL",
    status: "valid",
    textHash: "0".repeat(64),
    bytes: 0,
    chunkCount: 1,
    ingestedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function corpusHit(
  over: Partial<CorpusHit> & { source: CorpusSource }
): CorpusHit {
  return {
    chunkId: "chunk-1",
    locator: null,
    excerpt: "",
    score: 1,
    ...over,
  };
}

beforeEach(() => {
  state.library = { items: [], topics: [], details: {} };
  state.lawSources = [];
  state.corpusHits = [];
});

// ============================================================
// 1. Authority hierarchy
// ============================================================

describe("authority — tier derivation", () => {
  it("maps each Phase-8 source type to its tier", () => {
    expect(tierForSource({ sourceType: "law" })).toBe("STATUTE");
    expect(tierForSource({ sourceType: "regulation" })).toBe("REGULATION");
    expect(tierForSource({ sourceType: "directive" })).toBe("REGULATION");
    expect(tierForSource({ sourceType: "precedent" })).toBe("PRECEDENT");
    expect(tierForSource({ sourceType: "opinion" })).toBe("OPINION");
    expect(tierForSource({ sourceType: "user_document" })).toBe("USER_DOCUMENT");
  });

  it("maps Legal Library content types to their tier", () => {
    expect(tierForSource({ sourceType: "LAW_ARTICLE" })).toBe("STATUTE");
    expect(tierForSource({ sourceType: "REGULATION" })).toBe("REGULATION");
    expect(tierForSource({ sourceType: "UNIFICATION_RULING" })).toBe("PRECEDENT");
    expect(tierForSource({ sourceType: "JUDICIAL_DECISION" })).toBe("PRECEDENT");
    expect(tierForSource({ sourceType: "LEGAL_GUIDE" })).toBe("OPINION");
    expect(tierForSource({ sourceType: "FAQ" })).toBe("OPINION");
  });

  it("promotes a source naming the constitution to CONSTITUTION", () => {
    // The catalog stores the constitution as a `law`; it must outrank statutes.
    expect(
      tierForSource({ sourceType: "law", title: "قانون اساسی جمهوری اسلامی ایران" })
    ).toBe("CONSTITUTION");
    expect(
      tierForSource({ sourceType: "law", authority: "قانون اساسی" })
    ).toBe("CONSTITUTION");
    // A plain statute is NOT promoted.
    expect(tierForSource({ sourceType: "law", title: "قانون مدنی" })).toBe(
      "STATUTE"
    );
  });

  it("falls back to OPINION for an unknown source type", () => {
    expect(
      tierForSource({ sourceType: "something-unknown" as never })
    ).toBe("OPINION");
  });
});

describe("authority — ranking and weights", () => {
  it("ranks tiers 1..6 with the constitution highest", () => {
    expect(tierRank("CONSTITUTION")).toBe(1);
    expect(tierRank("STATUTE")).toBe(2);
    expect(tierRank("REGULATION")).toBe(3);
    expect(tierRank("PRECEDENT")).toBe(4);
    expect(tierRank("OPINION")).toBe(5);
    expect(tierRank("USER_DOCUMENT")).toBe(6);
  });

  it("outranks() is a strict, antisymmetric ordering", () => {
    expect(outranks("CONSTITUTION", "STATUTE")).toBe(true);
    expect(outranks("STATUTE", "CONSTITUTION")).toBe(false);
    expect(outranks("STATUTE", "STATUTE")).toBe(false);
    expect(outranks("PRECEDENT", "OPINION")).toBe(true);
  });

  it("weights decrease monotonically with rank", () => {
    const weights = AUTHORITY_TIERS.map(tierWeight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeLessThan(weights[i - 1]!);
    }
    expect(tierWeight("CONSTITUTION")).toBe(6);
    expect(tierWeight("USER_DOCUMENT")).toBe(1);
  });

  it("exposes AUTHORITY_TIERS highest-authority first", () => {
    expect(AUTHORITY_TIERS).toEqual([
      "CONSTITUTION",
      "STATUTE",
      "REGULATION",
      "PRECEDENT",
      "OPINION",
      "USER_DOCUMENT",
    ]);
  });

  it("labels every tier in Persian", () => {
    expect(tierLabelFa("CONSTITUTION")).toBe("قانون اساسی");
    expect(tierLabelFa("STATUTE")).toBe("قانون");
    expect(tierLabelFa("REGULATION")).toBe("آیین‌نامه");
    expect(tierLabelFa("PRECEDENT")).toBe("رویه قضایی");
    expect(tierLabelFa("OPINION")).toBe("نظر حقوقی");
    expect(tierLabelFa("USER_DOCUMENT")).toBe("سند کاربر");
  });
});

describe("authority — verification and validity weights", () => {
  it("ranks official > secondary > demo > unverified", () => {
    expect(verificationWeight("VERIFIED_OFFICIAL")).toBeGreaterThan(
      verificationWeight("VERIFIED_SECONDARY")
    );
    expect(verificationWeight("VERIFIED_SECONDARY")).toBeGreaterThan(
      verificationWeight("DEMO_VERIFIED")
    );
    expect(verificationWeight("DEMO_VERIFIED")).toBeGreaterThan(
      verificationWeight("UNVERIFIED")
    );
    expect(verificationWeight("UNVERIFIED")).toBe(0);
  });

  it("penalises expired and needs_review sources", () => {
    expect(statusWeight("valid")).toBeGreaterThan(statusWeight("amended"));
    expect(statusWeight("amended")).toBeGreaterThan(statusWeight("needs_review"));
    expect(statusWeight("needs_review")).toBeGreaterThan(statusWeight("expired"));
    expect(statusWeight("expired")).toBeLessThan(0);
  });
});

// ============================================================
// 2. Query tokenizer
// ============================================================

describe("tokenizeQuery — Persian keyword extraction", () => {
  it("keeps content words and drops stopwords", () => {
    const tokens = tokenizeQuery("وجه التزام در قانون مدنی چیست");
    expect(tokens).toContain("وجه");
    expect(tokens).toContain("التزام");
    expect(tokens).toContain("قانون");
    expect(tokens).toContain("مدنی");
    expect(tokens).not.toContain("در");
    expect(tokens).not.toContain("چیست");
  });

  it("strips digits (Persian and ASCII) and punctuation", () => {
    const tokens = tokenizeQuery("ماده ۲۳۰ قانون مدنی، تبصره 2");
    expect(tokens).toContain("ماده");
    expect(tokens).toContain("قانون");
    expect(tokens).toContain("مدنی");
    expect(tokens).toContain("تبصره");
    expect(tokens.some((t) => /\d/.test(t))).toBe(false);
  });

  it("drops single-character tokens", () => {
    expect(tokenizeQuery("و ب قانون")).toEqual(["قانون"]);
  });

  it("returns an empty list when the query is all stopwords", () => {
    expect(tokenizeQuery("و در از به")).toEqual([]);
  });
});

// ============================================================
// 3. Hybrid retrieval
// ============================================================

describe("retrieveHybrid — fusion and ranking", () => {
  it("returns nothing for an all-stopword query", () => {
    state.library.items = [libraryItem({ id: "a", title: "قانون مدنی" })];
    const result = retrieveHybrid("و در از به");
    expect(result.hits).toEqual([]);
    expect(result.tokens).toEqual([]);
  });

  it("surfaces a matching library source with full provenance", () => {
    state.library.items = [
      libraryItem({
        id: "law-civil-230",
        title: "وجه التزام در قانون مدنی",
        summary: "خسارت تأخیر تأدیه",
        popular: true,
      }),
    ];
    state.library.details = {
      "law-civil-230": libraryDetail({
        id: "law-civil-230",
        articleNumber: "ماده ۲۳۰",
        body: "اگر در ضمن معامله شرط شده باشد که در صورت تأخیر، مبلغی به‌عنوان وجه التزام پرداخت شود…",
      }),
    };

    const { hits } = retrieveHybrid("وجه التزام قانون مدنی");
    expect(hits).toHaveLength(1);
    const hit = hits[0]!;
    expect(hit.id).toBe("law-civil-230");
    expect(hit.provenance.origin).toBe("LIBRARY");
    expect(hit.provenance.tier).toBe("STATUTE");
    expect(hit.provenance.tierFa).toBe("قانون");
    expect(hit.provenance.locator).toBe("ماده ۲۳۰");
    expect(hit.provenance.verificationStatus).toBe("VERIFIED_OFFICIAL");
    expect(hit.signals.lexical).toBeGreaterThan(0);
    expect(hit.signals.authority).toBe(tierWeight("STATUTE"));
  });

  it("fuses a source surfaced by two passes by accumulating lexical score", () => {
    const shared = {
      id: "law-civil-230",
      title: "وجه التزام قانون مدنی",
      summary: "خسارت تأخیر",
    };

    // Library only.
    state.library.items = [libraryItem(shared)];
    state.library.details = {
      "law-civil-230": libraryDetail({ id: "law-civil-230", body: "وجه التزام" }),
    };
    const libraryOnly = retrieveHybrid("وجه التزام قانون مدنی").hits[0]!;

    // Library + corpus (same canonical id) → corroboration.
    state.corpusHits = [
      corpusHit({
        source: corpusSource({
          id: "corpus-1",
          lawId: "law-civil-230",
          title: "وجه التزام قانون مدنی",
          excerpt: "وجه التزام",
        }),
        score: 2,
      }),
    ];
    const fused = retrieveHybrid("وجه التزام قانون مدنی").hits[0]!;

    expect(fused.id).toBe("law-civil-230");
    expect(fused.signals.lexical).toBe(libraryOnly.signals.lexical + 2);
    expect(fused.score).toBeGreaterThan(libraryOnly.score);
  });

  it("ranks a higher-authority source above a lower-authority one at equal lexical match", () => {
    state.library.items = [
      libraryItem({
        id: "guide-1",
        title: "راهنمای مهریه",
        sourceType: "LEGAL_GUIDE",
        sourceTypeFa: "راهنمای حقوقی",
      }),
      libraryItem({
        id: "law-1",
        title: "قانون مهریه",
        sourceType: "LAW_ARTICLE",
      }),
    ];

    const { hits } = retrieveHybrid("مهریه");
    expect(hits.map((h) => h.id)).toEqual(["law-1", "guide-1"]);
    expect(hits[0]!.provenance.tier).toBe("STATUTE");
    expect(hits[1]!.provenance.tier).toBe("OPINION");
  });

  it("ranks a verified source above an unverified one at equal tier and lexical match", () => {
    state.library.items = [
      libraryItem({
        id: "unverified",
        title: "قانون اجاره",
        verificationStatus: "UNVERIFIED",
      }),
      libraryItem({
        id: "verified",
        title: "قانون اجاره",
        verificationStatus: "VERIFIED_OFFICIAL",
      }),
    ];

    const { hits } = retrieveHybrid("اجاره");
    expect(hits[0]!.id).toBe("verified");
  });

  it("penalises an expired source relative to a valid one", () => {
    state.library.items = [
      libraryItem({ id: "expired", title: "قانون کار" }),
      libraryItem({ id: "valid", title: "قانون کار" }),
    ];
    state.library.details = {
      expired: libraryDetail({ id: "expired", status: "expired" }),
      valid: libraryDetail({ id: "valid", status: "valid" }),
    };

    const { hits } = retrieveHybrid("کار");
    expect(hits[0]!.id).toBe("valid");
    expect(hits.find((h) => h.id === "expired")!.provenance.status).toBe(
      "expired"
    );
  });

  it("respects maxSources", () => {
    state.library.items = [
      libraryItem({ id: "a", title: "قانون مدنی" }),
      libraryItem({ id: "b", title: "قانون مدنی" }),
      libraryItem({ id: "c", title: "قانون مدنی" }),
      libraryItem({ id: "d", title: "قانون مدنی" }),
    ];
    expect(retrieveHybrid("قانون مدنی", 2).hits).toHaveLength(2);
    expect(retrieveHybrid("قانون مدنی", 10).hits).toHaveLength(4);
  });

  it("retrieves from the official law catalog with official verification", () => {
    state.lawSources = [
      lawSource({
        id: "law-labor",
        title: "قانون کار",
        articleSection: "ماده ۷",
        excerpt: "قرارداد کار",
        keywords: ["کار", "قرارداد"],
      }),
    ];

    const { hits } = retrieveHybrid("قرارداد کار");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.provenance.origin).toBe("CATALOG");
    expect(hits[0]!.provenance.verificationStatus).toBe("VERIFIED_OFFICIAL");
    expect(hits[0]!.provenance.locator).toBe("ماده ۷");
  });

  it("retrieves from the ingested corpus and carries its content hash", () => {
    state.corpusHits = [
      corpusHit({
        source: corpusSource({
          id: "corpus-9",
          lawId: "law-trade",
          title: "قانون تجارت",
          excerpt: "تاجر کسی است که…",
          textHash: "abc123",
        }),
        locator: "ماده ۱",
        score: 3,
      }),
    ];

    const { hits } = retrieveHybrid("تاجر");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe("law-trade");
    expect(hits[0]!.provenance.origin).toBe("CORPUS");
    expect(hits[0]!.provenance.textHash).toBe("abc123");
    expect(hits[0]!.provenance.locator).toBe("ماده ۱");
  });

  it("never invents a source when nothing matches", () => {
    state.library.items = [libraryItem({ id: "a", title: "قانون مدنی" })];
    const { hits } = retrieveHybrid("هواپیما فضایی");
    expect(hits).toEqual([]);
  });
});

// ============================================================
// 4. Answer contract + no-citation rule
// ============================================================

describe("buildAnswerContract — grounded answers", () => {
  it("builds a grounded contract with a context block and top tier", () => {
    state.library.items = [
      libraryItem({
        id: "law-1",
        title: "قانون مدنی",
        sourceType: "LAW_ARTICLE",
      }),
      libraryItem({
        id: "guide-1",
        title: "راهنمای مدنی",
        sourceType: "LEGAL_GUIDE",
        sourceTypeFa: "راهنمای حقوقی",
      }),
    ];
    state.library.details = {
      "law-1": libraryDetail({ id: "law-1", articleNumber: "ماده ۱۰" }),
    };

    const { hits } = retrieveHybrid("مدنی");
    const contract = buildAnswerContract(hits);

    expect(contract.grounded).toBe(true);
    expect(contract.sourceCount).toBe(hits.length);
    expect(contract.topTier).toBe("STATUTE");
    expect(contract.contextBlock).toContain("منابع حقوقی مرتبط");
    expect(contract.contextBlock).toContain("قانون مدنی");
    expect(contract.instructionBlock).toContain("قاعده استناد");
    expect(contract.instructionBlock).toContain("منبع حقوقی تأییدشده");
    expect(contract.noCitationRule).toBe(NO_CITATION_RULE);
  });

  it("picks the highest-authority tier among the hits", () => {
    state.library.items = [
      libraryItem({
        id: "guide-1",
        title: "راهنمای قانون اساسی",
        sourceType: "LEGAL_GUIDE",
        sourceTypeFa: "راهنمای حقوقی",
      }),
      libraryItem({ id: "law-1", title: "قانون اساسی" }),
    ];

    const { hits } = retrieveHybrid("قانون اساسی");
    const contract = buildAnswerContract(hits);
    expect(contract.topTier).toBe("CONSTITUTION");
  });
});

describe("buildAnswerContract — the no-citation rule", () => {
  it("returns an ungrounded contract when there are no hits", () => {
    const contract = buildAnswerContract([]);
    expect(contract.grounded).toBe(false);
    expect(contract.sourceCount).toBe(0);
    expect(contract.topTier).toBeNull();
    expect(contract.contextBlock).toBe("");
    expect(contract.instructionBlock).toBe(NO_CITATION_RULE);
  });

  it("forbids inventing a citation, article number or ruling", () => {
    expect(NO_CITATION_RULE).toContain("استناد نکن");
    expect(NO_CITATION_RULE).toContain("ماده");
    expect(NO_CITATION_RULE).toContain("رأی");
    expect(NO_CITATION_RULE).toContain("طبق ماده");
  });

  it("tells the model to disclose that the answer is unverified", () => {
    expect(NO_CITATION_RULE).toContain("تأییدشده");
    expect(NO_CITATION_RULE).toContain("وکیل");
  });

  it("is produced end-to-end when retrieval finds nothing", () => {
    state.library.items = [libraryItem({ id: "a", title: "قانون مدنی" })];
    const { hits } = retrieveHybrid("هواپیما فضایی");
    const contract = buildAnswerContract(hits);
    expect(contract.grounded).toBe(false);
    expect(contract.instructionBlock).toBe(NO_CITATION_RULE);
  });
});
