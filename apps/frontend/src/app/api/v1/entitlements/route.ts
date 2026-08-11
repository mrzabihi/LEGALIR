import { NextResponse } from "next/server";
import { findSessionById, queryActiveSubscription, queryProfileUsage } from "@/lib/db";

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

  const subscription = queryActiveSubscription(userId);
  const usage = queryProfileUsage(userId);

  const entitlements = [
    { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", limit: usage.dailyRequestsTotal, period: "month", used: usage.dailyRequestsUsed, isBoolean: false, isEnabled: true },
    { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", limit: usage.documentAnalysesTotal, period: "month", used: usage.documentAnalysesUsed, isBoolean: false, isEnabled: true },
    { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", limit: usage.contractsTotal, period: "month", used: usage.contractsGenerated, isBoolean: false, isEnabled: true },
    { featureKey: "ADVANCED_REFERENCE", nameFa: "منابع پیشرفته", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: true },
    { featureKey: "PRIORITY_PROCESSING", nameFa: "اولویت پردازش", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: false },
  ];

  return NextResponse.json({
    data: {
      entitlements,
      planCode: subscription?.planCode ?? "free",
      planNameFa: subscription?.planNameFa ?? "رایگان",
    },
  });
}
