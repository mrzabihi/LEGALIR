import { NextResponse } from "next/server";
import { getPointsAccount } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * GET /api/v1/points
 * The user's points account aggregates, derived from the ledger.
 * Balance is never stored — it is always SUM(points_delta).
 */
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  return NextResponse.json({ data: getPointsAccount(userId) });
}
