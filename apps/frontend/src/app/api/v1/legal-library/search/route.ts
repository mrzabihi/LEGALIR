// ============================================================
// LEGALIR — GET /api/v1/legal-library/search
// ============================================================

import { NextResponse } from "next/server";
import type { LegalContentType } from "@legalir/types";
import { filterLibraryItems, isPubliclyVisible, paginate, readLegalLibrary } from "@/lib/legal-library-db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const topic = url.searchParams.get("topic") ?? "";
  const sourceType = (url.searchParams.get("sourceType") ?? "") as LegalContentType | "";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  // Public endpoint — search runs over PUBLISHED sources only.
  const { items } = readLegalLibrary();
  const filtered = filterLibraryItems(items.filter(isPubliclyVisible), {
    search: q,
    topic,
    sourceType: sourceType || undefined,
  });

  const { items: paged, pagination } = paginate(filtered, page, pageSize);

  return NextResponse.json({
    data: { items: paged, pagination, query: q, normalizedQuery: q.trim().toLowerCase() },
    meta: { requestId: crypto.randomUUID() },
  });
}
