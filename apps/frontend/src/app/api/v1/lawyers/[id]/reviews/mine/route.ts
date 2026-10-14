// ============================================================
// LEGALIR — GET /api/v1/lawyers/[id]/reviews/mine
// ============================================================
// What the SIGNED-IN viewer may do about reviewing this lawyer: whether they
// are eligible (a completed engagement exists), their own existing review (any
// moderation status), and the edit deadline. Eligibility is decided here so
// the profile UI never has to guess — and the submit route re-checks it.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { buildReviewEligibility, getLawyerProfileById, isPubliclyViewable } from "@/lib/lawyer-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const profile = getLawyerProfileById(id);
  if (!profile || !isPubliclyViewable(profile)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: buildReviewEligibility(id, auth.ctx.userId) });
}
