// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers
// ============================================================
// The lawyer management table. Staff-only (`admin:lawyer:read`). Returns
// every lawyer profile — INCLUDING soft-deleted rows — with the fields an
// operator works with: avatar, professional rank, issuing organisation,
// primary specialty, cities, experience, displayed rating + review count,
// verification state, lifecycle (فعال/غیرفعال/معلق/حذف‌شده), featured flag,
// masked applicant mobile and the last recorded decision.
//
// This reads the SAME profile rows the public /lawyers marketplace reads, so
// a change here is reflected there immediately (there is no second copy).
//
// Filters: `bucket` (REVIEW|APPROVED|REJECTED|SUSPENDED), exact `status`,
// derived `lifecycle` (ACTIVE|INACTIVE|SUSPENDED|DELETED), `featured`, plus
// free-text `search` over name, licence, specialty labels, city and mobile.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import {
  listLawyerProfiles,
  latestStatusDecision,
  toAdminLawyerListItem,
  resolveAdminLifecycle,
} from "@/lib/lawyer-db";
import { findUserById, normalizeStoredMobile } from "@/lib/db";
import {
  lawyerDecisionBucket,
  taxonomySearchText,
  normalizeFa,
  type LawyerDecisionBucket,
  type LawyerVerificationStatus,
  type AdminLawyerStatus,
} from "@legalir/types";

const BUCKETS: LawyerDecisionBucket[] = ["REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];
const LIFECYCLES: AdminLawyerStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"];

/** Mask a mobile for the admin listing (first 4 + last 4). */
function maskMobile(mobile: string | undefined): string {
  if (!mobile) return "—";
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:lawyer:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const bucketParam = url.searchParams.get("bucket");
  const statusParam = url.searchParams.get("status");
  const lifecycleParam = url.searchParams.get("lifecycle");
  const featuredParam = url.searchParams.get("featured");
  const search = (url.searchParams.get("search") ?? "").trim();

  let rows = listLawyerProfiles();

  if (bucketParam && (BUCKETS as string[]).includes(bucketParam)) {
    rows = rows.filter((l) => lawyerDecisionBucket(l.verificationStatus) === bucketParam);
  } else if (statusParam) {
    rows = rows.filter((l) => l.verificationStatus === (statusParam as LawyerVerificationStatus));
  }
  if (lifecycleParam && (LIFECYCLES as string[]).includes(lifecycleParam)) {
    rows = rows.filter((l) => resolveAdminLifecycle(l) === lifecycleParam);
  }
  if (featuredParam === "true") rows = rows.filter((l) => l.featured === true);
  if (featuredParam === "false") rows = rows.filter((l) => l.featured !== true);

  if (search) {
    const q = normalizeFa(search.toLowerCase());
    rows = rows.filter((l) => {
      const user = findUserById(l.userId);
      const specialtyLabels = [
        ...(l.expertise ?? []).map((e) => taxonomySearchText(e.taxonomyNodeId)),
        ...l.specializations.map((s) => taxonomySearchText(s.category)),
      ].join(" ");
      const haystack = normalizeFa(
        [
          l.fullName,
          l.licenseNumber ?? "",
          l.licenseAuthority ?? "",
          specialtyLabels,
          ...l.locations.map((loc) => `${loc.province} ${loc.city}`),
          maskMobile(user?.mobile),
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }

  const items = rows
    .map((l) => {
      const decision = latestStatusDecision(l.id);
      const user = findUserById(l.userId);
      return toAdminLawyerListItem(
        l,
        maskMobile(user?.mobile),
        decision
          ? {
              newStatus: decision.newStatus as LawyerVerificationStatus,
              actorName: decision.actorName,
              reason: decision.reason,
              createdAt: decision.createdAt,
            }
          : null,
        lawyerDecisionBucket(l.verificationStatus)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ data: { items, total: items.length } });
}
