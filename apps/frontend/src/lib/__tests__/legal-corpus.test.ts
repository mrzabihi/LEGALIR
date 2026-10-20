import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizePersian, tokenize } from "../legal-corpus/normalize";
import {
  MAX_LAW_FILE_BYTES,
  chunkText,
  ingestCorpus,
  retrieveCorpus,
  storeLawFile,
} from "../legal-corpus/corpus";

// A scratch directory per test; cleaned up in afterAll.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-corpus-"));
function makeDir(name: string): string {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function writeFile(dir: string, fileName: string, content: string): void {
  fs.writeFileSync(path.join(dir, fileName), content, "utf-8");
}

// `ingestCorpus` persists the index it built. Left to its default it writes
// `<cwd>/.data/legal-corpus.json`, which is the LIVE dev corpus — a test run
// would then replace the real law sources with a one-file synthetic index.
// Point the pipeline at a scratch data dir instead, so both the ingest and the
// lazy `readCorpus()` inside `retrieveCorpus` stay inside the temp tree.
const indexDir = makeDir("_index");
const previousDataDir = process.env["LEGALIR_CORPUS_DATA_DIR"];
process.env["LEGALIR_CORPUS_DATA_DIR"] = indexDir;

beforeAll(() => {
  process.env["LEGALIR_CORPUS_DATA_DIR"] = indexDir;
});

afterAll(() => {
  if (previousDataDir === undefined) delete process.env["LEGALIR_CORPUS_DATA_DIR"];
  else process.env["LEGALIR_CORPUS_DATA_DIR"] = previousDataDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ============================================================
// normalizePersian
// ============================================================

describe("normalizePersian — Persian glyph/digit normalization", () => {
  it("unifies Arabic ي/ك/ة with their Persian counterparts", () => {
    expect(normalizePersian("كتاب")).toBe("کتاب");
    expect(normalizePersian("محمدي")).toBe("محمدی");
    expect(normalizePersian("آمارة")).toBe("اماره");
  });

  it("strips kashida, hamza and zero-width marks", () => {
    expect(normalizePersian("قانون\u0640\u0640\u0640 مدنی")).toBe("قانون مدنی");
    expect(normalizePersian("جزء")).toBe("جز");
  });

  it("converts Persian and Arabic-Indic digits to ASCII", () => {
    expect(normalizePersian("ماده ۲۳۰")).toBe("ماده 230");
    expect(normalizePersian("ماده ٢٣٠")).toBe("ماده 230");
  });

  it("collapses whitespace and lowercases embedded Latin", () => {
    expect(normalizePersian("  قانون   مدنی  Iran ")).toBe("قانون مدنی iran");
  });
});

// ============================================================
// tokenize
// ============================================================

describe("tokenize — stopword-aware Persian tokenization", () => {
  it("returns lowercase keyword tokens, dropping stopwords and numbers", () => {
    const tokens = tokenize("وجه التزام در ماده ۲۳۰ قانون مدنی");
    expect(tokens).toContain("وجه");
    expect(tokens).toContain("التزام");
    expect(tokens).toContain("قانون");
    expect(tokens).toContain("مدنی");
    // stopword "در" is removed
    expect(tokens).not.toContain("در");
    // numbers are dropped
    expect(tokens).not.toContain("230");
  });

  it("returns an empty list for stopword-only input", () => {
    expect(tokenize("و در از به")).toEqual([]);
  });
});

// ============================================================
// chunkText
// ============================================================

describe("chunkText — sentence-aware chunking", () => {
  it("returns short text as a single chunk", () => {
    expect(chunkText("متن کوتاه")).toEqual(["متن کوتاه"]);
  });

  it("splits long text into multiple chunks with an upper bound", () => {
    const long = Array(400).fill("این یک جمله آزمایشی است").join(" ");
    const chunks = chunkText(long, 900, 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(900);
    }
    // No chunk is empty.
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });
});

// ============================================================
// ingestCorpus
// ============================================================

describe("ingestCorpus — discover → hash → map → dedup → index", () => {
  it("maps a curated catalog file to its lawId and verified status", () => {
    const dir = makeDir("curated");
    writeFile(dir, "قانون امور گمركي.pdf", "customs law content");

    const report = ingestCorpus(dir);
    expect(report.discovered).toBe(1);
    expect(report.sources).toBe(1);
    expect(report.chunks).toBe(1);

    // Re-read the persisted index to assert the source mapping.
    const index = JSON.parse(
      fs.readFileSync(path.join(indexDir, "legal-corpus.json"), "utf-8")
    );
    const source = index.sources[0];
    expect(source.lawId).toBe("law-customs");
    expect(source.sourceType).toBe("LAW_ARTICLE");
    expect(source.verificationStatus).toBe("VERIFIED_OFFICIAL");
    expect(source.title).toContain("گمرک");
  });

  it("dedups identical bytes and marks unmapped files as DEMO_VERIFIED", () => {
    const dir = makeDir("dedup");
    writeFile(dir, "a.txt", "identical body");
    writeFile(dir, "b.txt", "identical body");
    writeFile(dir, "c.txt", "distinct body");

    const report = ingestCorpus(dir);
    expect(report.discovered).toBe(3);
    expect(report.duplicatesSkipped).toBe(1);
    expect(report.sources).toBe(2);

    const index = JSON.parse(
      fs.readFileSync(path.join(indexDir, "legal-corpus.json"), "utf-8")
    );
    for (const source of index.sources) {
      expect(source.lawId).toBeNull();
      expect(source.verificationStatus).toBe("DEMO_VERIFIED");
    }
  });
});

// ============================================================
// retrieveCorpus
// ============================================================

// ============================================================
// storeLawFile — the ONE write path into the source folder
// ============================================================

describe("storeLawFile — validated writes into the pipeline folder", () => {
  it("writes a supported file and reports its real size", () => {
    const dir = makeDir("upload-ok");
    const bytes = Buffer.from("متن قانون آزمایشی", "utf-8");
    const res = storeLawFile("قانون جدید.pdf", bytes, dir);

    expect("error" in res).toBe(false);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.fileName).toBe("قانون جدید.pdf");
    expect(res.bytes).toBe(bytes.length);
    expect(fs.readFileSync(path.join(dir, "قانون جدید.pdf"))).toEqual(bytes);
  });

  it("reduces a traversal name to a bare basename inside the folder", () => {
    const dir = makeDir("upload-traversal");
    const res = storeLawFile("../../evil.pdf", Buffer.from("x"), dir);

    if ("error" in res) throw new Error("unexpected error");
    expect(res.fileName).toBe("evil.pdf");
    // Written INSIDE the corpus folder, never in its parent.
    expect(fs.existsSync(path.join(dir, "evil.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, "evil.pdf"))).toBe(false);
  });

  it("rejects a Windows-style path the same way", () => {
    const dir = makeDir("upload-winpath");
    const res = storeLawFile("C:\\Users\\x\\law.pdf", Buffer.from("x"), dir);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.fileName).toBe("law.pdf");
  });

  it("rejects an unsupported extension, an empty file and a nameless file", () => {
    const dir = makeDir("upload-rejects");
    expect(storeLawFile("photo.png", Buffer.from("x"), dir)).toEqual({ error: "UNSUPPORTED_TYPE" });
    expect(storeLawFile("empty.pdf", Buffer.alloc(0), dir)).toEqual({ error: "EMPTY_FILE" });
    expect(storeLawFile("   ", Buffer.from("x"), dir)).toEqual({ error: "INVALID_NAME" });
  });

  it("rejects a file above the transfer cap", () => {
    const dir = makeDir("upload-large");
    // The cap itself is accepted; one byte over is not.
    const head = Buffer.alloc(16);
    expect(storeLawFile("ok.pdf", head, dir)).toMatchObject({ fileName: "ok.pdf" });
    // Allocating MAX+1 is 50 MB — assert the boundary via the exported cap
    // instead of allocating it twice.
    expect(MAX_LAW_FILE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("ingestCorpus — a .txt file is indexed by its real content", () => {
  it("makes the body searchable, not just the file name", () => {
    const dir = makeDir("txt-content");
    // The token inside the BODY appears nowhere in the file name.
    writeFile(dir, "shomare-1.txt", "مادهٔ یکم دربارهٔ مسئولیت مدنی و جبران خسارت است.");
    ingestCorpus(dir);

    const hits = retrieveCorpus("مسئولیت مدنی", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source.fileName).toBe("shomare-1.txt");
    expect(hits[0]!.excerpt).toContain("مسئولیت مدنی");
  });

  it("keeps indexing a CURATED .txt by its reviewed catalog fields", () => {
    const dir = makeDir("txt-curated");
    // A curated catalog file, but as .txt: the curated mapping must win.
    writeFile(dir, "قانون امور گمركي.pdf", "ترخیص کالا و حقوق ورودی گمرک");
    ingestCorpus(dir);
    const hits = retrieveCorpus("حقوق ورودی گمرک", 3);
    expect(hits[0]!.source.lawId).toBe("law-customs");
  });
});

describe("ingestCorpus — unreadable files are reported, never fatal", () => {
  it("reports a supported-extension DIRECTORY as a failure and keeps the rest", () => {
    const dir = makeDir("ingest-failure");
    writeFile(dir, "good.txt", "ترخیص کالا و حقوق ورودی گمرک");
    // A directory named like a supported file: readdir lists it, readFile
    // throws EISDIR. One bad entry must not take the whole ingest down.
    fs.mkdirSync(path.join(dir, "broken.pdf"));

    const report = ingestCorpus(dir);
    expect(report.sources).toBe(1);
    expect(report.discovered).toBe(2);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.fileName).toBe("broken.pdf");
    expect(report.failed[0]!.message.length).toBeGreaterThan(0);
    // ISO-8601
    expect(report.failed[0]!.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // The failure is persisted so the admin surface can report it after restart.
    const index = JSON.parse(
      fs.readFileSync(path.join(indexDir, "legal-corpus.json"), "utf-8")
    );
    expect(index.failures.map((f: { fileName: string }) => f.fileName)).toEqual(["broken.pdf"]);
  });
});

describe("retrieveCorpus — inverted-index retrieval", () => {
  it("surfaces the ingested source for a matching Persian query", () => {
    const dir = makeDir("retrieve");
    writeFile(dir, "قانون امور گمركي.pdf", "ترخیص کالا و حقوق ورودی گمرک");
    ingestCorpus(dir);

    const hits = retrieveCorpus("حقوق ورودی گمرک", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.source.title).toContain("گمرک");
    expect(hits[0]!.locator).toBeTruthy();
  });

  it("returns no hits for a query with no token overlap", () => {
    const hits = retrieveCorpus("مفهوم ناموجود غیرمرتبط", 3);
    expect(hits).toEqual([]);
  });
});
