// ============================================================
// LEGALIR — GET /api/v1/lawyer/workspace
// ============================================================
// The lawyer's own workspace: their profile, derived stats, the requests
// assigned to them and the cases those requests produced.
//
// Authorization: the caller must hold the LAWYER role
// (`lawyer:request:read:assigned`). A non-lawyer gets 403 — this is a
// role gate, not an ownership gate, so 403 (not 404) is correct here.
// The workspace is always built for the session user; there is no way to
// request another lawyer's workspace.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { buildLawyerWorkspace } from "@/lib/lawyer-workspace";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "lawyer:request:read:assigned");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ data: buildLawyerWorkspace(auth.ctx.userId) });
}
