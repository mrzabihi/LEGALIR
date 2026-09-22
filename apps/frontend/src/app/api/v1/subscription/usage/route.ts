// ============================================================
// LEGALIR — GET /api/v1/subscription/usage
// ============================================================
// The full usage summary the dashboard renders: today's subscription
// credit (resets at Tehran midnight), the period-scoped service quotas
// (reset only at period end) and the persistent reward-points balance —
// three distinct assets, never conflated.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getUsageSummary } from "@/lib/usage/engine";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  return NextResponse.json({ data: getUsageSummary(userId) });
}
