// ============================================================
// LEGALIR — Dashboard Widgets
// Partial loading: each widget independently manages its
// own loading/error/empty states so one failure doesn't
// break the entire dashboard.
// ============================================================

"use client";

import { type ReactNode, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  emptyIcon,
  errorMessage = "خطا در دریافت اطلاعات",
  children,
  className = "",
}: WidgetShellProps) {
  return (
    <section
      className={`rounded-xl bg-white border border-neutral-200 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <h3 className="text-h3 text-primary-900 font-semibold">{title}</h3>
      </div>

      {/* Content */}
      <div className="p-5">
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

function WidgetEmpty({ message }: { icon?: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <p className="text-body-2 text-neutral-500">{message}</p>
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
    <div className="mb-8">
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-9 w-56 rounded-lg bg-neutral-100" />
          <div className="h-5 w-40 rounded-lg bg-neutral-50" />
        </div>
      ) : (
        <>
          <h1 className="text-h2 text-primary-900">
            سلام، {displayName ?? "کاربر"} <span className="text-secondary-600">&#x202B;👋</span>
          </h1>
          <p className="text-body-1 text-neutral-500 mt-1">به محیط کار LEGALIR خوش آمدید</p>
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
    title: "مشاوره حقوقی",
    desc: "سوال خود را بپرسید",
    icon: "💬",
    colorClass: "bg-primary",
  },
  {
    href: "/documents",
    title: "بررسی قرارداد",
    desc: "تحلیل ریسک و شروط",
    icon: "🔍",
    colorClass: "bg-secondary",
  },
  {
    href: "/contracts",
    title: "تنظیم قرارداد",
    desc: "پیش‌نویس هوشمند",
    icon: "📝",
    colorClass: "bg-success",
  },
  {
    href: "/chat?category=formal_letter",
    title: "تولید اظهارنامه",
    desc: "نامه‌نگاری حقوقی",
    icon: "✉️",
    colorClass: "bg-warning",
  },
  {
    href: "/documents",
    title: "تحلیل اسناد",
    desc: "بررسی مستندات",
    icon: "📋",
    colorClass: "bg-info",
  },
  {
    href: "/chat?category=calculator",
    title: "محاسبات حقوقی",
    desc: "خسارت، ارث، دیه",
    icon: "🧮",
    colorClass: "bg-error",
  },
  {
    href: "/chat",
    title: "پرسش و پاسخ",
    desc: "استفتا و راهنمایی",
    icon: "❓",
    colorClass: "bg-primary-variant",
  },
];

export function QuickActions() {
  return (
    <section className="mb-8">
      <h2 className="text-h3 text-onSurface mb-4">دسترسی سریع</h2>
      <div className="grid grid-cols-1 mobile-l:grid-cols-2 tablet:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href + action.title}
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
            <p className="text-body-2 text-muted mt-0.5">{action.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// RecentActivities — recent drafts with status badges and quick actions
// ============================================================

interface RecentActivitiesProps {
  items: (RecentActivityItem & { description?: string | null; categoryFa?: string | null } )[] | undefined;
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

/** Map raw status strings to display badge config: { label, colorClass, symbol } */
function getStatusBadge(status: string): { label: string; colorClass: string; symbol: string } {
  const s = status.toLowerCase();
  // Completed / ready / generated / approved / exported
  if (["completed", "ready", "generated", "approved", "exported", "active"].includes(s)) {
    return { label: "تکمیل شده", colorClass: "bg-success/10 text-success border-success/30", symbol: "✓" };
  }
  // In progress / processing / analyzing / extracting / under_review / collecting
  if (["processing", "analyzing", "extracting", "in_progress", "under_review", "collecting", "uploaded"].includes(s)) {
    return { label: "در حال انجام", colorClass: "bg-blue-100 text-blue-700 border-blue-300", symbol: "⟳" };
  }
  // Draft
  if (["draft"].includes(s)) {
    return { label: "پیش‌نویس", colorClass: "bg-amber-100 text-amber-700 border-amber-300", symbol: "📝" };
  }
  // Failed
  if (["failed", "blocked"].includes(s)) {
    return { label: "ناموفق", colorClass: "bg-error/10 text-error border-error/30", symbol: "✗" };
  }
  // Archived
  if (["archived"].includes(s)) {
    return { label: "بایگانی", colorClass: "bg-surfaceVariant text-muted border-divider", symbol: "📦" };
  }
  return { label: s, colorClass: "bg-surfaceVariant text-muted border-divider", symbol: "" };
}

export function RecentActivities({ items, isLoading, error, onRetry }: RecentActivitiesProps) {
  return (
    <WidgetShell
      title="پیش‌نویس‌های اخیر"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items || items.length === 0}
      emptyMessage="هنوز فعالیتی ندارید. از گزینه‌های بالا شروع کنید"
      emptyIcon="🕐"
      className="mb-8"
    >
      {items && (
        <div className="grid grid-cols-1 mobile-l:grid-cols-2 gap-3">
          {items.map((activity) => {
            const badge = getStatusBadge(activity.status);
            return (
              <Link
                key={activity.id}
                href={ACTIVITY_TYPE_LINKS[activity.type] ?? "#"}
                className="rounded-large bg-surface border border-divider p-4 hover:shadow-elevation-4 hover:border-primary/30 transition-all group active:scale-[0.98] touch-target"
              >
                {/* Top: icon + title + badge */}
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl shrink-0 mt-0.5 w-8 h-8 rounded-full bg-surfaceVariant flex items-center justify-center">
                    {ACTIVITY_TYPE_ICONS[activity.type] ?? "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-2 text-onSurface font-medium truncate group-hover:text-primary transition-colors">
                      {activity.title}
                    </p>
                    <p className="text-caption text-muted">
                      {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                      {activity.categoryFa ? ` — ${activity.categoryFa}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium border ${badge.colorClass}`}
                  >
                    <span>{badge.symbol}</span>
                    {badge.label}
                  </span>
                </div>

                {/* Description preview */}
                {activity.description && (
                  <p className="text-caption text-muted line-clamp-2 mb-2 pr-11">
                    {activity.description}
                  </p>
                )}

                {/* Bottom: date + quick action */}
                <div className="flex items-center justify-between pr-11">
                  <span className="text-caption text-muted/70">
                    {formatRelativeDate(activity.updatedAt)}
                  </span>
                  <span className="text-caption text-primary font-medium group-hover:underline">
                    مشاهده
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {items && items.length > 0 && (
        <Link
          href="/history"
          className="mt-4 block text-center text-button text-primary hover:underline py-1"
        >
          مشاهده همه فعالیت‌ها
        </Link>
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

      // Brief "detecting" delay, then route to chat with prefilled query
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
      if (e.key === "Enter") {
        handleSubmit(query);
      }
    },
    [handleSubmit, query],
  );

  return (
    <section className={`mb-8 ${className}`}>
      <div className="relative max-w-2xl mx-auto">
        {/* Input container with glow effect */}
        <div
          className={`relative rounded-large border-2 transition-all duration-medium2 ${
            isRouting
              ? "border-primary/40 bg-surface"
              : "border-divider bg-surface focus-within:border-primary focus-within:shadow-[0_0_24px_-4px_rgba(22,32,51,0.25)]"
          }`}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="مسئله حقوقی خود را توضیح دهید..."
            disabled={isRouting}
            className="w-full h-14 pl-14 pr-6 rounded-large bg-transparent text-body-1 text-onSurface placeholder:text-muted/60 outline-none disabled:opacity-60"
            aria-label="مسئله حقوقی خود را توضیح دهید"
            dir="rtl"
          />

          {/* Submit button */}
          <button
            type="button"
            onClick={() => handleSubmit(query)}
            disabled={!query.trim() || isRouting}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-medium bg-primary text-white flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-target"
            aria-label="ارسال پرسش"
          >
            {isRouting ? (
              <span className="text-xs">...</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Routing state indicator */}
        {isRouting && (
          <div className="mt-3 text-center animate-fade-in">
            <span className="inline-flex items-center gap-2 text-caption text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              در حال تشخیص...
            </span>
          </div>
        )}

        {/* Example chips */}
        {!isRouting && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-caption text-muted/70">برای نمونه:</span>
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip.query)}
                className="rounded-full bg-surfaceVariant border border-divider/50 px-3 py-1 text-caption text-onSurface hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors active:scale-[0.97] touch-target"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Subtitle */}
        <p className="mt-4 text-center text-caption text-muted/60">
          با هوش مصنوعی قانون‌مدار ایران
        </p>
      </div>
    </section>
  );
}

// ============================================================
// ActiveRequests — in-progress request status tracker
// ============================================================

interface ActiveRequestItem {
  id: string;
  title: string;
  type: string;
  typeFa: string;
  date: string;
  progress: number;
  status: "draft" | "processing" | "needs_info" | "completed";
  statusFa: string;
  link: string;
}

const STATUS_STYLES: Record<ActiveRequestItem["status"], { badge: string; bar: string }> = {
  draft: { badge: "bg-neutral-100 text-neutral-700", bar: "bg-neutral-300" },
  processing: { badge: "bg-info/10 text-info", bar: "bg-info" },
  needs_info: { badge: "bg-warning/10 text-warning", bar: "bg-warning" },
  completed: { badge: "bg-success/10 text-success", bar: "bg-success" },
};

// Mock data — replace with API call in production
const MOCK_ACTIVE_REQUESTS: ActiveRequestItem[] = [
  {
    id: "1",
    title: "بررسی قرارداد اجاره ملک",
    type: "document",
    typeFa: "تحلیل سند",
    date: "2026-08-04T10:30:00Z",
    progress: 72,
    status: "processing",
    statusFa: "در حال پردازش",
    link: "/documents",
  },
  {
    id: "2",
    title: "پیش‌نویس قرارداد مشارکت",
    type: "contract",
    typeFa: "قرارداد",
    date: "2026-08-03T14:00:00Z",
    progress: 30,
    status: "draft",
    statusFa: "پیش‌نویس",
    link: "/contracts",
  },
  {
    id: "3",
    title: "مشاوره حقوقی در خصوص ارث",
    type: "conversation",
    typeFa: "گفتگو",
    date: "2026-08-05T08:15:00Z",
    progress: 0,
    status: "needs_info",
    statusFa: "نیازمند اطلاعات",
    link: "/chat",
  },
  {
    id: "4",
    title: "تحلیل سند وصیت‌نامه",
    type: "document",
    typeFa: "تحلیل سند",
    date: "2026-08-01T09:00:00Z",
    progress: 100,
    status: "completed",
    statusFa: "تکمیل شده",
    link: "/documents",
  },
  {
    id: "5",
    title: "تنظیم اظهارنامه رسمی",
    type: "contract",
    typeFa: "قرارداد",
    date: "2026-07-28T11:00:00Z",
    progress: 95,
    status: "processing",
    statusFa: "در حال پردازش",
    link: "/contracts",
  },
];

export function ActiveRequests() {
  return (
    <WidgetShell
      title="درخواست‌های فعال"
      isLoading={false}
      error={null}
      isEmpty={MOCK_ACTIVE_REQUESTS.length === 0}
      emptyMessage="درخواست فعالی ندارید"
      emptyIcon="📊"
      className="mb-8"
    >
      <div className="space-y-3">
        {MOCK_ACTIVE_REQUESTS.map((req) => {
          const styles = STATUS_STYLES[req.status];
          return (
            <Link
              key={req.id}
              href={req.link}
              className="flex flex-col gap-2 p-3 rounded-medium hover:bg-background transition-colors border border-divider/30 touch-target"
            >
              {/* Top row: title + badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-2 text-onSurface font-medium truncate">
                    {req.title}
                  </p>
                  <span className="text-caption text-muted">{req.typeFa}</span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption font-medium ${styles.badge}`}
                >
                  {req.statusFa}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-moderate1 ${styles.bar}`}
                    style={{ width: `${Math.max(2, req.progress)}%` }}
                  />
                </div>
                <span className="text-caption text-muted shrink-0 tabular-nums">
                  {req.progress}٪
                </span>
              </div>

              {/* Bottom: date + view link */}
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted/70">
                  {formatRelativeDate(req.date)}
                </span>
                <span className="text-caption text-primary font-medium hover:underline">
                  مشاهده
                </span>
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

interface Recommendation {
  id: string;
  text: string;
  icon: string;
  link: string;
  linkLabel: string;
  urgency: "info" | "warning" | "action";
}

const URGENCY_STYLES: Record<Recommendation["urgency"], { accent: string; bg: string }> = {
  info: { accent: "border-info/40", bg: "bg-info/5" },
  warning: { accent: "border-warning/40", bg: "bg-warning/5" },
  action: { accent: "border-primary/40", bg: "bg-primary/5" },
};

// Mock recommendations — replace with API call in production
const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    text: "قرارداد مشارکت شما هنوز نهایی نشده است. ادامه تنظیم قرارداد را تکمیل کنید.",
    icon: "📝",
    link: "/contracts",
    linkLabel: "ادامه تنظیم",
    urgency: "action",
  },
  {
    id: "rec-2",
    text: "بررسی ریسک سند قرارداد اجاره کامل شده است. گزارش تحلیل را مشاهده کنید.",
    icon: "✅",
    link: "/documents",
    linkLabel: "مشاهده گزارش",
    urgency: "info",
  },
  {
    id: "rec-3",
    text: "اطلاعات پرونده ناقص است. برای دریافت مشاوره دقیق‌تر، اطلاعات تکمیلی را وارد کنید.",
    icon: "⚠️",
    link: "/chat",
    linkLabel: "تکمیل اطلاعات",
    urgency: "warning",
  },
  {
    id: "rec-4",
    text: "درخواست اظهارنامه شما آماده پیش‌نمایش است. می‌توانید آن را بررسی و تأیید کنید.",
    icon: "✉️",
    link: "/contracts",
    linkLabel: "پیش‌نمایش",
    urgency: "action",
  },
];

export function SmartRecommendations() {
  return (
    <WidgetShell
      title="توصیه‌های هوشمند"
      isLoading={false}
      error={null}
      isEmpty={MOCK_RECOMMENDATIONS.length === 0}
      emptyMessage="توصیه‌ای برای شما وجود ندارد"
      emptyIcon="💡"
      className="mb-8"
    >
      <div className="space-y-3">
        {MOCK_RECOMMENDATIONS.map((rec) => {
          const styles = URGENCY_STYLES[rec.urgency];
          return (
            <div
              key={rec.id}
              className={`flex items-start gap-3 p-3 rounded-medium border ${styles.accent} ${styles.bg} transition-colors`}
            >
              <span className="text-xl shrink-0 mt-0.5">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-onSurface">{rec.text}</p>
                <Link
                  href={rec.link}
                  className="inline-block mt-1.5 text-caption text-primary font-medium hover:underline"
                >
                  {rec.linkLabel}
                </Link>
              </div>
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

interface RecentDocumentItem {
  id: string;
  name: string;
  mime: string;
  uploadedAt: string;
  status: string;
  statusFa: string;
}

const DOC_STATUS_STYLES: Record<string, string> = {
  ready: "bg-success/10 text-success",
  processing: "bg-info/10 text-info",
  analyzing: "bg-info/10 text-info",
  failed: "bg-error/10 text-error",
  uploaded: "bg-neutral-100 text-neutral-700",
  extracting: "bg-info/10 text-info",
};

// Mock data — replace with API call in production
const MOCK_RECENT_DOCS: RecentDocumentItem[] = [
  {
    id: "doc-1",
    name: "قرارداد_اجاره_۱۴۰۵.pdf",
    mime: "application/pdf",
    uploadedAt: "2026-08-04T10:30:00Z",
    status: "ready",
    statusFa: "آماده",
  },
  {
    id: "doc-2",
    name: "وصیت‌نامه_تنظیمی.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploadedAt: "2026-08-03T16:00:00Z",
    status: "analyzing",
    statusFa: "در حال تحلیل",
  },
  {
    id: "doc-3",
    name: "مدارک_مالکیت.pdf",
    mime: "application/pdf",
    uploadedAt: "2026-07-30T09:00:00Z",
    status: "ready",
    statusFa: "آماده",
  },
];

const MIME_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "image/webp": "🖼️",
};

export function RecentDocuments() {
  return (
    <WidgetShell
      title="اسناد اخیر"
      isLoading={false}
      error={null}
      isEmpty={MOCK_RECENT_DOCS.length === 0}
      emptyMessage="هنوز سندی بارگذاری نکرده‌اید"
      emptyIcon="📁"
      className="mb-8"
    >
      <div className="space-y-2">
        {MOCK_RECENT_DOCS.map((doc) => {
          const statusStyle = DOC_STATUS_STYLES[doc.status] ?? DOC_STATUS_STYLES["uploaded"];
          return (
            <Link
              key={doc.id}
              href="/documents"
              className="flex items-center gap-3 p-3 rounded-medium hover:bg-background transition-colors touch-target"
            >
              <span className="text-xl shrink-0">
                {MIME_ICONS[doc.mime] ?? "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-onSurface font-medium truncate">
                  {doc.name}
                </p>
                <span className="text-caption text-muted">
                  {formatRelativeDate(doc.uploadedAt)}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${statusStyle}`}
              >
                {doc.statusFa}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/documents"
        className="mt-3 block text-center text-button text-primary hover:underline py-1"
      >
        مشاهده همه اسناد
      </Link>
    </WidgetShell>
  );
}
