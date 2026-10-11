// ============================================================
// LEGALIR — GET /api/v1/legal-library/topics
// ============================================================

import { NextResponse } from "next/server";
import { isPubliclyVisible, readLegalLibrary } from "@/lib/legal-library-db";

export async function GET() {
  const { items, topics } = readLegalLibrary();

  // Public endpoint — a topic's live count reflects PUBLISHED sources only, so
  // a topic that has nothing published never advertises a phantom count.
  const published = items.filter(isPubliclyVisible);
  const counts = new Map<string, number>();
  for (const item of published) {
    if (item.topicSlug) counts.set(item.topicSlug, (counts.get(item.topicSlug) ?? 0) + 1);
  }

  const visible = topics
    .map((t) => ({ ...t, contentCount: counts.get(t.slug) ?? 0 }))
    .filter((t) => t.contentCount > 0);

  return NextResponse.json({ data: visible, meta: { requestId: crypto.randomUUID() } });
}
