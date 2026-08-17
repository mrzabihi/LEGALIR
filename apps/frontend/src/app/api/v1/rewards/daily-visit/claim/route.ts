import { NextResponse } from "next/server";
import { findSessionById, claimDailyVisitReward, getRewardBalance } from "@/lib/db";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}

export async function POST(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  // Idempotent: calling this multiple times in the same Tehran day never
  // awards points twice (enforced by `uniqueKey` = the Tehran date string).
  const result = claimDailyVisitReward(userId);
  const balance = getRewardBalance(userId);

  return NextResponse.json({
    data: {
      awarded: result.awarded,
      points: result.points,
      balance,
    },
  });
}
