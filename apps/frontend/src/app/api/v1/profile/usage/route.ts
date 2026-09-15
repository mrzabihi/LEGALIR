import { NextResponse } from "next/server";
import { findSessionById, queryProfileUsage, queryDailyQuota } from "@/lib/db";

function getUserFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' },
      { status: 401 }
    );
  }

  const usage = queryProfileUsage(userId);
  const quota = queryDailyQuota(userId);
  // The plan-derived allowance is authoritative for the daily counter.
  const data = { ...usage, dailyRequestsTotal: quota.total, dailyRequestsUsed: quota.used };
  return NextResponse.json({ data, quota });
}
