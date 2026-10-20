// ============================================================
// LEGALIR — Admin RAG source review (server-only)
// ============================================================
// The retrieval corpus itself (`legal-corpus.json`) is produced by the
// ingestion pipeline and is READ-ONLY here. Administrative review state —
// who reviewed a source, whether it is approved, published in the library,
// retired, or flagged — is kept in an overlay table keyed by source id so
// the ingested corpus stays reproducible.
//
// A source is only "active in retrieval" when it is approved/published AND
// its verification status is not unverified. Nothing is auto-approved.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import {
  MAX_LAW_FILE_BYTES,
  defaultCorpusDir,
  ingestCorpus,
  readCorpus,
  retrieveCorpus,
  storeLawFile,
  type CorpusFailure,
  type CorpusSource,
} from "@/lib/legal-corpus";
import type {
  RagPipelineStatus,
  RagRetrievalHit,
  RagRetrievalTestResult,
  RagReviewState,
  RagSource,
  RagIngestReport,
} from "@legalir/types";
import { matchesRow } from "@/lib/search/normalize";

const OVERLAY_TABLE = "rag_review_overlay";

/** Admin-authored review metadata for one corpus source. */
interface ReviewOverlay {
  sourceId: string;
  reviewState: RagReviewState;
  reviewerUserId: string | null;
  publishedInLibrary: boolean;
  /**
   * An operator's explicit "take this out of retrieval" switch — independent
   * of the review state, so disabling a published source does not throw away
   * the fact that it was reviewed and approved.
   */
  enabled: boolean;
  notes: string | null;
  evalScore: number | null;
  updatedAt: string;
}

function readOverlays(): ReviewOverlay[] {
  return readTable<ReviewOverlay>(OVERLAY_TABLE);
}

function overlayFor(sourceId: string): ReviewOverlay | undefined {
  return readOverlays().find((o) => o.sourceId === sourceId);
}

/** The default review state derived from the ingestion verification status. */
function initialStateFor(source: CorpusSource): RagReviewState {
  if (source.status === "repealed") return "retired";
  if (source.verificationStatus === "VERIFIED_OFFICIAL" || source.verificationStatus === "VERIFIED_SECONDARY") {
    return "indexed";
  }
  return "under_review";
}

/** Project a corpus source + its review overlay into an admin RagSource. */
function toRagSource(source: CorpusSource): RagSource {
  const overlay = overlayFor(source.id);
  const reviewState = overlay?.reviewState ?? initialStateFor(source);
  // Enabled defaults to TRUE: only an explicit disable removes a source.
  const enabled = overlay?.enabled !== false;
  // Both gates are required: the review state must admit retrieval AND the
  // operator must not have switched the source off.
  const activeInRetrieval =
    enabled && (reviewState === "approved" || reviewState === "published");
  const ts = source.ingestedAt;
  return {
    id: source.lawId ?? source.id,
    title: source.title,
    sourceType: source.sourceType,
    sourceTypeFa: source.sourceTypeFa,
    authority: source.authority,
    domain: source.sourceType,
    docNumber: null,
    docDate: null,
    jurisdiction: source.jurisdiction,
    validFrom: null,
    validTo: null,
    version: 1,
    retrievedFrom: source.fileName,
    reviewState,
    reviewerUserId: overlay?.reviewerUserId ?? null,
    enabled,
    activeInRetrieval,
    publishedInLibrary: overlay?.publishedInLibrary ?? false,
    pageCount: null,
    chunkCount: source.chunkCount,
    textHash: source.textHash,
    lastIndexedAt: source.ingestedAt,
    evalScore: overlay?.evalScore ?? null,
    notes: overlay?.notes ?? null,
    createdAt: ts,
    updatedAt: overlay?.updatedAt ?? ts,
  };
}

export interface RagQuery {
  reviewState?: RagReviewState;
  search?: string;
}

/** All RAG sources with their effective review state, newest first. */
export function listRagSources(query: RagQuery = {}): RagSource[] {
  const corpus = readCorpus();
  let items = corpus.sources.map(toRagSource);
  if (query.reviewState) items = items.filter((s) => s.reviewState === query.reviewState);
  if (query.search) {
    // Shared normalisation lane: Persian/Arabic digits and letter forms fold
    // before matching, so a Persian-numeral citation or a ك/ي title matches.
    items = items.filter((s) => matchesRow(query.search!, { texts: [s.title, s.authority] }));
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getRagSource(id: string): RagSource | undefined {
  return listRagSources().find((s) => s.id === id);
}

/** Aggregate review counts for the RAG dashboard header. */
export function ragReviewCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of listRagSources()) {
    counts[s.reviewState] = (counts[s.reviewState] ?? 0) + 1;
  }
  return counts;
}

export interface UpdateRagReviewInput {
  sourceId: string;
  reviewState: RagReviewState;
  reviewerUserId: string;
  publishedInLibrary?: boolean;
  enabled?: boolean;
  notes?: string | null;
  evalScore?: number | null;
}

