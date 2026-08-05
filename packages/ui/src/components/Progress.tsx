"use client";

import React from "react";

interface ProgressLinearProps {
  value: number;
  max?: number;
  variant?: "determinate" | "indeterminate";
  /** Buffer value for upload-style progress */
  buffer?: number;
  /** Color variant */
  color?: "primary" | "secondary" | "success" | "error";
  size?: "small" | "medium";
  label?: string;
  showValue?: boolean;
  className?: string;
}

const colorClasses = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  error: "bg-error",
};

export function ProgressLinear({
  value,
  max = 100,
  variant = "determinate",
  buffer,
  color = "primary",
  size = "medium",
  label,
  showValue = false,
  className = "",
}: ProgressLinearProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const bufferPercentage = buffer ? Math.min(Math.round((buffer / max) * 100), 100) : 0;

  return (
    <div className={className} role="progressbar" aria-valuenow={variant === "determinate" ? percentage : undefined} aria-label={label}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-labelMedium text-onSurface">{label}</span>}
          {showValue && (
            <span className="text-labelSmall text-onSurfaceVariant">{percentage}%</span>
          )}
        </div>
      )}
      <div
        className={[
          "relative w-full overflow-hidden rounded-full bg-surfaceVariant",
          size === "small" ? "h-1" : "h-2",
        ].join(" ")}
      >
        {/* Buffer */}
        {buffer !== undefined && (
          <div
            className="absolute top-0 h-full bg-primary/[0.16] rounded-full transition-all duration-short3"
            style={{ width: `${bufferPercentage}%`, insetInlineStart: 0 }}
          />
        )}
        {/* Determinate fill */}
        {variant === "determinate" ? (
          <div
            className={[
              "absolute top-0 h-full rounded-full transition-all duration-medium1 ease-standard",
              colorClasses[color],
            ].join(" ")}
            style={{ width: `${percentage}%`, insetInlineStart: 0 }}
          />
        ) : (
          /* Indeterminate animation */
          <div
            className={[
              "absolute top-0 h-full rounded-full",
              colorClasses[color],
              "animate-progress-indeterminate",
            ].join(" ")}
            style={{ width: "40%" }}
          />
        )}
      </div>
    </div>
  );
}

// --- Circular Progress ---

interface ProgressCircularProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "secondary" | "success" | "error";
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressCircular({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = "primary",
  label,
  showValue = false,
  className = "",
}: ProgressCircularProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const colorMap = {
    primary: "stroke-primary",
    secondary: "stroke-secondary",
    success: "stroke-success",
    error: "stroke-error",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surfaceVariant"
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={`${colorMap[color]} transition-all duration-medium1 ease-standard`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {showValue && (
        <span className="absolute text-labelSmall text-onSurface">{percentage}%</span>
      )}
    </div>
  );
}
