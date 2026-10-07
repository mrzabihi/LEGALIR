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
//
// Visual language: a card-first surface (thin divider border, one shadow,
// generous radius), a single 8/12/16 spacing rhythm and a tone system
// (neutral · brand · info · success · warning · danger) shared by badges,
// KPI cards and banners. Nothing here fetches or derives data — every value
// is passed in, so a page can never be tempted to fabricate one.
// ============================================================

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { snackbar } from "@legalir/ui";
import {
  ADMIN_EXPORT_PERMISSION,
  ADMIN_EXPORT_KIND_FA,
  type AdminExportKind,
} from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import { adminSectionTitle } from "@/lib/admin-nav";
import { downloadAdminExport } from "@/lib/api/admin";
import { useAdminMe } from "@/hooks/useAdmin";
import {
  IconWarning,
  IconDatabase,
  IconRefresh,
  IconInfo,
  IconOpenInNew,
  IconChevronUp,
  IconChevronDown,
  IconSearch,
  IconClose,
  IconDownload,
} from "@/lib/icons";

// ---------------------------------------------------------------------------
// Surface rhythm
// ---------------------------------------------------------------------------
// One shadow for resting cards, a slightly lifted shadow for interactive
// ones. Kept as constants so every card in the panel agrees.
const CARD_BASE = "rounded-large border border-divider bg-surface";
const CARD_REST = "shadow-elevation-1";
const CARD_LIFT = "transition-shadow hover:shadow-elevation-3";

// ---------------------------------------------------------------------------
// Card / section
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Lift the card's shadow on hover (use for cards that are themselves a link). */
  interactive?: boolean;
  /** Render as `section`/`article` when the semantics matter. */
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={`${CARD_BASE} ${CARD_REST} ${interactive ? CARD_LIFT : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Optional structured card parts for cards that want a header rule. */
export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-3 tablet:px-5 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-primary-soft text-primary"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-titleMedium text-onSurface">{title}</h3>
          {subtitle && <p className="mt-0.5 text-caption text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 tablet:p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-t border-divider px-4 py-3 tablet:px-5 ${className}`}>{children}</div>
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
              <span title={infoFa} className="text-muted" aria-label={infoFa} role="img">
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

// ---------------------------------------------------------------------------
// Breadcrumb + Page header
// ---------------------------------------------------------------------------

