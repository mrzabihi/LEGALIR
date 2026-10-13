// ============================================================
// LEGALIR — Filter chips (MD3)
// ============================================================
// A compact, horizontally-scrollable row of single-select filter
// chips. Used for the coarse "type / status" axis on /history,
// /cases and /documents.
//
// The selected chip is marked by MORE than colour: the icon slot
// swaps to a leading checkmark, so the state is legible without hue
// (WCAG). The row scrolls inside its own area on narrow screens — it
// never pushes the page into horizontal scroll.
// ============================================================

"use client";

import { IconCheck } from "@/lib/icons";

export interface FilterChipOption {
  key: string;
  label: string;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (key: string) => void;
  /** Accessible name for the chip group, e.g. «فیلتر وضعیت». */
  ariaLabel: string;
  className?: string;
}

export function FilterChips({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: FilterChipsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`scrollbar-hide -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5 ${className}`}
    >
      {options.map((opt) => {
        const selected = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.key)}
            className={[
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-labelLarge transition-colors duration-short3",
              "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
              selected
                ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                : "border-[color:var(--color-outline-variant)] bg-surface text-on-surface-variant hover:bg-surface-hover hover:text-on-surface",
            ].join(" ")}
          >
            {selected && <IconCheck size={15} aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
