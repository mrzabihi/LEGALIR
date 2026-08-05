"use client";

import React from "react";

type ChipVariant = "filled" | "outlined";

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  selected?: boolean;
  disabled?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  startIcon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const variantClasses = {
  filled: {
    default: "bg-surfaceVariant text-onSurfaceVariant",
    selected: "bg-primaryContainer text-onPrimaryContainer",
  },
  outlined: {
    default: "border border-outline text-onSurfaceVariant",
    selected: "border border-primary text-primary bg-primary/[0.08]",
  },
};

export function Chip({
  label,
  variant = "filled",
  selected = false,
  disabled = false,
  removable = false,
  onRemove,
  startIcon,
  onClick,
  className = "",
}: ChipProps) {
  const isInteractive = Boolean(onClick);
  const Tag = isInteractive ? "button" : "span";

  return (
    <Tag
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-full",
        "text-labelMedium transition-all duration-short3",
        selected ? variantClasses[variant].selected : variantClasses[variant].default,
        isInteractive
          ? "cursor-pointer hover:state-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
          : "",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ].join(" ")}
    >
      {startIcon && <span className="h-4 w-4 shrink-0">{startIcon}</span>}
      {label}
      {removable && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onRemove?.();
            }
          }}
          className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-onSurface/[0.12] cursor-pointer -me-0.5"
          aria-label={`حذف ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </span>
      )}
    </Tag>
  );
}
