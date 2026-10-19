// ============================================================
// LEGALIR — GET /api/v1/lawyer/referrals/[id]
// ============================================================
// The full referral detail: client identity, SLA block, timeline, messages,
// attachments, price and the verbs the server will accept right now.
//
// Opening the request records the first VIEW once (viewed ≠ accepted), which
// is what the SLA response clock is judged against.
//
// A request that is not assigned to this lawyer returns 404 — never 403 —
// so the existence of another lawyer's work is not disclosed.
// ============================================================

import { NextResponse } from "next/server";
import { notFound } from "@/lib/rbac";
import { requireLawyer } from "@/lib/lawyer-portal/http";
import { buildLawyerReferralDetail } from "@/lib/lawyer-portal/projections";
import { getRequestById } from "@/lib/legal-request-db";
import { markRequestViewed } from "@/lib/lawyer-portal/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireLawyer(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row) return notFound("درخواست یافت نشد");

  const detail = buildLawyerReferralDetail({
    request: row,
    lawyerId: auth.lawyer.profile.id,
    lawyerUserId: auth.lawyer.ctx.userId,
  });
  if (!detail) return notFound("درخواست یافت نشد");

  // Record the view only for the currently assigned lawyer — a former lawyer
  // revisiting a reassigned request must not stamp it as viewed for the new
  // owner.
  if (row.selectedLawyerId === auth.lawyer.profile.id && detail.allowedActions.includes("VIEW")) {
    const viewed = markRequestViewed({
      requestId: id,
      lawyerId: auth.lawyer.profile.id,
      actor: auth.lawyer.actor,
    });
    if (viewed.ok) {
      const refreshed = buildLawyerReferralDetail({
        request: viewed.request,
        lawyerId: auth.lawyer.profile.id,
        lawyerUserId: auth.lawyer.ctx.userId,
      });
      return NextResponse.json({ data: refreshed ?? detail });
    }
  }

  return NextResponse.json({ data: detail });
}
