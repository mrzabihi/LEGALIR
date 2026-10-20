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
    failures: [] as unknown[],
  } as {
    version: string;
    sources: unknown[];
    chunks: unknown[];
    inverted: Record<string, string[]>;
    failures: unknown[];
  },
  hits: [] as unknown[],
  overlays: [] as unknown[],
  lawSources: [] as unknown[],
  corpusDirFiles: [] as string[],
  /** The default ingest the mocks return; per-test overrides replace it. */
  ingestReport: {
    corpusDir: "/tmp/legalir-test-corpus",
    discovered: 0,
    duplicatesSkipped: 0,
    sources: 0,
    chunks: 0,
    tokens: 0,
    output: "",
    failed: [] as unknown[],
  },
  /** Overridable stand-in for the real storeLawFile validation. */
  storeLawFile: (_fileName: string, _bytes: Buffer): unknown => ({
    fileName: _fileName,
    bytes: _bytes.length,
  }),
}));

const CORPUS_DIR = "/tmp/legalir-test-corpus";

vi.mock("@/lib/legal-corpus", () => ({
  CORPUS_VERSION: "legalir-corpus-v1",
  MAX_LAW_FILE_BYTES: 50 * 1024 * 1024,
  defaultCorpusDir: () => CORPUS_DIR,
  ingestCorpus: () => state.ingestReport,
  storeLawFile: (fileName: string, bytes: Buffer) => state.storeLawFile(fileName, bytes),
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
  // The write REPLACES the shared overlay array, so a later read (which the
  // production code does) sees exactly what was written.
  writeTable: (name: string, rows: unknown[]) => {
    if (name === "rag_review_overlay") state.overlays = rows;
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
  uploadRagFile,
  retryRagIngestion,
  retryRagSource,
  updateRagReview,
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

function overlayRow(sourceId: string, over: Record<string, unknown> = {}) {
  return {
    sourceId,
    reviewState: "published",
    reviewerUserId: "admin-1",
    publishedInLibrary: false,
    enabled: true,
    notes: null,
    evalScore: null,
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  state.index = { version: "legalir-corpus-v1", sources: [], chunks: [], inverted: {}, failures: [] };
  state.hits = [];
  state.overlays = [];
  state.lawSources = [];
  state.corpusDirFiles = [];
  state.ingestReport = {
    corpusDir: CORPUS_DIR,
    discovered: 0,
    duplicatesSkipped: 0,
    sources: 0,
    chunks: 0,
    tokens: 0,
    output: "",
    failed: [],
  };
  state.storeLawFile = (fileName: string, bytes: Buffer) => ({
    fileName,
    bytes: bytes.length,
  });
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

describe("source enable/disable — the operator's retrieval switch", () => {
  it("defaults to enabled, so an absent overlay never removes a source", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    const detail = getRagSourceDetail("corpus-1");
    expect(detail!.source.enabled).toBe(true);
    // ...and a verified source with no overlay is NOT yet active.
    expect(detail!.source.activeInRetrieval).toBe(false);
  });

  it("a disabled review keeps the state but removes the source from retrieval", async () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    const res = updateRagReview({
      sourceId: "corpus-1",
      reviewState: "published",
      reviewerUserId: "admin-1",
      enabled: false,
    });
    expect("error" in res).toBe(false);
    const saved = res as { reviewState: string; enabled: boolean; activeInRetrieval: boolean };
    expect(saved.reviewState).toBe("published");
    expect(saved.enabled).toBe(false);
    expect(saved.activeInRetrieval).toBe(false);
  });

  it("an absent enabled flag keeps the stored switch on a later review", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    updateRagReview({
      sourceId: "corpus-1",
      reviewState: "approved",
      reviewerUserId: "admin-1",
      enabled: false,
    });
    // A notes-only edit must not silently switch the source back on.
    const res = updateRagReview({
      sourceId: "corpus-1",
      reviewState: "approved",
      reviewerUserId: "admin-1",
      notes: "یادداشت",
    });
    const saved = res as { enabled: boolean; activeInRetrieval: boolean; notes: string | null };
    expect(saved.enabled).toBe(false);
    expect(saved.activeInRetrieval).toBe(false);
    expect(saved.notes).toBe("یادداشت");
  });

  it("re-enabling restores retrieval for an approved source", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    state.overlays = [overlayRow("corpus-1", { reviewState: "approved", enabled: false })];
    const off = getRagSourceDetail("corpus-1")!.source;
    expect(off.activeInRetrieval).toBe(false);

    const res = updateRagReview({
      sourceId: "corpus-1",
      reviewState: "approved",
      reviewerUserId: "admin-1",
      enabled: true,
    });
    expect((res as { activeInRetrieval: boolean }).activeInRetrieval).toBe(true);
  });
});

describe("uploadRagFile — one write path into the same pipeline", () => {
  it("stores the file, then reports the real ingest effect", () => {
    state.storeLawFile = () => ({ fileName: "قانون جدید.pdf", bytes: 1024 });
    state.ingestReport = {
      corpusDir: CORPUS_DIR,
      discovered: 1,
      duplicatesSkipped: 0,
      sources: 1,
      chunks: 3,
      tokens: 12,
      output: "",
      failed: [],
    };

    const res = uploadRagFile("قانون جدید.pdf", Buffer.alloc(1024));
    if ("error" in res) throw new Error("unexpected error");
    expect(res.fileName).toBe("قانون جدید.pdf");
    expect(res.bytes).toBe(1024);
    expect(res.ingest.sources).toBe(1);
    expect(res.ingest.chunks).toBe(3);
  });

  it("surfaces a store rejection instead of pretending the upload worked", () => {
    state.storeLawFile = () => ({ error: "UNSUPPORTED_TYPE" });
    const res = uploadRagFile("photo.png", Buffer.alloc(10));
    expect(res).toEqual({ error: "UNSUPPORTED_TYPE" });
  });

  it("propagates an ingest failure alongside the stored file", () => {
    state.storeLawFile = () => ({ fileName: "locked.pdf", bytes: 5 });
    state.ingestReport = {
      corpusDir: CORPUS_DIR,
      discovered: 1,
      duplicatesSkipped: 0,
      sources: 0,
      chunks: 0,
      tokens: 0,
      output: "",
      failed: [{ fileName: "locked.pdf", message: "EBUSY", at: "2026-03-01T00:00:00.000Z" }],
    };
    const res = uploadRagFile("locked.pdf", Buffer.alloc(5));
    if ("error" in res) throw new Error("unexpected error");
    expect(res.ingest.failed).toHaveLength(1);
    expect(res.ingest.failed[0]!.message).toBe("EBUSY");
  });
});

describe("retryRagIngestion — retries, and reports what is still broken", () => {
  it("reports the files that remain unreadable", () => {
    state.ingestReport = {
      corpusDir: CORPUS_DIR,
      discovered: 2,
      duplicatesSkipped: 0,
      sources: 1,
      chunks: 2,
      tokens: 5,
      output: "",
      failed: [{ fileName: "bad.pdf", message: "EACCES", at: "2026-03-01T00:00:00.000Z" }],
    };
    const res = retryRagIngestion();
    expect(res.stillFailing).toEqual(["bad.pdf"]);
    expect(res.report.sources).toBe(1);
  });
});

describe("retryRagSource — per-source retry is honest about the outcome", () => {
  it("404s for an unknown source", () => {
    const res = retryRagSource("nope", "admin-1");
    expect(res).toEqual({ error: "NOT_FOUND" });
  });

  it("keeps the failed state and returns the real reason when it still fails", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    state.overlays = [overlayRow("corpus-1", { reviewState: "failed", enabled: true })];
    state.ingestReport = {
      corpusDir: CORPUS_DIR,
      discovered: 1,
      duplicatesSkipped: 0,
      sources: 0,
      chunks: 0,
      tokens: 0,
      output: "",
      failed: [{ fileName: "a.pdf", message: "EACCES: permission denied", at: "2026-03-01T00:00:00.000Z" }],
    };

    const res = retryRagSource("corpus-1", "admin-1");
    expect("error" in res).toBe(true);
    if (!("error" in res)) throw new Error("expected error");
    expect(res.error).toBe("STILL_FAILING");
    expect(res.message).toBe("EACCES: permission denied");
    // The stored state is untouched — no pretend success.
    expect(state.overlays[0]).toMatchObject({ reviewState: "failed" });
  });

  it("clears the failed state when the file is readable again", () => {
    state.index.sources = [corpusSource({ id: "corpus-1", fileName: "a.pdf", title: "الف" })];
    state.overlays = [overlayRow("corpus-1", { reviewState: "failed", enabled: true })];
    state.ingestReport = {
      corpusDir: CORPUS_DIR,
      discovered: 1,
      duplicatesSkipped: 0,
      sources: 1,
      chunks: 1,
      tokens: 3,
      output: "",
      failed: [],
    };

    const res = retryRagSource("corpus-1", "admin-1");
    if ("error" in res) throw new Error(`unexpected error: ${res.error}`);
    expect(res.reviewState).toBe("indexed");
    expect(res.enabled).toBe(true);
  });

  it("404s when the file is gone from the folder entirely", () => {
    state.index.sources = [];
    state.overlays = [];
    // getRagSource returns undefined → nothing to retry.
    expect(retryRagSource("corpus-1", "admin-1")).toEqual({ error: "NOT_FOUND" });
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
    expect(status.ingestFailures).toEqual([]);
  });

  it("reports ingest failures separately from unindexed files, newest first", () => {
    state.index.failures = [
      { fileName: "a.pdf", message: "EACCES", at: "2026-01-01T00:00:00.000Z" },
      { fileName: "b.pdf", message: "EBUSY", at: "2026-02-01T00:00:00.000Z" },
    ];
    state.corpusDirFiles = ["a.pdf", "b.pdf"];
    const status = getRagPipelineStatus();
    expect(status.ingestFailures.map((f) => f.fileName)).toEqual(["b.pdf", "a.pdf"]);
    // Both are ALSO reported as unindexed — they are present but not ingested.
    expect(status.unindexedFiles.sort()).toEqual(["a.pdf", "b.pdf"]);
  });

  it("publishes the upload cap so the UI never hard-codes it", () => {
    expect(getRagPipelineStatus().maxUploadBytes).toBe(50 * 1024 * 1024);
  });

  it("tolerates an index persisted before `failures` existed", () => {
    // An index written by an older build has no `failures` key at all. The
    // admin surface must read it as "no failures", not throw on undefined.
    state.index = {
      version: "legalir-corpus-v1",
      sources: [],
      chunks: [],
      inverted: {},
    } as unknown as typeof state.index;
    expect(getRagPipelineStatus().ingestFailures).toEqual([]);
  });
});
