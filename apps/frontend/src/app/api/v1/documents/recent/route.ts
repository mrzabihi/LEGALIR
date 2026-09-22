// ============================================================
// LEGALIR — GET /api/v1/documents/recent
// ============================================================
// The attach picker's source: the requesting user's most recent documents,
// newest first. Metadata only — never the file bytes — so the picker can
// list documents without downloading them.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { listRecentDocuments } from "@/lib/ai/attachments";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "12", 10) || 12)
  );

  return NextResponse.json({
    data: { items: listRecentDocuments(userId, limit) },
  });
}
