// ============================================================
// LEGALIR — Knowledge inventory tests
// ============================================================
// `lib/knowledge/inventory.ts` is the SINGLE projection of the legal
// knowledge base shared by the staff inventory endpoint
// (`GET /api/v1/admin/knowledge`) and the Excel export adapter
// (`case "knowledge"`). If it drifts, the endpoint and the export disagree —
// so its shape contract is pinned here.
//
// The two data sources are mocked so the test is hermetic and deterministic:
// no `.data/*.json` reads, no filesystem. The authority module is left REAL
// so tier derivation is exercised end-to-end on the synthetic rows.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  V1LegalLibraryListItem,
  V1LegalSourceDetail,
} from "@legalir/types";
import type { CorpusSource } from "@/lib/legal-corpus/corpus";

// ------------------------------------------------------------
// Mocked data sources (hoisted so vi.mock can close over them)
// ------------------------------------------------------------

const h = vi.hoisted(() => ({
  library: {
    items: [] as unknown[],
    topics: [] as unknown[],
    details: {} as Record<string, unknown>,
  },
  corpus: { sources: [] as unknown[] },
}));

vi.mock("@/lib/legal-library-db", () => ({
  readLegalLibrary: () => h.library,
}));

vi.mock("@/lib/legal-corpus", () => ({
  readCorpus: () => h.corpus,
}));

// Imported AFTER the mocks are registered.
import {
  buildKnowledgeInventory,
  getKnowledgeInventory,
  filterKnowledgeInventory,
} from "@/lib/knowledge/inventory";

// ------------------------------------------------------------
// Synthetic rows
// ------------------------------------------------------------

