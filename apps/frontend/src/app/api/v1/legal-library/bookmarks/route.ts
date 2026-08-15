// ============================================================
// LEGALIR — GET /api/v1/legal-library/bookmarks
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getBookmarkedIds, paginate, readLegalLibrary } from "@/lib/legal-library-db";

function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  const bookmarkedIds = getBookmarkedIds(userId);
  const { items } = readLegalLibrary();
  const bookmarkedItems = items.filter((i) => bookmarkedIds.has(i.id));

  const { items: paged, pagination } = paginate(bookmarkedItems, page, pageSize);

  return NextResponse.json({ data: { items: paged, pagination }, meta: { requestId: crypto.randomUUID() } });
}