/**
 * Record an administrative review decision for a source. Overwrites only the
 * overlay row — the ingested corpus is never mutated.
 */
export function updateRagReview(input: UpdateRagReviewInput): RagSource | { error: string } {
  const corpus = readCorpus();
  const source = corpus.sources.find((s) => (s.lawId ?? s.id) === input.sourceId);
  if (!source) return { error: "NOT_FOUND" };

  const rows = readOverlays();
  const idx = rows.findIndex((o) => o.sourceId === source.id);
  const prev = idx >= 0 ? rows[idx]! : undefined;
  const row: ReviewOverlay = {
    sourceId: source.id,
    reviewState: input.reviewState,
    reviewerUserId: input.reviewerUserId,
    publishedInLibrary: input.publishedInLibrary ?? prev?.publishedInLibrary ?? false,
    // An absent flag keeps the stored switch: a review edit must never
    // silently re-enable a source an operator deliberately switched off.
    enabled: input.enabled ?? prev?.enabled ?? true,
    notes: input.notes ?? prev?.notes ?? null,
    evalScore: input.evalScore ?? prev?.evalScore ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  writeTable(OVERLAY_TABLE, rows);
  return toRagSource(source);
}

// ---------------------------------------------------------------------------
// §1 — The single knowledge/RAG pipeline (read + operate, never a parallel one)
// ---------------------------------------------------------------------------
// Everything below reads or re-runs the ONE ingestion pipeline that also feeds
// chat retrieval (`lib/legal-corpus`). The admin panel never builds a second
// corpus: it inspects the same `.data/legal-corpus.json` and, when an operator
// adds law files to the source folder, re-runs `ingestCorpus` so those files
// enter the very pipeline the assistant already queries.

import fs from "node:fs";
import path from "node:path";
import { LAW_SOURCES } from "@/lib/law-catalog";
import { normalizePersian } from "@/lib/legal-corpus";

/** Corpus-level status for the Knowledge center header. */
export function getRagPipelineStatus(): RagPipelineStatus {
  const index = readCorpus();
  const active = listRagSources().filter((s) => s.activeInRetrieval).length;
  let lastIngestedAt: string | null = null;
  for (const s of index.sources) {
    if (!lastIngestedAt || s.ingestedAt > lastIngestedAt) lastIngestedAt = s.ingestedAt;
  }

  const corpusDir = defaultCorpusDir();
  const present =
    fs.existsSync(corpusDir)
      ? fs
          .readdirSync(corpusDir)
          .filter((f) => [".pdf", ".docx", ".txt"].includes(path.extname(f).toLowerCase()))
      : [];
  const indexedNames = new Set(index.sources.map((s) => normalizePersian(s.fileName)));
  const unindexed = present.filter((f) => !indexedNames.has(normalizePersian(f)));

  return {
    corpusVersion: index.version,
    corpusDir,
    sourceCount: index.sources.length,
    chunkCount: index.chunks.length,
    tokenCount: Object.keys(index.inverted).length,
    activeInRetrieval: active,
    lastIngestedAt,
    // Files discovered on disk that ingest skipped (not yet part of the corpus).
    unindexedFiles: unindexed,
    // Files the last ingest could NOT read. Distinct from `unindexedFiles`:
    // those are fine files awaiting an ingest, these are files that failed it.
    ingestFailures: [...(index.failures ?? [])].sort((a, b) => b.at.localeCompare(a.at)),
    maxUploadBytes: MAX_LAW_FILE_BYTES,
  };
}

/** One source with its searchable chunks, for the detail drawer. */
export function getRagSourceDetail(
  id: string
): { source: RagSource; chunks: { id: string; locator: string | null; text: string }[] } | undefined {
  const source = getRagSource(id);
  if (!source) return undefined;
  const index = readCorpus();
  // A RagSource id is either a curated `law-*` id or a `corpus-*` id; both sit
  // on the underlying CorpusSource, so match on either.
  const corpus = index.sources.find((s) => (s.lawId ?? s.id) === id);
  if (!corpus) return { source, chunks: [] };
  return {
    source,
    chunks: index.chunks
      .filter((c) => c.sourceId === corpus.id)
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ id: c.id, locator: c.locator, text: c.text })),
  };
}

/**
 * Run a retrieval query through the SAME pipeline the assistant uses, so an
 * operator can verify a source is actually reachable. Honesty: the hit list is
 * the real output of `retrieveCorpus`, never a simulated one.
 */
