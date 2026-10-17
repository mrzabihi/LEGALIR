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

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { snackbar, Button as SharedButton } from "@legalir/ui";
import {
  ADMIN_EXPORT_PERMISSION,
  ADMIN_EXPORT_KIND_FA,
  type AdminExportKind,
} from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import { PAGE_SIZE_OPTIONS } from "@/lib/admin/pagination";
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
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconClose,
  IconDownload,
  IconEye,
  IconEyeOff,
} from "@/lib/icons";

// ---------------------------------------------------------------------------
// Surface rhythm
// ---------------------------------------------------------------------------
// One shadow for resting cards, a slightly lifted shadow for interactive
// ones. Kept as constants so every card in the panel agrees.
const CARD_BASE = "rounded-large border border-divider bg-surface";
const CARD_REST = "shadow-elevation-1";
const CARD_LIFT =
  "transition-shadow duration-short3 ease-standard motion-reduce:transition-none can-hover:hover:shadow-elevation-3";

// ---------------------------------------------------------------------------
// One motion language (Jitter «Animated UI Kit», adapted)
// ---------------------------------------------------------------------------
// Interactive surfaces move through ONE shared, short transition instead of
// per-page one-offs: colour, shadow and a ≤1px lift resolve together on the
// same easing. It is clamped by the global `prefers-reduced-motion` rule, so no
// local override is needed and nothing animates permanently.
export const MOTION_STANDARD =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-short3 ease-standard motion-reduce:transition-none";

