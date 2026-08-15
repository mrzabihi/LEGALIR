// ============================================================
// LEGALIR — GET /api/v1/legal-library
// ============================================================

import { NextResponse } from "next/server";
import type { LegalContentType } from "@legalir/types";
import { findSessionById } from "@/lib/db";
import { filterLibraryItems, paginate, readLegalLibrary } from "@/lib/legal-library-db";

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
  const search = url.searchParams.get("search") ?? "";
  const topic = url.searchParams.get("topic") ?? "";
  const sourceType = (url.searchParams.get("sourceType") ?? "") as LegalContentType | "";
  const sort = url.searchParams.get("sort") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  const { items } = readLegalLibrary();
  const filtered = filterLibraryItems(items, {
    search,
    topic,
    sourceType: sourceType || undefined,
    sort: (sort || undefined) as "newest" | "oldest" | "title" | "popular" | undefined,
  });

  const { items: paged, pagination } = paginate(filtered, page, pageSize);

  return NextResponse.json({ data: { items: paged, pagination }, meta: { requestId: crypto.randomUUID() } });
}
