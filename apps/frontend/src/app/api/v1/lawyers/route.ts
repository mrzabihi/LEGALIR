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
import type { LawyerListFilters } from "@legalir/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const maxFeeRaw = searchParams.get("maxFeeToman");
  const filters: LawyerListFilters = {
    category: searchParams.get("category") || undefined,
    province: searchParams.get("province") || undefined,
    city: searchParams.get("city") || undefined,
    maxFeeToman: maxFeeRaw ? Number(maxFeeRaw) : undefined,
    remoteOnly: searchParams.get("remoteOnly") === "true" ? true : undefined,
    verifiedOnly: searchParams.get("verifiedOnly") === "false" ? false : true,
    search: searchParams.get("search") || undefined,
    sort: (searchParams.get("sort") as LawyerListFilters["sort"]) || undefined,
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 20,
  };

  const result = queryLawyers(filters);
  return NextResponse.json({ data: result });
}
