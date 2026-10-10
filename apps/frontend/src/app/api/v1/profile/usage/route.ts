import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getUsageSummary } from "@/lib/usage/engine";
import { profileUsageFromSummary, dailyQuotaFromSummary } from "@/lib/usage/views";

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

  // Both the flat usage counters and the daily quota come from the usage
  // engine — the single source of truth.
  const summary = getUsageSummary(userId);
  const data = profileUsageFromSummary(summary);
  return NextResponse.json({ data, quota: dailyQuotaFromSummary(summary) });
}
