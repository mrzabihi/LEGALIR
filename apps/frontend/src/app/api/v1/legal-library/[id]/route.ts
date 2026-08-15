// ============================================================
// LEGALIR — GET /api/v1/legal-library/[id]
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getBookmarkedIds, readLegalLibrary } from "@/lib/legal-library-db";

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
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  const { details } = readLegalLibrary();
  const source = details[id];

  if (!source) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "منبع حقوقی یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  const bookmarked = getBookmarkedIds(userId).has(id);
  return NextResponse.json({
    data: { ...source, isBookmarked: bookmarked },
    meta: { requestId: crypto.randomUUID() },
  });
}
