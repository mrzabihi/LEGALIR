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
import { getBookmarkedIds, projectSourceDetail, readPublishedSource } from "@/lib/legal-library-db";

/** The signed-in user, when a session cookie is present (optional — the
 *  library detail is public; the session only personalises the bookmark flag). */
function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Public endpoint — no session required. A source is served only when it is
  // PUBLISHED; drafts and archived sources 404 here (never leak their content,
  // even by direct id guess). `readPublishedSource` is the same rule the public
  // page and its metadata use, so all three surfaces agree by construction.
  const hit = readPublishedSource(id);
  if (!hit) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "منبع حقوقی یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  const userId = getUserId(request);
  const isBookmarked = userId ? getBookmarkedIds(userId).has(hit.item.id) : false;

  // The detail row is keyed by id; a published source without one still resolves
  // — from its real list item — so the card never dead-ends.
  const source: V1LegalSourceDetail = hit.detail
    ? { ...hit.detail, isBookmarked }
    : projectSourceDetail(hit.item, isBookmarked);

  return NextResponse.json({
    data: source,
    meta: { requestId: crypto.randomUUID() },
  });
}
