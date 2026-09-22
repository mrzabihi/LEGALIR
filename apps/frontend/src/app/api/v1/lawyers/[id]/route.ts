// ============================================================
// LEGALIR — GET /api/v1/lawyers/[id]
// ============================================================
// Public lawyer profile. Performance is recomputed from real events on
// every read (never stored stale). Reviews are returned with a display
// name only — the reviewer's user id is never exposed.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getLawyerProfileById,
  listLawyerReviews,
  computePerformance,
} from "@/lib/lawyer-db";
import type { LawyerDetail, LawyerReview } from "@legalir/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  // An unverified lawyer must never be publicly viewable.
  if (profile.verificationStatus !== "VERIFIED") {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const reviews: LawyerReview[] = listLawyerReviews(profile.id).map((r) => ({
    id: r.id,
    authorName: "کاربر لگالیر",
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

  const detail: LawyerDetail = {
    id: profile.id,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    avatarType: profile.avatarType ?? "real",
    professionalTitle: profile.professionalTitle ?? null,
    bio: profile.bio,
    licenseNumber: profile.licenseNumber,
    licenseYear: profile.licenseYear,
    verificationStatus: profile.verificationStatus,
    verifiedAt: profile.verifiedAt,
    specializations: profile.specializations,
    locations: profile.locations,
    languages: profile.languages,
    pricing: profile.pricing,
    availability: profile.availability,
    performance: computePerformance(profile.id),
    availabilityStatus: profile.availabilityStatus ?? "ACTIVE",
    consultationCapacity: profile.consultationCapacity ?? null,
    isDemo: profile.isDemo,
    acceptingRequests: profile.acceptingRequests,
    reviews,
  };

  return NextResponse.json({ data: detail });
}