// ---------------------------------------------------------------------------
// Card / section
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
  role,
}: {
  children: ReactNode;
  className?: string;
  /** Lift the card's shadow on hover (use for cards that are themselves a link). */
  interactive?: boolean;
  /** Render as `section`/`article` when the semantics matter. */
  as?: React.ElementType;
  /** ARIA role when the card is a state container (e.g. `alert`). */
  role?: React.AriaRole;
}) {
  return (
    <Tag
      role={role}
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
      {actions && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
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
        {actions && (
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        )}
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

/**
 * Metric-family accent. Applied to a KPI card in exactly two restrained,
 * token-derived places — the leading icon tile and a thin bar on the card's
 * start edge — so the cards of one family (users · lawyers · sales) read as a
 * group without a loud fill. The number keeps its semantic `tone`, so colour is
 * never the only carrier of meaning.
 */
export type StatAccent = "brand" | "info" | "success" | "warning";

export const ACCENT_TOKENS: Record<StatAccent, { tile: string; bar: string; hover: string }> = {
  brand: {
    tile: "bg-primary-soft text-primary",
    bar: "bg-primary",
    hover: "hover:border-primary-300",
  },
  info: {
    tile: "bg-info-soft text-info-700",
    bar: "bg-info-500",
    hover: "hover:border-info-300",
  },
  success: {
    tile: "bg-success-soft text-success-700",
    bar: "bg-success-500",
    hover: "hover:border-success-300",
  },
  warning: {
    tile: "bg-warning-soft text-warning-700",
    bar: "bg-warning-500",
    hover: "hover:border-warning-300",
  },
};

export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
  icon,
  accent = false,
  accentTone,
  trend,
  href,
  valueTitle,
  unavailable = false,
  unavailableLabel = "قابل محاسبه نیست",
  chart,
  moreLabel,
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
  /**
   * Tint the icon tile and add a thin start-edge bar in the metric family's
   * colour. Unlike `accent` this keeps a flat surface, so a row of cards reads
   * as one calm family with a controlled per-group hue.
   */
  accentTone?: StatAccent;
  /** Change-vs-previous-period indicator. Omitted when no honest comparison. */
  trend?: StatTrend;
  /** When set the whole card becomes a link to its detail report. */
  href?: string;
  /** Tooltip on the value (e.g. the exact figure behind a compact display). */
  valueTitle?: string;
  /**
   * A metric that cannot be derived from available data (e.g. AI error rate
   * with no provider telemetry). Renders `unavailableLabel` in a muted tone
   * instead of a value that could be misread as a real zero, and suppresses the
   * unit, trend and chart entirely. `hint` carries the reason.
   */
  unavailable?: boolean;
  /** Placeholder text for an `unavailable` metric. */
  unavailableLabel?: string;
  /** An optional compact glyph under the value (e.g. a `Sparkline`). */
  chart?: ReactNode;
  /** Visible link text shown inside a linked card (e.g. «مشاهدهٔ جزئیات»). */
  moreLabel?: string;
}) {
  const t = STAT_TONES[tone];
  const isUnavailable = unavailable === true;

  // A figure is a number, or a pre-formatted string made only of digits,
  // separators, signs and percent marks. Anything containing a letter (a
  // timezone, a status word) is prose and is allowed to wrap.
  const isFigureValue =
    typeof value === "number" || !/\p{L}/u.test(value);

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
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium transition-transform duration-200 motion-reduce:transition-none ${
              accentTone ? ACCENT_TOKENS[accentTone].tile : t.tile
            } ${href ? "group-hover:scale-105" : ""}`}
          >
            {icon}
          </span>
        )}
        {/* `break-words` is the safety net for a long single token (a ZWNJ word
            like «درخواست‌های» cannot wrap at the joiner); normally the label
            wraps at its spaces and never needs it. */}
        <p className="min-w-0 flex-1 break-words text-caption font-medium text-muted">{label}</p>
        {/* At a 2-up phone width the card interior is ~123px and this glyph
            alone costs the label ~19px — enough to clip its first word. The
            card itself is the link and carries a visible «مشاهدهٔ جزئیات» line,
            so the corner hint is decorative there and is dropped below tablet. */}
        {href && (
          <IconOpenInNew
            size={14}
            aria-hidden="true"
            className="hidden shrink-0 text-outline-variant transition-colors group-hover:text-primary tablet:block"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
        <p
          className={
            isUnavailable
              ? "min-w-0 break-words text-h4 font-semibold leading-snug text-muted"
              : // A figure must never break inside itself: on a 390px phone the
                // 2-up KPI grid leaves ~123px of card interior, where a 9-digit
                // money value split at a separator and read as two numbers. So
                // the digits stay atomic (`bdi` + nowrap) and the step scale is
                // driven by the card's real width at each breakpoint: 16px at
                // 320px, 18px once a 2-up grid fits, 20px on tablet, 24px only
                // where a card is ≥250px wide. The unit may still fall to the
                // next line, which is what keeps the number itself intact.
                `min-w-0 break-words text-body-1 font-bold leading-tight tabular-nums mobile-l:text-h4 tablet:text-h3 wide:text-h2 wide:leading-none ${t.value}`
          }
          title={valueTitle}
        >
          {isUnavailable ? (
            unavailableLabel
          ) : isFigureValue ? (
            <bdi className="whitespace-nowrap">
              {typeof value === "number" ? toPersianNumber(value) : value}
            </bdi>
          ) : (
            value
          )}
          {unit && !isUnavailable && (
            <span className="ms-1 text-caption font-medium text-muted">{unit}</span>
          )}
        </p>
        {trend && !isUnavailable && (
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

      {chart && !isUnavailable && <div className="mt-3">{chart}</div>}

      {(hint || (trend && !isUnavailable)) && (
        <p className="mt-2 text-caption leading-relaxed text-muted">
          {hint}
          {hint && trend && !isUnavailable && <span aria-hidden="true"> · </span>}
          {trend && !isUnavailable && <span className="text-muted">نسبت به بازهٔ قبل</span>}
        </p>
      )}

      {href && moreLabel && (
        <span className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-primary">
          {moreLabel}
          <IconChevronLeft size={13} aria-hidden="true" />
        </span>
      )}
    </>
  );

  const accentCls = accentTone ? ACCENT_TOKENS[accentTone] : null;

  // Accent KPI cards get a restrained brand sheen (top-to-bottom wash) instead
  // of a flat tint — a controlled gradient that keeps the value legible. A
  // family `accentTone` instead keeps a flat surface and marks the group with a
  // thin start-edge bar, so a row of cards stays calm and uniform. Only that
  // edge-bar variant needs `relative overflow-hidden`; every other card keeps
  // its exact previous shell.
  const shell = `${CARD_BASE} ${CARD_REST} ${accentCls ? "relative overflow-hidden" : ""} p-4 ${
    accent ? "border-primary-200 bg-gradient-to-b from-primary-soft to-surface" : ""
  }`;

  const edgeBar = accentCls ? (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 start-0 w-1 ${accentCls.bar}`}
    />
  ) : null;

  const hoverCls = accentCls ? accentCls.hover : "hover:border-primary-300";

  if (href) {
    return (
      <Link
        href={href}
        className={`group block ${shell} ${MOTION_STANDARD} can-hover:hover:-translate-y-px can-hover:hover:shadow-elevation-3 ${hoverCls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1`}
        aria-label={moreLabel ? `${label} — ${moreLabel}` : `${label} — مشاهدهٔ جزئیات`}
      >
        {edgeBar}
        {body}
      </Link>
    );
  }
  return (
    <div className={shell}>
      {edgeBar}
      {body}
    </div>
  );
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

