// ============================================================
// LEGALIR — GET /api/v1/legal-requests/[id]
// ============================================================
// Returns one request plus its full transition history. Owner-only: a
// request belonging to another user is indistinguishable from a missing
// one (404), preventing IDOR/BOLA enumeration.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getRequestById, listRequestEvents } from "@/lib/legal-request-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row || row.userId !== auth.ctx.userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({
    data: { request: row, events: listRequestEvents(id) },
  });
}
