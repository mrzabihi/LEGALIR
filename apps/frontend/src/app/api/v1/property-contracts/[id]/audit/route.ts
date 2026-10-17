// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/audit
// ============================================================
// GET — the contract's audit trail, SEARCHABLE (§9.2).
//
// Filters (all optional, combined with AND):
//   actor   — the acting user id
//   action  — a case-insensitive substring of the action (e.g. "signature.")
//   from    — inclusive lower bound on the date (YYYY-MM-DD or ISO)
//   to      — inclusive upper bound on the date (YYYY-MM-DD widens to EOD)
//
// The trail stores only non-sensitive data (an action code, a Persian
// description and coarse metadata) — never tokens, document text or the
// raw IP (§9). Owner-scoped via `requireContract`: another user's id
// returns 404, never 403. The response also lists the distinct actors
// present in the trail, so the UI can offer a real filter list.
// ============================================================

import { NextResponse } from "next/server";
import { isErrorResponse, requireContract } from "@/lib/contracts/api-helpers";
import { listAudit, listAuditActors, type AuditFilters } from "@/lib/contracts/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const url = new URL(request.url);
  const filters: AuditFilters = {};
  const actorId = url.searchParams.get("actor");
  const action = url.searchParams.get("action");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (actorId) filters.actorId = actorId;
  if (action) filters.action = action;
  if (from) filters.from = from;
  if (to) filters.to = to;

  return NextResponse.json({
    data: {
      entries: listAudit(ctx.contract.id, filters),
      actors: listAuditActors(ctx.contract.id),
      total: listAudit(ctx.contract.id).length,
    },
  });
}
