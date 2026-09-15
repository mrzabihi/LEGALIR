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

export interface CorpusIndex {
  version: string;
  sources: CorpusSource[];
  chunks: CorpusChunk[];
  /** token → chunkIds (inverted index for retrieval). */
  inverted: Record<string, string[]>;
}

// ============================================================
// Filesystem primitives
// ============================================================

function dataDir(): string {
  const dir = path.resolve(process.cwd(), ".data");
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

function discover(corpusDir: string): DiscoveredFile[] {
  if (!fs.existsSync(corpusDir)) return [];
  return fs
    .readdirSync(corpusDir)
    .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => {
      const absPath = path.join(corpusDir, f);
      const bytes = fs.readFileSync(absPath);
      return {
        absPath,
        fileName: f,
        ext: path.extname(f).toLowerCase(),
        bytes,
        hash: sha256(bytes),
        sizeBytes: bytes.length,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName, "fa"));
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
}

export function ingestCorpus(corpusDir: string = defaultCorpusDir()): IngestReport {
  const files = discover(corpusDir);
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

    // Searchable text: the curated structured fields.
    const searchable = [title, articleSection, excerpt, summary, keywords.join(" ")]
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
  const index: CorpusIndex = { version: CORPUS_VERSION, sources, chunks, inverted };

  const output = path.join(dataDir(), CORPUS_FILE);
  fs.writeFileSync(output, JSON.stringify(index, null, 2), "utf-8");

  return {
    corpusDir,
    discovered: files.length,
    duplicatesSkipped: files.length - sources.length,
    sources: sources.length,
    chunks: chunks.length,
    tokens: Object.keys(inverted).length,
    output,
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
