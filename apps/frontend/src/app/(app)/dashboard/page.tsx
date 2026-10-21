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
import { buttonClasses } from "@legalir/ui";
import { getServiceById } from "@/lib/services";
import { PageContainer, PromoModule, SectionHeader } from "@/components/shared";
import { DiscoveryEntryCard } from "@/components/services";
import { JudicialServiceZone } from "@/components/judicial/judicial-service-zone";
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
    <PageContainer>
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

      {/* Smart path discovery — the entry for a user who has a problem but
          does not yet know which service fits. Placed right after the quick
          actions so it is impossible to miss on first visit. */}
      <DiscoveryEntryCard className="mb-6" />

      {/* Judicial documents — the admin-managed discovery surface. The «خانه»
          flag in the admin panel decides whether this block exists, and a
          service that is switched off still shows its honest status note
          without a working CTA. The zone renders nothing when the flag is off
          or the catalog cannot be read, so the page keeps its existing shape. */}
      <JudicialServiceZone
        surface="home"
        mode="app"
        className="mb-6"
        footer={
          <div className="mt-3">
            <Link
              href="/cases"
              className="inline-flex items-center gap-1.5 text-caption font-medium text-primary transition-colors hover:text-primary-600"
            >
              مشاهدهٔ همهٔ پرونده‌ها و دادخواست‌ها
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        }
      />

      {/* Promo Banner — upgrade CTA */}
      <PromoBanner
        planCode={dashboard.data?.subscription?.planCode}
      />

      {/* ── 3) ONGOING WORK ─────────────────────────────────── */}
      {/* One group heading names the block, so the page reads as a sequence
          of labelled groups rather than an unbroken stack of cards. The
          heading is purely structural — the three cards keep their own
          headers, data and «مشاهده همه» links untouched. */}
      <SectionHeader
        id="ongoing-work-title"
        title="کارهای در جریان"
        description="آخرین فعالیت‌ها، درخواست‌های فعال و پیشنهادهای هوشمند"
      />
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
      {/* Legal-services promo banner — a full-bleed photographic surface
          (the SUSBS-GOLD poster), placed below the user's own work
          (activities, requests, usage) so it never competes with their
          active tasks. The photo carries the panel; the copy sits over its
          quiet right-hand side and the standard «مرور خدمات» link opens the
          catalog. */}
      <PromoModule
        eyebrow="خدمات حقوقی"
        title="خدمات حقوقی روی همه دستگاه‌ها"
        message="پرونده، سند و قراردادهایتان را از موبایل یا رایانه مدیریت کنید — همه‌چیز همگام و در دسترس."
        cta="مرور خدمات"
        href="/services"
        icon={IconServices}
        className="mb-6"
        photo={{
          src: "/assets/promo/legalir-banner-legal-services.webp",
          srcSm: "/assets/promo/legalir-banner-legal-services-sm.webp",
          width: 1600,
          height: 535,
          // Phone crop: keep the courthouse + scales framed, pin toward the
          // subject (the 2168:725 source is far wider than the portrait frame).
          objectPositionMobile: "30% center",
          // Gentle baseline darkening; the directional wash adds the rest.
          scrim: 0.34,
        }}
      />

      <RecentDocuments
        items={dashboard.data?.recentDocuments ?? []}
        isLoading={dashboardLoading}
        error={dashboard.error as Error | null}
        onRetry={() => dashboard.refetch()}
      />

      {/* Blog / Legal Education */}
      <section className="mb-6">
        <SectionHeader
          title="مطالب پیشنهادی"
          action={
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-caption text-primary font-medium transition-colors hover:text-primary-600"
            >
              مشاهده وبلاگ
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          }
        />

        {blogLoading ? (
          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low skeleton-shimmer"
              />
            ))}
          </div>
        ) : blog.data?.items && blog.data.items.length > 0 ? (
          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
            {blog.data.items.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 shadow-elevation-1 transition-[box-shadow,border-color] duration-short4 ease-standard hover:border-[color:var(--color-outline)] hover:shadow-elevation-3"
              >
                {/* Category pill lives in the gold family, the one accent the
                    blog owns, so it never competes with a status chip. */}
                <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--color-secondary)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-secondary)_10%,transparent)] px-2.5 py-0.5 text-caption text-[color:var(--color-secondary)]">
                  {post.category}
                </span>
                <h3 className="mb-2 line-clamp-2 text-body-1 font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary">
                  {post.titleFa}
                </h3>
                {/* Three lines: the excerpt is one sentence of real legal
                    prose and needs a third line on a phone. The card sits
                    in a grid, so siblings equalise on the tallest one
                    rather than leaving this row short. */}
                <p className="line-clamp-3 flex-1 text-caption leading-relaxed text-muted">
                  {post.excerpt}
                </p>
                <span className="mt-3 text-caption tabular-nums text-muted">
                  {post.readingTime} دقیقه مطالعه
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low p-6 text-center">
            <p className="text-body-2 text-muted">هنوز مطلبی در وبلاگ منتشر نشده است.</p>
          </div>
        )}
      </section>

      {/* Empty state CTA when no activity exists */}
      {hasNoActivity && (
        <section className="mb-6 rounded-large border border-[color:var(--color-outline-variant)] bg-surface-container-low p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-large bg-[linear-gradient(135deg,var(--brand-teal)_0%,var(--brand-green)_100%)] shadow-elevation-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <h2 className="mb-3 text-h3 text-on-surface">شروع کنید!</h2>
          <p className="mx-auto mb-6 max-w-lg text-body-1 text-muted">
            هنوز فعالیتی ثبت نشده است. یکی از گزینه‌های زیر را انتخاب کنید تا با LEGALIR شروع به کار کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={getServiceById("legal_consultation")?.href ?? "/chat"}
              className={buttonClasses({ className: "px-5", size: "large" })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              مشاوره حقوقی جدید
            </Link>
            <Link
              href={getServiceById("document_analysis")?.href ?? "/documents"}
              className={buttonClasses({ variant: "outlined", size: "large", className: "px-5" })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              بارگذاری سند
            </Link>
            <Link
              href={getServiceById("contract_drafting")?.href ?? "/contracts"}
              className={buttonClasses({ variant: "outlined", size: "large", className: "px-5" })}
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
    </PageContainer>
  );
}
