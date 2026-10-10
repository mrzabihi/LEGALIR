import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getUsageSummary } from "@/lib/usage/engine";
import { usageCountersFromSummary } from "@/lib/usage/views";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  // Counters come from the usage engine (today's daily credit + period quotas),
  // not the frozen `usage_stats` table.
  const summary = getUsageSummary(userId);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const daysRemaining = Math.ceil((new Date(periodEnd).getTime() - now.getTime()) / 86400000);

  return NextResponse.json({
    data: {
      usageCounters: usageCountersFromSummary(summary, periodStart, periodEnd),
      periodStart,
      periodEnd,
      daysRemaining,
    },
  });
}
