// ============================================================
// LEGALIR — GET /api/v1/judicial/services
// ============================================================
// The admin-managed catalog of the judicial documents family, projected for
// THIS caller (plan/org-aware flags). Every surface that shows a judicial
// card reads this — never a hard-coded status.
//
// Public read: the catalog itself carries no user data. The per-user entry
// payload lives at /api/v1/judicial/card.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { judicialFlagContext } from "@/lib/judicial/context";
import { listJudicialServiceViews } from "@/lib/judicial/service-config";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  const items = listJudicialServiceViews(
    auth ? judicialFlagContext({ userId: auth.userId, orgId: auth.orgId }) : undefined
  );
  return NextResponse.json({ data: { items } });
}
