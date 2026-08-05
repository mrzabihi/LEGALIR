// ============================================================
// LEGALIR — Dashboard Widgets
// Partial loading: each widget independently manages its
// own loading/error/empty states so one failure doesn't
// break the entire dashboard.
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type {
  Profile,
  Subscription,
  Entitlement,
  RecentActivityItem,
  UsageSummary,
} from "@legalir/types";

// ============================================================
// WidgetShell — common wrapper with loading/error/empty handling
// ============================================================

interface WidgetShellProps {
  title: string;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  errorMessage?: string;
  children: ReactNode;
  className?: string;
}

export function WidgetShell({
  title,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "اطلاعاتی یافت نشد",
  emptyIcon = "📋",
  errorMessage = "خطا در دریافت اطلاعات",
  children,
  className = "",
}: WidgetShellProps) {
  return (
    <section
      className={`rounded-large bg-surface border border-divider shadow-elevation-1 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider/50">
        <h3 className="text-labelLarge text-onSurface font-medium">{title}</h3>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <WidgetSkeleton />
        ) : error ? (
          <WidgetError message={errorMessage} onRetry={onRetry} />
        ) : isEmpty ? (
          <WidgetEmpty icon={emptyIcon} message={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="h-5 w-3/4 rounded-small bg-muted/20" />
      <div className="h-4 w-full rounded-small bg-muted/10" />
      <div className="h-4 w-2/3 rounded-small bg-muted/10" />
    </div>
  );
}

function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center" role="alert">
      <span className="text-2xl">⚠️</span>
      <p className="text-body-2 text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-small bg-primary px-4 py-1.5 text-white text-caption hover:opacity-90 transition-opacity touch-target"
        >
          تلاش مجدد
        </button>
      )}
    </div>
  );
}

function WidgetEmpty({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-body-2 text-muted">{message}</p>
    </div>
  );
}

// ============================================================
// GreetingHeader
// ============================================================

interface GreetingHeaderProps {
  displayName: string | null;
  isLoading: boolean;
}

export function GreetingHeader({ displayName, isLoading }: GreetingHeaderProps) {
  return (
    <div className="mb-6">
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-48 rounded-medium bg-muted/20" />
          <div className="h-5 w-32 rounded-small bg-muted/10" />
        </div>
      ) : (
        <>
          <h1 className="text-h2 text-onSurface">
            سلام، {displayName ?? "کاربر"}
          </h1>
          <p className="text-body-2 text-muted mt-1">به محیط کار LEGALIR خوش آمدید</p>
        </>
      )}
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
      <div className="rounded-large bg-surface border border-warning/30 shadow-elevation-1 p-4 mb-6 animate-pulse">
        <div className="h-5 w-40 rounded-small bg-muted/20" />
        <div className="mt-2 h-2 w-48 rounded-full bg-muted/10" />
      </div>
    );
  }

  if (!profile || profile.completionPercent >= 100) return null;

  return (
    <div className="rounded-large bg-surface border border-warning/30 shadow-elevation-1 p-4 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <span className="text-body-2 text-onSurface font-medium">
            تکمیل پروفایل {profile.completionPercent}٪
          </span>
          <div className="w-full max-w-xs h-2 bg-background rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-moderate1"
              style={{ width: `${profile.completionPercent}%` }}
            />
          </div>
          {profile.completionPercent < 70 && (
            <p className="text-caption text-muted mt-1">
              برای استفاده از تمام امکانات، پروفایل خود را تکمیل کنید
            </p>
          )}
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-medium bg-primary text-white px-4 py-2 text-button hover:bg-primary-variant transition-colors touch-target inline-flex items-center"
        >
          تکمیل پروفایل
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// SubscriptionSummaryCard
// ============================================================

interface SubscriptionSummaryCardProps {
  subscription: Subscription | null | undefined;
  isLoading: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  ultra: "الترا",
  pro: "پرو",
  pro_max: "پرو مکس",
};

export function SubscriptionSummaryCard({ subscription, isLoading }: SubscriptionSummaryCardProps) {
  return (
    <WidgetShell
      title="اشتراک فعلی"
      isLoading={isLoading}
      error={null}
      onRetry={undefined}
      isEmpty={!subscription}
      emptyMessage="شما هنوز اشتراک فعالی ندارید"
      emptyIcon="⭐"
      className="mb-6"
    >
      {subscription && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-body-1 text-onSurface font-medium">
              {PLAN_LABELS[subscription.planCode] ?? subscription.planCode}
            </span>
            <span className="text-caption text-muted mr-3">
              تا {new Date(subscription.endAt).toLocaleDateString("fa-IR")}
            </span>
            <span
              className={`mr-3 inline-block rounded-full px-2 py-0.5 text-caption font-medium ${
                subscription.status === "active"
                  ? "bg-success/10 text-success"
                  : subscription.status === "expired"
                    ? "bg-error/10 text-error"
                    : "bg-warning/10 text-warning"
              }`}
            >
              {subscription.status === "active"
                ? "فعال"
                : subscription.status === "expired"
                  ? "منقضی"
                  : subscription.status === "cancelled"
                    ? "لغوشده"
                    : "در انتظار"}
            </span>
          </div>
          <Link
            href="/subscription"
            className="shrink-0 rounded-medium border border-border text-onSurface px-4 py-2 text-button hover:bg-background transition-colors touch-target"
          >
            مدیریت اشتراک
          </Link>
        </div>
      )}
    </WidgetShell>
  );
}

// ============================================================
// QuickActions
// ============================================================

interface QuickActionItem {
  href: string;
  title: string;
  desc: string;
  icon: string;
  colorClass: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    href: "/chat",
    title: "مشاوره حقوقی جدید",
    desc: "سوال خود را بپرسید",
    icon: "💬",
    colorClass: "bg-primary",
  },
  {
    href: "/documents",
    title: "تحلیل سند",
    desc: "قرارداد را بررسی کنید",
    icon: "📄",
    colorClass: "bg-secondary",
  },
  {
    href: "/contracts",
    title: "ساخت قرارداد",
    desc: "پیش‌نویس هوشمند",
    icon: "📝",
    colorClass: "bg-success",
  },
];

export function QuickActions() {
  return (
    <section className="mb-8">
      <h2 className="text-h3 text-onSurface mb-4">دسترسی سریع</h2>
      <div className="grid grid-cols-1 mobile-l:grid-cols-2 tablet:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-large bg-surface p-4 shadow-elevation-1 hover:shadow-elevation-4 transition-shadow border border-divider group active:scale-[0.98] touch-target"
          >
            <div
              className={`h-10 w-10 rounded-medium ${action.colorClass} mb-3 flex items-center justify-center text-white`}
            >
              {action.icon}
            </div>
            <h3 className="text-body-1 text-onSurface font-medium group-hover:text-primary transition-colors">
              {action.title}
            </h3>
            <p className="text-body-2 text-muted">{action.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// RecentActivities — unified list for conversations, documents, contracts
// ============================================================

interface RecentActivitiesProps {
  items: RecentActivityItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  conversation: "گفتگو",
  document: "سند",
  contract: "قرارداد",
};

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

export function RecentActivities({ items, isLoading, error, onRetry }: RecentActivitiesProps) {
  return (
    <WidgetShell
      title="فعالیت اخیر"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="هنوز فعالیتی ندارید. از گزینه‌های بالا شروع کنید"
      emptyIcon="🕐"
      className="mb-8"
    >
      {items && (
        <div className="space-y-2">
          {items.map((activity) => (
            <Link
              key={activity.id}
              href={ACTIVITY_TYPE_LINKS[activity.type] ?? "#"}
              className="flex items-center justify-between gap-3 p-3 rounded-medium hover:bg-background transition-colors touch-target"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0">
                  {ACTIVITY_TYPE_ICONS[activity.type] ?? "📋"}
                </span>
                <div className="min-w-0">
                  <p className="text-body-2 text-onSurface font-medium truncate">
                    {activity.title}
                  </p>
                  <span className="text-caption text-muted">
                    {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                  </span>
                </div>
              </div>
              <span className="text-caption text-muted shrink-0">
                {formatRelativeDate(activity.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

// ============================================================
// UsageSummaryCard
// ============================================================

interface UsageSummaryCardProps {
  usage: UsageSummary | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
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
      emptyIcon="📊"
      className="mb-8"
    >
      {usage && (
        <div className="space-y-3">
          {usage.entitlements.map((ent) => (
            <UsageRow key={ent.featureKey} entitlement={ent} />
          ))}
          <div className="pt-2 border-t border-divider/50 flex items-center justify-between">
            <span className="text-caption text-muted">بازنشانی سهمیه</span>
            <span className="text-caption text-onSurface">
              {usage.daysRemaining} روز دیگر
            </span>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function UsageRow({ entitlement }: { entitlement: Entitlement }) {
  if (entitlement.isBoolean) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-body-2 text-onSurface">{entitlement.nameFa}</span>
        <span
          className={`text-caption font-medium ${
            entitlement.isEnabled ? "text-success" : "text-muted"
          }`}
        >
          {entitlement.isEnabled ? "فعال" : "غیرفعال"}
        </span>
      </div>
    );
  }

  const limit = entitlement.limit ?? 0;
  const used = entitlement.used;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = pct >= 80;
  const isExhausted = pct >= 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-body-2 text-onSurface">{entitlement.nameFa}</span>
        <span
          className={`text-caption font-medium ${
            isExhausted ? "text-error" : isNearLimit ? "text-warning" : "text-muted"
          }`}
        >
          {used} از {limit === 0 ? "∞" : limit.toLocaleString("fa-IR")}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-moderate1 ${
            isExhausted ? "bg-error" : isNearLimit ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
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
      emptyIcon="🔔"
      className="mb-8"
    >
      {null}
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
