"use client";

import React from "react";

type BadgeVariant = "error" | "warning" | "success" | "info" | "neutral";

interface BadgeProps {
  content?: React.ReactNode;
  variant?: BadgeVariant;
  /** Dot mode — just a colored dot, no content */
  dot?: boolean;
  /** Max visible number before showing "+" */
  max?: number;
  children?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  error: "bg-error text-onError",
  warning: "bg-warning text-onWarning",
  success: "bg-success text-onSuccess",
  info: "bg-info text-white",
  neutral: "bg-surfaceVariant text-onSurfaceVariant",
};

export function Badge({
  content,
  variant = "error",
  dot = false,
  max = 99,
  children,
  className = "",
}: BadgeProps) {
  const displayValue =
    typeof content === "number" && content > max
      ? `${max}+`
      : content;

  return (
    <span className="relative inline-flex">
      {children}
      {(content !== undefined || dot) && (
        <span
          className={[
            "absolute",
            dot
              ? "w-2 h-2 rounded-full -top-0.5 -end-0.5"
              : "min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full -top-1.5 -end-1.5",
            "text-labelSmall font-bold",
            variantClasses[variant],
            className,
          ].join(" ")}
        >
          {dot ? null : displayValue}
        </span>
      )}
    </span>
  );
}
