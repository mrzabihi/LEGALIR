// ============================================================
// LEGALIR — Settings (تنظیمات)
// تاریخچه و مصرف / Appearance / Notifications / Privacy
// ============================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  usePreferences,
  useUpdatePreferences,
  useSubscriptionHistory,
  useProfileUsage,
  useMemories,
  useCreateMemory,
  useDeleteMemory,
} from "@/hooks/usePhase11";
import { useDailyQuota } from "@/hooks/useDashboard";
import type {
  V1ProfileUsage,
  V1UserPreferences,
  V1SubscriptionHistoryItem,
  V1MemoryItem,
  V1DailyQuota,
} from "@legalir/types";
import {
  IconSettings,
  IconHistory,
  IconShield,
  IconCheck,
  IconWarning,
  IconInfo,
  IconRefresh,
  IconLogout,
  IconDownload,
  IconDelete,
  IconFile,
  IconPerson,
  IconMemory,
  IconAdd,
  IconClose,
  IconSubscription,
  IconChat,
  IconDocument,
  IconContract,
} from "@/lib/icons";

// ============================================================
// Helpers
// ============================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR");
}

function pct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

/** Remaining time until `resetAt`, formatted as HH:MM:SS (Persian digits). */
function useResetCountdown(resetAt: string | undefined): string {
  const compute = useCallback(() => {
    if (!resetAt) return "--:--:--";
    const diff = new Date(resetAt).getTime() - Date.now();
    if (diff <= 0) return "۰۰:۰۰:۰۰";
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
  }, [resetAt]);

  const [value, setValue] = useState(compute);
  useEffect(() => {
    setValue(compute());
    if (!resetAt) return;
    const id = setInterval(() => setValue(compute()), 1000);
    return () => clearInterval(id);
  }, [compute, resetAt]);
  return value;
}

// ============================================================
// Sub-components
// ============================================================

