// ============================================================
// LEGALIR — GET /api/v1/blog/[slug]
// ============================================================

import { NextResponse } from "next/server";
import { isBlogPostPubliclyVisible, readBlog } from "@/lib/legal-library-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { items, details } = readBlog();
  const post = details[slug];

  // An unpublished post is indistinguishable from a missing one to the public.
  if (!post || !isBlogPostPubliclyVisible(items.find((i) => i.slug === slug), post)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "مطلب یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: post, meta: { requestId: crypto.randomUUID() } });
}
