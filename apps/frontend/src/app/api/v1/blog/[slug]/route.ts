// ============================================================
// LEGALIR — GET /api/v1/blog/[slug]
// ============================================================

import { NextResponse } from "next/server";
import { readBlog } from "@/lib/legal-library-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { details } = readBlog();
  const post = details[slug];

  if (!post) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "مطلب یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: post, meta: { requestId: crypto.randomUUID() } });
}
