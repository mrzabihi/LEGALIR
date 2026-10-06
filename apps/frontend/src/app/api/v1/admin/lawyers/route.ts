// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers
// ============================================================
// The lawyer review queue. Staff-only (`admin:lawyer:verify`). Returns every
// lawyer profile with its verification state, the four-way decision bucket
// the admin works with, the masked applicant mobile and the last recorded
// decision (who decided, when, why) so the queue is self-explanatory.
//
// Filters: `bucket` (REVIEW|APPROVED|REJECTED|SUSPENDED) or exact `status`,
// plus free-text `search` over name, licence, city and masked mobile.
// Demo profiles are flagged so they are never mistaken for real applicants.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listLawyerProfiles, latestStatusDecision } from "@/lib/lawyer-db";
import { findUserById, normalizeStoredMobile } from "@/lib/db";
import {
  lawyerDecisionBucket,
  type LawyerDecisionBucket,
  type LawyerVerificationStatus,
} from "@legalir/types";

const BUCKETS: LawyerDecisionBucket[] = ["REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];

/** Mask a mobile for the admin listing (first 4 + last 4). */
function maskMobile(mobile: string | undefined): string {
  if (!mobile) return "—";
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const bucketParam = url.searchParams.get("bucket");
  const statusParam = url.searchParams.get("status");
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

  let rows = listLawyerProfiles();

  if (bucketParam && (BUCKETS as string[]).includes(bucketParam)) {
    rows = rows.filter((l) => lawyerDecisionBucket(l.verificationStatus) === bucketParam);
  } else if (statusParam) {
    rows = rows.filter((l) => l.verificationStatus === statusParam);
  }

  if (search) {
    rows = rows.filter((l) => {
      const user = findUserById(l.userId);
      const haystack = [
        l.fullName,
        l.licenseNumber ?? "",
        l.licenseAuthority ?? "",
        ...l.specializations.map((s) => s.category),
        ...l.locations.map((loc) => `${loc.province} ${loc.city}`),
        maskMobile(user?.mobile),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const items = rows
    .map((l) => {
      const decision = latestStatusDecision(l.id);
      const user = findUserById(l.userId);
      return {
        id: l.id,
        userId: l.userId,
        fullName: l.fullName,
        licenseNumber: l.licenseNumber,
        licenseYear: l.licenseYear,
        licenseAuthority: l.licenseAuthority ?? null,
        verificationStatus: l.verificationStatus,
        verificationNote: l.verificationNote,
        verifiedAt: l.verifiedAt,
        isDemo: l.isDemo,
        specializations: l.specializations,
        locations: l.locations,
        activityType: l.activityType ?? null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        mobileMasked: maskMobile(user?.mobile),
        bucket: lawyerDecisionBucket(l.verificationStatus),
        lastDecision: decision
          ? {
              newStatus: decision.newStatus as LawyerVerificationStatus,
              actorName: decision.actorName,
              reason: decision.reason,
              createdAt: decision.createdAt,
            }
          : null,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ data: { items, total: items.length } });
}
