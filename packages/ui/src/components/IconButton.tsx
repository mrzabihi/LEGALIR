"use client";

import React, { forwardRef } from "react";

type IconButtonVariant = "standard" | "filled" | "tonal";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: "small" | "medium" | "large";
  label: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  standard:
    "text-onSurfaceVariant hover:bg-onSurface/[0.08] focus-visible:bg-onSurface/[0.12] active:bg-onSurface/[0.12]",
  filled: "bg-primary text-onPrimary hover:state-hover focus-visible:state-focus active:state-pressed",
  tonal:
    "bg-primaryContainer text-onPrimaryContainer hover:state-hover focus-visible:state-focus active:state-pressed",
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
  { variant = "standard", size = "medium", label, children, className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      className={[
        "inline-flex items-center justify-center",
        "transition-all duration-short3 ease-standard",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        "disabled:opacity-[0.38] disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span className={iconSizeClasses[size]} aria-hidden="true">
        {children}
      </span>
    </button>
  );
});
