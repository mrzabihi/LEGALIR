// ============================================================
// LEGALIR — Segmented control (Material 3)
// ============================================================
// A single-choice control for switching between two or more PEER views
// *in place* — it selects, it does not navigate. This is deliberately
// distinct from `Tabs` (an underline tab bar): it is the filled MD3
// segmented button group — a rounded track with the selected segment
// raised on its own surface chip.
//
// Accessibility: a real `tablist`. Each segment is a `tab` carrying
// `aria-selected`; supply `idBase` and the paired panel is wired with
// `aria-controls` / `aria-labelledby`. A roving tabindex plus the
// Arrow / Home / End keys move selection, and the arrow direction
// honours RTL — the visual "next" segment flips with the document.
// ============================================================

"use client";

import React, { useCallback, useRef } from "react";

export interface SegmentItem {
  value: string;
  label: string;
  /** Optional trailing count/label, rendered as a neutral pill. */
  badge?: number | string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  segments: SegmentItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the tablist. */
  ariaLabel?: string;
  /**
   * Prefix for the generated tab/panel id pair
   * (`${idBase}-tab-${value}` / `${idBase}-panel-${value}`). Supply it when
   * the control owns a panel so assistive tech can link the two.
   */
  idBase?: string;
  /** Stretch the control to fill its container (equal-width segments). */
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl({
  segments,
  value,
  onChange,
  ariaLabel,
  idBase,
  fullWidth = false,
  className = "",
}: SegmentedControlProps) {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const moveTo = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (!segment || segment.disabled) return;
      onChange(segment.value);
      refs.current.get(segment.value)?.focus();
    },
    [segments, onChange]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = segments.findIndex((segment) => segment.value === value);
    if (current < 0) return;

    // In RTL the visual order runs right → left, so "next" is ArrowLeft.
    const el = refs.current.get(value);
    const rtl = el ? getComputedStyle(el).direction === "rtl" : false;
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";

    let target = -1;
    if (event.key === nextKey) target = (current + 1) % segments.length;
    else if (event.key === prevKey) target = (current - 1 + segments.length) % segments.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = segments.length - 1;

    if (target >= 0) {
      event.preventDefault();
      moveTo(target);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className={[
        "inline-flex items-center gap-1 rounded-full bg-surface-container-high p-1",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${segment.value}` : undefined}
            aria-selected={selected}
            aria-controls={idBase ? `${idBase}-panel-${segment.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={segment.disabled}
            ref={(el) => {
              if (el) refs.current.set(segment.value, el);
              else refs.current.delete(segment.value);
            }}
            onClick={() => onChange(segment.value)}
            className={[
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-center",
              "text-labelLarge leading-tight transition-all duration-short4 ease-standard",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-container-high)]",
              "disabled:pointer-events-none disabled:opacity-[0.38]",
              selected
                ? "bg-surface font-semibold text-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            {segment.label}
            {segment.badge !== undefined && (
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
                  selected
                    ? "bg-primary/[0.12] text-primary"
                    : "bg-on-surface/[0.08] text-on-surface-variant",
                ].join(" ")}
              >
                {segment.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
