// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers
// ============================================================
// The lawyer management table. Staff-only (`admin:lawyer:read`). Returns
// every lawyer profile — INCLUDING soft-deleted rows — with the fields an
// operator works with: avatar, professional rank, issuing organisation,
// primary specialty, cities, experience, displayed rating + review count,
// verification state, lifecycle (فعال/غیرفعال/معلق/حذف‌شده), featured flag,
// the applicant mobile (full `mobile` + a four-middle-digit `mobileMasked`) and
// the last recorded decision.
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
import { findUserById } from "@/lib/db";
import {
  lawyerDecisionBucket,
  taxonomySearchText,
  type LawyerDecisionBucket,
  type LawyerVerificationStatus,
  type AdminLawyerStatus,
} from "@legalir/types";
import { resolvePage, resolvePageSize, paginate } from "@/lib/admin/pagination";
import { matchesRow } from "@/lib/search/normalize";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import { summarizeLawyerIncomes } from "@/lib/admin/settlements";

const BUCKETS: LawyerDecisionBucket[] = ["REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];
const LIFECYCLES: AdminLawyerStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"];

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:lawyer:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const page = resolvePage(url.searchParams.get("page"));
  const pageSize = resolvePageSize(url.searchParams.get("pageSize"));
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
    rows = rows.filter((l) => {
      const user = findUserById(l.userId);
      const specialtyLabels = [
        ...(l.expertise ?? []).map((e) => taxonomySearchText(e.taxonomyNodeId)),
        ...l.specializations.map((s) => taxonomySearchText(s.category)),
      ].join(" ");
      // Phone lane matches the FULL stored mobile (so `09122842174` works), the
      // text lane keeps the existing Persian-normalized name/licence/city match.
      return matchesRow(search, {
        phones: [user?.mobile],
        texts: [
          l.fullName,
          l.licenseNumber,
          l.licenseAuthority,
          specialtyLabels,
          ...l.locations.map((loc) => `${loc.province} ${loc.city}`),
        ],
      });
    });
  }

  const mapped = rows
    .map((l) => {
      const decision = latestStatusDecision(l.id);
      const user = findUserById(l.userId);
      return toAdminLawyerListItem(
        l,
        user?.mobile ?? "",
        maskMobileMiddle(user?.mobile),
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

  // One ledger read for the whole page, not one per row. The figure attached
  // to each lawyer is a real sum of their settlement rows; a lawyer with no
  // settlement gets `hasData: false` and the table says «بدون تسویه» rather
  // than printing a zero that reads like a measured income.
  const p = paginate(mapped, page, pageSize);
  const income = summarizeLawyerIncomes(p.items.map((l) => l.id));
  const items = p.items.map((l) => ({ ...l, income: income.get(l.id)! }));

  return NextResponse.json({
    data: { items, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages },
  });
}
