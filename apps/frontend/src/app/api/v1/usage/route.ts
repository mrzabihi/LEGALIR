import { NextResponse } from "next/server";
import { findSessionById, queryProfileUsage } from "@/lib/db";

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

  const usage = queryProfileUsage(userId);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const daysRemaining = Math.ceil((new Date(periodEnd).getTime() - now.getTime()) / 86400000);

  return NextResponse.json({
    data: {
      usageCounters: [
        { featureKey: "AI_CHAT_MESSAGE", periodStart, periodEnd, used: usage.dailyRequestsUsed, limit: usage.dailyRequestsTotal },
        { featureKey: "DOCUMENT_ANALYSIS", periodStart, periodEnd, used: usage.documentAnalysesUsed, limit: usage.documentAnalysesTotal },
        { featureKey: "CONTRACT_GENERATION", periodStart, periodEnd, used: usage.contractsGenerated, limit: usage.contractsTotal },
      ],
      periodStart,
      periodEnd,
      daysRemaining,
    },
  });
}