export function testRagRetrieval(query: string, maxResults = 5): RagRetrievalTestResult | { error: string } {
  const trimmed = query.trim();
  if (!trimmed) return { error: "QUERY_REQUIRED" };
  const limit = Math.min(Math.max(Math.round(maxResults) || 5, 1), 20);
  const hits = retrieveCorpus(trimmed, limit);
  const status = getRagPipelineStatus();
  const items: RagRetrievalHit[] = hits.map((h) => {
    const source = listRagSources().find((s) => (s.id === (h.source.lawId ?? h.source.id)));
    return {
      chunkId: h.chunkId,
      sourceId: source?.id ?? h.source.id,
      title: h.source.title,
      locator: h.locator,
      excerpt: h.excerpt,
      score: h.score,
      // Whether this hit is actually eligible for retrieval (approved/published).
      activeInRetrieval: source?.activeInRetrieval ?? false,
    };
  });
  return { query: trimmed, activeSources: status.activeInRetrieval, totalSources: status.sourceCount, hits: items };
}

/**
 * Re-run ingestion over the source folder. Files already ingested are deduped
 * by content hash, so this is idempotent: newly added law files enter the ONE
 * pipeline and existing review overlays are preserved.
 */
export function reingestRagCorpus(): RagIngestReport {
  const report = ingestCorpus();
  return {
    discovered: report.discovered,
    duplicatesSkipped: report.duplicatesSkipped,
    sources: report.sources,
    chunks: report.chunks,
    tokens: report.tokens,
    corpusDir: report.corpusDir,
    failed: report.failed,
  };
}

// ---------------------------------------------------------------------------
// §2 — Ingestion operations: upload a law file, retry a failed ingest
// ---------------------------------------------------------------------------

export interface UploadRagFileResult {
  fileName: string;
  bytes: number;
  /** The ingest that followed the write, so the caller sees its real effect. */
  ingest: RagIngestReport;
}

/**
 * Write one uploaded law file into the pipeline's source folder and ingest it.
 *
 * The upload feeds the SAME one pipeline chat retrieval reads — there is no
 * separate admin corpus. The write is rejected outright when the bytes are
 * not a permitted type or exceed the transfer cap, so nothing partial or
 * unsupported ever lands in the folder.
 */
export function uploadRagFile(
  fileName: string,
  bytes: Buffer
): UploadRagFileResult | { error: string } {
  const stored = storeLawFile(fileName, bytes);
  if ("error" in stored) return { error: stored.error };
  const report = reingestRagCorpus();
  return { fileName: stored.fileName, bytes: stored.bytes, ingest: report };
}

/**
 * Retry a source whose ingest previously failed.
 *
 * "Retry" is honest about what it can do: ingestion is deterministic over the
 * files on disk, so re-running it either now reads the file (and the source
 * leaves the failed state) or fails again with the SAME reason. This function
 * re-ingests and reports which of those happened; it never pretends success.
 */
export function retryRagIngestion(): {
  report: RagIngestReport;
  /** File names still unreadable after the retry. */
  stillFailing: string[];
} {
  const report = reingestRagCorpus();
  return { report, stillFailing: report.failed.map((f) => f.fileName) };
}

/** Unreadable files from the last ingest, for the pipeline header. */
export function ragIngestFailures(): CorpusFailure[] {
  const failures = readCorpus().failures ?? [];
  return [...failures].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Retry ONE source that an operator had marked «ناموفق».
 *
 * The retry re-runs the real ingest and then inspects its outcome:
 *   • the file is readable again  → the source leaves `failed` (back to `indexed`);
 *   • it is still unreadable      → the state STAYS failed and the real reason
 *                                   is returned, never a pretend success;
 *   • the file is gone            → NOT_FOUND, because there is nothing to retry.
 */
export function retryRagSource(
  sourceId: string,
  reviewerUserId: string
): RagSource | { error: string; message?: string } {
  const before = getRagSource(sourceId);
  if (!before) return { error: "NOT_FOUND" };

  const report = reingestRagCorpus();
  const correlation = before.retrievedFrom;
  const stillFailing = correlation
    ? report.failed.find((f) => normalizePersian(f.fileName) === normalizePersian(correlation))
    : undefined;

  const after = getRagSource(sourceId);
  if (!after) {
    // The source vanished from the corpus — the file is no longer on disk.
    return { error: "NOT_FOUND", message: "فایل منبع دیگر در پوشهٔ منابع وجود ندارد" };
  }
  if (stillFailing) {
    return { error: "STILL_FAILING", message: stillFailing.message };
  }
  if (after.reviewState !== "failed") return after;

  return (
    updateRagReview({
      sourceId,
      reviewState: "indexed",
      reviewerUserId,
      enabled: before.enabled,
    }) as RagSource
  );
}

export const RAG_UPLOAD_MAX_BYTES = MAX_LAW_FILE_BYTES;

/** How many curated law-catalog files matched a file on disk (indexable coverage). */
export function lawCatalogCoverage(): { curated: number; ingested: number } {
  const index = readCorpus();
  const ingestedNames = new Set(index.sources.map((s) => normalizePersian(s.fileName)));
  const matched = LAW_SOURCES.filter((l) => ingestedNames.has(normalizePersian(l.fileName))).length;
  return { curated: LAW_SOURCES.length, ingested: matched };
}
