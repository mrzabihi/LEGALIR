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
import {
  CONTRACT_ADMIN_REVIEW_STATUS_FA,
  SIGNATURE_REQUEST_STATUS_FA,
} from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { findUserById } from "@/lib/db";
import { intParam } from "@/lib/admin/http";
import { matchesRow } from "@/lib/search/normalize";
import { latestAdminReview, currentVersionApproval } from "@/lib/contracts/admin-review";
import { getVersion, listAllContracts, listParties } from "@/lib/contracts/db";
import { latestSignatureRequestDetail } from "@/lib/contracts/signature/db";
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

/** The sort keys the queue accepts; anything else falls back to `updated_desc`. */
const SORT_KEYS = [
  "updated_desc",
  "updated_asc",
  "created_desc",
  "created_asc",
  "reference_asc",
] as const;
type SortKey = (typeof SORT_KEYS)[number];

function isSortKey(value: string | null): value is SortKey {
  return value !== null && (SORT_KEYS as readonly string[]).includes(value);
}

/**
 * Two-digit-padded `YYYY-MM-DD` bounds are compared against the stored ISO
 * timestamps. A date-only upper bound includes that whole day (the same rule
 * `withinRange` in lib/contracts/db uses), and an unparsable value is ignored
 * rather than silently emptying the queue.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function upperBoundDay(raw: string | null): string | null {
  return raw && DAY_RE.test(raw) ? `${raw}T23:59:59.999Z` : null;
}

function lowerBoundDay(raw: string | null): string | null {
  return raw && DAY_RE.test(raw) ? `${raw}T00:00:00.000Z` : null;
}

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
  // §2.4 — the queue shows where signing stands, per contract. The
  // newest request is used even when COMPLETED, as its participants ARE
  // the record.
  const signature = latestSignatureRequestDetail(contract.id);

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
    signatureStatus: signature?.status ?? null,
    signatureStatusFa: signature ? SIGNATURE_REQUEST_STATUS_FA[signature.status] : null,
    signedCount: signature
      ? signature.participants.filter((p) => p.status === "SIGNED").length
      : 0,
    participantCount: signature?.participants.length ?? 0,
    isSample: contract.isSample === true,
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
  // Date window over the row's stable «آخرین تغییر» column. Both bounds are
  // inclusive, so picking the same day for both ends matches that day.
  const fromIso = lowerBoundDay(url.searchParams.get("from"));
  const toIso = upperBoundDay(url.searchParams.get("to"));
  const sortParam = url.searchParams.get("sort");
  const sort: SortKey = isSortKey(sortParam) ? sortParam : "updated_desc";

  let rows = listAllContracts();

  if (statusParam && (REVIEW_STATUSES as string[]).includes(statusParam)) {
    rows = rows.filter(
      (c) => latestAdminReview(c.id)?.status === (statusParam as ContractAdminReviewStatus)
    );
  }
  if (typeParam) {
    rows = rows.filter((c) => c.type === typeParam);
  }
  if (fromIso) rows = rows.filter((c) => c.updatedAt >= fromIso);
  if (toIso) rows = rows.filter((c) => c.updatedAt <= toIso);
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

  // Sort BEFORE pagination so the whole filtered set is ordered, not just the
  // visible page.
  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "updated_asc":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "created_desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "created_asc":
        return a.createdAt.localeCompare(b.createdAt);
      case "reference_asc":
        return a.referenceCode.localeCompare(b.referenceCode, "fa");
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });

  const page = intParam(url, "page", 1);
  const pageSize = Math.min(intParam(url, "pageSize", 20), MAX_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize).map(toAdminItem);

  // The type filter vocabulary is derived from the contracts that actually
  // exist, so the operator is never offered a type with no rows.
  const typeMap = new Map<string, string>();
  for (const c of all) typeMap.set(c.type, c.typeFa);
  const types = [...typeMap.entries()]
    .map(([value, labelFa]) => ({ value, labelFa }))
    .sort((a, b) => a.labelFa.localeCompare(b.labelFa, "fa"));

  const body: AdminContractListResponse = {
    items,
    pagination: { page, pageSize, total, totalPages },
    counts,
    types,
  };

  return NextResponse.json({ data: body });
}
