// ============================================================
// LEGALIR — GET /api/v1/intake/schemas/[category]
// ============================================================
// Returns the current versioned intake schema for a legal category. The
// wizard renders directly from this payload, so the questionnaire is
// data-driven and can evolve without a UI change.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildIntakeSchema, isSupportedCategory } from "@/lib/intake-schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;
  if (!isSupportedCategory(category)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "دسته‌بندی پشتیبانی نمی‌شود" },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: buildIntakeSchema(category) });
}
