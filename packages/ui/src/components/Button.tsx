"use client";

import React, { forwardRef } from "react";

type ButtonVariant = "filled" | "outlined" | "text" | "tonal";
type ButtonSize = "small" | "medium" | "large";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  filled:
    "bg-primary text-primary-on hover:state-hover focus-visible:state-focus active:state-pressed",
  outlined:
    "border border-outline text-primary hover:state-hover focus-visible:state-focus active:state-pressed",
  text: "text-primary hover:state-hover focus-visible:state-focus active:state-pressed",
  tonal:
    "bg-primary-container text-primary-on-container hover:state-hover focus-visible:state-focus active:state-pressed",
};

const sizeClasses: Record<ButtonSize, string> = {
  small: "h-9 px-3 gap-1.5 text-labelLarge",
  medium: "h-10 px-5 gap-2 text-labelLarge",
  large: "h-12 px-6 gap-2 text-labelLarge",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  small: "h-4 w-4",
  medium: "h-5 w-5",
  large: "h-5 w-5",
};

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
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center rounded-medium font-labelLarge select-none",
        "transition-all duration-short3 ease-standard",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        "disabled:opacity-[0.38] disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <svg
          className="animate-spin"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path
            d="M12 2a10 10 0 019.95 9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : startIcon ? (
        <span className={iconSizeClasses[size]} aria-hidden="true">
          {startIcon}
        </span>
      ) : null}
      {children}
      {!loading && endIcon && (
        <span className={iconSizeClasses[size]} aria-hidden="true">
          {endIcon}
        </span>
      )}
    </button>
  );
});
