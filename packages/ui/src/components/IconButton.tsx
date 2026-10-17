"use client";

// ============================================================
// LEGALIR — IconButton (compact, labelled actions)
// ============================================================
// Same interaction language as the shared Button: an MD3 state layer on
// hover/press, a brand ring on keyboard focus, and a hard block while a
// request is in flight. `label` is required by the type, so an icon-only
// control can never ship without an accessible name.
//
// Icon-only buttons are reserved for low-stakes, well-understood actions
// (close, download, retry). Anything that saves, pays or deletes uses the
// text Button so the action is unambiguous in Persian.
// ============================================================

import React, { forwardRef } from "react";

type IconButtonVariant = "standard" | "filled" | "tonal" | "danger";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: "small" | "medium" | "large";
  /** Accessible name. Required — an icon alone is never a name. */
  label: string;
  /** In-flight action: spinner replaces the icon and clicks are blocked. */
  loading?: boolean;
}

const variantClasses: Record<IconButtonVariant, string> = {
  standard: "text-on-surface-variant",
  filled: "bg-primary text-primary-on shadow-elevation-1",
  tonal: "bg-primary-container text-primary-on-container",
  danger: "bg-error-container text-on-error-container",
};

const sizeClasses = {
  small: "h-9 w-9 rounded-medium",
  medium: "h-12 w-12 rounded-full",
  large: "h-14 w-14 rounded-full",
};

const iconSizeClasses = {
  small: "h-4 w-4",
  medium: "h-6 w-6",
  large: "h-7 w-7",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = "standard",
    size = "medium",
    label,
    loading = false,
    disabled,
    children,
    className = "",
    type = "button",
    onClick,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
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
      className={[
        "relative isolate inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
        "transition-[background-color,color,box-shadow,transform] duration-short3 ease-standard",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-current",
        "before:opacity-0 before:transition-opacity before:duration-short3 before:ease-standard",
        "can-hover:hover:before:opacity-[0.08] active:before:opacity-[0.12]",
        "active:scale-[0.96]",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
        // 44px minimum hit area on touch-sized viewports only.
        "max-desktop:min-h-11 max-desktop:min-w-11",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span className={iconSizeClasses[size]} aria-hidden="true">
        {loading ? (
          <svg className="h-full w-full animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path
              d="M12 2a10 10 0 019.95 9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          children
        )}
      </span>
    </button>
  );
});