function libraryItem(
  over: Partial<V1LegalLibraryListItem> & { id: string; title: string }
): V1LegalLibraryListItem {
  return {
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانون",
    topic: null,
    topicSlug: null,
    summary: "خلاصه",
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

function sourceDetail(
  over: Partial<V1LegalSourceDetail> & { id: string }
): V1LegalSourceDetail {
  return {
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانون",
    title: "ماده",
    shortTitle: null,
    lawName: null,
    articleNumber: "۱۲",
    judgmentNumber: null,
    authority: "مجلس",
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
    ...over,
  } as V1LegalSourceDetail;
}

function corpusSource(
  over: Partial<CorpusSource> & { id: string; title: string }
): CorpusSource {
  return {
    lawId: null,
    fileName: "law.txt",
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانون",
    authority: "قوه قضائیه",
    jurisdiction: "ایران",
    articleSection: "ماده ۱",
    excerpt: "…",
    summary: "…",
    keywords: [],
    verificationStatus: "VERIFIED_SECONDARY",
    status: "valid",
    textHash: "a".repeat(64),
    bytes: 100,
    chunkCount: 1,
    ingestedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  } as CorpusSource;
}

beforeEach(() => {
  h.library.items = [];
  h.library.details = {};
  h.corpus.sources = [];
});

// ------------------------------------------------------------
// buildKnowledgeInventory — library projection
// ------------------------------------------------------------

describe("buildKnowledgeInventory — legal library", () => {
  it("projects every library item with its derived tier, origin and locator", () => {
    h.library.items = [
      libraryItem({ id: "s-civil", title: "قانون مدنی", popular: true }),
    ];
    h.library.details = {
      "s-civil": sourceDetail({ id: "s-civil", articleNumber: "۱۰" }),
    };

    const items = buildKnowledgeInventory();
    expect(items).toHaveLength(1);
    const [it] = items;
    expect(it).toMatchObject({
      id: "s-civil",
      title: "قانون مدنی",
      sourceType: "law",
      tier: "STATUTE",
      tierFa: "قانون",
      origin: "LIBRARY",
      locator: "۱۰",
      textHash: null,
      popular: true,
    });
  });

  it("maps a REGULATION content type to sourceType 'regulation'", () => {
    h.library.items = [
      libraryItem({
        id: "r-1",
        title: "آیین‌نامه",
        sourceType: "REGULATION",
        sourceTypeFa: "آیین‌نامه",
      }),
    ];
    const [it] = buildKnowledgeInventory();
    expect(it?.sourceType).toBe("regulation");
    expect(it?.tier).toBe("REGULATION");
  });

  it("promotes a constitution-titled source to the CONSTITUTION tier", () => {
    h.library.items = [
      libraryItem({ id: "con", title: "قانون اساسی جمهوری اسلامی ایران" }),
    ];
    const [it] = buildKnowledgeInventory();
    expect(it?.tier).toBe("CONSTITUTION");
    expect(it?.tierFa).toBe("قانون اساسی");
  });

  it("defaults status to 'valid' when the detail is missing, and keeps a real status otherwise", () => {
    h.library.items = [
      libraryItem({ id: "no-detail", title: "الف" }),
      libraryItem({ id: "amended", title: "ب" }),
    ];
    h.library.details = {
      amended: sourceDetail({ id: "amended", status: "amended" }),
    };
    const items = buildKnowledgeInventory();
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["no-detail"]?.status).toBe("valid");
    expect(byId["no-detail"]?.locator).toBe("");
    expect(byId["amended"]?.status).toBe("amended");
  });
});

// ------------------------------------------------------------
// buildKnowledgeInventory — corpus projection
// ------------------------------------------------------------

describe("buildKnowledgeInventory — ingested corpus", () => {
  it("projects corpus sources with origin CORPUS and their text hash", () => {
    h.corpus.sources = [
      corpusSource({ id: "c-1", title: "لایحه", textHash: "b".repeat(64) }),
    ];
    const [it] = buildKnowledgeInventory();
    expect(it).toMatchObject({
      id: "c-1",
      sourceType: "law",
      origin: "CORPUS",
      locator: "ماده ۱",
      textHash: "b".repeat(64),
      popular: false,
    });
  });

  it("prefers lawId over the raw id when the file matched a catalog entry", () => {
    h.corpus.sources = [
      corpusSource({ id: "file-uuid", lawId: "law-civil", title: "قانون مدنی" }),
    ];
    const [it] = buildKnowledgeInventory();
    expect(it?.id).toBe("law-civil");
  });

  it("concatenates library and corpus sources into one list", () => {
    h.library.items = [libraryItem({ id: "L", title: "کتابخانه" })];
    h.corpus.sources = [corpusSource({ id: "C", title: "پیکره" })];
    const items = buildKnowledgeInventory();
    expect(items.map((i) => i.origin)).toEqual(["LIBRARY", "CORPUS"]);
  });
});

// ------------------------------------------------------------
// getKnowledgeInventory — derived counts
// ------------------------------------------------------------

describe("getKnowledgeInventory", () => {
  it("returns the items plus tier and verification-status histograms", () => {
    h.library.items = [
      libraryItem({ id: "a", title: "قانون مدنی" }), // STATUTE, VERIFIED_OFFICIAL
      libraryItem({
        id: "b",
        title: "آیین‌نامه",
        sourceType: "REGULATION",
        verificationStatus: "UNVERIFIED",
      }), // REGULATION, UNVERIFIED
    ];
    const res = getKnowledgeInventory();
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
    expect(res.byTier).toEqual({ STATUTE: 1, REGULATION: 1 });
    expect(res.byStatus).toEqual({ VERIFIED_OFFICIAL: 1, UNVERIFIED: 1 });
  });

  it("returns empty histograms for an empty knowledge base", () => {
    const res = getKnowledgeInventory();
    expect(res.total).toBe(0);
    expect(res.byTier).toEqual({});
    expect(res.byStatus).toEqual({});
  });
});

// ------------------------------------------------------------
// filterKnowledgeInventory
// ------------------------------------------------------------

describe("filterKnowledgeInventory", () => {
  beforeEach(() => {
    h.library.items = [
      libraryItem({ id: "law-1", title: "قانون کار" }), // law / STATUTE / VERIFIED_OFFICIAL
      libraryItem({
        id: "reg-1",
        title: "آیین‌نامه",
        sourceType: "REGULATION",
        verificationStatus: "UNVERIFIED",
      }), // regulation / REGULATION / UNVERIFIED
    ];
  });

  it("returns every item when the filter is empty (no keys set)", () => {
    const items = buildKnowledgeInventory();
    expect(filterKnowledgeInventory(items, {})).toHaveLength(2);
  });

  it("filters by verificationStatus", () => {
    const items = buildKnowledgeInventory();
    const out = filterKnowledgeInventory(items, { verificationStatus: "UNVERIFIED" });
    expect(out.map((i) => i.id)).toEqual(["reg-1"]);
  });

  it("filters by sourceType", () => {
    const items = buildKnowledgeInventory();
    const out = filterKnowledgeInventory(items, { sourceType: "law" });
    expect(out.map((i) => i.id)).toEqual(["law-1"]);
  });

  it("filters by tier", () => {
    const items = buildKnowledgeInventory();
    const out = filterKnowledgeInventory(items, { tier: "REGULATION" });
    expect(out.map((i) => i.id)).toEqual(["reg-1"]);
  });

  it("combines filters (AND semantics)", () => {
    const items = buildKnowledgeInventory();
    const out = filterKnowledgeInventory(items, {
      sourceType: "law",
      tier: "STATUTE",
      verificationStatus: "VERIFIED_OFFICIAL",
    });
    expect(out.map((i) => i.id)).toEqual(["law-1"]);
  });

  it("null filter values are treated as 'no constraint'", () => {
    const items = buildKnowledgeInventory();
    const out = filterKnowledgeInventory(items, {
      verificationStatus: null,
      sourceType: null,
      tier: null,
    });
    expect(out).toHaveLength(2);
  });
});
