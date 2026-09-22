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
  Entitlement,
  ActiveRequestItem,
  DashboardRecommendation,
  RecentDocumentItem,
} from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconChevronRight,
  IconChat,
  IconDocument,
  IconContract,
  IconDatabase,
  IconBolt,
  IconCalendar,
  IconShield,
  IconHistory,
  IconRefresh,
  IconStar,
} from "@/lib/icons";
import { PointsSummaryCard } from "./points-summary-card";
import { TextField } from "@legalir/ui";

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
          <h3 className="text-h3 text-on-surface font-bold">{title}</h3>
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
      className={`rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] shadow-elevation-1 p-5 ${className}`}
    >
      {content}
    </section>
  );
}

// ============================================================
// DashboardSection — consistent section grouping with a heading
// ============================================================

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({ title, subtitle, action, children, className = "" }: DashboardSectionProps) {
  return (
    <section className={`mb-6 ${className}`} aria-label={title}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-h3 text-on-surface font-bold">{title}</h2>
          {subtitle && <p className="text-caption text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============================================================
// StatusChip — one shared status pill for every dashboard widget
// ============================================================

export type StatusTone = "success" | "info" | "warning" | "error" | "neutral";

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-50 text-success-700 border-success-200",
  info: "bg-info-50 text-info-700 border-info-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  error: "bg-error-50 text-error-700 border-error-200",
  neutral: "bg-surface-container-high text-on-surface-variant border-outline-variant",
};

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${STATUS_TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

/** Lightweight "مشاهده همه" action used in widget headers. */
function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-0.5 text-caption text-primary font-medium hover:underline touch-target"
    >
      مشاهده همه
      <IconChevronRight size={14} className="transition-transform duration-short4 ease-standard group-hover:-translate-x-0.5" />
    </Link>
  );
}

// ============================================================
// DashboardCard — the shared shell for the three "ongoing work" cards
// ============================================================
// One header architecture for all three (icon · title · subtitle ·
// «مشاهده همه») so no card reads heavier than its neighbours, and one
// height contract: `h-full flex flex-col` with a `flex-1` body, so the
// three cards in a row always end at the same baseline.

interface DashboardCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** Where «مشاهده همه» points. Omit to hide the action. */
  viewAllHref?: string;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

function DashboardCard({
  icon,
  title,
  subtitle,
  viewAllHref,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  children,
}: DashboardCardProps) {
  return (
    <section
      className="h-full flex flex-col rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] shadow-elevation-1 p-5"
      aria-label={title}
    >
      {/* Header — identical padding, title size, icon container and action slot */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-titleMedium text-on-surface font-semibold truncate">{title}</h3>
            <p className="text-caption text-muted mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>
        {viewAllHref && <ViewAllLink href={viewAllHref} />}
      </div>

      {/* Body — flex-1 so the card fills the row height without stretching content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <WidgetSkeleton />
        ) : error ? (
          <WidgetError message="خطا در دریافت اطلاعات" onRetry={onRetry} />
        ) : isEmpty ? (
          <WidgetEmpty message={emptyMessage} />
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
      <div className="h-5 w-3/4 rounded-small bg-[color-mix(in_srgb,var(--color-muted)_15%,transparent)]" />
      <div className="h-4 w-full rounded-small bg-[color-mix(in_srgb,var(--color-muted)_10%,transparent)]" />
      <div className="h-4 w-2/3 rounded-small bg-[color-mix(in_srgb,var(--color-muted)_10%,transparent)]" />
    </div>
  );
}

function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center" role="alert">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-error">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-body-2 text-on-surface-variant">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-full bg-primary px-4 py-1.5 text-primary-on text-caption hover:state-hover transition-colors duration-short3 ease-standard touch-target"
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
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_40%,transparent)]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <p className="text-body-2 text-on-surface-variant">{message}</p>
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

  // Pie-chart geometry for the days-remaining card: remaining days sweep
  // clockwise from the top, elapsed days fill the rest.
  const daysTotal = 30;
  const daysLeft = Math.max(0, Math.min(daysTotal, stats.daysRemaining));
  const daysElapsed = daysTotal - daysLeft;
  const sweep = (daysLeft / daysTotal) * 360;
  const pieDash = `${sweep} ${360 - sweep}`;
  const pieRotate = 90; // start at 12 o'clock

  // 30-day strip: elapsed days red, remaining days green.
  const dayCells = Array.from({ length: daysTotal }, (_, i) => i < daysElapsed);

  // Donut geometry for the daily-requests card: the remaining allowance
  // sweeps clockwise from the top; consumed requests fill the rest.
  const dailyTotal = Math.max(0, stats.dailyTotal);
  const dailyUsed = Math.min(Math.max(0, stats.dailyUsed), dailyTotal);
  const dailyRemaining = Math.max(0, dailyTotal - dailyUsed);
  const dailySweep = dailyTotal > 0 ? (dailyRemaining / dailyTotal) * 360 : 0;
  const dailyDash = `${dailySweep} ${360 - dailySweep}`;
  const dailyExhausted = dailyTotal > 0 && dailyRemaining === 0;
  const dailyLow = !dailyExhausted && dailyTotal > 0 && dailyRemaining / dailyTotal <= 0.25;

  if (isLoading) {
    return (
      <div className="rounded-large bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 p-6 tablet:p-8 mb-6 animate-pulse">
        <div className="h-9 w-56 rounded-medium bg-white/10 mb-3" />
        <div className="h-5 w-40 rounded-medium bg-white/10 mb-8" />
        <div className="grid grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-medium bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-large bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 p-6 tablet:p-8 mb-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[rgba(96,165,250,0.10)] blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[rgba(176,141,87,0.12)] blur-3xl" />
      </div>

      {/* Greeting */}
      <div className="relative">
        <h1 className="text-h2 tablet:text-h1 text-white font-bold">
          سلام، {name}
          <span className="inline-block ml-2 animate-bounce-gentle">👋</span>
        </h1>
        <p className="text-body-1 text-primary-200 mt-1">به محیط کار LEGALIR خوش آمدید</p>
      </div>

      {/* Stat cards — RTL: the points card is first in DOM, so it renders
          as the right-most card. */}
      <div className="relative grid grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-5 gap-3 mt-6">
        {/* امتیاز من — balance + mini consumption chart (shared rewards source) */}
        <PointsSummaryCard />

        {/* درخواست امروز — donut: consumed vs remaining */}
        <div className="group relative overflow-hidden rounded-medium bg-[linear-gradient(135deg,rgba(59,130,246,0.22),rgba(37,99,235,0.10))] text-info-100 border border-white/10 backdrop-blur p-4 flex flex-col gap-2 transition-colors duration-short4 ease-standard hover:border-[rgba(147,197,253,0.30)]">
          {/* soft glow that intensifies on hover */}
          <span
            className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-[rgba(96,165,250,0.20)] blur-2xl transition-opacity duration-long2 opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <div
              className="relative w-11 h-11 shrink-0"
              role="img"
              aria-label={`${dailyUsed.toLocaleString("fa-IR")} درخواست مصرف‌شده از ${dailyTotal.toLocaleString("fa-IR")}؛ ${dailyRemaining.toLocaleString("fa-IR")} باقی‌مانده`}
            >
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <defs>
                  <linearGradient id="dailyQuotaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                {/* track = consumed portion */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                {/* remaining allowance sweeps from 12 o'clock */}
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke={dailyExhausted ? "#f87171" : dailyLow ? "#fbbf24" : "url(#dailyQuotaGrad)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={dailyDash}
                  className="transition-all duration-long4 ease-emphasized"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white tabular-nums">
                {dailyRemaining.toLocaleString("fa-IR")}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">
                {dailyUsed}/{dailyTotal}
              </p>
              <p className="text-caption text-primary-200 mt-0.5">درخواست امروز</p>
            </div>
          </div>
          {/* legend: consumed vs remaining */}
          <div className="relative flex items-center gap-3 text-[10px] text-[color:color-mix(in_srgb,var(--color-primary-200)_90%,transparent)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-info-300" aria-hidden="true" />
              {dailyRemaining.toLocaleString("fa-IR")} مانده
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white/25" aria-hidden="true" />
              {dailyUsed.toLocaleString("fa-IR")} مصرف
            </span>
          </div>
        </div>

        {/* اسناد — gradient icon ring + count badge */}
        <div className="group relative overflow-hidden rounded-medium bg-[linear-gradient(135deg,rgba(34,197,94,0.22),rgba(22,163,74,0.10))] text-success-100 border border-white/10 backdrop-blur p-4 flex flex-col gap-2 transition-colors duration-short4 ease-standard hover:border-[rgba(134,239,172,0.30)]">
          {/* soft glow that intensifies on hover */}
          <span
            className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-[rgba(74,222,128,0.20)] blur-2xl transition-opacity duration-long2 opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
          <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-medium bg-[rgba(74,222,128,0.20)] text-success-200 ring-1 ring-inset ring-[rgba(134,239,172,0.20)] transition-transform duration-short4 ease-standard group-hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-success-400 text-success-900 text-[10px] font-bold tabular-nums ring-2 ring-[color-mix(in_srgb,var(--color-success-500)_20%,transparent)]">
              {stats.docCount.toLocaleString("fa-IR")}
            </span>
          </span>
          <div className="relative">
            <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">{stats.docCount.toLocaleString("fa-IR")}</p>
            <p className="text-caption text-primary-200 mt-0.5">اسناد</p>
          </div>
        </div>

        {/* درخواست فعال — blinking light-sweep effect */}
        <div className="group relative overflow-hidden rounded-medium bg-[linear-gradient(135deg,rgba(59,130,246,0.22),rgba(37,99,235,0.10))] text-info-100 border border-white/10 backdrop-blur p-4 flex flex-col gap-2 transition-colors duration-short4 ease-standard hover:border-[rgba(147,197,253,0.30)]">
          <span className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <span className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-light-sweep" />
          </span>
          {/* soft glow that intensifies on hover */}
          <span
            className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-[rgba(96,165,250,0.20)] blur-2xl transition-opacity duration-long2 opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
          <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-medium bg-[rgba(96,165,250,0.20)] text-info-200 ring-1 ring-inset ring-[rgba(147,197,253,0.20)] transition-transform duration-short4 ease-standard group-hover:scale-105">
            <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-info-300 animate-status-blink" aria-hidden="true" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          <div className="relative">
            <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">{stats.activeReqCount.toLocaleString("fa-IR")}</p>
            <p className="text-caption text-primary-200 mt-0.5">درخواست فعال</p>
          </div>
        </div>

        {/* روز باقی‌مانده — pie chart + 30-day strip */}
        <div className="group relative overflow-hidden rounded-medium bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(217,119,6,0.10))] text-warning-100 border border-white/10 backdrop-blur p-4 flex flex-col gap-2 transition-colors duration-short4 ease-standard hover:border-[rgba(252,211,77,0.30)]">
          {/* soft glow that intensifies on hover */}
          <span
            className="pointer-events-none absolute -top-8 -end-8 w-24 h-24 rounded-full bg-[rgba(251,191,36,0.20)] blur-2xl transition-opacity duration-long2 opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3">
            <div className="relative w-11 h-11 shrink-0" role="img" aria-label={`${daysLeft} روز باقی‌مانده از ${daysTotal} روز`}>
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <defs>
                  <linearGradient id="daysLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fcd34d" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="15.915" fill="none"
                  stroke="url(#daysLeftGrad)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={pieDash}
                  transform={`rotate(${pieRotate} 18 18)`}
                  className="transition-all duration-long4 ease-emphasized"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white tabular-nums">
                {daysLeft.toLocaleString("fa-IR")}
              </span>
            </div>
            <div>
              <p className="text-h3 text-white font-bold tabular-nums" dir="ltr">{stats.daysRemaining.toLocaleString("fa-IR")}</p>
              <p className="text-caption text-primary-200 mt-0.5">روز باقی‌مانده</p>
            </div>
          </div>
          {/* 30-day strip: elapsed red, remaining green */}
          <div className="relative grid grid-cols-10 gap-1 mt-1" aria-hidden="true">
            {dayCells.map((elapsed, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full transition-colors duration-short4 ease-standard",
                  elapsed
                    ? "bg-[color-mix(in_srgb,var(--color-error-400)_70%,transparent)]"
                    : "bg-[color-mix(in_srgb,var(--color-success-400)_70%,transparent)]",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
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
    <div className="relative rounded-large bg-gradient-to-r from-warning-50 via-warning-100 to-warning-50 border border-warning-200 p-5 mb-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[rgba(252,211,77,0.20)] blur-2xl" />
      </div>
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-medium bg-warning-500 flex items-center justify-center shrink-0 shadow-elevation-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <p className="text-body-1 text-on-surface font-semibold">{info.title}</p>
            <p className="text-caption text-on-surface-variant mt-0.5">{info.desc}</p>
          </div>
        </div>
        <Link
          href={info.href}
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-warning-500 text-white px-5 py-2.5 text-button font-semibold hover:bg-warning-600 active:scale-95 transition-all duration-short4 ease-standard touch-target shadow-elevation-1"
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
      <div className="rounded-large bg-surface-container-low border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] p-5 mb-6 animate-pulse">
        <div className="h-5 w-40 rounded-small bg-[color-mix(in_srgb,var(--color-muted)_15%,transparent)]" />
        <div className="mt-2 h-2 w-48 rounded-full bg-[color-mix(in_srgb,var(--color-muted)_10%,transparent)]" />
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
    <div className="rounded-large bg-surface-container-low border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-body-1 text-on-surface font-semibold">
              {title}
              <span className="text-on-surface-variant font-normal"> · {pct}٪</span>
            </span>
          </div>
          <div
            className="w-full max-w-xs h-2 bg-surface-container-high rounded-full overflow-hidden"
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
          <p className="text-caption text-on-surface-variant mt-1.5">{supporting}</p>
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-full bg-primary text-primary-on px-5 py-2.5 text-button font-medium hover:state-hover transition-colors duration-short3 ease-standard touch-target shadow-elevation-1"
        >
          {cta}
        </Link>
      </div>
    </div>
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
  subscription: "💳",
  case: "⚖️",
};

const ACTIVITY_TYPE_LINKS: Record<string, string> = {
  conversation: "/chat",
  document: "/documents",
  contract: "/contracts",
  subscription: "/subscription",
  case: "/cases",
};

function getStatusBadge(status: string): { label: string; colorClass: string } {
  const s = status.toLowerCase();
  if (["completed", "ready", "generated", "approved", "exported", "active"].includes(s)) {
    return { label: "تکمیل شده", colorClass: "bg-success-50 text-success-700 border-success-200" };
  }
  if (["processing", "analyzing", "extracting", "in_progress", "under_review", "collecting", "uploaded"].includes(s)) {
    return { label: "در حال انجام", colorClass: "bg-info-50 text-info-700 border-info-200" };
  }
  if (["draft"].includes(s)) {
    return { label: "پیش‌نویس", colorClass: "bg-warning-50 text-warning-700 border-warning-200" };
  }
  if (["failed", "blocked"].includes(s)) {
    return { label: "ناموفق", colorClass: "bg-error-50 text-error-700 border-error-200" };
  }
  if (["archived"].includes(s)) {
    return { label: "بایگانی", colorClass: "bg-surface-container-high text-on-surface-variant border-outline-variant" };
  }
  return { label: s, colorClass: "bg-surface-container text-on-surface-variant border-outline-variant" };
}

/** Max rows shown per card — keeps the three cards visually balanced. */
const CARD_ITEM_LIMIT = 3;

export function RecentActivities({ items, isLoading, error, onRetry }: RecentActivitiesProps) {
  const visible = items?.slice(0, CARD_ITEM_LIMIT);

  return (
    <DashboardCard
      icon={<IconHistory size={18} />}
      title="پیش‌نویس‌های اخیر"
      subtitle="آخرین پیش‌نویس‌های ذخیره‌شده شما"
      viewAllHref={items && items.length > 0 ? "/history" : undefined}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!visible || visible.length === 0}
      emptyMessage="هنوز پیش‌نویسی ندارید"
    >
      <div className="divide-y divide-[color:var(--color-outline-variant)]">
        {visible?.map((activity) => {
          const badge = getStatusBadge(activity.status);
          return (
            <Link
              key={activity.id}
              href={ACTIVITY_TYPE_LINKS[activity.type] ?? "#"}
              className="group flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0 transition-colors active:scale-[0.99] touch-target"
            >
              <span className="text-base shrink-0 w-8 h-8 rounded-medium bg-surface-container-high flex items-center justify-center group-hover:bg-surface-container-highest transition-colors">
                {ACTIVITY_TYPE_ICONS[activity.type] ?? "📋"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-on-surface font-medium truncate group-hover:text-primary transition-colors">
                  {activity.title}
                </p>
                <p className="text-caption text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_70%,transparent)] truncate">
                  {formatRelativeDate(activity.updatedAt)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border ${badge.colorClass}`}>
                {badge.label}
              </span>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}

// ============================================================
// UsageSummaryCard — compact MD3 usage & quota panel
// ============================================================
// Layout (desktop): header row (title + subtitle · «جزئیات بیشتر») →
// one row of 3 equal usage mini-cards → one row of 3 status cells split
// by hairline separators. Mobile collapses both rows into stacked
// compact rows and moves the action to a full-width button.
//
// Every value is derived from the SAME `UsageSummary` the API already
// returns — no quota maths, thresholds or business rules live here.

interface UsageSummaryCardProps {
  usage: UsageSummary | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

/** Per-feature accent. Blue · green · violet, muted and theme-aware. */
interface UsageAccent {
  /** Icon container background */
  bg: string;
  /** Icon + emphasis text colour */
  fg: string;
  /** Progress-ring stroke colour */
  stroke: string;
}

const ACCENT_BLUE: UsageAccent = { bg: "bg-info-50", fg: "text-info-600", stroke: "stroke-info-500" };
const ACCENT_GREEN: UsageAccent = { bg: "bg-success-50", fg: "text-success-600", stroke: "stroke-success-500" };
const ACCENT_VIOLET: UsageAccent = {
  bg: "bg-[var(--color-violet-50)]",
  fg: "text-[var(--color-violet-600)]",
  stroke: "stroke-[var(--color-violet-500)]",
};

const USAGE_ACCENT: Record<string, UsageAccent> = {
  AI_CHAT_MESSAGE: ACCENT_BLUE,
  DOCUMENT_ANALYSIS: ACCENT_GREEN,
  CONTRACT_GENERATION: ACCENT_VIOLET,
};

const USAGE_ICON: Record<string, typeof IconDocument> = {
  AI_CHAT_MESSAGE: IconChat,
  DOCUMENT_ANALYSIS: IconDocument,
  CONTRACT_GENERATION: IconContract,
};

const STATUS_ICON: Record<string, typeof IconDocument> = {
  ADVANCED_REFERENCE: IconDatabase,
  PRIORITY_PROCESSING: IconBolt,
};

/** Hairline separator between status cells — vertical on tablet, horizontal on mobile. */
const STATUS_CELL =
  "flex items-center gap-2.5 p-3.5 border-b border-[color:var(--color-outline-variant)] last:border-b-0 tablet:border-b-0 tablet:border-e tablet:last:border-e-0";

/**
 * Compact circular usage indicator. `pct` is the already-computed
 * used/total percentage; `unlimited` renders ∞ instead of a number.
 * Sized 44px on mobile, 48px from tablet up.
 */
function UsageRing({
  pct,
  unlimited = false,
  accent,
  label,
}: {
  pct: number;
  unlimited?: boolean;
  accent: UsageAccent;
  label: string;
}) {
  const size = 48;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <span
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center tablet:h-12 tablet:w-12"
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-surface-container-high"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={`${accent.stroke} transition-all duration-moderate1`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-on-surface-variant tabular-nums">
        {unlimited ? "∞" : `${toPersianNumber(clamped)}٪`}
      </span>
    </span>
  );
}

/** One usage mini-card: accent icon · title · used/total · remaining · ring. */
function UsageMiniCard({ ent }: { ent: Entitlement }) {
  const accent = USAGE_ACCENT[ent.featureKey] ?? ACCENT_BLUE;
  const Icon = USAGE_ICON[ent.featureKey] ?? IconDocument;

  const limit = ent.limit ?? 0;
  const unlimited = limit <= 0;
  const used = ent.used;
  const remaining = unlimited ? null : Math.max(0, limit - used);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const ringLabel = unlimited
    ? `${ent.nameFa}: مصرف نامحدود`
    : `${ent.nameFa}: ${toPersianNumber(used)} از ${toPersianNumber(limit)} مصرف شده`;

  return (
    <div className="flex items-center gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3.5 transition-colors duration-short4 hover:bg-surface-container-high">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${accent.bg} ${accent.fg}`}>
        <Icon size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-2 text-on-surface font-medium truncate">{ent.nameFa}</p>
        <p className="text-body-2 text-on-surface font-semibold tabular-nums mt-0.5">
          {toPersianNumber(used)} از {unlimited ? "∞" : toPersianNumber(limit)}
        </p>
        <p className="text-caption text-muted tabular-nums">
          {remaining === null ? "نامحدود" : `${toPersianNumber(remaining)} باقی‌مانده`}
        </p>
      </div>

      <UsageRing pct={pct} unlimited={unlimited} accent={accent} label={ringLabel} />
    </div>
  );
}

/** One boolean-feature status cell: icon · label · فعال/غیرفعال chip. */
function UsageStatusCell({ ent }: { ent: Entitlement }) {
  const Icon = STATUS_ICON[ent.featureKey] ?? IconShield;

  return (
    <div className={STATUS_CELL}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-surface-container-high text-on-surface-variant">
        <Icon size={16} />
      </span>
      <span className="text-body-2 text-on-surface-variant min-w-0 truncate">{ent.nameFa}</span>
      <span
        className={`ms-auto shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-labelSmall font-medium transition-colors duration-short4 ${
          ent.isEnabled
            ? "bg-success-50 text-success-700 border-success-200"
            : "bg-surface-container-high text-on-surface-variant border-[color:var(--color-outline-variant)]"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ent.isEnabled ? "bg-success" : "bg-muted"}`} aria-hidden="true" />
        {ent.isEnabled ? "فعال" : "غیرفعال"}
      </span>
    </div>
  );
}

/** Quota-reset cell: calendar · label · «N روز دیگر». */
function UsageResetCell({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div className={STATUS_CELL}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-info-50 text-info-600">
        <IconCalendar size={16} />
      </span>
      <span className="text-body-2 text-on-surface-variant min-w-0 truncate">بازنشانی سهمیه</span>
      <span className="ms-auto shrink-0 text-body-2 text-info-600 font-medium tabular-nums">
        {toPersianNumber(daysRemaining)} روز دیگر
      </span>
    </div>
  );
}

export function UsageSummaryCard({ usage, isLoading, error, onRetry }: UsageSummaryCardProps) {
  const isEmpty = !usage || usage.entitlements.length === 0;
  const numeric = usage?.entitlements.filter((e) => !e.isBoolean) ?? [];
  const boolean = usage?.entitlements.filter((e) => e.isBoolean) ?? [];

  return (
    <section
      className="mb-6 rounded-large bg-surface-container-low border border-[color:var(--color-outline-variant)] shadow-elevation-1 p-5"
      aria-label="مصرف و سهمیه"
    >
      {/* Header — title + subtitle, action on the opposite side */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-titleMedium text-on-surface font-semibold">مصرف و سهمیه</h3>
          <p className="text-caption text-muted mt-0.5">وضعیت استفاده از امکانات و منابع شما</p>
        </div>
        <Link
          href="/settings/usage"
          className="hidden tablet:inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] px-3.5 py-1.5 text-caption text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-on-surface transition-colors duration-short4 touch-target-min"
        >
          جزئیات بیشتر
          <IconChevronRight size={14} rtlFlip />
        </Link>
      </div>

      {isLoading ? (
        <WidgetSkeleton />
      ) : error ? (
        <WidgetError message="خطا در دریافت اطلاعات" onRetry={onRetry} />
      ) : isEmpty ? (
        <WidgetEmpty message="اطلاعات مصرف در دسترس نیست" />
      ) : (
        usage && (
          <div className="space-y-3">
            {/* Row 1 — usage mini-cards */}
            <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
              {numeric.map((ent) => (
                <UsageMiniCard key={ent.featureKey} ent={ent} />
              ))}
            </div>

            {/* Row 2 — status cells split by hairline separators */}
            <div className="grid grid-cols-1 tablet:grid-cols-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface overflow-hidden">
              {boolean.map((ent) => (
                <UsageStatusCell key={ent.featureKey} ent={ent} />
              ))}
              <UsageResetCell daysRemaining={usage.daysRemaining} />
            </div>

            {/* Mobile action — full width */}
            <Link
              href="/settings/usage"
              className="tablet:hidden flex w-full items-center justify-center gap-1 rounded-medium border border-[color:var(--color-outline-variant)] px-4 py-2.5 text-body-2 text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors duration-short4 touch-target"
            >
              جزئیات بیشتر
              <IconChevronRight size={16} rtlFlip />
            </Link>
          </div>
        )
      )}
    </section>
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
      <div className="max-w-2xl mx-auto">
        <TextField
          label="مسئله حقوقی خود را توضیح دهید"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="مسئله حقوقی خود را توضیح دهید..."
          disabled={isRouting}
          endAdornment={
            <button
              type="button"
              onClick={() => handleSubmit(query)}
              disabled={!query.trim() || isRouting}
              className="h-10 w-10 rounded-full bg-primary text-primary-on flex items-center justify-center hover:state-hover transition-colors duration-short3 ease-standard disabled:opacity-40 disabled:cursor-not-allowed touch-target"
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
          }
          fullWidth
        />

        {isRouting && (
          <div className="mt-3 text-center animate-fade-in">
            <span className="inline-flex items-center gap-2 text-caption text-on-surface-variant">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              در حال تشخیص...
            </span>
          </div>
        )}

        {!isRouting && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-caption text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_60%,transparent)]">برای نمونه:</span>
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip.query)}
                className="rounded-full bg-surface-container-high border border-[color:var(--color-outline-variant)] px-3 py-1 text-caption text-on-surface hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:text-primary transition-colors active:scale-[0.97] touch-target"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-caption text-[color:color-mix(in_srgb,var(--color-on-surface-variant)_50%,transparent)]">
          با هوش مصنوعی قانون‌مدار ایران
        </p>
      </div>
    </section>
  );
}

// ============================================================
// ActiveRequests — in-progress request status tracker
// ============================================================

const STATUS_STYLES: Record<ActiveRequestItem["status"], { badge: string; bar: string; dot: string }> = {
  draft: { badge: "bg-surface-container-high text-on-surface-variant border-outline-variant", bar: "bg-outline", dot: "bg-outline" },
  processing: { badge: "bg-info-50 text-info-700 border-info-200", bar: "bg-info-500", dot: "bg-info-500" },
  needs_info: { badge: "bg-warning-50 text-warning-700 border-warning-200", bar: "bg-warning-500", dot: "bg-warning-500" },
  completed: { badge: "bg-success-50 text-success-700 border-success-200", bar: "bg-success-500", dot: "bg-success-500" },
};

interface ActiveRequestsProps {
  items: ActiveRequestItem[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function ActiveRequests({ items, isLoading, error, onRetry }: ActiveRequestsProps) {
  const visible = items?.slice(0, CARD_ITEM_LIMIT);

  return (
    <DashboardCard
      icon={<IconRefresh size={18} />}
      title="درخواست‌های فعال"
      subtitle="درخواست‌های در حال پردازش شما"
      viewAllHref={items && items.length > 0 ? "/history" : undefined}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!visible || visible.length === 0}
      emptyMessage="درخواست فعالی ندارید"
    >
      <div className="divide-y divide-[color:var(--color-outline-variant)]">
        {visible?.map((req) => {
          const styles = STATUS_STYLES[req.status];
          return (
            <Link
              key={req.id}
              href={req.link}
              className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors active:scale-[0.99] touch-target"
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="text-body-2 text-on-surface font-medium truncate group-hover:text-primary transition-colors">
                  {req.title}
                </p>
                {/* Meta + compact progress bar (real progress only) */}
                <div className="flex items-center gap-1.5 text-caption text-on-surface-variant min-w-0 whitespace-nowrap">
                  <span className="truncate min-w-0">{req.typeFa}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{formatRelativeDate(req.date)}</span>
                  <div className="flex-1 min-w-[24px] h-1 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-moderate1 ${styles.bar}`}
                      style={{ width: `${Math.max(2, req.progress)}%` }}
                    />
                  </div>
                  <span className="shrink-0 tabular-nums">{req.progress}٪</span>
                </div>
              </div>

              <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium border ${styles.badge}`}>
                {req.statusFa}
              </span>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}

// ============================================================
// SmartRecommendations — context-aware suggestion cards
// ============================================================

const URGENCY_STYLES: Record<
  DashboardRecommendation["urgency"],
  { accent: string; bg: string; dot: string; chip: string; chipLabel: string }
> = {
  info: {
    accent: "border-info-200",
    bg: "bg-info-50",
    dot: "bg-info-500",
    chip: "bg-info-100 text-info-800 border-info-200",
    chipLabel: "پیشنهاد",
  },
  warning: {
    accent: "border-warning-200",
    bg: "bg-warning-50",
    dot: "bg-warning-500",
    chip: "bg-warning-100 text-warning-800 border-warning-200",
    chipLabel: "نیازمند بررسی",
  },
  action: {
    accent: "border-primary-200",
    bg: "bg-primary-50",
    dot: "bg-primary-500",
    chip: "bg-primary-100 text-primary-800 border-primary-200",
    chipLabel: "اقدام لازم",
  },
};

const SOURCE_KIND_FA: Record<NonNullable<DashboardRecommendation["source"]>["kind"], string> = {
  law: "منبع قانونی",
  document: "سند شما",
  contract: "قرارداد شما",
};

/**
 * SmartRecommendationCard — a single grounded recommendation.
 * Renders the reasoning (`detail`) and, when present, the provenance
 * (`source`) so the user can see exactly which law/article or which of
 * their own artifacts produced the suggestion.
 */
export function SmartRecommendationCard({ rec }: { rec: DashboardRecommendation }) {
  const styles = URGENCY_STYLES[rec.urgency];
  const src = rec.source;

  return (
    <article
      className={`group relative flex flex-col gap-1.5 p-3 rounded-medium border ${styles.accent} ${styles.bg} transition-colors duration-short4 ease-standard hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)]`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`h-2 w-2 rounded-full ${styles.dot} mt-1.5 shrink-0`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-body-2 text-on-surface font-medium leading-snug line-clamp-2">{rec.text}</p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles.chip}`}
            >
              {styles.chipLabel}
            </span>
          </div>
          {rec.detail && (
            <p className="text-caption text-on-surface-variant mt-0.5 leading-snug line-clamp-1">{rec.detail}</p>
          )}
        </div>
        {rec.icon && (
          <span className="text-base shrink-0 mt-0.5" aria-hidden="true">
            {rec.icon}
          </span>
        )}
      </div>

      {/* Provenance — the real source behind the recommendation (only when present) */}
      {src && (
        <div className="ms-4.5 flex items-center gap-1.5 text-[10px] text-on-surface-variant min-w-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span className="font-medium shrink-0">{SOURCE_KIND_FA[src.kind]}</span>
          <span className="truncate">{src.title}</span>
          {src.locator && <span className="text-primary-700 shrink-0">· {src.locator}</span>}
        </div>
      )}

      <Link
        href={rec.link}
        className="ms-4.5 mt-auto inline-flex w-fit items-center gap-1 text-caption text-primary font-medium hover:underline"
      >
        {rec.linkLabel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl-flip" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </article>
  );
}

interface SmartRecommendationsProps {
  items: DashboardRecommendation[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function SmartRecommendations({ items, isLoading, error, onRetry }: SmartRecommendationsProps) {
  const visible = items?.slice(0, CARD_ITEM_LIMIT);

  return (
    <DashboardCard
      icon={<IconStar size={18} />}
      title="توصیه‌های هوشمند"
      subtitle="پیشنهادهای مرتبط با فعالیت‌ها و اسناد شما"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!visible || visible.length === 0}
      emptyMessage="توصیه‌ای برای شما وجود ندارد"
    >
      <div className="flex flex-col gap-2.5">
        {visible?.map((rec) => (
          <SmartRecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </DashboardCard>
  );
}

// ============================================================
// RecentDocuments — quick access to latest uploaded files
// ============================================================

const DOC_STATUS_STYLES: Record<string, string> = {
  ready: "bg-success-50 text-success-700 border-success-200",
  processing: "bg-info-50 text-info-700 border-info-200",
  analyzing: "bg-info-50 text-info-700 border-info-200",
  failed: "bg-error-50 text-error-700 border-error-200",
  uploaded: "bg-surface-container-high text-on-surface-variant border-outline-variant",
  extracting: "bg-info-50 text-info-700 border-info-200",
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
              className="flex items-center gap-3 p-3 rounded-medium hover:bg-surface-container-high transition-colors touch-target group"
            >
              <span className="text-xl shrink-0 w-10 h-10 rounded-medium bg-surface-container-high flex items-center justify-center group-hover:bg-surface-container-highest transition-colors">
                {doc.mime?.includes("pdf") ? "📄" : doc.mime?.includes("image") ? "🖼️" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-2 text-on-surface font-medium truncate">{doc.name}</p>
                <span className="text-caption text-on-surface-variant">{formatRelativeDate(doc.uploadedAt)}</span>
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
