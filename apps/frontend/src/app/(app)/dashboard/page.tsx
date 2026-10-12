// ============================================================
// LEGALIR — Workplace Dashboard
// Each widget independently manages its own loading/error/empty
// states so a single failure never breaks the entire page.
// ============================================================

"use client";

import { useMe, useDashboardSummary, useUsageSummary, useBlogPosts } from "@/hooks/useDashboard";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import {
  HeroSection,
  LibraryBanner,
  PromoBanner,
  ProfileCompletionCard,
  QuickActions,
  SmartInputBar,
  ActiveRequests,
  SmartRecommendations,
  RecentDocuments,
  RecentActivities,
  SubscriptionUsageCard,
} from "@/components/dashboard";
import {
  useProfileCompletionPrompt,
  ProfileCompletionPromptModal,
} from "@/features/profile-completion-prompt";
import Link from "next/link";
import { getServiceById } from "@/lib/services";
import { PromoModule } from "@/components/shared";
import { IconServices } from "@/lib/icons";

export default function DashboardPage() {
  const me = useMe();
  const dashboard = useDashboardSummary();
  const usage = useUsageSummary();
  const blog = useBlogPosts(1, 3);

  // Profile Completion Incentive — evaluates eligibility after data loads.
  const promptController = useProfileCompletionPrompt();

  // Hydration guard. The shell (AppLayout/TopBar/Sidebar) fetches the shared
  // `["me"]` query, and because `(app)/loading.tsx` nests this page in its own
  // Suspense boundary the shell can hydrate — and resolve `me` — before this
  // page does. React Query feeds the live `getCurrentResult()` to both
  // snapshots, so without this flag the hydration render would read *resolved*
  // data while the server rendered the loading branch → hydration mismatch.
  // Passing `isPending || !hydrated` keeps the loading branch identical to the
  // server until hydration completes; each widget's own `isLoading` prop is the
  // same expression once hydrated.
  const hydrated = useIsHydrated();
  const loading = me.isPending || !hydrated;
  const dashboardLoading = dashboard.isPending || !hydrated;
  const blogLoading = blog.isPending || !hydrated;

  const displayName = me.data?.profile?.displayName ?? null;
  const activities = dashboard.data?.recentActivity;
  // `hasNoActivity` also gates the "شروع کنید!" empty-state CTA, so it must be
  // false during the loading branch (the server's pending render).
  const hasNoActivity = !dashboard.isPending && hydrated && (!activities || activities.length === 0);

  const heroStats = {
    dailyUsed: dashboard.data?.dailyTrialsUsed ?? 0,
    dailyTotal: dashboard.data?.dailyTrialsTotal ?? 10,
    docCount: dashboard.data?.documentsCount ?? 0,
    activeReqCount: dashboard.data?.activeRequests?.length ?? 0,
    daysRemaining: dashboard.data?.daysRemaining ?? usage.data?.daysRemaining ?? 0,
  };

  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto">
      {/* Profile Completion Incentive — non-blocking modal when eligible */}
      <ProfileCompletionPromptModal controller={promptController} />

      {/* ── 1) OVERVIEW ─────────────────────────────────────── */}
      <HeroSection
        displayName={displayName}
        isLoading={loading}
        stats={heroStats}
      />

      <SmartInputBar />

      {/* Legal Library Banner — directly under the AI tagline */}
      <LibraryBanner />

      {/* Profile Completion — from /api/v1/me */}
      <ProfileCompletionCard
        profile={me.data?.profile}
        isLoading={loading}
      />

      {/* ── 2) ACTIONS ──────────────────────────────────────── */}
      <QuickActions />

      {/* Promo Banner — upgrade CTA */}
      <PromoBanner
        planCode={dashboard.data?.subscription?.planCode}
      />

      {/* ── 3) ONGOING WORK ─────────────────────────────────── */}
      {/* Three cards share one equal-height row on desktop; each card owns its
          own header (icon + title + subtitle + «مشاهده همه»). */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 items-stretch gap-4 mb-6">
        <RecentActivities
          items={activities}
          isLoading={dashboardLoading}
          error={dashboard.error as Error | null}
          onRetry={() => dashboard.refetch()}
        />
        <ActiveRequests
          items={dashboard.data?.activeRequests ?? []}
          isLoading={dashboardLoading}
          error={dashboard.error as Error | null}
          onRetry={() => dashboard.refetch()}
        />
        <SmartRecommendations
          items={dashboard.data?.recommendations ?? []}
          isLoading={dashboardLoading}
          error={dashboard.error as Error | null}
          onRetry={() => dashboard.refetch()}
        />
      </div>

      {/* ── 4) USAGE & SUBSCRIPTION ─────────────────────────── */}
      {/* The card carries its own header (title + subtitle + «جزئیات بیشتر»).
          It renders the usage engine's two distinct assets — today's
          subscription credit and the persistent reward points — plus the
          period-scoped service quotas. */}
      <SubscriptionUsageCard />

      {/* ── 5) SECONDARY ────────────────────────────────────── */}
      {/* Compact promo module — a secondary surface, deliberately small
          and placed below the user's own work (activities, requests,
          usage) so it never competes with their active tasks. */}
      <PromoModule
        art="five"
        title="خدمات حقوقی روی همه دستگاه‌ها"
        message="پرونده، سند و قراردادهایتان را از موبایل یا رایانه مدیریت کنید — همه‌چیز همگام و در دسترس."
        cta="مرور خدمات"
        href="/services"
        icon={IconServices}
        className="mb-6"
      />

      <RecentDocuments
        items={dashboard.data?.recentDocuments ?? []}
        isLoading={dashboardLoading}
        error={dashboard.error as Error | null}
        onRetry={() => dashboard.refetch()}
      />

      {/* Blog / Legal Education */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-titleMedium text-on-surface font-semibold">مطالب پیشنهادی</h2>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-caption text-primary-700 font-medium hover:text-primary-600 transition-colors"
          >
            مشاهده وبلاگ
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {blogLoading ? (
          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-large bg-surface border border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] skeleton-shimmer" />
            ))}
          </div>
        ) : blog.data?.items && blog.data.items.length > 0 ? (
          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
            {blog.data.items.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group rounded-large bg-surface border border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] p-5 shadow-elevation-1 hover:shadow-elevation-3 hover:border-primary-200 transition-all duration-200 flex flex-col"
              >
                <span className="inline-flex items-center gap-1 w-fit text-caption text-secondary-700 bg-secondary-50 border border-[color-mix(in_srgb,var(--color-secondary-200)_60%,transparent)] rounded-full px-2.5 py-0.5 mb-3">
                  {post.category}
                </span>
                <h3 className="text-body-1 text-on-surface font-semibold mb-2 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug">
                  {post.titleFa}
                </h3>
                <p className="text-caption text-muted leading-relaxed line-clamp-2 flex-1">
                  {post.excerpt}
                </p>
                <span className="text-caption text-neutral-400 mt-3 tabular-nums">
                  {post.readingTime} دقیقه مطالعه
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-large bg-surface border border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] p-6 text-center">
            <p className="text-body-2 text-muted">هنوز مطلبی در وبلاگ منتشر نشده است.</p>
          </div>
        )}
      </section>

      {/* Empty state CTA when no activity exists */}
      {hasNoActivity && (
        <section className="mb-6 rounded-large bg-surface border border-[color-mix(in_srgb,var(--color-divider)_60%,transparent)] p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-large bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-elevation-2">
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
              href={getServiceById("legal_consultation")?.href ?? "/chat"}
              className="inline-flex items-center gap-2 rounded-medium bg-primary text-primary-on px-5 py-2.5 text-body-2 font-medium hover:bg-primary-600 hover:text-white transition-colors touch-target shadow-elevation-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              مشاوره حقوقی جدید
            </Link>
            <Link
              href={getServiceById("document_analysis")?.href ?? "/documents"}
              className="inline-flex items-center gap-2 rounded-medium border border-divider px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-neutral-50 transition-colors touch-target"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              بارگذاری سند
            </Link>
            <Link
              href={getServiceById("contract_drafting")?.href ?? "/contracts"}
              className="inline-flex items-center gap-2 rounded-medium border border-divider px-5 py-2.5 text-onSurface text-body-2 font-medium hover:bg-neutral-50 transition-colors touch-target"
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

    </div>
  );
}
