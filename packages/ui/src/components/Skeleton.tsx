"use client";

import React from "react";

interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
  className?: string;
}

const variantDefaults = {
  text: { width: "100%", height: "16px" },
  circular: { width: "48px", height: "48px" },
  rectangular: { width: "100%", height: "100px" },
};

const animationClasses = {
  pulse: "animate-pulse",
  wave: "animate-skeleton-wave",
  none: "",
};

export function Skeleton({
  variant = "text",
  width,
  height,
  animation = "pulse",
  className = "",
}: SkeletonProps) {
  const defaults = variantDefaults[variant];

  return (
    <div
      aria-hidden="true"
      className={[
        "bg-surfaceVariant rounded-small",
        animationClasses[animation],
        variant === "circular" ? "rounded-full" : "",
        className,
      ].join(" ")}
      style={{
        width: width ?? defaults.width,
        height: height ?? defaults.height,
      }}
    />
  );
}

/** Common skeleton patterns */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 space-y-3" aria-hidden="true">
      <Skeleton variant="rectangular" height="120px" className="rounded-medium" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="60%" />
      {lines > 2 && <Skeleton variant="text" width="40%" />}
    </div>
  );
}

export function SkeletonList({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="30%" />
          </div>
        </div>
      ))}
    </div>
  );
}
