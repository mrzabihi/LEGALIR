// ============================================================
// LEGALIR — GET /api/v1/documents/[id]/analysis (demo dataset)
// ============================================================
// Returns the stored risk report + extracted text, matching the
// V1DocumentAnalysisResponse contract.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument } from "@/lib/demo-seed";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const doc = getDemoDocument(userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }
  if (!doc.report) {
    return NextResponse.json(
      { code: "ANALYSIS_NOT_READY", message: "تحلیل سند هنوز آماده نیست", retryable: true },
      { status: 409 }
    );
  }

  return NextResponse.json({
    data: { report: doc.report, extractedText: doc.extractedText },
  });
}
