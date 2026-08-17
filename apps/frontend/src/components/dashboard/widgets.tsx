// ============================================================
// LEGALIR — Dashboard Widgets
// Modern UI with gradient hero, stat cards, circular progress,
// and partial-loading resilience so one failure doesn't break
// the entire dashboard.
// ============================================================

"use client";

import { type ReactNode, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Profile,
  RecentActivityItem,
  UsageSummary,
  ActiveRequestItem,
  DashboardRecommendation,
  RecentDocumentItem,
} from "@legalir/types";

// ============================================================
// WidgetShell — common wrapper with loading/error/empty handling
// ============================================================

interface WidgetShellProps {
  title?: string;
  titleRight?: ReactNode;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  children: ReactNode;
  className?: string;
  /** Skip the white card wrapper for full-bleed sections */
  bare?: boolean;
}

export function WidgetShell({
  title,
  titleRight,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "اطلاعاتی یافت نشد",
  errorMessage = "خطا در دریافت اطلاعات",
  children,
  className = "",
  bare = false,
}: WidgetShellProps) {
  const content = (
    <>
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3 text-onSurface font-bold">{title}</h3>
          {titleRight}
        </div>
      )}

      {isLoading ? (
        <WidgetSkeleton />
      ) : error ? (
        <WidgetError message={errorMessage} onRetry={onRetry} />
      ) : isEmpty ? (
        <WidgetEmpty message={emptyMessage} />
      ) : (
        children
      )}
    </>
  );

  if (bare) return <section className={className}>{content}</section>;

  return (
    <section
      className={`rounded-2xl bg-surface border border-divider/60 shadow-elevation-1 p-5 ${className}`}
    >
      {content}
    </section>
  );
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="h-5 w-3/4 rounded-small bg-muted/15" />
      <div className="h-4 w-full rounded-small bg-muted/10" />
      <div className="h-4 w-2/3 rounded-small bg-muted/10" />
    </div>
  );
}

function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center" role="alert">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-body-2 text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-primary px-4 py-1.5 text-white text-caption hover:bg-primary-600 transition-colors touch-target"
        >
          تلاش مجدد
        </button>
      )}
    </div>
  );
}

function WidgetEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-250">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <p className="text-body-2 text-neutral-400">{message}</p>
    </div>
  );
}

// ============================================================
// HeroSection — gradient hero with greeting, stats, and input
// ============================================================

interface HeroSectionProps {
  displayName: string | null;
  isLoading: boolean;
  stats: {
    dailyUsed: number;
    dailyTotal: number;
    docCount: number;
    activeReqCount: number;
    daysRemaining: number;
  };
}

