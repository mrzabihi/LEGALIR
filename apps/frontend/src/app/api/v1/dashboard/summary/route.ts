// ============================================================
// LEGALIR — GET /api/v1/dashboard/summary (real metrics)
// ============================================================
// Backs the Workplace Dashboard operational overview with real
// numbers computed from the JSON DB, replacing the previous
// hard-coded placeholders. Requests-today uses the Asia/Tehran
// business day; days-remaining derives from the active subscription.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  findUserById,
  getProfile,
  queryRecentActivity,
  queryProfileUsage,
  queryActiveSubscription,
  queryDailyQuota,
} from "@/lib/db";
import {
  computeDashboardMetrics,
  subscriptionDaysRemaining,
} from "@/lib/dashboard-metrics";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const user = findUserById(userId);
  const profile = getProfile(userId);
  const subscription = queryActiveSubscription(userId);
  const usage = queryProfileUsage(userId);
  const recentActivity = queryRecentActivity(userId, 5);
  const metrics = computeDashboardMetrics(userId);
  const daysRemaining = subscriptionDaysRemaining(userId);
  const quota = queryDailyQuota(userId);

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
    // --- Real operational overview (replaces the mock placeholders) ---
    savedSourcesCount: metrics.savedSourcesCount,
    activeProcessingCount: metrics.activeProcessingCount,
    // Backward-compatible hero card fields: "درخواست امروز" now reflects
    // activities that were updated within the current Asia/Tehran day.
    dailyTrialsUsed: quota.used,
    dailyTrialsTotal: quota.total,
    quota,
    activeRequests: metrics.activeRequests,
    recommendations: metrics.recommendations,
    recentDocuments: metrics.recentDocuments,
    // Explicit real metrics (new fields).
    requestsToday: metrics.requestsToday,
    documentsCount: metrics.documentsCount,
    contractsCount: metrics.contractsCount,
    memoriesCount: metrics.memoriesCount,
    daysRemaining,
    subscriptionUsage: subscription
      ? {
          planCode: subscription.planCode,
          planNameFa: subscription.planNameFa,
          endAt: subscription.endAt,
          daysRemaining: daysRemaining ?? 0,
        }
      : null,
  };

  return NextResponse.json({ data });
}
