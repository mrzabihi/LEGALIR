// ============================================================
// LEGALIR — Local Legal Knowledge Corpus (ingest + index + retrieve)
// ============================================================
// A dependency-free ingestion pipeline that turns the official law files
// under «iran legal» into a searchable, citable corpus persisted as a
// JSON DB table (.data/legal-corpus.json).
//
// Pipeline:
//   discover → validate → hash(dedup) → map metadata → normalize
//   → chunk → inverted-index → persist
//
// PDF/DOCX binaries are NOT parsed (no native PDF text extractor in the
// dependency set). Instead each file is fingerprinted by SHA-256 and mapped
// to its hand-curated structured source in law-catalog.ts (title, article
// locator, verbatim-ish excerpt, summary, keywords), which is then chunked
// and indexed. This keeps the pipeline honest (real files are discovered,
// hashed, deduped and indexed) without inventing extracted text.
//
// `.txt` files are the exception: they need no extractor, so their real
// content is indexed and they are genuinely searchable.
//
// A file that cannot be READ is reported in `failures[]` (persisted with the
// index) rather than aborting the ingest or vanishing silently.
// ============================================================

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { LAW_SOURCES } from "../law-catalog";
import { normalizePersian, tokenize } from "./normalize";
import type { LegalContentType, VerificationStatus } from "@legalir/types";

export const CORPUS_VERSION = "legalir-corpus-v1";
const CORPUS_FILE = "legal-corpus.json";
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

// ============================================================
// Entity shapes (persisted)
// ============================================================

export interface CorpusChunk {
  id: string;
  sourceId: string;
  /** Normalized chunk text (searchable). */
  text: string;
  /** Article/provision locator, e.g. «ماده ۲۳۰ قانون مدنی». */
  locator: string | null;
  order: number;
}

export interface CorpusSource {
  id: string;
  /** Canonical `law-*` id when this file matched a curated catalog entry. */
  lawId: string | null;
  fileName: string;
  title: string;
  sourceType: LegalContentType;
  sourceTypeFa: string;
  authority: string;
  jurisdiction: string;
  articleSection: string;
  excerpt: string;
  summary: string;
  keywords: string[];
  verificationStatus: VerificationStatus;
  status: string;
  /** SHA-256 of the raw file bytes — used for dedup + idempotency. */
  textHash: string;
  bytes: number;
  chunkCount: number;
  ingestedAt: string;
}

/** A discovered file that could not be read into the corpus. */
export interface CorpusFailure {
  fileName: string;
  message: string;
  /** ISO-8601 instant of the failed ingest attempt. */
  at: string;
}

export interface CorpusIndex {
  version: string;
  sources: CorpusSource[];
  chunks: CorpusChunk[];
  /** token → chunkIds (inverted index for retrieval). */
  inverted: Record<string, string[]>;
  /**
   * Files the last ingest could not read. Persisted so the admin surface
   * reports a real failure rather than silently dropping the file.
   */
  failures?: CorpusFailure[];
}

// ============================================================
// Filesystem primitives
// ============================================================

function dataDir(): string {
  // The persisted index lives beside the other DB tables by default. The
  // override exists so an isolated caller (a test, a staging tool) can point
  // the pipeline at a throwaway directory instead of the live `.data`, which
  // it would otherwise rewrite with its own synthetic corpus.
  const dir =
    process.env["LEGALIR_CORPUS_DATA_DIR"] || path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function defaultCorpusDir(): string {
  return (
    process.env["LEGALIR_LEGAL_CORPUS_PATH"] ||
    path.resolve(process.cwd(), "..", "..", "iran legal")
  );
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// ============================================================
// Discovery + validation
// ============================================================

interface DiscoveredFile {
  absPath: string;
  fileName: string;
  ext: string;
  bytes: Buffer;
  hash: string;
  sizeBytes: number;
}

/**
 * Read the source folder. A file that cannot be read (permissions, a
 * directory with a supported extension, a vanished file) is REPORTED as a
 * failure instead of aborting the whole ingest — one bad file must not take
 * every other law out of the corpus.
 */
function discover(corpusDir: string): {
  files: DiscoveredFile[];
  failures: CorpusFailure[];
} {
  if (!fs.existsSync(corpusDir)) return { files: [], failures: [] };
  const at = new Date().toISOString();
  const files: DiscoveredFile[] = [];
  const failures: CorpusFailure[] = [];

  for (const f of fs
    .readdirSync(corpusDir)
    .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "fa"))) {
    const absPath = path.join(corpusDir, f);
    try {
      const bytes = fs.readFileSync(absPath);
      files.push({
        absPath,
        fileName: f,
        ext: path.extname(f).toLowerCase(),
        bytes,
        hash: sha256(bytes),
        sizeBytes: bytes.length,
      });
    } catch (err) {
      failures.push({
        fileName: f,
        message: err instanceof Error ? err.message : String(err),
        at,
      });
    }
  }
  return { files, failures };
}

