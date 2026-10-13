// ============================================================
// LEGALIR — Results bar
// ============================================================
// The quiet line that sits directly above a list: "how many results"
// on one side, and the currently-active, individually-removable
// filters plus a «پاک کردن همه» reset on the other. Every list
// surface uses it so the reader always knows both what they are
// looking at and how it has been narrowed.
// ============================================================

"use client";

import { IconClose } from "@/lib/icons";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface ResultsBarProps {
  /** The result count line, e.g. «۱۲ نتیجه» (already formatted). */
  countLabel: string;
  filters?: ActiveFilter[];
  onClearAll?: () => void;
  /** Label for the reset button. Default «پاک کردن همه». */
  clearLabel?: string;
  className?: string;
}

export function ResultsBar({
  countLabel,
  filters = [],
  onClearAll,
  clearLabel = "پاک کردن همه",
  className = "",
}: ResultsBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 ${className}`}>
      <span className="text-body-2 text-on-surface-variant">{countLabel}</span>

      {filters.length > 0 && (
        <span aria-hidden="true" className="text-divider">
          ·
        </span>
      )}

      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={f.onRemove}
          aria-label={`حذف فیلتر ${f.label}`}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-2.5 text-caption text-on-surface transition-colors duration-short3 hover:border-error hover:text-error focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          {f.label}
          <IconClose size={12} aria-hidden="true" />
        </button>
      ))}

      {filters.length > 0 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-caption font-medium text-[color:var(--brand-fg)] hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
