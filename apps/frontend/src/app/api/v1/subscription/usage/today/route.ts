// ============================================================
// LEGALIR — GET /api/v1/subscription/usage/today
// ============================================================
// Just today's subscription credit — the "اعتبار امروز اشتراک" card.
// Resets at Tehran midnight and never carries over.
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

  const summary = getUsageSummary(userId);
  return NextResponse.json({ data: summary.daily });
}
