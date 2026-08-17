import { NextResponse } from "next/server";
import { findSessionById, findUserById, getProfile, queryRecentActivity, queryProfileUsage, queryActiveSubscription } from "@/lib/db";

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

  const user = findUserById(userId);
  const profile = getProfile(userId);
  const subscription = queryActiveSubscription(userId);
  const usage = queryProfileUsage(userId);
  const recentActivity = queryRecentActivity(userId, 5);

  const entitlements = [
    { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", limit: usage.dailyRequestsTotal, period: "month", used: usage.dailyRequestsUsed, isBoolean: false, isEnabled: true },
    { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", limit: usage.documentAnalysesTotal, period: "month", used: usage.documentAnalysesUsed, isBoolean: false, isEnabled: true },
    { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", limit: usage.contractsTotal, period: "month", used: usage.contractsGenerated, isBoolean: false, isEnabled: true },
    { featureKey: "ADVANCED_REFERENCE", nameFa: "منابع پیشرفته", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: true },
    { featureKey: "PRIORITY_PROCESSING", nameFa: "اولویت پردازش", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: false },
  ];

  const data = {
    user: user ? {
      id: user.id,
      mobileE164: `+98${user.mobile.replace(/^0/, '')}`,
      mobileDisplay: user.mobile.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'['0123456789'.indexOf(d)] ?? d),
      status: 'active' as const,
    } : null,
    profile: {
      userId,
      displayName: profile.displayName ?? user?.displayName,
      city: profile.city,
      occupation: profile.occupation,
      completionPercent: profile.completionPercent,
      avatarUrl: profile.avatarUrl,
      userType: profile.userType,
      province: profile.province,
      legalInterests: profile.legalInterests,
      primaryUseCase: profile.primaryUseCase,
    },
    subscription,
    entitlements,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      status: a.status,
      updatedAt: a.updated_at,
    })),
    savedSourcesCount: 0,
    activeProcessingCount: 0,
    dailyTrialsUsed: 0,
    dailyTrialsTotal: 5,
    activeRequests: [],
    recommendations: [],
    recentDocuments: [],
  };

  return NextResponse.json({ data });
}
