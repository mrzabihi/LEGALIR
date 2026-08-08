// ============================================================
// LEGALIR — Profile Page
// Avatar, inline-editable profile fields, profile completion,
// token usage pie chart, subscription history table.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { useMe, useUpdateProfile } from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory } from "@/hooks/usePhase11";
import {
  fixtureProfileComplete,
  fixtureProfileUsage,
  fixtureV1SubscriptionHistory,
} from "@legalir/testing";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  IconEdit,
  IconCheck,
  IconClose,
  IconPhone,
  IconShield,
  IconSettings,
  IconSubscription,
} from "@/lib/icons";
import type { Profile, V1SubscriptionHistoryItem, V1ProfileUsage } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: "bg-success/10 text-success",
  expired: "bg-error/10 text-error",
  cancelled: "bg-surfaceVariant text-muted",
  unknown: "bg-surfaceVariant text-muted",
};

/**
 * Split the display name into first name (first word) and family name (the rest).
 */
function splitDisplayName(name: string | null): { firstName: string; familyName: string } {
  if (!name) return { firstName: "", familyName: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", familyName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", familyName: "" };
  return {
    firstName: parts[0] ?? "",
    familyName: parts.slice(1).join(" "),
  };
}

/**
 * Get the first Persian letter of a display name for the avatar.
 */
function getInitial(name: string | null): string {
  if (!name || name.trim().length === 0) return "ک";
  return name.trim().charAt(0);
}

/**
 * Format a mobile number to 09XX XXX XXXX display format.
 */
function formatMobileForDisplay(mobile: string | undefined): string {
  if (!mobile) return "۰۹-- --- ----";
  // mobileDisplay is already "09XX XXX XXXX" — ensure Persian digits
  return mobile.replace(/[0-9]/g, (d) =>
    ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"][parseInt(d)] ?? d,
  );
}

/**
 * Determine the color class for the completion progress bar.
 */
function completionColor(percent: number): string {
  if (percent < 50) return "bg-error";
  if (percent <= 80) return "bg-warning";
  return "bg-success";
}

/**
 * Format a token number for compact display (e.g., 850000 -> 850K, 1300000 -> 1.3M).
 */
function formatCompactTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v : v.toFixed(0)}K`;
  }
  return String(n);
}

// ============================================================
// Pie Chart Calculations
// ============================================================

interface PieSegment {
  label: string;
  used: number;
  total: number;
  color: string;
  fullColor: string;
}

function buildPieSegments(usage: V1ProfileUsage): PieSegment[] {
  return [
    {
      label: "درخواست‌های روزانه",
      used: usage.dailyRequestsUsed,
      total: usage.dailyRequestsTotal,
      color: "#3B82F6",
      fullColor: "text-blue-500",
    },
    {
      label: "توکن‌ها",
      used: usage.tokensUsed,
      total: usage.tokensTotal,
      color: "#A855F7",
      fullColor: "text-purple-500",
    },
    {
      label: "تحلیل اسناد",
      used: usage.documentAnalysesUsed,
      total: usage.documentAnalysesTotal,
      color: "#22C55E",
      fullColor: "text-green-500",
    },
    {
      label: "قراردادها",
      used: usage.contractsGenerated,
      total: usage.contractsTotal,
      color: "#F59E0B",
      fullColor: "text-amber-500",
    },
  ];
}

/**
 * Compute SVG stroke-dasharray values for a set of pie segments.
 * Returns an array of { offset, dash, color, label } for each segment.
 */
function computePieArc(segments: PieSegment[], radius: number) {
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.total, 0);
  if (total === 0) return [];

  let cumulativeOffset = 0;
  return segments.map((seg) => {
    const fraction = seg.used / total;
    const dash = fraction * circumference;
    const result = {
      offset: cumulativeOffset,
      dash: dash > 0 ? dash : 0,
      color: seg.color,
      label: seg.label,
      used: seg.used,
      total: seg.total,
    };
    cumulativeOffset += dash;
    return result;
  });
}

// ============================================================
// Inline Editable Field
// ============================================================

function EditableField({
  label,
  value,
  placeholder,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft(value);
  }, [value]);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, value, saving, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") handleCancel();
    },
    [handleSave, handleCancel],
  );

  return (
    <div className="flex items-center justify-between py-3 border-b border-divider group">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>

      {editing ? (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className="text-body-2 text-on-surface bg-surfaceVariant rounded-medium px-3 py-1.5 w-full max-w-[200px] border border-divider focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            autoFocus
            dir="rtl"
          />
          <button
            onClick={handleSave}
            disabled={saving || draft.trim() === value}
            className="p-1 rounded-full text-success hover:bg-success/10 transition-colors disabled:opacity-40"
            aria-label="ذخیره"
          >
            <IconCheck size={18} />
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-1 rounded-full text-muted hover:bg-surfaceVariant transition-colors"
            aria-label="لغو"
          >
            <IconClose size={18} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <dd className="text-body-2 text-on-surface">
            {value || <span className="text-muted">{placeholder}</span>}
          </dd>
          {!disabled && (
            <button
              onClick={handleEdit}
              className="p-1 rounded-full text-muted opacity-0 group-hover:opacity-100 hover:text-on-surface hover:bg-surfaceVariant transition-all"
              aria-label={`ویرایش ${label}`}
            >
              <IconEdit size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Readonly Field (for mobile)
// ============================================================

function ReadonlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-divider">
      <dt className="text-body-2 text-muted shrink-0 w-28">{label}</dt>
      <dd className="flex items-center gap-2 text-body-2 text-on-surface">
        {icon}
        {value}
      </dd>
    </div>
  );
}

// ============================================================
// SVG Pie Chart Component
// ============================================================

function UsagePieChart({ usage }: { usage: V1ProfileUsage }) {
  const segments = buildPieSegments(usage);
  const radius = 54;
  const strokeWidth = 16;
  const viewBoxSize = (radius + strokeWidth) * 2;
  const cx = viewBoxSize / 2;
  const cy = viewBoxSize / 2;

  const arcs = computePieArc(segments, radius);

  const totalUsed = segments.reduce((s, seg) => s + seg.used, 0);
  const totalAll = segments.reduce((s, seg) => s + seg.total, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pie */}
      <div className="relative">
        <svg
          width={viewBoxSize}
          height={viewBoxSize}
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          aria-label="نمودار مصرف توکن و منابع"
          role="img"
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200"
          />
          {/* Segments */}
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dash} ${2 * Math.PI * radius - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {/* Center count */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-h3 text-on-surface">
            {toPersianNumber(totalUsed)}
          </span>
          <span className="text-caption text-muted">
            از {toPersianNumber(totalAll)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-body-2 text-on-surface">
              {seg.label}
            </span>
            <span className="text-caption text-muted mr-auto">
              {formatCompactTokens(seg.used)}/{formatCompactTokens(seg.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Profile Page
// ============================================================

export default function ProfilePage() {
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const usage = useProfileUsage();
  const subHistory = useSubscriptionHistory();

  // --- Derived data with fixture fallbacks ---
  const profile: Profile = me.data?.profile ?? fixtureProfileComplete;
  const mobile = me.data?.user?.mobileDisplay ?? "۰۹۱۲۳۴۵۶۷۸۹";
  const usageData = usage.data ?? fixtureProfileUsage;
  const subItems: V1SubscriptionHistoryItem[] =
    subHistory.data?.items ?? fixtureV1SubscriptionHistory;

  const { firstName, familyName } = splitDisplayName(profile.displayName);

  const handleSave = useCallback(
    (field: keyof Profile, value: string) => {
      return updateProfile.mutateAsync(
        field === "displayName"
          ? { displayName: value }
          : { [field]: value } as Partial<Profile>,
      );
    },
    [updateProfile],
  );

  const handleSaveDisplayName = useCallback(
    (first: string) => {
      if (!first && !familyName) return Promise.resolve();
      return updateProfile.mutateAsync({ displayName: [first, familyName].filter(Boolean).join(" ") || null });
    },
    [updateProfile, familyName],
  );

  const handleSaveFamilyName = useCallback(
    (last: string) => {
      if (!firstName && !last) return Promise.resolve();
      return updateProfile.mutateAsync({ displayName: [firstName, last].filter(Boolean).join(" ") || null });
    },
    [updateProfile, firstName],
  );

  const handleSaveCity = useCallback(
    (v: string) => handleSave("city", v),
    [handleSave],
  );

  const handleSaveOccupation = useCallback(
    (v: string) => handleSave("occupation", v),
    [handleSave],
  );

  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
      <h1 className="text-h2 text-on-surface mb-6">پروفایل</h1>

      {/* ---- Profile Card ---- */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-20 w-20 rounded-full bg-primary-variant flex items-center justify-center text-white text-h1 mb-3">
            {getInitial(profile.displayName)}
          </div>
          <h2 className="text-h3 text-on-surface">
            {profile.displayName ?? "کاربر LEGALIR"}
          </h2>
          <p className="text-body-2 text-muted mt-1">
            {profile.city && profile.occupation
              ? `${profile.city} — ${profile.occupation}`
              : profile.city ?? profile.occupation ?? ""}
          </p>

          {/* Profile Completion Bar */}
          <div className="w-full max-w-xs mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-caption text-muted">تکمیل پروفایل</span>
              <span className="text-caption font-medium text-on-surface">
                {toPersianNumber(profile.completionPercent)}٪
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completionColor(profile.completionPercent)}`}
                style={{ width: `${profile.completionPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <dl className="space-y-0">
          <EditableField
            label="نام"
            value={firstName}
            placeholder="نام خود را وارد کنید"
            onSave={handleSaveDisplayName}
          />
          <EditableField
            label="نام خانوادگی"
            value={familyName}
            placeholder="نام خانوادگی خود را وارد کنید"
            onSave={handleSaveFamilyName}
          />
          <EditableField
            label="شهر"
            value={profile.city ?? ""}
            placeholder="شهر محل سکونت"
            onSave={handleSaveCity}
          />
          <EditableField
            label="شغل"
            value={profile.occupation ?? ""}
            placeholder="شغل خود را وارد کنید"
            onSave={handleSaveOccupation}
          />
          <ReadonlyField
            label="شماره موبایل"
            value={formatMobileForDisplay(mobile)}
            icon={
              <IconShield size={16} className="text-muted" />
            }
          />
        </dl>
      </section>

      {/* ---- Usage Section ---- */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center gap-2 mb-5">
          <IconSettings size={20} className="text-primary" />
          <h2 className="text-h3 text-on-surface">مصرف منابع</h2>
        </div>

        {usage.isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-[140px] w-[140px] rounded-full bg-surfaceVariant animate-pulse" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 bg-surfaceVariant rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : usage.isError ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-body-2 text-error">
              خطا در دریافت اطلاعات مصرف
            </p>
            <button
              onClick={() => usage.refetch()}
              className="text-body-2 text-primary underline"
            >
              تلاش مجدد
            </button>
          </div>
        ) : (
          <UsagePieChart usage={usageData} />
        )}
      </section>

      {/* ---- Payment History ---- */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center gap-2 mb-5">
          <IconSubscription size={20} className="text-primary" />
          <h2 className="text-h3 text-on-surface">پرداخت‌ها</h2>
        </div>

        {subHistory.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surfaceVariant rounded animate-pulse" />
            ))}
          </div>
        ) : subHistory.isError ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-body-2 text-error">
              خطا در دریافت تاریخچه پرداخت
            </p>
            <button
              onClick={() => subHistory.refetch()}
              className="text-body-2 text-primary underline"
            >
              تلاش مجدد
            </button>
          </div>
        ) : subItems.length === 0 ? (
          <p className="text-body-2 text-muted text-center py-4">
            هنوز پرداختی انجام نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {subItems.map((item) => {
              const isActive = item.status === "active";
              const isExpired = item.status === "expired";
              const statusStyle = isActive
                ? "bg-success/10 text-success border-success/30"
                : isExpired
                  ? "bg-warning/10 text-warning border-warning/30"
                  : item.status === "cancelled"
                    ? "bg-error/10 text-error border-error/30"
                    : "bg-surfaceVariant text-muted border-divider";
              const statusIcon = isActive ? "✓" : isExpired ? "⏱" : item.status === "cancelled" ? "✗" : "؟";

              return (
                <div
                  key={item.id}
                  className="flex flex-col mobile-l:flex-row mobile-l:items-center gap-3 p-4 rounded-large border border-divider hover:bg-surfaceVariant/30 transition-colors"
                >
                  {/* Plan name + status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-body-1 text-onSurface font-semibold">
                        {item.planNameFa}
                      </h3>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium border ${statusStyle}`}>
                        <span>{statusIcon}</span>
                        {item.statusFa}
                      </span>
                    </div>
                    <p className="text-caption text-muted">
                      {toPersianDate(item.purchasedAt)} — {toPersianDate(item.startAt)} تا {toPersianDate(item.endAt)}
                    </p>
                  </div>
                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className="text-body-1 text-onSurface font-bold tabular-nums">
                      {toPersianNumber(item.amount)} تومان
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Subscription Timeline ---- */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider">
        <div className="flex items-center gap-2 mb-5">
          <IconPhone size={20} className="text-primary" />
          <h2 className="text-h3 text-on-surface">تاریخچه اشتراک</h2>
        </div>

        {subHistory.isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-1 bg-surfaceVariant rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surfaceVariant rounded w-1/3" />
                  <div className="h-3 bg-surfaceVariant rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : subHistory.isError ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-body-2 text-error">
              خطا در دریافت تاریخچه اشتراک
            </p>
            <button
              onClick={() => subHistory.refetch()}
              className="text-body-2 text-primary underline"
            >
              تلاش مجدد
            </button>
          </div>
        ) : subItems.length === 0 ? (
          <p className="text-body-2 text-muted text-center py-4">
            هنوز اشتراکی تهیه نشده است.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline vertical line */}
            <div className="absolute right-[11px] top-2 bottom-2 w-0.5 bg-divider" aria-hidden="true" />

            <div className="space-y-6">
              {subItems.map((item, idx) => {
                const isActive = item.status === "active";
                const isExpired = item.status === "expired";
                const dotColor = isActive
                  ? "bg-success ring-success/20"
                  : isExpired
                    ? "bg-warning ring-warning/20"
                    : "bg-muted ring-muted/20";

                return (
                  <div key={item.id} className="flex gap-4 items-start">
                    {/* Timeline dot */}
                    <div className="relative z-10 shrink-0">
                      <div className={`h-6 w-6 rounded-full ${dotColor} ring-4 flex items-center justify-center`}>
                        <div className={`h-2.5 w-2.5 rounded-full bg-white`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex flex-wrap items-baseline gap-2 mb-1">
                        <span className="text-body-2 text-onSurface font-semibold">
                          {item.planNameFa}
                        </span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-caption ${STATUS_BADGE_STYLES[item.status] ?? STATUS_BADGE_STYLES['unknown']}`}>
                          {item.statusFa}
                        </span>
                        {idx === 0 && isActive && (
                          <span className="text-caption text-success font-medium">
                            (فعلی)
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-muted mb-1">
                        {toPersianDate(item.startAt)} تا {toPersianDate(item.endAt)}
                      </p>
                      <p className="text-caption text-onSurface font-medium tabular-nums">
                        {toPersianNumber(item.amount)} تومان
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
