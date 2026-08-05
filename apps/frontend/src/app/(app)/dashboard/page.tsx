// ============================================================
// LEGALIR — Workplace Dashboard
// Each widget independently manages its own loading/error/empty
// states so a single failure never breaks the entire page.
// ============================================================

"use client";

import { useMe, useDashboardSummary, useUsageSummary } from "@/hooks/useDashboard";
import {
  GreetingHeader,
  ProfileCompletionCard,
  SubscriptionSummaryCard,
  QuickActions,
  RecentActivities,
  UsageSummaryCard,
  NotificationsPlaceholder,
} from "@/components/dashboard";

export default function DashboardPage() {
  // Each data source is an independent query — one failure won't crash others
  const me = useMe();
  const dashboard = useDashboardSummary();
  const usage = useUsageSummary();

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      {/* Greeting — from /api/v1/me */}
      <GreetingHeader
        displayName={me.data?.profile?.displayName ?? null}
        isLoading={me.isLoading}
      />

      {/* Profile Completion — from /api/v1/me */}
      <ProfileCompletionCard
        profile={me.data?.profile}
        isLoading={me.isLoading}
      />

      {/* Subscription Summary — from /api/v1/dashboard/summary */}
      <SubscriptionSummaryCard
        subscription={dashboard.data?.subscription}
        isLoading={dashboard.isLoading}
      />

      {/* Quick Actions — always shown, no data dependency */}
      <QuickActions />

      {/* Recent Activities — from /api/v1/dashboard/summary */}
      <RecentActivities
        items={dashboard.data?.recentActivity}
        isLoading={dashboard.isLoading}
        error={dashboard.error as Error | null}
        onRetry={() => dashboard.refetch()}
      />

      {/* Usage & Entitlement Summary — from /api/v1/usage/summary */}
      <UsageSummaryCard
        usage={usage.data}
        isLoading={usage.isLoading}
        error={usage.error as Error | null}
        onRetry={() => usage.refetch()}
      />

      {/* Notifications — placeholder for future phase */}
      <NotificationsPlaceholder />
    </div>
  );
}
