// ============================================================
// LEGALIR — GET /api/v1/lawyer/cases
// ============================================================
// The lawyer's caseload: every case they own or hold an active membership on,
// filtered, sorted and paginated on the server. The `summary` block is computed
// over the whole caseload before filtering, so a narrowed list still reports
// the true shape of the workload above it.
//
// Scoping is implicit — the user id comes from the session, never the query
// string, so there is no parameter that could point at another lawyer's cases.
// ============================================================

import { NextResponse } from "next/server";
import { requireLawyer } from "@/lib/lawyer-portal/http";
import { listLawyerCases } from "@/lib/lawyer-portal/cases";
import type { LawyerCaseFilters } from "@legalir/types";

const SORTS: NonNullable<LawyerCaseFilters["sort"]>[] = ["deadline", "updated", "title"];

function num(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const auth = requireLawyer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const sortRaw = url.searchParams.get("sort");

  const filters: LawyerCaseFilters = {
    lifecycle: url.searchParams.get("lifecycle") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    overdueOnly: url.searchParams.get("overdueOnly") === "1",
    page: num(url.searchParams.get("page"), 1),
    pageSize: num(url.searchParams.get("pageSize"), 20),
    sort:
      sortRaw && (SORTS as string[]).includes(sortRaw)
        ? (sortRaw as NonNullable<LawyerCaseFilters["sort"]>)
        : "deadline",
  };

  return NextResponse.json({ data: listLawyerCases(auth.lawyer.ctx.userId, filters) });
}
