// ============================================================
// LEGALIR — GET /api/v1/lawyers/[id]
// ============================================================
// Public lawyer profile. Performance is recomputed from real events on
// every read (never stored stale). Reviews are returned with a display
// name only — the reviewer's user id is never exposed.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLawyerProfileById, isPubliclyViewable, toLawyerDetail } from "@/lib/lawyer-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  // An unverified, deactivated (HIDDEN) or deleted lawyer must never be
  // publicly viewable — even by direct id. The one exception is a SUSPENDED
  // lawyer: their profile stays reachable so the alert card (and the reason)
  // are visible, but every CTA is disabled. `isPubliclyViewable` is the same
  // gate the marketplace listing uses, so the two can never disagree.
  if (!isPubliclyViewable(profile)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: toLawyerDetail(profile) });
}
