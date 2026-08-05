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
    className: "bg-green-100 text-green-800 border-green-200",
    pulse: false,
  },
  processing: {
    label: "در حال پردازش",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    pulse: true,
  },
  extracting: {
    label: "استخراج متن",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    pulse: true,
  },
  analyzing: {
    label: "در حال تحلیل",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    pulse: true,
  },
  uploaded: {
    label: "بارگذاری شده",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    pulse: false,
  },
  failed: {
    label: "خطا",
    className: "bg-red-100 text-red-800 border-red-200",
    pulse: false,
  },
  blocked: {
    label: "مسدود",
    className: "bg-red-100 text-red-800 border-red-200",
    pulse: false,
  },
  cancelled: {
    label: "لغو شده",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
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
