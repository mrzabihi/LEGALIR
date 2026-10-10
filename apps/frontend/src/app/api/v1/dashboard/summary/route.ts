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
  queryActiveSubscription,
} from "@/lib/db";
import { getUsageSummary } from "@/lib/usage/engine";
import { entitlementsFromSummary, dailyQuotaFromSummary } from "@/lib/usage/views";
import {
  computeDashboardMetrics,
  subscriptionDaysRemaining,
} from "@/lib/dashboard-metrics";
import { toPersianMobileDisplay } from "@legalir/validation";

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
  const recentActivity = queryRecentActivity(userId, 5);
  const metrics = computeDashboardMetrics(userId);
  const daysRemaining = subscriptionDaysRemaining(userId);
  // Usage counters come from the usage engine — the single source of truth.
  const summary = getUsageSummary(userId);
  const quota = dailyQuotaFromSummary(summary);
  const entitlements = entitlementsFromSummary(summary);

  const data = {
    user: user ? {
      id: user.id,
      mobileE164: user.mobile,
      mobileDisplay: toPersianMobileDisplay(user.mobile),
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
