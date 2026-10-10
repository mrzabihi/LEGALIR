// ============================================================
// LEGALIR — GET /api/v1/legal-library
// ============================================================

import { NextResponse } from "next/server";
import type { LegalContentType } from "@legalir/types";
import { filterLibraryItems, isPubliclyVisible, paginate, readLegalLibrary } from "@/lib/legal-library-db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const topic = url.searchParams.get("topic") ?? "";
  const sourceType = (url.searchParams.get("sourceType") ?? "") as LegalContentType | "";
  const sort = url.searchParams.get("sort") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  // Public endpoint — no session required, and ONLY published sources. Drafts
  // and archived sources must never leak here (or through any public surface).
  const { items } = readLegalLibrary();
  const published = items.filter(isPubliclyVisible);
  const filtered = filterLibraryItems(published, {
    search,
    topic,
    sourceType: sourceType || undefined,
    sort: (sort || undefined) as "newest" | "oldest" | "title" | "popular" | undefined,
  });

  const { items: paged, pagination } = paginate(filtered, page, pageSize);

  return NextResponse.json({ data: { items: paged, pagination }, meta: { requestId: crypto.randomUUID() } });
}