// The admin panel used to carry its own button table. It now renders the
// product-wide primitive, so hover/focus/pressed/loading/disabled behave
// identically in the panel and in the app. The variant and size names the
// admin pages already pass (`primary`, `sm`, …) are first-class aliases on
// the shared component — there is no second visual language to maintain.
type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

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
  ariaLabel,
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
  /** Accessible name for icon-only buttons (no visible text child). */
  ariaLabel?: string;
}) {
  return (
    <SharedButton
      type={type}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      variant={variant}
      size={size}
      startIcon={startIcon}
      endIcon={endIcon}
      className={className}
    >
      {children}
    </SharedButton>
  );
}

// ---------------------------------------------------------------------------
// State view — loading · error · empty · ready
// ---------------------------------------------------------------------------

export function LoadingBlock({ rows = 4, label = "در حال دریافت اطلاعات…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`${CARD_BASE} h-14 ${CARD_REST} skeleton-shimmer`}
        />
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
    <Card className="p-6 text-center" as="div" role="alert">
      <span
        aria-hidden="true"
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft"
      >
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
 * Result of an action the operator just took (save, role change, archive…).
 * Unlike `InfoBanner` — which is a permanent note — this is a transient result,
 * so it is a live region: a screen reader announces it the moment it appears,
 * and errors use `alert` so they are never missed. It enters with one short
 * slide-up fade and is fully static under `prefers-reduced-motion`.
 */
export function InlineNotice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "error"
      ? "border-error-200 bg-error-soft text-error-700"
      : tone === "success"
        ? "border-success-200 bg-success-soft text-success-700"
        : tone === "warning"
          ? "border-warning-200 bg-warning-soft text-warning-700"
          : "border-info-200 bg-info-soft text-info-700";
  const Icon = tone === "error" || tone === "warning" ? IconWarning : IconInfo;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 flex items-start gap-2 rounded-large border p-3 text-body-2 animate-slide-up-fade motion-reduce:animate-none ${toneClass} ${className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
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
  bare = false,
}: {
  head: ReactNode;
  children: ReactNode;
  /** Min table width before the wrapper scrolls horizontally (mobile). */
  minWidth?: number;
  /** Row hover tint. On by default. */
  hover?: boolean;
  /**
   * Drop the card shell so the table can sit flush inside an existing card
   * (`ChartFrame`, a drawer, a modal). Two nested borders read as a mis-aligned
   * box and waste horizontal room on small screens.
   */
  bare?: boolean;
}) {
  return (
    // A horizontally scrollable table must be reachable by keyboard (WCAG
    // 2.1.1): the wrapper is a focusable region so arrow keys can pan it on a
    // narrow screen instead of the last columns being unreachable.
    <div
      role="region"
      aria-label="جدول داده‌ها (برای جابه‌جایی افقی از کلیدهای جهت‌دار استفاده کنید)"
      tabIndex={0}
      className={`overflow-x-auto ${
        bare ? "rounded-medium" : `${CARD_BASE} ${CARD_REST}`
      } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      <table className="w-full border-collapse text-body-2" style={{ minWidth }}>
        <thead className="bg-surface-container-low text-caption font-medium text-muted">
          {head}
        </thead>
        <tbody
          className={`divide-y divide-divider bg-surface ${
            hover
              ? "[&>tr]:transition-colors [&>tr]:duration-short3 [&>tr]:ease-standard [&>tr:hover]:bg-surface-hover motion-reduce:[&>tr]:transition-none"
              : ""
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

/**
 * A mobile number rendered left-to-right inside the RTL panel. `isolate` +
 * `dir="ltr"` keep the digits, country code and any `+` prefix in the correct
 * order regardless of the surrounding Persian text, while the row still lays
 * out RTL. Shown in full — never masked, truncated or wrapped. The E.164 value
 * it wraps (`+989…`) is complete; `dir="ltr"` is the ONLY direction control,
 * never a code-point trick or string reversal.
 */
export function MobileNumber({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi
      dir="ltr"
      className={`inline-block tabular-nums whitespace-nowrap text-start ${className}`}
      style={{ unicodeBidi: "isolate" }}
    >
      {children}
    </bdi>
  );
}

/**
 * A mobile rendered MASKED by default, with a per-cell reveal toggle. This is
 * the panel-wide default for a user's or lawyer's number: four middle digits
 * are hidden (see {@link maskMobileMiddle}) until the operator clicks the eye,
 * which reveals the full value LTR — re-hidden on a second click. The reveal
 * state is LOCAL to the cell and never escapes it: nothing lands in the URL,
 * localStorage, a tooltip, an HTML `title`, alt text or the DOM of a
 * neighbouring row, so a masked screenshot carries no full numbers.
 *
 * The mask is a privacy affordance, not an authorization boundary — the
 * server still authorizes the caller and decides what the endpoint returns.
 */
export function MaskedMobile({
  value,
  className = "",
}: {
  /** The full value the row owns (any stored shape); masking is display-only. */
  value: string | null | undefined;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const full = value ?? "";
  const hasValue = full.trim().length > 0;

  return (
    <span className="inline-flex items-center gap-1.5">
      <bdi
        dir="ltr"
        className={`tabular-nums whitespace-nowrap text-start ${className}`}
        style={{ unicodeBidi: "isolate" }}
      >
        {revealed ? full : maskMobileMiddle(full)}
      </bdi>
      {hasValue && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-pressed={revealed}
          aria-label={revealed ? "مخفی‌کردن شماره موبایل" : "نمایش شماره موبایل"}
          title={revealed ? "مخفی‌کردن شماره" : "نمایش شماره"}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {revealed ? (
            <IconEyeOff size={15} aria-hidden="true" />
          ) : (
            <IconEye size={15} aria-hidden="true" />
          )}
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
// The ONE pager every admin list uses. It speaks the shared 10/20/100 page-size
// contract (see lib/admin/pagination) so the control and the API can never
// disagree. RTL-first and responsive: the summary collapses on mobile while the
// size selector and first/prev/next/last buttons stay reachable. The page and
// page-size values are CONTROLLED — the page owns them (URL or state) so a page
// can persist them; this component only renders and emits.
export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = "نتیجه",
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Optional — derived from total/pageSize when omitted. */
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  /** Noun after the count, e.g. «کاربر» / «سفارش» / «نتیجه». */
  itemLabel?: string;
}) {
  const pages = Math.max(1, totalPages ?? Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const atFirst = page <= 1;
  const atLast = page >= pages;

  return (
    <div className="mt-3 flex flex-col gap-3 text-caption text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <span className="tabular-nums">
        نمایش {toPersianNumber(from)} تا {toPersianNumber(to)} از {toPersianNumber(total)} {itemLabel}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">در هر صفحه</span>
            <span
              role="group"
              aria-label="تعداد رکورد در هر صفحه"
              className="flex items-center overflow-hidden rounded-medium border border-divider"
            >
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={pageSize === size}
                  onClick={() => onPageSizeChange(size)}
                  className={`px-3 py-1.5 tabular-nums transition-colors ${
                    pageSize === size
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant hover:bg-surface-hover"
                  }`}
                >
                  {toPersianNumber(size)}
                </button>
              ))}
            </span>
          </label>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={atFirst}
            onClick={() => onPageChange(1)}
            title="صفحهٔ اول"
            ariaLabel="صفحهٔ اول"
            startIcon={<IconChevronRight size={14} aria-hidden="true" />}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={atFirst}
            onClick={() => onPageChange(page - 1)}
            title="صفحهٔ قبل"
          >
            قبلی
          </Button>
          <span className="px-1 tabular-nums whitespace-nowrap">
            {toPersianNumber(page)} / {toPersianNumber(pages)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={atLast}
            onClick={() => onPageChange(page + 1)}
            title="صفحهٔ بعد"
          >
            بعدی
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={atLast}
            onClick={() => onPageChange(pages)}
            title="صفحهٔ آخر"
            ariaLabel="صفحهٔ آخر"
            startIcon={<IconChevronLeft size={14} aria-hidden="true" />}
          />
        </div>
      </div>
    </div>
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
        // Same 40px control height as a `medium` Button and a `Select`, so a
        // filter row reads as one line instead of three stray baselines.
        className={`${INPUT_CLASS} h-10 ps-9 pe-9`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="پاک کردن جست‌وجو"
          className="absolute inset-y-0 end-2 my-auto flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-short3 hover:bg-surface-hover hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          <IconClose size={14} aria-hidden="true" />
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
          className={`inline-flex h-10 max-desktop:min-h-11 items-center rounded-full border px-4 text-caption font-medium transition-colors duration-short3 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
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
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow keys move selection in reading order. RTL is the panel's default
  // direction, so ArrowLeft advances to the next tab and ArrowRight returns;
  // Home/End jump to the edges. Selection itself stays controlled by `value`.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((t) => t.value === value);
    if (current < 0) return;
    let next: number;
    if (e.key === "ArrowLeft") next = Math.min(items.length - 1, current + 1);
    else if (e.key === "ArrowRight") next = Math.max(0, current - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const target = items[next];
    if (target && next !== current) onChange(target.value);
    requestAnimationFrame(() => {
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    });
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
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
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`-mb-px flex min-h-10 max-desktop:min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-body-2 font-medium transition-colors duration-short3 ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
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
