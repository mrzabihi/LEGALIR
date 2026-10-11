// ============================================================
// LEGALIR — GET /api/v1/blog
// ============================================================

import { NextResponse } from "next/server";
import { filterBlogItems, isBlogPostPubliclyVisible, paginate, readBlog } from "@/lib/legal-library-db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  // Only published posts reach the public list — a DRAFT/ARCHIVED post stays
  // in the admin store but is never served here (see isBlogPostPubliclyVisible).
  const { items, details } = readBlog();
  const published = items.filter((i) => isBlogPostPubliclyVisible(i, details[i.slug]));
  const filtered = filterBlogItems(published, { category, tag });

  const { items: paged, pagination } = paginate(filtered, page, pageSize);

  return NextResponse.json({ data: { items: paged, pagination }, meta: { requestId: crypto.randomUUID() } });
}
