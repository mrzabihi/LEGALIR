"use client";

// ============================================================
// LEGALIR — Button (the one button primitive)
// ============================================================
// Every clickable action in the product renders through this file.
// The interaction language is deliberately short and local:
//
//   rest     → flat fill / outline, 1dp elevation on raised fills
//   hover    → an 8% currentColor state layer (painted above the real
//              fill, so a filled button never goes transparent), plus a
//              1px lift and one extra elevation step on raised variants
//   focus    → 2px brand outline + 2px offset (keyboard only, no reflow)
//   pressed  → 12% state layer, 1.5% scale down — visual only
//   loading  → spinner replaces the leading icon, the label stays put (no
//              reflow), aria-busy is set, clicks are blocked so a request
//              can never be submitted twice
//   disabled → 40% opacity, no pointer events, no hover motion
//
// Motion is transform/opacity only, so nothing reflows. Hover motion is
// gated behind `can-hover:` (a real mouse or trackpad) so it never sticks
// on touch. The global reduced-motion rule clamps every transition, so
// these states still resolve instantly for users who ask for less motion.
//
// Icons lean toward the action's direction: a trailing icon moves toward
// the logical end of the row and a leading icon toward the logical start,
// mirrored under RTL by the built-in `rtl:` variant.
// ============================================================

import React, { forwardRef } from "react";

/** Canonical variants plus the aliases older screens already pass. */
export type ButtonVariant =
  | "filled"
  | "outlined"
  | "text"
  | "tonal"
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-outlined";

export type ButtonSize = "small" | "medium" | "large" | "sm" | "md" | "lg";

type CanonicalVariant =
  | "filled"
  | "outlined"
  | "text"
  | "tonal"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-outlined";
type CanonicalSize = "small" | "medium" | "large";

const VARIANT_ALIAS: Record<ButtonVariant, CanonicalVariant> = {
  filled: "filled",
  primary: "filled",
  outlined: "outlined",
  text: "text",
  tonal: "tonal",
  secondary: "secondary",
  ghost: "ghost",
  danger: "danger",
  "danger-outlined": "danger-outlined",
};

const SIZE_ALIAS: Record<ButtonSize, CanonicalSize> = {
  small: "small",
  sm: "small",
  medium: "medium",
  md: "medium",
  large: "large",
  lg: "large",
};

/**
 * Only raised fills lift on hover. Lifting a bordered or text button reads
 * as a mis-rendered card, so those stay flat and get the state layer only.
 */
const RAISED = new Set<CanonicalVariant>(["filled", "tonal", "danger"]);

const variantClasses: Record<CanonicalVariant, string> = {
  // Solid brand action — the one primary CTA per view.
  filled: "bg-primary text-primary-on shadow-elevation-1",
  // Primary-adjacent action that sits on a tinted surface.
  tonal: "bg-primary-container text-primary-on-container",
  // Calm bordered action; the label carries the brand colour.
  outlined: "border border-outline bg-transparent text-primary",
  // The quietest bordered action, for dense tables and toolbars.
  secondary: "border border-divider bg-surface text-on-surface-variant",
  // Inline tertiary action with a brand-coloured label.
  text: "bg-transparent text-primary",
  // Inline dismissal (بستن / انصراف / بعداً) — quieter than a brand action.
  ghost: "bg-transparent text-on-surface-variant",
  // Destructive — colour, label and confirmation all have to agree.
  danger: "bg-error text-on-error shadow-elevation-1",
  // A destructive *toolbar* action. It must be distinguishable from an
  // archive/delete that sits next to neutral controls, but a solid red
  // fill would outrank the screen's real primary action. Calm at rest,
  // unambiguously red on hover.
  "danger-outlined": "border border-divider bg-transparent text-on-surface-variant can-hover:hover:border-error can-hover:hover:text-error",
};

const sizeClasses: Record<CanonicalSize, string> = {
  small: "h-9 px-3 gap-1.5 text-labelLarge",
  medium: "h-10 px-5 gap-2 text-labelLarge",
  large: "h-12 px-6 gap-2 text-labelLarge",
};

const iconSizeClasses: Record<CanonicalSize, string> = {
  small: "h-4 w-4",
  medium: "h-5 w-5",
  large: "h-5 w-5",
};

