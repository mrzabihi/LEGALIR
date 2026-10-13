// ============================================================
// LEGALIR — Document status badge
// ============================================================
// The document surfaces' status badge, now backed by the SHARED
// tone-based badge so documents read with the exact same status
// vocabulary as /history, /cases and /contracts. It keeps its original
// `{ status }` call signature, so existing call sites are untouched.
//
// A processing state keeps a subtle pulse to signal "live work"; every
// label is text, so a status is never carried by colour alone.
// ============================================================

"use client";

import type { DocumentStatus } from "@legalir/types";
import { StatusBadge as SharedStatusBadge, type StatusTone } from "@/components/shared";

const DOC_STATUS: Record<DocumentStatus, { label: string; tone: StatusTone; pulse: boolean }> = {
  ready: { label: "آماده", tone: "success", pulse: false },
  processing: { label: "در حال پردازش", tone: "info", pulse: true },
  extracting: { label: "استخراج متن", tone: "info", pulse: true },
  analyzing: { label: "در حال تحلیل", tone: "info", pulse: true },
  uploaded: { label: "بارگذاری شده", tone: "neutral", pulse: false },
  failed: { label: "خطا", tone: "error", pulse: false },
  blocked: { label: "مسدود", tone: "error", pulse: false },
  cancelled: { label: "لغو شده", tone: "warning", pulse: false },
};

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = DOC_STATUS[status];

  return (
    <SharedStatusBadge
      label={config.label}
      tone={config.tone}
      className={`${config.pulse ? "animate-pulse" : ""} ${className}`.trim()}
    />
  );
}
