// ============================================================
// LEGALIR — GET /api/v1/lawyer/referrals
// ============================================================
// The lawyer's referral queue with server-side filtering, search, sorting and
// pagination. Filters: service, state, perspective, SLA health, referral date
// range, free text. The response carries the facet counts the filter bar
// renders, computed over the unfiltered set.
//
// Scoping is implicit: the lawyer id comes from the session's own profile, so
// there is no parameter that could point at somebody else's queue.
// ============================================================

import { NextResponse } from "next/server";
import { requireLawyer } from "@/lib/lawyer-portal/http";
import { buildReferralList, type ReferralListQuery } from "@/lib/lawyer-portal/projections";
import type {
  LawyerDashboardCounts,
  LawyerReferralListItem,
  SlaHealth,
} from "@legalir/types";

const PERSPECTIVES: LawyerReferralListItem["perspective"][] = [
  "NEEDS_ACTION",
  "WAITING_ON_CLIENT",
  "ACTIVE",
  "DONE",
];

const BUCKETS: (keyof LawyerDashboardCounts)[] = [
  "newAssignments",
  "viewed",
  "accepted",
  "inProgress",
  "waitingForClient",
  "completed",
  "declined",
  "cancelled",
  "atRisk",
  "breached",
];

const SLA_HEALTH: SlaHealth[] = [
  "ON_TRACK",
  "AT_RISK",
  "BREACHED",
  "PAUSED",
  "MET",
  "MISSED",
  "NONE",
];

function num(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const auth = requireLawyer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const perspectiveRaw = url.searchParams.get("perspective");
  const slaRaw = url.searchParams.get("slaHealth");
  const sortRaw = url.searchParams.get("sort");
  const bucketRaw = url.searchParams.get("bucket");

  const query: ReferralListQuery = {
    serviceKey: url.searchParams.get("serviceKey"),
    state: url.searchParams.get("state"),
    perspective:
      perspectiveRaw &&
      PERSPECTIVES.includes(perspectiveRaw as LawyerReferralListItem["perspective"])
        ? (perspectiveRaw as LawyerReferralListItem["perspective"])
        : null,
    slaHealth:
      slaRaw && SLA_HEALTH.includes(slaRaw as SlaHealth) ? (slaRaw as SlaHealth) : null,
    fromIso: url.searchParams.get("fromIso"),
    toIso: url.searchParams.get("toIso"),
    search: url.searchParams.get("search"),
    bucket:
      bucketRaw && BUCKETS.includes(bucketRaw as keyof LawyerDashboardCounts)
        ? (bucketRaw as keyof LawyerDashboardCounts)
        : null,
    page: num(url.searchParams.get("page"), 1),
    pageSize: num(url.searchParams.get("pageSize"), 20),
    sort: sortRaw === "oldest" || sortRaw === "due" ? sortRaw : "newest",
  };

  return NextResponse.json({
    data: buildReferralList({
      lawyerId: auth.lawyer.profile.id,
      userId: auth.lawyer.ctx.userId,
      query,
    }),
  });
}
