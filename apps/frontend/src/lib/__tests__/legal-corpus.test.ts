import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizePersian, tokenize } from "../legal-corpus/normalize";
import { chunkText, ingestCorpus, retrieveCorpus } from "../legal-corpus/corpus";

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

afterAll(() => {
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
      fs.readFileSync(path.join(process.cwd(), ".data", "legal-corpus.json"), "utf-8")
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
      fs.readFileSync(path.join(process.cwd(), ".data", "legal-corpus.json"), "utf-8")
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
