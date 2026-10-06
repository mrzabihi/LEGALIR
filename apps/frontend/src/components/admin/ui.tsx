// ============================================================
// LEGALIR — Admin panel shared UI primitives
// ============================================================
// Presentational building blocks shared by every admin page. They use the
// project's design tokens (bg-surface, border-divider, text-muted,
// rounded-large, …) so the panel matches the rest of the app rather than
// inventing its own palette.
//
// StateView renders the four states every admin page owes the user:
// loading · error · empty · ready (plus unauthorized, handled by the shell).
// ============================================================

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconWarning,
  IconDatabase,
  IconRefresh,
  IconInfo,
  IconOpenInNew,
  IconChevronUp,
  IconChevronDown,
} from "@/lib/icons";

// ---------------------------------------------------------------------------
// Card / section
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-large border border-divider bg-surface ${className}`}>{children}</div>
  );
}

export function Section({
  title,
  subtitle,
  infoFa,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  /** A longer explanation surfaced via a small ⓘ beside the title. */
  infoFa?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-h3 text-onSurface font-bold">
            {title}
            {infoFa && (
              <span
                title={infoFa}
                className="text-muted"
                aria-label={infoFa}
                role="img"
              >
                <IconInfo size={15} />
              </span>
            )}
          </h2>
          {subtitle && <p className="mt-0.5 text-body-2 text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-h2 text-onSurface font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-body-2 text-muted">{description}</p>}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

/**
 * A ready-to-render movement indicator, pre-computed by the caller so this
 * component stays presentational: it never derives a percentage itself.
 * `tone` is the *interpretation* — for an inverse metric (errors, latency)
 * an increase is `bad`, and the chip colours accordingly.
 */
export interface StatTrend {
  direction: "up" | "down" | "flat";
  tone: "good" | "bad" | "neutral";
  /** Short label, e.g. «۱۲٪+». */
  labelFa: string;
  /** Long tooltip explaining the comparison basis and the previous value. */
  titleFa: string;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
  icon,
  accent = false,
  trend,
  href,
  valueTitle,
}: {
  label: string;
  value: string | number;
  /** Unit shown after the value (e.g. «تومان»). */
  unit?: string;
  hint?: string;
  tone?: "default" | "warning" | "success" | "danger";
  /** A small leading icon shown in a tinted square beside the label. */
  icon?: ReactNode;
  /** Emphasise the card with a brand-tinted surface (a section lead KPI). */
  accent?: boolean;
  /** Change-vs-previous-period indicator. Omitted when no honest comparison. */
  trend?: StatTrend;
  /** When set the whole card becomes a link to its detail report. */
  href?: string;
  /** Tooltip on the value (e.g. the exact figure behind a compact display). */
  valueTitle?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "text-onSurface";
  const iconClass =
    tone === "warning"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : tone === "danger"
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-primary/10 text-primary";

  const trendClass =
    trend?.tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend?.tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : "text-muted";

  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-medium ${iconClass}`}
          >
            {icon}
          </span>
        )}
        <p className="min-w-0 flex-1 text-caption text-muted">{label}</p>
        {href && (
          <IconOpenInNew
            size={14}
            aria-hidden="true"
            className="shrink-0 text-muted transition-colors group-hover:text-primary"
          />
        )}
      </div>
      <p
        className={`mt-1.5 text-h3 font-bold tabular-nums ${toneClass}`}
        title={valueTitle}
      >
        {typeof value === "number" ? toPersianNumber(value) : value}
        {unit && <span className="ms-1 text-caption font-medium text-muted">{unit}</span>}
      </p>
      {trend ? (
        <p className={`mt-1 flex items-center gap-1 text-caption font-medium ${trendClass}`} title={trend.titleFa}>
          {trend.direction !== "flat" ? (
            trend.direction === "up" ? (
              <IconChevronUp size={13} aria-hidden="true" />
            ) : (
              <IconChevronDown size={13} aria-hidden="true" />
            )
          ) : (
            <span aria-hidden="true">•</span>
          )}
          <span dir="ltr" className="tabular-nums">
            {trend.labelFa}
          </span>
          <span className="text-muted">نسبت به بازهٔ قبل</span>
        </p>
      ) : (
        hint && <p className="mt-0.5 text-caption text-muted">{hint}</p>
      )}
      {trend && hint && <p className="mt-0.5 text-caption text-muted">{hint}</p>}
    </>
  );

  const shell = `rounded-large border p-4 ${
    accent ? "bg-primary/[0.04] border-primary/20" : "bg-surface border-divider"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={`group block ${shell} transition-colors hover:border-primary/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
        aria-label={`${label} — مشاهدهٔ جزئیات`}
      >
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const BADGE_TONES: Record<string, string> = {
  neutral: "border-divider text-muted",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/30",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/30",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700/30",
  brand: "border-primary/30 bg-primary/10 text-primary",
};

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium whitespace-nowrap ${BADGE_TONES[tone] ?? BADGE_TONES["neutral"]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90 border-transparent",
  secondary: "bg-surface border-divider text-on-surface-variant hover:bg-surface-hover",
  ghost: "bg-transparent border-transparent text-muted hover:text-on-surface hover:bg-surface-hover",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
  size = "md",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm" | "md";
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-medium border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1.5 text-caption" : "px-4 py-2 text-body-2"
      } ${BUTTON_VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// State view — loading · error · empty · ready
// ---------------------------------------------------------------------------

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-large bg-surface-container-high skeleton-shimmer" />
      ))}
    </div>
  );
}

