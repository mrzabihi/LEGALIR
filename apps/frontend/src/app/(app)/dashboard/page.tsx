// ============================================================
// LEGALIR — Workplace Dashboard
// Each widget independently manages its own loading/error/empty
// states so a single failure never breaks the entire page.
// ============================================================

"use client";

import { useMe, useDashboardSummary, useUsageSummary } from "@/hooks/useDashboard";
import {
  HeroSection,
  PromoBanner,
  ProfileCompletionCard,
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
  const me = useMe();
  const dashboard = useDashboardSummary();
  const usage = useUsageSummary();

  const displayName = me.data?.profile?.displayName ?? null;
  const activities = dashboard.data?.recentActivity;
  const hasNoActivity = !dashboard.isLoading && (!activities || activities.length === 0);

  const heroStats = {
    dailyUsed: dashboard.data?.dailyTrialsUsed ?? 0,
    dailyTotal: dashboard.data?.dailyTrialsTotal ?? 5,
    docCount: dashboard.data?.recentDocuments?.length ?? 0,
    activeReqCount: dashboard.data?.activeRequests?.length ?? 0,
    daysRemaining: usage.data?.daysRemaining ?? 0,
  };

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      {/* Hero Section — gradient with stats */}
      <HeroSection
        displayName={displayName}
        isLoading={me.isLoading}
        stats={heroStats}
      />

      {/* Smart Input Bar — below hero */}
      <SmartInputBar />

      {/* Profile Completion — from /api/v1/me */}
      <ProfileCompletionCard
        profile={me.data?.profile}
        isLoading={me.isLoading}
      />

      {/* Promo Banner — upgrade CTA */}
      <PromoBanner
        planCode={dashboard.data?.subscription?.planCode}
        daysRemaining={usage.data?.daysRemaining ?? 0}
      />

      {/* Quick Actions — always shown */}
      <QuickActions />

      {/* Legal Library Banner */}
      <section className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60 p-5 flex items-center gap-4 flex-col tablet:flex-row text-center tablet:text-right">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shrink-0 shadow-sm">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8M8 11h6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-titleMedium text-on-surface font-semibold">کتابخانه حقوقی LEGALIR</h3>
          <p className="text-caption text-muted mt-0.5">
            دسترسی رایگان به قوانین، آرای وحدت رویه، راهنماها و منابع آموزشی حقوقی
          </p>
        </div>
        <Link
          href="/legal-library"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white px-5 py-2.5 text-button font-medium hover:from-amber-700 hover:to-yellow-700 transition-all active:scale-[0.98] shadow-sm touch-target"
        >
          مشاهده
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* Empty state CTA when no activity exists */}
      {hasNoActivity && (
        <section className="mb-6 rounded-2xl bg-surface border border-divider/60 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-elevation-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <h2 className="text-h3 text-onSurface mb-3">شروع کنید!</h2>
          <p className="text-body-1 text-muted mb-6 max-w-lg mx-auto">
            هنوز فعالیتی ثبت نشده است. یکی از گزینه‌های زیر را انتخاب کنید تا با LEGALIR شروع به کار کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-body-2 font-medium hover:bg-primary-600 transition-colors touch-target shadow-elevation-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              مشاوره حقوقی جدید
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-xl border border-divider px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-neutral-50 transition-colors touch-target"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              بارگذاری سند
            </Link>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 rounded-xl border border-divider px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-neutral-50 transition-colors touch-target"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              تنظیم قرارداد جدید
            </Link>
          </div>
        </section>
      )}

      {/* Active Requests + Smart Recommendations side-by-side */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 mb-6">
        <ActiveRequests
          items={dashboard.data?.activeRequests ?? []}
          isLoading={dashboard.isLoading}
          error={dashboard.error as Error | null}
          onRetry={() => dashboard.refetch()}
        />
        <SmartRecommendations
          items={dashboard.data?.recommendations ?? []}
          isLoading={dashboard.isLoading}
          error={dashboard.error as Error | null}
          onRetry={() => dashboard.refetch()}
        />
      </div>

      {/* Recent Documents */}
      <RecentDocuments
        items={dashboard.data?.recentDocuments ?? []}
        isLoading={dashboard.isLoading}
        error={dashboard.error as Error | null}
        onRetry={() => dashboard.refetch()}
      />

      {/* Recent Activities */}
      <RecentActivities
        items={activities}
        isLoading={dashboard.isLoading}
        error={dashboard.error as Error | null}
        onRetry={() => dashboard.refetch()}
      />

      {/* Usage & Entitlement Summary */}
      <UsageSummaryCard
        usage={usage.data}
        isLoading={usage.isLoading}
        error={usage.error as Error | null}
        onRetry={() => usage.refetch()}
      />

      {/* Notifications */}
      <NotificationsPlaceholder />
    </div>
  );
}