const spinnerSizeClasses: Record<CanonicalSize, string> = {
  small: "h-3.5 w-3.5",
  medium: "h-4 w-4",
  large: "h-5 w-5",
};

function ButtonSpinner({ className }: { className: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The exact class list a button renders with. Exported so a navigation
 * target (an `<a>` / `next/link`) can look identical to a button without
 * nesting a `<button>` inside an `<a>` — two interactive elements in one
 * control, which breaks keyboard and screen-reader semantics.
 */
export function buttonClasses(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  const variant = VARIANT_ALIAS[options?.variant ?? "filled"];
  const size = SIZE_ALIAS[options?.size ?? "medium"];
  const raised = RAISED.has(variant);

  return [
    "group/btn relative isolate inline-flex select-none items-center justify-center overflow-hidden whitespace-nowrap",
    "rounded-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-short3 ease-standard",
    // MD3 state layer: a currentColor wash painted above the real fill and
    // below the label, so hover never erases the button's surface.
    "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-current",
    "before:opacity-0 before:transition-opacity before:duration-short3 before:ease-standard",
    "can-hover:hover:before:opacity-[0.08] active:before:opacity-[0.12]",
    // A restrained top sheen on raised fills — the “glass” edge of the
    // Jitter samples. Invisible at rest; never a permanent glow.
    raised
      ? "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:-z-10 after:h-1/2 after:rounded-t-medium after:bg-gradient-to-b after:from-white/15 after:to-transparent after:opacity-0 after:transition-opacity after:duration-short3 after:ease-standard can-hover:hover:after:opacity-100"
      : "",
    raised ? "can-hover:hover:-translate-y-px can-hover:hover:shadow-elevation-2" : "",
    // Visual-only press; scaled from the centre so neighbours never move.
    "active:translate-y-0 active:scale-[0.985]",
    // Flat, always-visible keyboard ring in the brand colour.
    "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
    // Touch targets: below desktop width the compact sizes grow to 44px
    // tall. A density rule, not a hover effect, so PWA/tablet keep it too.
    "max-desktop:min-h-11",
    variantClasses[variant],
    sizeClasses[size],
    options?.fullWidth ? "w-full" : "",
    options?.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `filled` (alias `primary`), `tonal`, `outlined`, `secondary`, `text`, `ghost`, `danger`. */
  variant?: ButtonVariant;
  /** `small` (alias `sm`), `medium` (alias `md`), `large` (alias `lg`). */
  size?: ButtonSize;
  fullWidth?: boolean;
  /** In-flight action: spinner, `aria-busy`, and duplicate clicks blocked. */
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "filled",
    size = "medium",
    fullWidth = false,
    loading = false,
    disabled,
    startIcon,
    endIcon,
    children,
    className = "",
    type = "button",
    onClick,
    ...rest
  },
  ref
) {
  const canonicalSize = SIZE_ALIAS[size];

  return (
    <button
      ref={ref}
      type={type}
      // A loading button stays in the tab order (native `disabled` would
      // eject keyboard focus mid-action); the handler below blocks the
      // duplicate submit and announces the busy state.
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <ButtonSpinner className={`shrink-0 ${spinnerSizeClasses[canonicalSize]}`} />
      ) : startIcon ? (
        <span
          aria-hidden="true"
          className={[
            iconSizeClasses[canonicalSize],
            "btn-icon-start inline-flex shrink-0 items-center justify-center",
            "transition-transform duration-short3 ease-standard",
            // Leading icon leans toward the logical start edge on hover;
            // the direction itself lives in CSS so RTL cannot regress.
            "can-hover:group-hover/btn:translate-x-[var(--btn-icon-shift)]",
          ].join(" ")}
        >
          {startIcon}
        </span>
      ) : null}
      {children}
      {!loading && endIcon && (
        <span
          aria-hidden="true"
          className={[
            iconSizeClasses[canonicalSize],
            "btn-icon-end inline-flex shrink-0 items-center justify-center",
            "transition-transform duration-short3 ease-standard",
            // Trailing icon leans toward the logical end edge on hover.
            "can-hover:group-hover/btn:translate-x-[var(--btn-icon-shift)]",
          ].join(" ")}
        >
          {endIcon}
        </span>
      )}
    </button>
  );
});
