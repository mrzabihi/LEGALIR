// ============================================================
// LEGALIR — GET /api/v1/legal-requests/[id]
// ============================================================
// Returns the full consultation case room for one request: the request,
// its transition history, the assigned lawyer, the message thread and
// attachment metadata. Readable by the owner AND the assigned lawyer —
// anyone else gets 404 (not 403), so a foreign request is
// indistinguishable from a missing one (no IDOR/BOLA enumeration).
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getRequestById } from "@/lib/legal-request-db";
import { buildConsultationDetail, canViewConsultation } from "@/lib/consultation-detail";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row || !canViewConsultation(row, auth.ctx.userId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({
    data: buildConsultationDetail(row, auth.ctx.userId),
  });
}
