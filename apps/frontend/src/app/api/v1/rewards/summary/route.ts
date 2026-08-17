import { NextResponse } from "next/server";
import { findSessionById, getRewardBalance, readRewardLedger } from "@/lib/db";
import { REWARD_RULES, tehranDateString } from "@/lib/rewards";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const balance = getRewardBalance(userId);
  const today = tehranDateString();

  const todayVisit = readRewardLedger(userId).find(
    (e) => e.event_type === "DAILY_VISIT" && (e.metadata as Record<string, unknown>)["uniqueKey"] === today
  );

  const data = {
    balance,
    today: {
      visitRewardClaimed: Boolean(todayVisit),
      pointsAwarded: todayVisit ? todayVisit.points_delta : 0,
    },
    rules: REWARD_RULES.map((r) => ({
      eventType: r.eventType,
      points: r.points,
      frequency: r.frequency,
      enabled: r.enabled,
      labelFa: r.labelFa,
      descriptionFa: r.descriptionFa,
    })),
  };

  return NextResponse.json({ data });
}
