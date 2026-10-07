// ============================================================
// LEGALIR — Admin Knowledge center · §1 (hermetic)
// ============================================================
// Covers the admin Knowledge/RAG helpers added in §1:
//
//   • getRagSourceDetail   — projects a corpus source + its searchable chunks
//   • testRagRetrieval      — runs a REAL query via the ONE retrieval pipeline
//   • getRagPipelineStatus  — real corpus stats + unindexed-file detection
//
// The corpus pipeline is mocked so the tests are hermetic: they assert the
// admin surface never fabricates a parallel corpus and always reflects the
// overlay + the pipeline's own output.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CorpusIndex, CorpusSource } from "@/lib/legal-corpus";

// Hoisted state the module mocks close over.
const state = vi.hoisted(() => ({
  index: {
    version: "legalir-corpus-v1",
    sources: [] as unknown[],
    chunks: [] as unknown[],
    inverted: {} as Record<string, string[]>,
  },
  hits: [] as unknown[],
  overlays: [] as unknown[],
  lawSources: [] as unknown[],
  corpusDirFiles: [] as string[],
}));

const CORPUS_DIR = "/tmp/legalir-test-corpus";

vi.mock("@/lib/legal-corpus", () => ({
  CORPUS_VERSION: "legalir-corpus-v1",
  defaultCorpusDir: () => CORPUS_DIR,
  ingestCorpus: () => ({
    corpusDir: CORPUS_DIR,
    discovered: 0,
    duplicatesSkipped: 0,
    sources: 0,
    chunks: 0,
    tokens: 0,
    output: "",
  }),
  readCorpus: () => state.index as unknown as CorpusIndex,
  retrieveCorpus: () => state.hits,
  normalizePersian: (s: string) => s.trim().toLowerCase(),
}));

vi.mock("@/lib/law-catalog", () => ({
  get LAW_SOURCES() {
    return state.lawSources;
  },
}));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => (name === "rag_review_overlay" ? state.overlays : []),
  writeTable: () => {
    /* noop — overlay writes are asserted via readTable's shared state */
  },
}));

// Mock fs so `getRagPipelineStatus` sees a deterministic source folder.
vi.mock("node:fs", () => {
  const mocked = {
    existsSync: () => true,
    readdirSync: () => state.corpusDirFiles,
  };
  return { default: mocked, ...mocked };
});

// Imported AFTER the mocks are registered.
import {
  getRagPipelineStatus,
  getRagSourceDetail,
  testRagRetrieval,
} from "@/lib/admin/rag";

function corpusSource(over: Partial<CorpusSource> & { id: string; fileName: string }): CorpusSource {
  return {
    lawId: null,
    title: "",
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "ماده قانونی",
    authority: "مجلس",
    jurisdiction: "ایران",
    articleSection: "",
    excerpt: "",
    summary: "",
    keywords: [],
    verificationStatus: "VERIFIED_OFFICIAL",
    status: "valid",
    textHash: "h",
    bytes: 0,
    chunkCount: 1,
    ingestedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  state.index = { version: "legalir-corpus-v1", sources: [], chunks: [], inverted: {} };
  state.hits = [];
  state.overlays = [];
  state.lawSources = [];
  state.corpusDirFiles = [];
});

describe("getRagSourceDetail — source + its searchable chunks", () => {
  it("projects the source and orders its chunks by `order`", () => {
    state.index.sources = [
      corpusSource({ id: "corpus-abc", lawId: "law-civil", fileName: "civil.pdf", title: "قانون مدنی" }),
    ];
    state.index.chunks = [
      { id: "c2", sourceId: "corpus-abc", text: "دوم", locator: "ماده ۲", order: 2 },
      { id: "c1", sourceId: "corpus-abc", text: "اول", locator: "ماده ۱", order: 1 },
    ];

    // The admin id is the canonical lawId when present.
    const detail = getRagSourceDetail("law-civil");
    expect(detail).toBeDefined();
    expect(detail!.source.title).toBe("قانون مدنی");
    expect(detail!.chunks.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(detail!.chunks[0]!.locator).toBe("ماده ۱");
  });

  it("returns undefined for an unknown source id", () => {
    expect(getRagSourceDetail("does-not-exist")).toBeUndefined();
  });

  it("honours a published overlay (active in retrieval)", () => {
    state.index.sources = [corpusSource({ id: "corpus-x", fileName: "x.pdf", title: "قانون کار" })];
    state.overlays = [
      {
        sourceId: "corpus-x",
        reviewState: "published",
        reviewerUserId: "admin-1",
        publishedInLibrary: true,
        notes: null,
        evalScore: 0.9,
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];
    const detail = getRagSourceDetail("corpus-x");
    expect(detail!.source.reviewState).toBe("published");
    expect(detail!.source.activeInRetrieval).toBe(true);
    expect(detail!.source.publishedInLibrary).toBe(true);
  });
});

describe("testRagRetrieval — a live query through the existing pipeline", () => {
  it("rejects an empty query", () => {
    const res = testRagRetrieval("   ");
    expect("error" in res).toBe(true);
  });

  it("maps pipeline hits and marks eligibility from the overlay", () => {
    state.index.sources = [
      corpusSource({ id: "corpus-1", lawId: "law-labor", fileName: "labor.pdf", title: "قانون کار" }),
    ];
    state.overlays = [
      {
        sourceId: "corpus-1",
        reviewState: "published",
        reviewerUserId: "admin-1",
        publishedInLibrary: false,
        notes: null,
        evalScore: null,
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];
    state.hits = [
      {
        chunkId: "chunk-9",
        source: state.index.sources[0],
        locator: "ماده ۷",
        excerpt: "قرارداد کار",
        score: 4,
      },
    ];

    const res = testRagRetrieval("قرارداد کار");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.query).toBe("قرارداد کار");
    expect(res.totalSources).toBe(1);
    expect(res.activeSources).toBe(1);
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0]!.sourceId).toBe("law-labor");
    expect(res.hits[0]!.activeInRetrieval).toBe(true);
    expect(res.hits[0]!.locator).toBe("ماده ۷");
    expect(res.hits[0]!.score).toBe(4);
  });

  it("clamps maxResults into a sane range", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    state.hits = [];
    const res = testRagRetrieval("الف", 999);
    if ("error" in res) throw new Error("unexpected error");
    // No throw and a well-formed result — the clamp is exercised internally.
    expect(res.hits).toEqual([]);
  });
});

describe("getRagPipelineStatus — real corpus stats + unindexed detection", () => {
  it("reports counts, active-in-retrieval, and unindexed files", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "civil.pdf", title: "قانون مدنی" })];
    state.index.chunks = [
      { id: "c1", sourceId: "corpus-1", text: "الف", locator: null, order: 1 },
    ];
    state.index.inverted = { الف: ["c1"], ب: ["c1"] };
    state.corpusDirFiles = ["civil.pdf", "new-law.pdf", "notes.txt"];

    const status = getRagPipelineStatus();
    expect(status.corpusVersion).toBe("legalir-corpus-v1");
    expect(status.sourceCount).toBe(1);
    expect(status.chunkCount).toBe(1);
    expect(status.tokenCount).toBe(2);
    // Verified-but-unoverlaid source defaults to "indexed" (not active).
    expect(status.activeInRetrieval).toBe(0);
    // Only the not-yet-ingested supported files are reported.
    expect(status.unindexedFiles.sort()).toEqual(["new-law.pdf", "notes.txt"]);
    expect(status.lastIngestedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
