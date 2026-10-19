// ============================================================
// LEGALIR — GET /api/v1/lawyer/dashboard
// ============================================================
// The lawyer's real KPI counters, 30-day trend, action list and the Persian
// summary of the most urgent work. Every number is derived from stored
// requests; the ids behind each counter ride along in `buckets` so the UI can
// deep-link each stat into the filtered referral list.
// ============================================================

import { NextResponse } from "next/server";
import { requireLawyer } from "@/lib/lawyer-portal/http";
import { buildLawyerDashboard } from "@/lib/lawyer-portal/projections";

export async function GET(request: Request) {
  const auth = requireLawyer(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ data: buildLawyerDashboard({ userId: auth.lawyer.ctx.userId }) });
}
