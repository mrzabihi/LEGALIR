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
  SmartInputBar,
  ActiveRequests,
  SmartRecommendations,
  RecentDocuments,
  RecentActivities,
  UsageSummaryCard,
  NotificationsPlaceholder,
} from "@/components/dashboard";
import Link from "next/link";

export default function DashboardPage() {
  // Each data source is an independent query — one failure won't crash others
  const me = useMe();
  const dashboard = useDashboardSummary();
  const usage = useUsageSummary();

  const displayName = me.data?.profile?.displayName ?? null;
  const activities = dashboard.data?.recentActivity;
  const hasNoActivity = !dashboard.isLoading && (!activities || activities.length === 0);

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      {/* Greeting — from /api/v1/me */}
      <GreetingHeader
        displayName={displayName}
        isLoading={me.isLoading}
      />

      {/* Smart Input Bar — intelligent routing to services */}
      <SmartInputBar />

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

      {/* Empty state: show big CTA when no activity exists */}
      {hasNoActivity && (
        <section className="mb-8 rounded-large bg-surface border border-divider p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
              🚀
            </div>
          </div>
          <h2 className="text-h3 text-onSurface mb-3">شروع کنید!</h2>
          <p className="text-body-1 text-muted mb-6 max-w-lg mx-auto">
            هنوز فعالیتی ثبت نشده است. یکی از گزینه‌های زیر را انتخاب کنید تا با LEGALIR شروع به کار کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-white text-body-2 font-medium hover:bg-primary-dark transition-colors touch-target"
            >
              💬 مشاوره حقوقی جدید
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-surfaceVariant transition-colors touch-target"
            >
              📄 بارگذاری سند
            </Link>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-surfaceVariant transition-colors touch-target"
            >
              📝 تنظیم قرارداد جدید
            </Link>
          </div>
        </section>
      )}

      {/* Dashboard grid: Active Requests + Smart Recommendations side-by-side on desktop */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 mb-8">
        <div className="tablet:col-span-2 laptop:col-span-1">
          <ActiveRequests />
        </div>
        <div className="tablet:col-span-2 laptop:col-span-1">
          <SmartRecommendations />
        </div>
      </div>

      {/* Recent Documents */}
      <RecentDocuments />

      {/* Recent Activities — from /api/v1/dashboard/summary */}
      <RecentActivities
        items={activities}
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
