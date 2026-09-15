// ============================================================
// LEGALIR — GET /api/v1/quota
// ============================================================
// Returns the live daily-request quota for the authenticated user:
// the plan-derived allowance, how much is consumed today, the server
// reset time (Tehran midnight), and whether the subscription lapsed.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { queryDailyQuota } from "@/lib/db";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  return NextResponse.json({ data: queryDailyQuota(userId) });
}