/** `خانه / بخش` — derived from the route so no page has to pass it in. */
function AdminBreadcrumb() {
  const pathname = usePathname();
  const sectionTitle = adminSectionTitle(pathname);

  return (
    <nav aria-label="مسیر صفحه" className="mb-1.5">
      <ol className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
        <li>
          <Link href="/admin" className="transition-colors hover:text-primary">
            خانه
          </Link>
        </li>
        {pathname !== "/admin" && (
          <>
            <li aria-hidden="true" className="text-outline-variant">
              /
            </li>
            <li aria-current="page" className="font-medium text-on-surface-variant">
              {sectionTitle}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
  breadcrumb = true,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** A leading glyph shown in a tinted tile beside the title. */
  icon?: ReactNode;
  /** Render the route-derived breadcrumb (default on). */
  breadcrumb?: boolean;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && <AdminBreadcrumb />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-primary-soft text-primary tablet:flex"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-h2 text-onSurface font-bold">{title}</h1>
            {description && (
              <p className="mt-1 max-w-3xl text-body-2 text-muted">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        )}
      </div>
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

/** Tone → (value text, icon tile) for the KPI card. */
// Solid ramp steps only — the semantic ramps are redefined per theme, so a
// single step (e.g. `text-success-700`) already adapts to light/dark. Opacity
// modifiers (`text-success-700/80`) would emit nothing on a var() colour.
const STAT_TONES = {
  default: { value: "text-onSurface", tile: "bg-primary-soft text-primary" },
  success: { value: "text-success-600", tile: "bg-success-soft text-success-700" },
  warning: { value: "text-warning-600", tile: "bg-warning-soft text-warning-700" },
  danger: { value: "text-error-600", tile: "bg-error-soft text-error-700" },
} as const;

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
  const t = STAT_TONES[tone];

  const trendClass =
    trend?.tone === "good"
      ? "bg-success-soft text-success-700"
      : trend?.tone === "bad"
        ? "bg-error-soft text-error-700"
        : "bg-surface-container text-muted";

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium transition-transform duration-200 motion-reduce:transition-none ${t.tile} ${
              href ? "group-hover:scale-105" : ""
            }`}
          >
            {icon}
          </span>
        )}
        <p className="min-w-0 flex-1 text-caption font-medium text-muted">{label}</p>
        {href && (
          <IconOpenInNew
            size={14}
            aria-hidden="true"
            className="shrink-0 text-outline-variant transition-colors group-hover:text-primary"
          />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p
          className={`text-h2 font-bold leading-none tabular-nums ${t.value}`}
          title={valueTitle}
        >
          {typeof value === "number" ? toPersianNumber(value) : value}
          {unit && <span className="ms-1 text-caption font-medium text-muted">{unit}</span>}
        </p>
        {trend && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-caption font-semibold tabular-nums ${trendClass}`}
            title={trend.titleFa}
          >
            {trend.direction === "up" ? (
              <IconChevronUp size={12} aria-hidden="true" />
            ) : trend.direction === "down" ? (
              <IconChevronDown size={12} aria-hidden="true" />
            ) : (
              <span aria-hidden="true">•</span>
            )}
            <span dir="ltr">{trend.labelFa}</span>
          </span>
        )}
      </div>

      {(hint || trend) && (
        <p className="mt-2 text-caption leading-relaxed text-muted">
          {hint}
          {hint && trend && <span aria-hidden="true"> · </span>}
          {trend && <span className="text-muted">نسبت به بازهٔ قبل</span>}
        </p>
      )}
    </>
  );

  // Accent KPI cards get a restrained brand sheen (top-to-bottom wash) instead
  // of a flat tint — a controlled gradient that keeps the value legible.
  const shell = `${CARD_BASE} p-4 ${CARD_REST} ${
    accent
      ? "border-primary-200 bg-gradient-to-b from-primary-soft to-surface"
      : ""
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={`group block ${shell} ${CARD_LIFT} hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
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
  neutral: "border-divider bg-surface-container text-on-surface-variant",
  success: "border-success-200 bg-success-soft text-success-700",
  warning: "border-warning-200 bg-warning-soft text-warning-700",
  danger: "border-error-200 bg-error-soft text-error-700",
  info: "border-info-200 bg-info-soft text-info-700",
  brand: "border-primary-200 bg-primary-soft text-primary",
};

const BADGE_DOTS: Record<string, string> = {
  neutral: "bg-outline",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-error-500",
  info: "bg-info-500",
  brand: "bg-primary",
};

