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
import { readCorpus, type CorpusSource } from "@/lib/legal-corpus";
import type { RagReviewState, RagSource } from "@legalir/types";

const OVERLAY_TABLE = "rag_review_overlay";

/** Admin-authored review metadata for one corpus source. */
interface ReviewOverlay {
  sourceId: string;
  reviewState: RagReviewState;
  reviewerUserId: string | null;
  publishedInLibrary: boolean;
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
  const activeInRetrieval = reviewState === "approved" || reviewState === "published";
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
    const q = query.search.toLowerCase();
    items = items.filter(
      (s) => s.title.toLowerCase().includes(q) || s.authority.toLowerCase().includes(q)
    );
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
    notes: input.notes ?? prev?.notes ?? null,
    evalScore: input.evalScore ?? prev?.evalScore ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  writeTable(OVERLAY_TABLE, rows);
  return toRagSource(source);
}
