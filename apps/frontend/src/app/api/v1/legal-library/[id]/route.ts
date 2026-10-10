// ============================================================
// LEGALIR — GET /api/v1/legal-library/[id]
// ============================================================
// Public read of a single library source. It is served ONLY when the source is
// PUBLISHED — drafts and archived rows 404 here, so their content can never be
// retrieved, even by guessing an id. When a source has no stored detail row
// yet, the response is built from the real list item (title, summary, type,
// authority …) with every unknown field left null — never invented.
// ============================================================

import { NextResponse } from "next/server";
import type { V1LegalSourceDetail } from "@legalir/types";
import { findSessionById } from "@/lib/db";
import {
  getBookmarkedIds,
  isPubliclyVisible,
  readLegalLibrary,
  type StoredLegalListItem,
} from "@/lib/legal-library-db";

/** The signed-in user, when a session cookie is present (optional — the
 *  library detail is public; the session only personalises the bookmark flag). */
function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

/**
 * A detail projection for a published source that has no stored detail row yet.
 * Every value comes from the real list item; unknown fields are null (never a
 * placeholder document). This keeps the card → detail journey working for
 * sources whose full text an operator has not authored yet.
 */
function detailFromListItem(item: StoredLegalListItem, isBookmarked: boolean): V1LegalSourceDetail {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceTypeFa: item.sourceTypeFa,
    title: item.title,
    shortTitle: null,
    lawName: null,
    articleNumber: null,
    judgmentNumber: null,
    authority: item.authority,
    jurisdiction: "ایران",
    publicationDate: item.publishedDate,
    effectiveDate: null,
    lastAmendmentDate: null,
    status: "معتبر",
    summary: item.summary,
    body: null,
    simpleExplanation: null,
    practicalApplication: null,
    keyPoints: null,
    examples: null,
    sourceUrl: null,
    officialSourceUrl: null,
    sourceProvider: null,
    sourceDomain: null,
    verificationStatus: item.verificationStatus,
    lastVerifiedAt: null,
    version: 1,
    relatedSources: [],
    relatedGuides: [],
    relatedServices: [],
    legalReviewStatus: "NOT_REVIEWED",
    isBookmarked,
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { items, details } = readLegalLibrary();

  // Public endpoint — no session required. A source is served only when it is
  // PUBLISHED; drafts and archived sources 404 here (never leak their content,
  // even by direct id guess).
  const item = items.find((i) => i.id === id || i.slug === id);
  if (!item || !isPubliclyVisible(item)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "منبع حقوقی یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  const userId = getUserId(request);
  const isBookmarked = userId ? getBookmarkedIds(userId).has(item.id) : false;

  // The detail row is keyed by id; a published source without one still resolves
  // — from its real list item — so the card never dead-ends.
  const stored = details[item.id];
  const source: V1LegalSourceDetail = stored
    ? { ...stored, isBookmarked }
    : detailFromListItem(item, isBookmarked);

  return NextResponse.json({
    data: source,
    meta: { requestId: crypto.randomUUID() },
  });
}
