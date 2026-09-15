// ============================================================
// LEGALIR — GET /api/v1/sources/[id]
// ============================================================
// Resolves a source id to a Phase-8 V1SourceDetail for the chat
// «مستندات» / «ارجاعات» tabs. Resolution order:
//   1. Official law catalog (16 files) — ids like `law-*`.
//   2. Legal Library fixtures — ids like `src-*`.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getLawById,
  lawSourceToV1SourceDetail,
} from "@/lib/law-catalog";
import { readLegalLibrary } from "@/lib/legal-library-db";
import { readCorpus } from "@/lib/legal-corpus";
import type { CorpusSource } from "@/lib/legal-corpus";
import type {
  LegalContentType,
  SourceType,
  SourceStatus,
  V1LegalSourceDetail,
  V1SourceDetail,
} from "@legalir/types";

const LEGAL_CONTENT_TYPE_TO_SOURCE_TYPE: Partial<Record<LegalContentType, SourceType>> = {
  LAW_ARTICLE: "law",
  REGULATION: "regulation",
  UNIFICATION_RULING: "precedent",
  JUDICIAL_DECISION: "precedent",
  LEGAL_GUIDE: "opinion",
  HOW_TO: "opinion",
  CHECKLIST: "opinion",
  FAQ: "opinion",
  LEGAL_TOOL: "opinion",
  TEMPLATE_GUIDE: "opinion",
  SOURCE: "opinion",
};

function toSourceStatus(status: string | undefined): SourceStatus {
  const s = (status ?? "").toLowerCase();
  if (s.includes("اصلاح") || s.includes("amended")) return "amended";
  if (s.includes("منسوخ") || s.includes("expired") || s.includes("supersed")) return "expired";
  if (s.includes("نیاز") || s.includes("review")) return "needs_review";
  return "valid";
}

function legalLibraryDetailToSourceDetail(d: V1LegalSourceDetail): V1SourceDetail {
  return {
    id: d.id,
    sourceType: LEGAL_CONTENT_TYPE_TO_SOURCE_TYPE[d.sourceType] ?? "law",
    sourceTypeFa: d.sourceTypeFa,
    title: d.title,
    articleSection: d.articleNumber ?? d.lawName ?? null,
    publicationAuthority: d.authority,
    jurisdiction: d.jurisdiction,
    effectiveDate: d.effectiveDate ?? d.publicationDate ?? "",
    versionDate: d.lastAmendmentDate ?? null,
    excerpt: d.body ?? d.simpleExplanation ?? d.summary,
    url: d.sourceUrl ?? d.officialSourceUrl ?? null,
    documentIdentifier: d.judgmentNumber ?? null,
    status: toSourceStatus(d.status),
    availability: "available",
  };
}

function corpusSourceToV1SourceDetail(s: CorpusSource): V1SourceDetail {
  return {
    id: s.id,
    sourceType: LEGAL_CONTENT_TYPE_TO_SOURCE_TYPE[s.sourceType] ?? "law",
    sourceTypeFa: s.sourceTypeFa,
    title: s.title,
    articleSection: s.articleSection || null,
    publicationAuthority: s.authority,
    jurisdiction: s.jurisdiction,
    effectiveDate: "",
    versionDate: null,
    excerpt: s.excerpt || s.summary,
    url: null,
    documentIdentifier: s.fileName,
    status: toSourceStatus(s.status),
    availability: "available",
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;

  // 1) Official law catalog
  const law = getLawById(id);
  if (law) {
    return NextResponse.json({ data: lawSourceToV1SourceDetail(law) });
  }

  // 2) Legal Library fixtures
  const library = readLegalLibrary();
  const detail = library.details?.[id];
  if (detail) {
    return NextResponse.json({ data: legalLibraryDetailToSourceDetail(detail) });
  }

  // 3) Ingested legal corpus (corpus-* source ids, or a law's canonical
  //    lawId when a file matched the catalog). Lazy-ingests on first use.
  const corpusSource = readCorpus().sources.find((s) => s.id === id);
  if (corpusSource) {
    return NextResponse.json({ data: corpusSourceToV1SourceDetail(corpusSource) });
  }

  return NextResponse.json(
    { code: "NOT_FOUND", message: "منبع یافت نشد" },
    { status: 404 }
  );
}