export function HeroSection({ displayName, isLoading, stats }: HeroSectionProps) {
  const name = displayName ?? "کاربر";

  const statCards = [
    {
      label: "درخواست امروز",
      value: `${stats.dailyUsed}/${stats.dailyTotal}`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      accent: "from-blue-500/20 to-blue-600/10 text-blue-100",
    },
    {
      label: "اسناد",
      value: stats.docCount.toLocaleString("fa-IR"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      accent: "from-emerald-500/20 to-emerald-600/10 text-emerald-100",
    },
    {
      label: "درخواست فعال",
      value: stats.activeReqCount.toLocaleString("fa-IR"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      accent: "from-purple-500/20 to-purple-600/10 text-purple-100",
    },
    {
      label: "روز باقی‌مانده",
      value: stats.daysRemaining.toLocaleString("fa-IR"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      accent: "from-amber-500/20 to-amber-600/10 text-amber-100",
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 p-6 tablet:p-8 mb-6 animate-pulse">
        <div className="h-9 w-56 rounded-lg bg-white/10 mb-3" />
        <div className="h-5 w-40 rounded-lg bg-white/10 mb-8" />
        <div className="grid grid-cols-2 tablet:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 p-6 tablet:p-8 mb-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary-400/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-secondary-400/10 blur-3xl" />
      </div>

      {/* Greeting */}
      <div className="relative">
        <h1 className="text-h2 tablet:text-h1 text-white font-bold">
          سلام، {name}
          <span className="inline-block ml-2 animate-bounce-gentle">👋</span>
        </h1>
        <p className="text-body-1 text-primary-200 mt-1">به محیط کار LEGALIR خوش آمدید</p>
      </div>

      {/* Stat cards */}
      <div className="relative grid grid-cols-2 tablet:grid-cols-4 gap-3 mt-6">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl bg-gradient-to-br ${stat.accent} border border-white/10 backdrop-blur p-4 flex flex-col gap-2`}
          >
            <span className="opacity-70">{stat.icon}</span>
            <div>
              <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">{stat.value}</p>
              <p className="text-caption text-primary-200 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PromoBanner — subscription upgrade CTA
// ============================================================

interface PromoBannerProps {
  planCode: string | null | undefined;
}

const PLAN_BANNER_INFO: Record<string, { title: string; desc: string; cta: string; href: string }> = {
  silver: {
    title: "ارتقا به اشتراک طلایی",
    desc: "با ارتقا به طلا، از تحلیل قرارداد و استعلام سوابق بهره‌مند شوید",
    cta: "ارتقا اشتراک",
    href: "/pricing",
  },
  gold: {
    title: "ارتقا به اشتراک الماس",
    desc: "با الماس، دستیار اختصاصی و تنظیم خودکار اظهارنامه دریافت کنید",
    cta: "ارتقا به الماس",
    href: "/pricing",
  },
};

export function PromoBanner({ planCode }: PromoBannerProps) {
  const info = planCode ? PLAN_BANNER_INFO[planCode] : null;
  if (!info) return null;

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border border-amber-200/60 p-5 mb-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/20 blur-2xl" />
      </div>
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-elevation-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <p className="text-body-1 text-onSurface font-semibold">{info.title}</p>
            <p className="text-caption text-muted mt-0.5">{info.desc}</p>
          </div>
        </div>
        <Link
          href={info.href}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white px-5 py-2.5 text-button font-semibold hover:bg-amber-600 active:scale-95 transition-all touch-target shadow-elevation-1"
        >
          {info.cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// ProfileCompletionCard
// ============================================================

interface ProfileCompletionCardProps {
  profile: Profile | null | undefined;
  isLoading: boolean;
}

export function ProfileCompletionCard({ profile, isLoading }: ProfileCompletionCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface border border-warning/30 p-5 mb-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-muted/15" />
        <div className="mt-2 h-2 w-48 rounded-full bg-muted/10" />
      </div>
    );
  }

  // 100% — onboarding complete; the card disappears entirely.
  if (!profile || profile.completionPercent >= 100) return null;

  const pct = profile.completionPercent;

  // 50% — Basic Profile done; invite the user to complete the Extended profile.
  const atBasicComplete = pct >= 50 && pct < 51;

  const title = atBasicComplete ? "اطلاعات پایه تکمیل شد" : "پروفایل خود را تکمیل کنید";
  const supporting = atBasicComplete
    ? "برای تکمیل پروفایل حقوقی و دریافت تجربه شخصی‌سازی‌شده، مرحله دوم را تکمیل کنید."
    : "برای استفاده از تمام امکانات، پروفایل خود را تکمیل کنید";
  const cta = atBasicComplete ? "ادامه تکمیل پروفایل" : "تکمیل پروفایل";

  return (
    <div className="rounded-2xl bg-surface border border-warning/30 p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-body-1 text-onSurface font-semibold">
              {title}
              <span className="text-muted font-normal"> · {pct}٪</span>
            </span>
          </div>
          <div
            className="w-full max-w-xs h-2 bg-neutral-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="درصد تکمیل پروفایل"
          >
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-moderate1"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-caption text-muted mt-1.5">{supporting}</p>
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-xl bg-primary text-white px-5 py-2.5 text-button font-medium hover:bg-primary-600 transition-colors touch-target shadow-elevation-1"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// QuickActions — service launcher grid
// ============================================================

interface QuickActionItem {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  gradient: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    href: "/chat",
    title: "مشاوره حقوقی",
    desc: "سوال خود را بپرسید",
    gradient: "from-blue-500 to-blue-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/documents",
    title: "بررسی قرارداد",
    desc: "تحلیل ریسک و شروط",
    gradient: "from-emerald-500 to-emerald-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
      </svg>
    ),
  },
  {
    href: "/contracts",
    title: "تنظیم قرارداد",
    desc: "پیش‌نویس هوشمند",
    gradient: "from-violet-500 to-violet-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    href: "/chat?category=formal_letter",
    title: "تولید اظهارنامه",
    desc: "نامه‌نگاری حقوقی",
    gradient: "from-orange-500 to-orange-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    href: "/documents",
    title: "تحلیل اسناد",
    desc: "بررسی مستندات",
    gradient: "from-cyan-500 to-cyan-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/chat?category=calculator",
    title: "محاسبات حقوقی",
    desc: "خسارت، ارث، دیه",
    gradient: "from-rose-500 to-rose-600",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
    ),
  },
];

export function QuickActions() {
  return (
    <section className="mb-6">
      <h2 className="text-h3 text-onSurface font-bold mb-4">دسترسی سریع</h2>
      <div className="grid grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-6 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href + action.title}
            href={action.href}
            className="group rounded-2xl bg-surface border border-divider/60 p-4 hover:shadow-elevation-4 hover:border-primary/20 transition-all duration-200 active:scale-[0.97] touch-target flex flex-col items-center text-center gap-3"
          >
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-elevation-1 group-hover:scale-110 transition-transform duration-200`}>
              {action.icon}
            </div>
            <div>
              <h3 className="text-body-2 text-onSurface font-semibold group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              <p className="text-caption text-muted mt-0.5 hidden tablet:block">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// RecentActivities — modern card grid with status badges
// ============================================================

interface RecentActivitiesProps {
  items: (RecentActivityItem & { description?: string | null; categoryFa?: string | null })[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  conversation: "💬",
  document: "📄",
  contract: "📝",
};

const ACTIVITY_TYPE_LINKS: Record<string, string> = {
  conversation: "/chat",
  document: "/documents",
  contract: "/contracts",
};

function getStatusBadge(status: string): { label: string; colorClass: string } {
  const s = status.toLowerCase();
  if (["completed", "ready", "generated", "approved", "exported", "active"].includes(s)) {
    return { label: "تکمیل شده", colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (["processing", "analyzing", "extracting", "in_progress", "under_review", "collecting", "uploaded"].includes(s)) {
    return { label: "در حال انجام", colorClass: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (["draft"].includes(s)) {
    return { label: "پیش‌نویس", colorClass: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (["failed", "blocked"].includes(s)) {
    return { label: "ناموفق", colorClass: "bg-red-50 text-red-700 border-red-200" };
  }
  if (["archived"].includes(s)) {
    return { label: "بایگانی", colorClass: "bg-neutral-100 text-neutral-600 border-neutral-200" };
  }
  return { label: s, colorClass: "bg-neutral-50 text-neutral-600 border-neutral-200" };
}

export function RecentActivities({ items, isLoading, error, onRetry }: RecentActivitiesProps) {
  return (
    <WidgetShell
      title="پیش‌نویس‌های اخیر"
      titleRight={
        items && items.length > 0 ? (
          <Link href="/history" className="text-button text-primary hover:underline">
            مشاهده همه
          </Link>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="هنوز فعالیتی ندارید. از گزینه‌های بالا شروع کنید"
      className="mb-6"
    >
      {items && (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
          {items.map((activity) => {
            const badge = getStatusBadge(activity.status);
            return (
              <Link
                key={activity.id}
                href={ACTIVITY_TYPE_LINKS[activity.type] ?? "#"}
                className="group flex gap-3 p-3 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-divider transition-all duration-200 active:scale-[0.98] touch-target"
              >
                <span className="text-xl shrink-0 w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center group-hover:bg-white transition-colors">
                  {ACTIVITY_TYPE_ICONS[activity.type] ?? "📋"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body-2 text-onSurface font-medium truncate group-hover:text-primary transition-colors">
                      {activity.title}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border ${badge.colorClass}`}>
                      {badge.label}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="text-caption text-muted line-clamp-1 mt-0.5">{activity.description}</p>
                  )}
                  <span className="text-caption text-muted/60 mt-1 block">
                    {formatRelativeDate(activity.updatedAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

// ============================================================
// UsageSummaryCard — circular progress rings
// ============================================================

interface UsageSummaryCardProps {
  usage: UsageSummary | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

function CircularProgress({ pct, size = 56, strokeWidth = 5 }: { pct: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const isExhausted = pct >= 100;
  const isNearLimit = pct >= 80;

  const strokeColor = isExhausted
    ? "stroke-error"
    : isNearLimit
      ? "stroke-warning"
      : "stroke-primary";

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-neutral-100"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={`${strokeColor} transition-all duration-moderate1`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function UsageSummaryCard({ usage, isLoading, error, onRetry }: UsageSummaryCardProps) {
  return (
    <WidgetShell
      title="مصرف و سهمیه"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!usage || usage.entitlements.length === 0}
      emptyMessage="اطلاعات مصرف در دسترس نیست"
      className="mb-6"
    >
      {usage && (
        <div className="space-y-4">
          {usage.entitlements.map((ent) => {
            if (ent.isBoolean) {
              return (
                <div key={ent.featureKey} className="flex items-center justify-between py-1">
                  <span className="text-body-2 text-onSurface">{ent.nameFa}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-medium ${
                    ent.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-muted"
                  }`}>
                    {ent.isEnabled ? "فعال" : "غیرفعال"}
                  </span>
                </div>
              );
            }

            const limit = ent.limit ?? 0;
            const used = ent.used;
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const isExhausted = pct >= 100;
            const isNearLimit = pct >= 80;

            return (
              <div key={ent.featureKey} className="flex items-center gap-4">
                <CircularProgress pct={pct} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-2 text-onSurface font-medium">{ent.nameFa}</p>
                  <p className={`text-caption mt-0.5 ${
                    isExhausted ? "text-error" : isNearLimit ? "text-warning" : "text-muted"
                  }`}>
                    {used.toLocaleString("fa-IR")} از {limit === 0 ? "∞" : limit.toLocaleString("fa-IR")}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="pt-3 border-t border-divider/50 flex items-center justify-between">
            <span className="text-caption text-muted">بازنشانی سهمیه</span>
            <span className="text-caption text-onSurface font-medium">
              {usage.daysRemaining} روز دیگر
            </span>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

// ============================================================
// NotificationsPlaceholder
// ============================================================

export function NotificationsPlaceholder() {
  return (
    <WidgetShell
      title="اعلان‌ها"
      isLoading={false}
      error={null}
      isEmpty={true}
      emptyMessage="اعلان جدیدی ندارید"
      className="mb-6"
    >
      {null}
    </WidgetShell>
  );
}

// ============================================================
// SmartInputBar — intelligent search/routing input
// ============================================================

interface SmartInputBarProps {
  className?: string;
}

const EXAMPLE_CHIPS = [
  { label: "بررسی قرارداد", query: "قرارداد من را بررسی کن" },
  { label: "شکایت از موجر", query: "می‌خواهم از موجر شکایت کنم" },
  { label: "تنظیم اظهارنامه", query: "یک اظهارنامه رسمی تنظیم کن" },
  { label: "محاسبه خسارت", query: "خسارت تاخیر تادیه را محاسبه کن" },
];

export function SmartInputBar({ className = "" }: SmartInputBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isRouting, setIsRouting] = useState(false);

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isRouting) return;
      setIsRouting(true);
      const encoded = encodeURIComponent(trimmed);
      router.push(`/chat?q=${encoded}`);
    },
    [router, isRouting],
  );

  const handleChipClick = useCallback(
    (chipQuery: string) => {
      setQuery(chipQuery);
      handleSubmit(chipQuery);
    },
    [handleSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit(query);
    },
    [handleSubmit, query],
  );

  return (
    <section className={`mb-6 ${className}`}>
      <div className="relative max-w-2xl mx-auto">
        {/* Input container */}
        <div
          className={`relative rounded-2xl border-2 transition-all duration-medium2 bg-surface ${
            isRouting
              ? "border-primary/30"
              : "border-divider focus-within:border-primary/60 focus-within:shadow-[0_4px_24px_-6px_rgba(22,32,51,0.15)]"
          }`}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="مسئله حقوقی خود را توضیح دهید..."
            disabled={isRouting}
            className="w-full h-14 pl-14 pr-5 rounded-2xl bg-transparent text-body-1 text-onSurface placeholder:text-muted/50 outline-none disabled:opacity-60"
            aria-label="مسئله حقوقی خود را توضیح دهید"
            dir="rtl"
          />

          <button
            type="button"
            onClick={() => handleSubmit(query)}
            disabled={!query.trim() || isRouting}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-target"
            aria-label="ارسال پرسش"
          >
            {isRouting ? (
              <span className="text-xs">...</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {isRouting && (
          <div className="mt-3 text-center animate-fade-in">
            <span className="inline-flex items-center gap-2 text-caption text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              در حال تشخیص...
            </span>
          </div>
        )}

        {!isRouting && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-caption text-muted/60">برای نمونه:</span>
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip.query)}
                className="rounded-full bg-neutral-100 border border-divider/40 px-3 py-1 text-caption text-onSurface hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors active:scale-[0.97] touch-target"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-caption text-muted/50">
          با هوش مصنوعی قانون‌مدار ایران
        </p>
      </div>
    </section>
  );
}

// ============================================================
// ActiveRequests — in-progress request status tracker
// ============================================================

const STATUS_STYLES: Record<ActiveRequestItem["status"], { badge: string; bar: string }> = {
  draft: { badge: "bg-neutral-100 text-neutral-700 border-neutral-200", bar: "bg-neutral-300" },
  processing: { badge: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-500" },
  needs_info: { badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  completed: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
};

interface ActiveRequestsProps {
  items: ActiveRequestItem[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function ActiveRequests({ items, isLoading, error, onRetry }: ActiveRequestsProps) {
  return (
    <WidgetShell
      title="درخواست‌های فعال"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="درخواست فعالی ندارید"
    >
      <div className="space-y-2">
        {items.map((req) => {
          const styles = STATUS_STYLES[req.status];
          return (
            <Link
              key={req.id}
              href={req.link}
              className="flex flex-col gap-2 p-3 rounded-xl hover:bg-neutral-50 transition-colors border border-transparent hover:border-divider active:scale-[0.98] touch-target"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-2 text-onSurface font-medium truncate">{req.title}</p>
                  <span className="text-caption text-muted">{req.typeFa}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${styles.badge}`}>
                  {req.statusFa}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-moderate1 ${styles.bar}`}
                    style={{ width: `${Math.max(2, req.progress)}%` }}
                  />
                </div>
                <span className="text-caption text-muted shrink-0 tabular-nums">{req.progress}٪</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted/60">{formatRelativeDate(req.date)}</span>
                <span className="text-caption text-primary font-medium">مشاهده</span>
              </div>
            </Link>
          );
        })}
      </div>
    </WidgetShell>
  );
}

// ============================================================
// SmartRecommendations — context-aware suggestion cards
// ============================================================

const URGENCY_STYLES: Record<DashboardRecommendation["urgency"], { accent: string; bg: string; dot: string }> = {
  info: { accent: "border-blue-200", bg: "bg-blue-50/50", dot: "bg-blue-500" },
  warning: { accent: "border-amber-200", bg: "bg-amber-50/50", dot: "bg-amber-500" },
  action: { accent: "border-primary-200", bg: "bg-primary-50/30", dot: "bg-primary-500" },
};

interface SmartRecommendationsProps {
  items: DashboardRecommendation[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function SmartRecommendations({ items, isLoading, error, onRetry }: SmartRecommendationsProps) {
  return (
    <WidgetShell
      title="توصیه‌های هوشمند"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="توصیه‌ای برای شما وجود ندارد"
    >
      <div className="space-y-2">
        {items.map((rec) => {
          const styles = URGENCY_STYLES[rec.urgency];
          return (
            <div
              key={rec.id}
              className={`flex items-start gap-3 p-3 rounded-xl border ${styles.accent} ${styles.bg} transition-colors`}
            >
              <span className={`h-2 w-2 rounded-full ${styles.dot} mt-2 shrink-0`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-onSurface">{rec.text}</p>
                <Link
                  href={rec.link}
                  className="inline-block mt-1.5 text-caption text-primary font-medium hover:underline"
                >
                  {rec.linkLabel}
                </Link>
              </div>
              {rec.icon && <span className="text-lg shrink-0 mt-0.5">{rec.icon}</span>}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

// ============================================================
// RecentDocuments — quick access to latest uploaded files
// ============================================================

const DOC_STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  analyzing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  uploaded: "bg-neutral-100 text-neutral-600 border-neutral-200",
  extracting: "bg-blue-50 text-blue-700 border-blue-200",
};

interface RecentDocumentsProps {
  items: RecentDocumentItem[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function RecentDocuments({ items, isLoading, error, onRetry }: RecentDocumentsProps) {
  return (
    <WidgetShell
      title="اسناد اخیر"
      titleRight={
        items && items.length > 0 ? (
          <Link href="/documents" className="text-button text-primary hover:underline">
            مشاهده همه
          </Link>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="هنوز سندی بارگذاری نکرده‌اید"
      className="mb-6"
    >
      <div className="space-y-1">
        {items.map((doc) => {
          const statusStyle = DOC_STATUS_STYLES[doc.status] ?? DOC_STATUS_STYLES["uploaded"];
          return (
            <Link
              key={doc.id}
              href="/documents"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors touch-target group"
            >
              <span className="text-xl shrink-0 w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-white transition-colors">
                {doc.mime?.includes("pdf") ? "📄" : doc.mime?.includes("image") ? "🖼️" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-onSurface font-medium truncate">{doc.name}</p>
                <span className="text-caption text-muted">{formatRelativeDate(doc.uploadedAt)}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${statusStyle}`}>
                {doc.statusFa}
              </span>
            </Link>
          );
        })}
      </div>
    </WidgetShell>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "امروز";
  if (diffDays === 1) return "دیروز";
  if (diffDays < 7) return `${diffDays} روز پیش`;
  return date.toLocaleDateString("fa-IR");
}
