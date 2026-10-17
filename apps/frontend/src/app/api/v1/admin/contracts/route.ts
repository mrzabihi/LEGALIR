// ============================================================
// LEGALIR — GET /api/v1/admin/contracts
// ============================================================
// The admin contract review QUEUE. Staff-only (`admin:contracts:read`).
// One row per contract — including every owner's, since this is the
// operator surface — with only what an operator needs to triage: the
// reference code, the current lifecycle state, the admin-review status
// and whether the CURRENT version carries a valid, bound approval.
//
// The approval status is DERIVED, never a stored flag: `adminApproved`
// is true only when `currentVersionApproval` finds an APPROVED review
// whose version hash still matches the contract's current version. So a
// contract whose content changed after approval shows as un-approved
// again, exactly as the sign/finalize gates would treat it.
//
// Filters: `status` (the admin-review status), `type` (contract type),
// free-text `search` over the reference code, title, owner and parties.
// Pagination: `page` (1-based), `pageSize`. Counts by review status
// accompany the page so the queue tabs stay accurate.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  AdminContractListItem,
  AdminContractListResponse,
  ContractAdminReviewStatus,
  ContractParty,
  PropertyContract,
} from "@legalir/types";
import { CONTRACT_ADMIN_REVIEW_STATUS_FA } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { intParam } from "@/lib/admin/http";
import { matchesRow } from "@/lib/search/normalize";
import { latestAdminReview, currentVersionApproval } from "@/lib/contracts/admin-review";
import { getVersion, listAllContracts, listParties } from "@/lib/contracts/db";
import { getContractDefinition } from "@/lib/contracts/registry";
import { stateLabelFa } from "@/lib/contracts/state-machine";

const REVIEW_STATUSES: ContractAdminReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "CANCELLED",
];

const MAX_PAGE_SIZE = 100;

/** The two primary party names, e.g. «مریم محمدی و رضا کریمی». */
function partySummaryFa(contract: PropertyContract, parties: ContractParty[]): string {
  const def = getContractDefinition(contract.type);
  const names = def.roles
    .map((role) => parties.find((p) => p.role === role))
    .filter((p): p is ContractParty => !!p)
    .map((p) => `${p.identity.firstName} ${p.identity.lastName}`.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) return "طرفین ثبت نشده‌اند";
  return names.join(" و ");
}

/** The owner's display name, falling back to a neutral label. */
function ownerLabelFa(userId: string): string {
  const user = findUserById(userId);
  const name = user?.displayName?.trim();
  return name && name.length > 0 ? name : "کاربر لیگالیر";
}

/** Project a contract row into the admin list item shape. */
function toAdminItem(contract: PropertyContract): AdminContractListItem {
  const parties = listParties(contract.id);
  const review = latestAdminReview(contract.id);
  const currentVersion = contract.currentVersionId
    ? getVersion(contract.id, contract.currentVersionId)
    : null;
  const approved = currentVersionApproval(contract, currentVersion?.documentHash ?? null) !== null;

  return {
    id: contract.id,
    referenceCode: contract.referenceCode,
    type: contract.type,
    typeFa: contract.typeFa,
    title: contract.title,
    state: contract.state,
    stateFa: stateLabelFa(contract.state),
    progress: contract.progress,
    ownerLabelFa: ownerLabelFa(contract.userId),
    partySummaryFa: partySummaryFa(contract, parties),
    adminReviewStatus: review?.status ?? null,
    adminReviewStatusFa: review ? CONTRACT_ADMIN_REVIEW_STATUS_FA[review.status] : null,
    adminApproved: approved,
    currentVersionNumber: contract.currentVersionNumber,
    finalizedAt: contract.finalizedAt,
    updatedAt: contract.updatedAt,
    createdAt: contract.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:contracts:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const typeParam = url.searchParams.get("type");
  const search = (url.searchParams.get("search") ?? "").trim();

  let rows = listAllContracts();

  if (statusParam && (REVIEW_STATUSES as string[]).includes(statusParam)) {
    rows = rows.filter(
      (c) => latestAdminReview(c.id)?.status === (statusParam as ContractAdminReviewStatus)
    );
  }
  if (typeParam) {
    rows = rows.filter((c) => c.type === typeParam);
  }
  if (search) {
    rows = rows.filter((c) => {
      const owner = ownerLabelFa(c.userId);
      const parties = partySummaryFa(c, listParties(c.id));
      // Shared normalisation lane: Persian/Arabic digits and letter forms in
      // the query fold before matching, so a reference code typed in Persian
      // numerals — or a title with a ك/ي spelling — still finds the row.
      return matchesRow(search, {
        texts: [c.referenceCode, c.title, c.typeFa, owner, parties],
      });
    });
  }

  // Counts describe the WHOLE queue, so the tab badges stay stable
  // regardless of the current status/type/search filter.
  const all = listAllContracts();
  const counts = { pending: 0, approved: 0, rejected: 0, changesRequested: 0 };
  for (const c of all) {
    const s = latestAdminReview(c.id)?.status ?? null;
    if (s === "PENDING") counts.pending += 1;
    else if (s === "APPROVED") counts.approved += 1;
    else if (s === "REJECTED") counts.rejected += 1;
    else if (s === "CHANGES_REQUESTED") counts.changesRequested += 1;
  }

  const page = intParam(url, "page", 1);
  const pageSize = Math.min(intParam(url, "pageSize", 20), MAX_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize).map(toAdminItem);

  const body: AdminContractListResponse = {
    items,
    pagination: { page, pageSize, total, totalPages },
    counts,
  };

  return NextResponse.json({ data: body });
}