export function ErrorBlock({
  message = "خطا در دریافت اطلاعات",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-6 text-center">
      <IconWarning size={28} className="mx-auto mb-3 text-amber-500" />
      <p className="text-body-2 text-on-surface-variant">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button onClick={onRetry} variant="secondary" size="sm">
            <IconRefresh size={16} /> تلاش مجدد
          </Button>
        </div>
      )}
    </Card>
  );
}

export function EmptyBlock({
  message = "موردی برای نمایش وجود ندارد.",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <Card className="p-8 text-center">
      <IconDatabase size={28} className="mx-auto mb-3 text-muted" />
      <p className="text-body-2 text-muted">{message}</p>
      {hint && <p className="mt-1 text-caption text-muted">{hint}</p>}
    </Card>
  );
}

export function InfoBanner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  const cls =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700/30"
      : "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700/30";
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-large border p-3 text-body-2 ${cls}`}>
      <IconInfo size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/**
 * Renders the correct state for a React Query result. Callers supply the
 * ready-render as a child function so this stays generic.
 */
export function StateView<T>({
  query,
  isEmpty,
  emptyMessage,
  emptyHint,
  loadingRows,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data: T | undefined;
    refetch: () => void;
  };
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  emptyHint?: string;
  loadingRows?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <LoadingBlock rows={loadingRows} />;
  if (query.isError || query.data === undefined)
    return <ErrorBlock onRetry={() => query.refetch()} />;
  if (isEmpty && isEmpty(query.data))
    return <EmptyBlock message={emptyMessage} hint={emptyHint} />;
  return <>{children(query.data)}</>;
}

// ---------------------------------------------------------------------------
// Table shell
// ---------------------------------------------------------------------------

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-large border border-divider">
      <table className="w-full min-w-[640px] border-collapse text-body-2">
        <thead className="bg-surface-container-low text-caption text-muted">{head}</thead>
        <tbody className="divide-y divide-divider bg-surface">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
  dir,
  title,
}: {
  children: ReactNode;
  className?: string;
  dir?: "ltr" | "rtl";
  title?: string;
}) {
  return (
    <th dir={dir} title={title} className={`px-4 py-2.5 text-start font-medium ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  dir,
  title,
}: {
  children: ReactNode;
  className?: string;
  dir?: "ltr" | "rtl";
  title?: string;
}) {
  return (
    <td
      dir={dir}
      title={title}
      className={`px-4 py-2.5 align-middle text-on-surface-variant ${className}`}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-medium text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

// ---------------------------------------------------------------------------
// Filter pills
// ---------------------------------------------------------------------------

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
            value === o.value
              ? "border-primary bg-primary text-on-primary"
              : "border-divider text-muted hover:text-on-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A short monospace id with a title tooltip (full value on hover). */
export function IdChip({ id }: { id: string }) {
  return (
    <span className="font-mono text-caption text-muted" dir="ltr" title={id}>
      {id.length > 12 ? `${id.slice(0, 12)}…` : id}
    </span>
  );
}