export function Badge({
  children,
  tone = "neutral",
  title,
  dot = false,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  title?: string;
  /** Prefix a small status dot for extra scannability. */
  dot?: boolean;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium whitespace-nowrap ${BADGE_TONES[tone] ?? BADGE_TONES["neutral"]}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${BADGE_DOTS[tone] ?? BADGE_DOTS["neutral"]}`}
        />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary border-transparent hover:bg-primary-700",
  secondary: "bg-surface border-divider text-on-surface-variant hover:bg-surface-hover",
  tonal: "bg-primary-soft border-transparent text-primary hover:bg-primary-container",
  ghost: "bg-transparent border-transparent text-muted hover:text-on-surface hover:bg-surface-hover",
  danger: "bg-error text-on-error border-transparent hover:opacity-90",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-caption",
  md: "h-10 px-4 text-body-2",
  lg: "h-11 px-5 text-body-1",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
  size = "md",
  title,
  startIcon,
  endIcon,
  loading = false,
  className = "",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: ButtonSize;
  title?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-medium border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <IconRefresh size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        startIcon
      )}
      {children}
      {endIcon}
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
        <div key={i} className={`${CARD_BASE} h-14 ${CARD_REST} skeleton-shimmer`} />
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
    <Card className="p-6 text-center" as="div">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft">
        <IconWarning size={26} className="text-warning-600" />
      </span>
      <p className="text-body-2 text-on-surface-variant">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button
            onClick={onRetry}
            variant="secondary"
            size="sm"
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}
    </Card>
  );
}

export function EmptyBlock({
  message = "موردی برای نمایش وجود ندارد.",
  hint,
  action,
}: {
  message?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-8 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
        <IconDatabase size={26} className="text-outline" />
      </span>
      <p className="text-body-2 font-medium text-on-surface">{message}</p>
      {hint && <p className="mt-1 text-caption text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function InfoBanner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  const cls =
    tone === "warning"
      ? "border-warning-200 bg-warning-soft text-warning-800"
      : tone === "success"
        ? "border-success-200 bg-success-soft text-success-800"
        : "border-info-200 bg-info-soft text-info-800";
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

export function DataTable({
  head,
  children,
  minWidth = 640,
  hover = true,
}: {
  head: ReactNode;
  children: ReactNode;
  /** Min table width before the wrapper scrolls horizontally (mobile). */
  minWidth?: number;
  /** Row hover tint. On by default. */
  hover?: boolean;
}) {
  return (
    <div className={`overflow-x-auto ${CARD_BASE} ${CARD_REST}`}>
      <table className="w-full border-collapse text-body-2" style={{ minWidth }}>
        <thead className="bg-surface-container-low text-caption font-medium text-muted">
          {head}
        </thead>
        <tbody
          className={`divide-y divide-divider bg-surface ${
            hover ? "[&>tr]:transition-colors [&>tr:hover]:bg-surface-hover" : ""
          }`}
        >
          {children}
        </tbody>
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
    <th
      dir={dir}
      title={title}
      className={`whitespace-nowrap px-4 py-3 text-start font-medium ${className}`}
    >
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
      className={`px-4 py-3 align-middle text-on-surface-variant ${className}`}
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
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  /** Error message — when set the hint is suppressed and the field reads red. */
  error?: string;
  /** Marks the label with an asterisk so required fields read as such. */
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-medium text-on-surface-variant">
        {label}
        {required && (
          <span className="text-error-600 dark:text-error-400" aria-hidden="true">
            {" *"}
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-caption text-error-600 dark:text-error-400">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-caption text-muted">{hint}</span>
      )}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-muted";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

/** A leading-icon search box used by page filter rows. */
export function SearchInput({
  value,
  onChange,
  placeholder = "جست‌وجو…",
  className = "",
  ariaLabel = "جست‌وجو",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch
        size={16}
        className="pointer-events-none absolute inset-y-0 start-3 my-auto text-outline"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} ps-9 pe-9`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="پاک کردن جست‌وجو"
          className="absolute inset-y-0 end-2 my-auto flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-on-surface"
        >
          <IconClose size={14} />
        </button>
      )}
    </div>
  );
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
    <div className="flex flex-wrap items-center gap-2" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
            value === o.value
              ? "border-primary bg-primary text-on-primary shadow-elevation-1"
              : "border-divider bg-surface text-muted hover:border-primary-300 hover:text-on-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs (underline style)
// ---------------------------------------------------------------------------

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Optional trailing count/badge, e.g. `۱۲`. */
  badge?: ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-divider"
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-body-2 font-medium transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:border-outline-variant hover:text-on-surface"
            }`}
          >
            {t.icon && <span aria-hidden="true">{t.icon}</span>}
            {t.label}
            {t.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-caption tabular-nums ${
                  active ? "bg-primary-soft text-primary" : "bg-surface-container text-muted"
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
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

// ---------------------------------------------------------------------------
// Excel export control (§7)
// ---------------------------------------------------------------------------

/**
 * Downloads the COMPLETE Excel workbook for one admin surface. The server
 * builds it from the same source data the table reads — never the current UI
 * page — so a filtered or paginated screen still exports every row. The button
 * is gated on the surface's own read permission: an operator who cannot view
 * the audit log cannot export it either. Success and failure are reported
 * through the app-wide snackbar; a double-click cannot fire two downloads.
 */
export function ExportButton({
  kind,
  label = "خروجی اکسل",
  size = "sm",
}: {
  kind: AdminExportKind;
  label?: string;
  size?: "sm" | "md";
}) {
  const { can } = useAdminMe();
  const [busy, setBusy] = useState(false);
  const allowed = can(ADMIN_EXPORT_PERMISSION[kind]);
  const surfaceFa = ADMIN_EXPORT_KIND_FA[kind];

  async function run() {
    if (busy || !allowed) return;
    setBusy(true);
    try {
      await downloadAdminExport(kind);
      snackbar.show({
        message: `خروجی «${surfaceFa}» ساخته و دانلود شد.`,
        variant: "success",
      });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "خروجی گرفتن ناموفق بود";
      snackbar.show({ message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={run}
      disabled={busy || !allowed}
      title={
        allowed
          ? `دانلود خروجی کامل ${surfaceFa} در قالب اکسل`
          : "برای خروجی گرفتن این بخش دسترسی ندارید"
      }
    >
      <IconDownload size={size === "sm" ? 14 : 16} />
      {busy ? "در حال آماده‌سازی…" : label}
    </Button>
  );
}