/** Reusable toggle switch */
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-body-1 ${
            disabled ? "text-muted" : "text-on-surface"
          }`}
        >
          {label}
        </span>
        {description && (
          <span className="text-body-2 text-muted">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/** Skelton placeholder for card content */
function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return (
    <div className={`h-4 ${width} bg-divider rounded animate-pulse`} />
  );
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

/** Error banner with retry */
function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-6 text-center">
      <IconWarning className="text-error" size={28} />
      <p className="text-body-1 text-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
        >
          <IconRefresh size={16} />
          تلاش مجدد
        </button>
      )}
    </div>
  );
}

/** Empty state for tab content */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <IconInfo size={32} className="text-muted" />
      <p className="text-body-2 text-muted">{text}</p>
    </div>
  );
}

// ============================================================
// Usage Tab
// ============================================================

/** A single metric card with a progress bar. */
function MetricCard({
  label,
  used,
  total,
  unit,
  icon,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  icon: React.ReactNode;
}) {
  const usedPct = pct(used, total);
  const barColor =
    usedPct >= 90 ? "bg-error" : usedPct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="flex items-start gap-3 rounded-large bg-surface-hover p-4 border border-divider">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-2 text-muted">{label}</p>
        <p className="text-body-1 text-on-surface font-medium tabular-nums">
          {used.toLocaleString("fa-IR")} / {total.toLocaleString("fa-IR")} {unit}
        </p>
        <div
          className="mt-1.5 h-2 w-full rounded-full bg-gray-200 dark:bg-surface overflow-hidden"
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`مصرف ${label}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function UsageTabContent({
  usage,
  quota,
  isLoading,
  error,
  onRetry,
}: {
  usage: V1ProfileUsage | undefined;
  quota: V1DailyQuota | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const countdown = useResetCountdown(quota?.resetAt);

  if (isLoading) {
    return <SkeletonBlock lines={6} />;
  }

  if (error) {
    return <ErrorBanner message={error.message} onRetry={onRetry} />;
  }

  if (!usage) {
    return <EmptyState text="اطلاعات مصرف در دسترس نیست." />;
  }

  // Live daily quota (plan-derived) takes precedence over the stored usage row.
  const dailyUsed = quota?.used ?? usage.dailyRequestsUsed;
  const dailyTotal = quota?.total ?? usage.dailyRequestsTotal;
  const remaining = Math.max(0, dailyTotal - dailyUsed);
  const exhausted = quota?.exhausted ?? remaining <= 0;
  const expired = quota?.subscriptionExpired ?? false;

  // Donut geometry: remaining allowance sweeps clockwise from 12 o'clock.
  const dailySweep = dailyTotal > 0 ? (remaining / dailyTotal) * 360 : 0;
  const dailyDash = `${dailySweep} ${360 - dailySweep}`;
  const dailyExhausted = dailyTotal > 0 && remaining === 0;
  const dailyLow = !dailyExhausted && dailyTotal > 0 && remaining / dailyTotal <= 0.25;

  const metrics: {
    key: string;
    label: string;
    used: number;
    total: number;
    unit: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "tokens",
      label: "توکن",
      used: usage.tokensUsed,
      total: usage.tokensTotal,
      unit: "توکن",
      icon: <IconShield size={20} className="text-primary" />,
    },
    {
      key: "analysis",
      label: "تحلیل سند",
      used: usage.documentAnalysesUsed,
      total: usage.documentAnalysesTotal,
      unit: "تحلیل",
      icon: <IconDocument size={20} className="text-primary" />,
    },
    {
      key: "contracts",
      label: "تولید قرارداد",
      used: usage.contractsGenerated,
      total: usage.contractsTotal,
      unit: "قرارداد",
      icon: <IconContract size={20} className="text-primary" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero: daily request allowance — donut card (matches dashboard) */}
      <div className="group relative overflow-hidden rounded-large bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-100 border border-white/10 backdrop-blur p-5">
        <span
          className="pointer-events-none absolute -top-10 -end-10 w-32 h-32 rounded-full bg-blue-400/20 blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4">
          <div
            className="relative w-16 h-16 shrink-0"
            role="img"
            aria-label={`${dailyUsed.toLocaleString("fa-IR")} درخواست مصرف‌شده از ${dailyTotal.toLocaleString("fa-IR")}؛ ${remaining.toLocaleString("fa-IR")} باقی‌مانده`}
          >
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <defs>
                <linearGradient id="settingsQuotaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              {/* track = consumed portion */}
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
              {/* remaining allowance sweeps from 12 o'clock */}
              <circle
                cx="18" cy="18" r="15.915" fill="none"
                stroke={dailyExhausted ? "#f87171" : dailyLow ? "#fbbf24" : "url(#settingsQuotaGrad)"}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={dailyDash}
                className="transition-all duration-700 ease-emphasized"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-body-1 font-bold text-white tabular-nums">
              {remaining.toLocaleString("fa-IR")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <IconChat size={18} className="text-blue-200" />
              <span className="text-body-1 text-white font-medium">درخواست امروز</span>
            </div>
            <p className="mt-1 text-h3 font-bold text-white tabular-nums" dir="ltr">
              {dailyUsed.toLocaleString("fa-IR")} / {dailyTotal.toLocaleString("fa-IR")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-primary-200/90">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-300" aria-hidden="true" />
                {remaining.toLocaleString("fa-IR")} مانده
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white/25" aria-hidden="true" />
                {dailyUsed.toLocaleString("fa-IR")} مصرف
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-primary-200/90">
          <p>{remaining.toLocaleString("fa-IR")} درخواست باقی‌مانده</p>
          <p>
            بازنشانی تا <span className="tabular-nums" dir="ltr">{countdown}</span>
          </p>
        </div>

        {(exhausted || expired) && (
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-medium bg-white/10 p-3 border border-white/15">
            <p className="text-body-2 text-white">
              {expired
                ? "اشتراک شما به پایان رسیده است."
                : "سهمیه درخواست امروز شما به پایان رسیده است."}
            </p>
            <Link
              href="/subscription"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-body-2 text-blue-700 font-medium transition hover:bg-blue-50 touch-target"
            >
              <IconSubscription size={16} />
              {expired ? "تمدید اشتراک" : "خرید اشتراک"}
            </Link>
          </div>
        )}
      </div>

      {/* Other metrics */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
        {metrics.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            used={m.used}
            total={m.total}
            unit={m.unit}
            icon={m.icon}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// History Tab
// ============================================================

const STATUS_CLASS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  expired: "bg-muted/10 text-muted border-muted/20",
  cancelled: "bg-muted/10 text-muted border-muted/20",
  unknown: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-success",
  expired: "bg-muted",
  cancelled: "bg-muted",
  unknown: "bg-amber-500",
};

function HistoryTabContent({
  history,
  isLoading,
  error,
  onRetry,
}: {
  history: V1SubscriptionHistoryItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonBlock lines={5} />;
  }

  if (error) {
    return <ErrorBanner message={error.message} onRetry={onRetry} />;
  }

  if (!history || history.length === 0) {
    return <EmptyState text="تاریخچه‌ای برای نمایش وجود ندارد." />;
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="tablet:hidden space-y-2">
        {history.map((item) => (
          <div key={item.id} className="rounded-large bg-surface p-4 border border-divider">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_CLASS[item.status] ?? STATUS_CLASS['unknown']}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? STATUS_DOT['unknown']}`} />
                {item.statusFa}
              </span>
              <span className="text-caption text-muted">{formatDate(item.purchasedAt)}</span>
            </div>
            <p className="text-body-2 text-on-surface font-medium">{item.planNameFa}</p>
          </div>
        ))}
      </div>
      {/* Desktop table view */}
      <div className="hidden tablet:block overflow-x-auto">
        <table className="w-full text-right text-body-2">
          <thead>
            <tr className="border-b border-divider text-muted">
              <th className="pb-2 pl-3 font-medium">تاریخ</th>
              <th className="pb-2 pl-3 font-medium">نام اشتراک</th>
              <th className="pb-2 font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-surface-hover/50 transition-colors">
                <td className="py-2.5 pl-3 text-on-surface">{formatDate(item.purchasedAt)}</td>
                <td className="py-2.5 pl-3 text-on-surface">{item.planNameFa}</td>
                <td className="py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_CLASS[item.status] ?? STATUS_CLASS['unknown']}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? STATUS_DOT['unknown']}`} />
                    {item.statusFa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// Preferences Section Builder
// ============================================================

interface ToggleItem {
  key: string;
  label: string;
  description?: string;
}

function PreferenceToggleGroup({
  items,
  values,
  onChange,
  disabled,
  saving,
}: {
  items: ToggleItem[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <div className="divide-y divide-divider">
      {items.map((item) => (
        <Toggle
          key={item.key}
          label={item.label}
          description={item.description}
          checked={!!values[item.key]}
          disabled={disabled || saving}
          onChange={(v) => onChange(item.key, v)}
        />
      ))}
    </div>
  );
}

// ============================================================
// Delete History Button (with confirmation dialog)
// ============================================================

function DeleteHistoryButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    setDeleting(true);
    // Simulate API call
    setTimeout(() => {
      setDeleting(false);
      setShowConfirm(false);
    }, 1500);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-error/30 px-4 py-2 text-body-2 text-error transition hover:bg-error/5"
      >
        <IconDelete size={16} />
        حذف تاریخچه خروجی‌ها
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-history-title"
        >
          <div className="w-full max-w-sm rounded-large bg-surface p-6 shadow-elevation-8">
            <h3
              id="delete-history-title"
              className="text-h4 text-on-surface mb-2"
            >
              تأیید حذف تاریخچه
            </h3>
            <p className="text-body-2 text-muted mb-5">
              آیا مطمئن هستید که می‌خواهید تمام تاریخچه خروجی داده‌ها را حذف
              کنید؟ این عمل قابل بازگشت نیست.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="rounded-full border border-divider px-4 py-2 text-body-2 text-on-surface transition hover:bg-surface-hover"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-full bg-error px-4 py-2 text-body-2 text-on-error font-medium transition hover:bg-error/90 disabled:opacity-60"
              >
                {deleting ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-on-error border-t-transparent" />
                ) : (
                  <IconDelete size={16} />
                )}
                {deleting ? "در حال حذف..." : "تأیید حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Account Closure Form
// ============================================================

const CLOSURE_REASONS = [
  { value: "no-need", label: "دیگر نیاز ندارم" },
  { value: "privacy", label: "نگرانی حریم خصوصی" },
  { value: "quality", label: "کیفیت پایین خدمات" },
  { value: "financial", label: "دلایل مالی" },
  { value: "other", label: "سایر" },
] as const;

function AccountClosureForm() {
  const [step, setStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const canDelete =
    step === "confirm" &&
    confirmText === "DELETE" &&
    reason !== "";

  const handleInitiate = useCallback(() => {
    setStep("confirm");
  }, []);

  const handleDelete = useCallback(() => {
    if (!canDelete) return;
    setStep("deleting");
    // Simulate API call
    setTimeout(() => {
      setStep("idle");
      setConfirmText("");
      setReason("");
    }, 2000);
  }, [canDelete]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setConfirmText("");
    setReason("");
  }, []);

  return (
    <div className="space-y-4">
      {/* Reason dropdown — always visible */}
      <div>
        <label
          htmlFor="closure-reason"
          className="block text-body-2 text-on-surface mb-1.5"
        >
          دلیل حذف حساب
        </label>
        <select
          id="closure-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={step === "deleting"}
          className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface focus:outline-none focus:border-error transition disabled:opacity-50"
        >
          <option value="">انتخاب دلیل...</option>
          {CLOSURE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Step-based actions */}
      {step === "idle" && (
        <button
          type="button"
          onClick={handleInitiate}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-error/60 bg-error/5 px-5 py-2.5 text-body-2 text-error font-medium transition hover:bg-error/10"
        >
          <IconDelete size={16} />
          درخواست حذف حساب
        </button>
      )}

      {step === "confirm" && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4 space-y-3">
          <p className="text-body-2 text-error font-medium">
            برای تأیید، عبارت DELETE را تایپ کنید:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full rounded-full border border-error/40 bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-error transition"
            dir="ltr"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="inline-flex items-center gap-1.5 rounded-full bg-error px-5 py-2.5 text-body-2 text-on-error font-medium transition hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconDelete size={16} />
              تأیید نهایی حذف حساب
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-divider px-4 py-2.5 text-body-2 text-on-surface transition hover:bg-surface-hover"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {step === "deleting" && (
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error/5 p-4">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-error border-t-transparent" />
          <span className="text-body-2 text-error font-medium">
            در حال حذف حساب... لطفا منتظر بمانید.
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Memory & Knowledge Section
// ============================================================
// Lets the user teach the product the documents/knowledge it needs
// so the AI can update itself with that knowledge. Items are stored
// as memory entries and injected into AI grounding.

const MEMORY_CATEGORY_LABELS: Record<V1MemoryItem["category"], string> = {
  profile: "اطلاعات کاربر",
  preference: "تنظیمات برگزیده",
  legal_context: "دانش حقوقی",
};

function MemorySection() {
  const { data, isLoading, isError, error, refetch } = useMemories();
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();

  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<V1MemoryItem["category"]>("legal_context");
  const [deleteTarget, setDeleteTarget] = useState<V1MemoryItem | null>(null);

  const items = (data?.items ?? []).filter((m) => m.status !== "deleted");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!key.trim() || !value.trim()) return;
      createMemory.mutate(
        { key: key.trim(), value: value.trim(), category },
        {
          onSuccess: () => {
            setKey("");
            setValue("");
            setShowForm(false);
          },
        }
      );
    },
    [key, value, category, createMemory]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMemory.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteMemory]);

  return (
    <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconMemory size={22} className="text-primary" />
          <h2 className="text-h3 text-on-surface">حافظه و دانش</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-body-2 text-on-primary font-medium transition hover:bg-primary-variant touch-target"
        >
          {showForm ? <IconClose size={16} /> : <IconAdd size={16} />}
          {showForm ? "بستن" : "افزودن دانش"}
        </button>
      </div>
      <p className="text-body-2 text-muted mb-5">
        مستندات و دانشی که لازم است محصول بداند را اینجا اضافه کنید تا هوش مصنوعی
        خودش را با آن دانش به‌روزرسانی کند.
      </p>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-large border border-divider bg-surface-hover/40 p-4 mb-5 space-y-3"
        >
          <div>
            <label htmlFor="memory-key" className="block text-body-2 text-on-surface mb-1.5">
              عنوان دانش
            </label>
            <input
              id="memory-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="مثال: رویه داخلی شرکت در تنظیم قراردادها"
              className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary transition"
              dir="rtl"
            />
          </div>
          <div>
            <label htmlFor="memory-value" className="block text-body-2 text-on-surface mb-1.5">
              محتوا
            </label>
            <textarea
              id="memory-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              placeholder="متن دانش یا توضیح مستند..."
              className="w-full rounded-large border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary transition resize-y"
              dir="rtl"
            />
          </div>
          <div>
            <label htmlFor="memory-category" className="block text-body-2 text-on-surface mb-1.5">
              دسته
            </label>
            <select
              id="memory-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as V1MemoryItem["category"])}
              className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface focus:outline-none focus:border-primary transition"
            >
              <option value="legal_context">دانش حقوقی</option>
              <option value="profile">اطلاعات کاربر</option>
              <option value="preference">تنظیمات برگزیده</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={createMemory.isPending || !key.trim() || !value.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-body-2 text-on-primary font-medium transition hover:bg-primary-variant disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            {createMemory.isPending ? "در حال ذخیره..." : "ذخیره دانش"}
          </button>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <SkeletonBlock lines={4} />
      ) : isError ? (
        <ErrorBanner
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState text="هنوز دانشی اضافه نشده است." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-large border border-divider bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-body-1 text-on-surface font-medium">{item.key}</span>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-caption text-primary">
                    {MEMORY_CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                <p className="text-body-2 text-muted line-clamp-2">{item.value}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(item)}
                disabled={deleteMemory.isPending}
                className="shrink-0 rounded-full p-2 text-muted hover:text-error hover:bg-error/10 transition-colors touch-target"
                aria-label="حذف"
              >
                <IconDelete size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأیید حذف دانش"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-large bg-surface p-6 shadow-elevation-8 border border-divider">
            <h3 className="text-h3 text-on-surface mb-3">حذف دانش</h3>
            <p className="text-body-2 text-muted mb-6">
              آیا از حذف
              <span className="text-on-surface font-medium"> «{deleteTarget.key}» </span>
              اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMemory.isPending}
                className="rounded-full border border-divider px-5 py-2 text-body-2 text-muted hover:text-on-surface hover:bg-muted/10 transition-colors touch-target"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteMemory.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-error px-5 py-2 text-white text-body-2 font-medium hover:bg-error/90 disabled:opacity-50 transition-colors touch-target"
              >
                {deleteMemory.isPending ? "در حال حذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// Page
// ============================================================

export default function SettingsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"usage" | "history">("usage");

  // Data hooks
  const usageQuery = useProfileUsage();
  const quotaQuery = useDailyQuota();
  const historyQuery = useSubscriptionHistory(1, 20);
  const prefsQuery = usePreferences();
  const updatePrefs = useUpdatePreferences();

  // Optimistic local shadow of prefs so toggles feel instant
  const localPrefs = prefsQuery.data;
  const [optimistic, setOptimistic] = useState<V1UserPreferences | null>(null);

  const prefs = optimistic ?? localPrefs;

  // Build a single update handler
  const handlePrefChange = useCallback(
    (
      section: "notifications" | "privacy",
      key: string,
      value: boolean
    ) => {
      if (!prefs) return;

      // Apply optimistic update
      setOptimistic({
        ...prefs,
        [section]: {
          ...prefs[section],
          [key]: value,
        },
      });

      // Fire mutation
      updatePrefs.mutate(
        {
          [section]: { [key]: value },
        } as Record<string, unknown>,
        {
          onSuccess: (_data) => {
            setOptimistic(null);
            // React Query will update cache automatically via onSuccess in hook
          },
          onError: () => {
            // Revert
            setOptimistic(null);
          },
        }
      );
    },
    [prefs, updatePrefs]
  );

  // Notification items (only the ones specified)
  const notificationItems: ToggleItem[] = [
    { key: "contractExpiry", label: "یادآوری قراردادها", description: "پیش از انقضای قراردادها به شما اطلاع می‌دهیم." },
    { key: "lawyerResponse", label: "پاسخ وکیل", description: "وقتی وکیل به درخواست شما پاسخ می‌دهد مطلع شوید." },
    { key: "paymentStatus", label: "وضعیت پرداخت", description: "نتیجه پرداخت‌ها و صورتحساب‌ها را اطلاع می‌دهیم." },
    { key: "caseUpdate", label: "به‌روزرسانی پرونده", description: "تغییرات وضعیت پرونده‌های شما را اطلاع می‌دهیم." },
    { key: "marketing", label: "بازاریابی", description: "پیشنهادها و اخبار محصول." },
  ];

  // Privacy items
  const privacyItems: ToggleItem[] = [
    { key: "shareUsageData", label: "اشتراک‌گذاری داده‌های مصرف", description: "داده‌های ناشناس مصرف برای بهبود سرویس." },
    { key: "allowAiTraining", label: "اجازه آموزش AI", description: "استفاده از گفتگوهای شما برای بهبود مدل." },
    {
      key: "storeConversationHistory",
      label: "ذخیره تاریخچه گفتگو",
      description: "گفتگوها ذخیره و در تاریخچه نمایش داده می‌شوند.",
    },
    { key: "autoMemoryConsent", label: "تأیید خودکار حافظه", description: "ذخیره خودکار دانش استخراج‌شده از گفتگوها." },
  ];

  const isSaving = updatePrefs.isPending;

  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto" dir="rtl">
      {/* Page title */}
      <div className="flex items-center gap-3 mb-6">
        <IconSettings size={28} className="text-on-surface" />
        <h1 className="text-h2 text-on-surface">تنظیمات</h1>
      </div>

      {/* ================================================ */}
      {/* تاریخچه و مصرف Section */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center gap-2 mb-5">
          <IconHistory size={22} className="text-primary" />
          <h2 className="text-h3 text-on-surface">تاریخچه و مصرف</h2>
        </div>

        {/* Tab pills */}
        <div
          className="flex gap-1 rounded-full bg-surface-hover p-1 mb-5 w-fit"
          role="tablist"
          aria-label="برگه‌های تاریخچه و مصرف"
        >
          <button
            role="tab"
            aria-selected={activeTab === "usage"}
            onClick={() => setActiveTab("usage")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${
              activeTab === "usage"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-muted hover:text-on-surface"
            }`}
          >
            مصرف
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`rounded-full px-4 py-2 text-body-2 font-medium transition-all ${
              activeTab === "history"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-muted hover:text-on-surface"
            }`}
          >
            تاریخچه
          </button>
        </div>

        {/* Tab panels */}
        {activeTab === "usage" ? (
          <UsageTabContent
            usage={usageQuery.data}
            quota={quotaQuery.data}
            isLoading={usageQuery.isLoading}
            error={usageQuery.error as Error | null}
            onRetry={() => usageQuery.refetch()}
          />
        ) : (
          <HistoryTabContent
            history={historyQuery.data?.items}
            isLoading={historyQuery.isLoading}
            error={historyQuery.error as Error | null}
            onRetry={() => historyQuery.refetch()}
          />
        )}
      </section>

      {/* ================================================ */}
      {/* اعلان‌ها (Notifications) */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconInfo size={22} className="text-primary" />
            <h2 className="text-h3 text-on-surface">اعلان‌ها</h2>
          </div>
          {isSaving && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              در حال ذخیره...
            </span>
          )}
        </div>

        {prefsQuery.isLoading ? (
          <SkeletonBlock lines={5} />
        ) : prefsQuery.error ? (
          <ErrorBanner
            message={(prefsQuery.error as Error).message}
            onRetry={() => prefsQuery.refetch()}
          />
        ) : !prefs ? (
          <EmptyState text="تنظیمات اعلان‌ها در دسترس نیست." />
        ) : (
          <PreferenceToggleGroup
            items={notificationItems}
            values={prefs.notifications as unknown as Record<string, boolean>}
            onChange={(key, value) =>
              handlePrefChange("notifications", key, value)
            }
            disabled={false}
            saving={isSaving}
          />
        )}
      </section>

      {/* ================================================ */}
      {/* حریم خصوصی (Privacy) */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconShield size={22} className="text-primary" />
            <h2 className="text-h3 text-on-surface">حریم خصوصی</h2>
          </div>
          {isSaving && (
            <span className="inline-flex items-center gap-1.5 text-caption text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              در حال ذخیره...
            </span>
          )}
        </div>

        {prefsQuery.isLoading ? (
          <SkeletonBlock lines={4} />
        ) : prefsQuery.error ? (
          <ErrorBanner
            message={(prefsQuery.error as Error).message}
            onRetry={() => prefsQuery.refetch()}
          />
        ) : !prefs ? (
          <EmptyState text="تنظیمات حریم خصوصی در دسترس نیست." />
        ) : (
          <PreferenceToggleGroup
            items={privacyItems}
            values={prefs.privacy as unknown as Record<string, boolean>}
            onChange={(key, value) => handlePrefChange("privacy", key, value)}
            disabled={false}
            saving={isSaving}
          />
        )}
      </section>

      {/* ================================================ */}
      {/* حافظه و دانش (Memory & Knowledge) */}
      {/* ================================================ */}
      <MemorySection />

      {/* ================================================ */}
      {/* امنیت (Security) */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center gap-2 mb-5">
          <IconShield size={22} className="text-primary" />
          <h2 className="text-h3 text-on-surface">امنیت حساب</h2>
        </div>

        {/* Active Sessions */}
        <div className="mb-6">
          <h3 className="text-body-1 text-on-surface font-medium mb-3">
            نشست‌های فعال
          </h3>
          <div className="rounded-lg border border-divider bg-surface-hover/40 p-4">
            <div className="flex items-center gap-2">
              <IconPerson size={18} className="text-muted" />
              <span className="text-body-2 text-on-surface font-medium">
                این دستگاه
                <span className="mr-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-caption text-primary">
                  جاری
                </span>
              </span>
            </div>
            <p className="mt-1 text-caption text-muted">
              تنها نشست فعال، نشست فعلی شماست. نشست‌های دیگر پس از ورود در
              دستگاه‌های مختلف اینجا نمایش داده می‌شوند.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-divider px-4 py-2 text-body-2 text-on-surface opacity-50 cursor-not-allowed transition"
          >
            <IconLogout size={16} />
            خروج از تمام نشست‌های دیگر
          </button>
        </div>

        {/* Divider */}
        <hr className="border-divider my-5" />

        {/* Password Change */}
        <div className="mb-5">
          <h3 className="text-body-1 text-on-surface font-medium mb-3">
            تغییر رمز عبور
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="current-password"
                className="block text-body-2 text-on-surface mb-1.5"
              >
                رمز عبور فعلی
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary transition"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-body-2 text-on-surface mb-1.5"
                >
                  رمز عبور جدید
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary transition"
                  dir="ltr"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-body-2 text-on-surface mb-1.5"
                >
                  تکرار رمز عبور جدید
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-full border border-divider bg-surface px-4 py-2.5 text-body-2 text-on-surface placeholder:text-muted focus:outline-none focus:border-primary transition"
                  dir="ltr"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-body-2 text-on-primary font-medium transition hover:bg-primary-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconCheck size={16} />
              تغییر رمز عبور
            </button>
          </form>
        </div>

        {/* Divider */}
        <hr className="border-divider my-5" />

        {/* Login History */}
        <div>
          <h3 className="text-body-1 text-on-surface font-medium mb-3">
            تاریخچه ورود
          </h3>
          <div className="rounded-lg border border-divider bg-surface-hover/40 p-4 text-center">
            <p className="text-body-2 text-muted">
              تاریخچه ورودهای اخیر پس از فعال‌سازی ثبت نشست‌ها اینجا نمایش داده
              می‌شود.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================ */}
      {/* خروجی داده (Data Export) */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border border-divider mb-6">
        <div className="flex items-center gap-2 mb-4">
          <IconFile size={22} className="text-primary" />
          <h2 className="text-h3 text-on-surface">مدیریت داده‌ها</h2>
        </div>

        {/* Export Action */}
        <div className="mb-5">
          <p className="text-body-2 text-muted mb-3">
            شما می‌توانید یک نسخه کامل از تمام داده‌های خود شامل تحلیل اسناد،
            تاریخچه گفتگوها، قراردادهای تولیدشده و تنظیمات حساب را به صورت یک
            فایل ZIP دریافت کنید. آماده‌سازی فایل ممکن است تا چند ساعت طول بکشد.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-body-2 text-on-primary font-medium opacity-50 cursor-not-allowed transition"
          >
            <IconDownload size={16} />
            دریافت خروجی از تمام داده‌های من
          </button>
        </div>

        {/* Divider */}
        <hr className="border-divider my-5" />

        {/* Export History */}
        <div className="mb-5">
          <h3 className="text-body-1 text-on-surface font-medium mb-3">
            تاریخچه خروجی‌ها
          </h3>
          <EmptyState text="تاکنون خروجی داده‌ای درخواست نشده است." />
        </div>

        {/* Divider */}
        <hr className="border-divider my-5" />

        {/* Delete History */}
        <div>
          <p className="text-body-2 text-muted mb-3">
            با حذف تاریخچه خروجی‌ها، تمام فایل‌های خروجی قبلی از سرور حذف شده و
            لینک‌های دانلود آن‌ها از کار خواهد افتاد. این عمل قابل بازگشت نیست.
          </p>
          <DeleteHistoryButton />
        </div>
      </section>

      {/* ================================================ */}
      {/* حذف حساب (Account Closure) */}
      {/* ================================================ */}
      <section className="rounded-large bg-surface p-6 shadow-elevation-1 border-2 border-error/40 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <IconWarning size={22} className="text-error" />
          <h2 className="text-h3 text-error">حذف حساب کاربری</h2>
        </div>

        {/* Warning */}
        <div className="rounded-lg bg-error/5 border border-error/20 p-4 mb-5">
          <p className="text-body-2 text-on-surface mb-1 font-medium">
            هشدار: این عملیات قابل بازگشت نیست
          </p>
          <p className="text-body-2 text-muted">
            با حذف حساب، تمام داده‌های شما از جمله قراردادها، تحلیل اسناد،
            تاریخچه گفتگوها و اطلاعات پروفایل به طور دائمی حذف خواهند شد. همچنین
            تمام اشتراک‌های فعال شما لغو شده و دسترسی به حساب برای همیشه مسدود
            می‌شود.
          </p>
        </div>

        {/* Account closure form */}
        <AccountClosureForm />
      </section>
    </div>
  );
}
