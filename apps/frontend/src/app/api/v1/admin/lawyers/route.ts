// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers
// ============================================================
// The lawyer verification queue. Staff-only (`admin:lawyer:verify`).
// Returns every lawyer profile with its verification state so an admin
// can approve, reject or suspend. Demo profiles are flagged so they are
// never mistaken for real applicants.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listLawyerProfiles } from "@/lib/lawyer-db";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;

  const status = new URL(request.url).searchParams.get("status");

  const items = listLawyerProfiles()
    .filter((l) => !status || l.verificationStatus === status)
    .map((l) => ({
      id: l.id,
      userId: l.userId,
      fullName: l.fullName,
      licenseNumber: l.licenseNumber,
      licenseYear: l.licenseYear,
      verificationStatus: l.verificationStatus,
      verificationNote: l.verificationNote,
      verifiedAt: l.verifiedAt,
      isDemo: l.isDemo,
      specializations: l.specializations,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ data: { items, total: items.length } });
}
