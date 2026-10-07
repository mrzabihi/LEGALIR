// ============================================================
// LEGALIR — GET /api/v1/lawyers
// ============================================================
// Public lawyer marketplace listing. Only VERIFIED lawyers are returned
// by default (verifiedOnly defaults to true in queryLawyers). Filters and
// pagination come from the query string.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryLawyers } from "@/lib/lawyer-db";
import type {
  LawyerSearchFilters,
  LawyerProfessionalRank,
  LawyerOrganizationType,
} from "@legalir/types";

/** Split a comma-joined list param into a trimmed, non-empty array. */
function csv(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const maxFeeRaw = searchParams.get("maxFeeToman");
  const minRatingRaw = searchParams.get("minRating");
  const experienceBand = searchParams.get("experienceBand");
  const filters: LawyerSearchFilters = {
    category: searchParams.get("category") || undefined,
    province: searchParams.get("province") || undefined,
    city: searchParams.get("city") || undefined,
    maxFeeToman: maxFeeRaw ? Number(maxFeeRaw) : undefined,
    remoteOnly: searchParams.get("remoteOnly") === "true" ? true : undefined,
    verifiedOnly: searchParams.get("verifiedOnly") === "false" ? false : true,
    search: searchParams.get("search") || undefined,
    sort: (searchParams.get("sort") as LawyerSearchFilters["sort"]) || undefined,
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 20,
    // --- Extended filters ---
    specialtyIds: csv(searchParams.get("specialtyIds")),
    professionalRanks: csv(searchParams.get("professionalRanks")) as
      | LawyerProfessionalRank[]
      | undefined,
    organizationTypes: csv(searchParams.get("organizationTypes")) as
      | LawyerOrganizationType[]
      | undefined,
    serviceIds: csv(searchParams.get("serviceIds")),
    jurisdictionIds: csv(searchParams.get("jurisdictionIds")),
    minRating: minRatingRaw ? Number(minRatingRaw) : undefined,
    experienceBand: experienceBand || undefined,
    acceptingClientsOnly: searchParams.get("acceptingClientsOnly") === "true" ? true : undefined,
    onlineOnly: searchParams.get("onlineOnly") === "true" ? true : undefined,
    featuredOnly: searchParams.get("featuredOnly") === "true" ? true : undefined,
  };

  const result = queryLawyers(filters);
  return NextResponse.json({ data: result });
}