// ============================================================
// Upload — the only write path into the source folder
// ============================================================

/** Upload cap. The corpus only fingerprints bytes, so this is a transfer limit. */
export const MAX_LAW_FILE_BYTES = 50 * 1024 * 1024;

export interface StoredLawFile {
  fileName: string;
  bytes: number;
}

/**
 * Validate and write one uploaded law file into the pipeline's source folder,
 * then let the caller re-ingest so it enters the ONE corpus.
 *
 * The name is reduced to a bare basename: an uploaded name must never be able
 * to select a directory (`../x.pdf`, `C:\…`) that would let an admin upload
 * write outside the corpus folder.
 */
export function storeLawFile(
  rawFileName: string,
  bytes: Buffer,
  corpusDir: string = defaultCorpusDir()
): StoredLawFile | { error: "INVALID_NAME" | "UNSUPPORTED_TYPE" | "EMPTY_FILE" | "TOO_LARGE" | "STORE_FAILED" } {
  const fileName = path.basename(String(rawFileName ?? "").replace(/\\/g, "/")).trim();
  if (!fileName || fileName === "." || fileName === ".." || fileName.includes("/")) {
    return { error: "INVALID_NAME" };
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return { error: "UNSUPPORTED_TYPE" };
  if (bytes.length === 0) return { error: "EMPTY_FILE" };
  if (bytes.length > MAX_LAW_FILE_BYTES) return { error: "TOO_LARGE" };

  try {
    fs.mkdirSync(corpusDir, { recursive: true });
    fs.writeFileSync(path.join(corpusDir, fileName), bytes);
  } catch {
    return { error: "STORE_FAILED" };
  }
  return { fileName, bytes: bytes.length };
}

// ============================================================
// Chunking
// ============================================================

export function chunkText(text: string, maxChars = 900, overlap = 120): string[] {
  const norm = normalizePersian(text);
  if (norm.length <= maxChars) return [norm];

  const chunks: string[] = [];
  let start = 0;
  while (start < norm.length) {
    let end = Math.min(start + maxChars, norm.length);
    // Prefer to break at a sentence boundary near the end.
    if (end < norm.length) {
      const slice = norm.slice(start, end);
      const lastDot = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("؟"), slice.lastIndexOf("!"));
      if (lastDot > maxChars * 0.5) end = start + lastDot + 1;
    }
    chunks.push(norm.slice(start, end).trim());
    if (end >= norm.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter((c) => c.length > 0);
}

// ============================================================
// Inverted index
// ============================================================

function buildInvertedIndex(chunks: CorpusChunk[]): Record<string, string[]> {
  const inverted: Record<string, string[]> = {};
  for (const chunk of chunks) {
    const tokens = new Set(tokenize(chunk.text));
    for (const t of tokens) {
      (inverted[t] ??= []).push(chunk.id);
    }
  }
  return inverted;
}

// ============================================================
// Ingest
// ============================================================

export interface IngestReport {
  corpusDir: string;
  discovered: number;
  duplicatesSkipped: number;
  sources: number;
  chunks: number;
  tokens: number;
  output: string;
  /** Files discovered but unreadable — reported, never silently dropped. */
  failed: CorpusFailure[];
}

export function ingestCorpus(corpusDir: string = defaultCorpusDir()): IngestReport {
  const { files, failures } = discover(corpusDir);
  const ingestedAt = new Date().toISOString();
  const sources: CorpusSource[] = [];
  const chunks: CorpusChunk[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    // Dedup by content hash.
    if (seen.has(file.hash)) continue;
    seen.add(file.hash);

    // Map the discovered file to its curated law-catalog source (if any),
    // matching on the original file name.
    const curated = LAW_SOURCES.find(
      (l) => normalizePersian(l.fileName) === normalizePersian(file.fileName)
    );

    const sourceId = `corpus-${file.hash.slice(0, 12)}`;
    const title = curated?.title ?? file.fileName.replace(/\.[^.]+$/, "");
    const articleSection = curated?.articleSection ?? "";
    const excerpt = curated?.excerpt ?? "";
    const summary = curated?.summary ?? "";
    const keywords = curated?.keywords ?? [];
    const authority = curated?.publicationAuthority ?? "نامشخص";
    const jurisdiction = curated?.jurisdiction ?? "جمهوری اسلامی ایران";
    const sourceTypeFa = curated?.sourceTypeFa ?? "قانون";
    const sourceType: LegalContentType = "LAW_ARTICLE";
    const verificationStatus: VerificationStatus = curated
      ? "VERIFIED_OFFICIAL"
      : "DEMO_VERIFIED";

    // Searchable text.
    //
    // A `.txt` law needs no extractor — it IS text — so its real content is
    // indexed and the file becomes genuinely retrievable. PDF/DOCX binaries
    // cannot be parsed with the dependency set, so for those the searchable
    // text stays the curated catalog fields (and never invented content).
    // A curated file keeps its curated fields even when it is a .txt, so the
    // hand-reviewed excerpt is not diluted by a raw dump.
    const plainText = !curated && file.ext === ".txt" ? file.bytes.toString("utf-8").trim() : "";
    const searchable = [title, articleSection, excerpt, summary, keywords.join(" "), plainText]
      .join(" ")
      .trim();

    const textChunks = chunkText(searchable);
    const sourceChunks: CorpusChunk[] = textChunks.map((text, i) => ({
      id: `${sourceId}-chunk-${i + 1}`,
      sourceId,
      text,
      locator: articleSection || null,
      order: i + 1,
    }));

    sources.push({
      id: sourceId,
      lawId: curated?.id ?? null,
      fileName: file.fileName,
      title,
      sourceType,
      sourceTypeFa,
      authority,
      jurisdiction,
      articleSection,
      excerpt,
      summary,
      keywords,
      verificationStatus,
      status: curated?.status ?? "valid",
      textHash: file.hash,
      bytes: file.sizeBytes,
      chunkCount: sourceChunks.length,
      ingestedAt,
    });
    chunks.push(...sourceChunks);
  }

  const inverted = buildInvertedIndex(chunks);
  const index: CorpusIndex = { version: CORPUS_VERSION, sources, chunks, inverted, failures };

  const output = path.join(dataDir(), CORPUS_FILE);
  fs.writeFileSync(output, JSON.stringify(index, null, 2), "utf-8");

  return {
    corpusDir,
    discovered: files.length + failures.length,
    duplicatesSkipped: files.length - sources.length,
    sources: sources.length,
    chunks: chunks.length,
    tokens: Object.keys(inverted).length,
    output,
    failed: failures,
  };
}

// ============================================================
// Read (lazy ingest on first access)
// ============================================================

export function readCorpus(): CorpusIndex {
  const file = path.join(dataDir(), CORPUS_FILE);
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as CorpusIndex;
      if (parsed.version === CORPUS_VERSION) return parsed;
    } catch {
      // fall through to re-ingest
    }
  }
  ingestCorpus();
  return JSON.parse(fs.readFileSync(file, "utf-8")) as CorpusIndex;
}

// ============================================================
// Retrieval
// ============================================================

export interface CorpusHit {
  chunkId: string;
  source: CorpusSource;
  locator: string | null;
  excerpt: string;
  score: number;
}

export function retrieveCorpus(query: string, maxResults = 3): CorpusHit[] {
  const tokens = tokenize(normalizePersian(query));
  if (tokens.length === 0) return [];

  const index = readCorpus();
  const byChunk = new Map(index.chunks.map((c) => [c.id, c]));
  const bySource = new Map(index.sources.map((s) => [s.id, s]));

  const scored = new Map<string, number>();
  for (const token of tokens) {
    for (const chunkId of index.inverted[token] ?? []) {
      scored.set(chunkId, (scored.get(chunkId) ?? 0) + 1);
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([chunkId, score]) => {
      const chunk = byChunk.get(chunkId)!;
      const source = bySource.get(chunk.sourceId)!;
      return {
        chunkId,
        source,
        locator: chunk.locator,
        excerpt: source.excerpt || chunk.text.slice(0, 200),
        score,
      };
    });
}
