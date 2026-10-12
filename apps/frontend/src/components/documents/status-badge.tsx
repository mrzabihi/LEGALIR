// ============================================================
// LEGALIR — Document Status Badge
// Color-coded badge with Persian labels for document status
// ============================================================

"use client";

import type { DocumentStatus } from "@legalir/types";

// ============================================================
// Status config map
// ============================================================

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string; pulse: boolean }
> = {
  ready: {
    label: "آماده",
    className: "bg-success-container text-success border-success",
    pulse: false,
  },
  processing: {
    label: "در حال پردازش",
    className: "bg-info-container text-info border-info",
    pulse: true,
  },
  extracting: {
    label: "استخراج متن",
    className: "bg-info-container text-info border-info",
    pulse: true,
  },
  analyzing: {
    label: "در حال تحلیل",
    className: "bg-info-container text-info border-info",
    pulse: true,
  },
  uploaded: {
    label: "بارگذاری شده",
    className: "bg-surface-container text-muted border-divider",
    pulse: false,
  },
  failed: {
    label: "خطا",
    className: "bg-error-container text-error border-error",
    pulse: false,
  },
  blocked: {
    label: "مسدود",
    className: "bg-error-container text-error border-error",
    pulse: false,
  },
  cancelled: {
    label: "لغو شده",
    className: "bg-warning-container text-warning border-warning",
    pulse: false,
  },
};

// ============================================================
// StatusBadge component
// ============================================================

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium border ${config.className} ${config.pulse ? "animate-pulse" : ""} ${className}`}
      aria-label={`وضعیت: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
