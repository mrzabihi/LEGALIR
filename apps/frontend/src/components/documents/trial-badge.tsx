"use client";

// ============================================================
// LEGALIR — Trial badge (نمونهٔ آزمایشی)
// ============================================================
// The single, reusable marker for every surface that renders trial
// (demo-scenario) data on the document-review page. It carries BOTH an
// icon and text — never colour alone (accessibility rule) — and an
// optional one-line explanation so "trial" is unambiguous in context.
// ============================================================

import { IconSparkle } from "@/lib/icons";

interface TrialBadgeProps {
  /** Extra classes, e.g. to align it in a header row. */
  className?: string;
  /**
   * The label text. Defaults to the canonical «نمونهٔ آزمایشی»; pass a
   * scenario-specific string (e.g. «نمونهٔ آزمایشی — اجاره‌نامهٔ مسکونی»)
   * when the scenario matters for context.
   */
  label?: string;
  /** Show the one-line disclaimer under the label. */
  withNote?: boolean;
}

export function TrialBadge({ className = "", label, withNote = false }: TrialBadgeProps) {
  const text = label ?? "نمونهٔ آزمایشی";
  return (
    <span className={`inline-flex flex-col items-start gap-0.5 ${className}`}>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-caption font-medium text-secondary-700"
        role="status"
      >
        <IconSparkle size={13} aria-hidden="true" className="shrink-0" />
        {text}
      </span>
      {withNote && (
        <span className="text-caption text-muted">
          دادهٔ نمایشی برای تست محصول است و تحلیل حقوقی معتبر نیست.
        </span>
      )}
    </span>
  );
}
