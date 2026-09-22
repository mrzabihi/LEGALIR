"use client";

// ============================================================
// LEGALIR — Selectable option & card
// ============================================================
// The one "pick one of these" control family.
//
// Both share the same selection language, driven by the `--control-*`
// tokens so the brand green lives in exactly one place:
//
//   unselected → white/light surface, neutral border
//   selected   → subtle green tonal surface, green border, green tick
//
// The selected state is a *tonal* treatment — never a large card
// flooded with dark green — so the title stays readable and the
// control still reads as a surface, not a button.
//
// `SelectableOption` is the compact chip form (filters, tags,
// specializations). `SelectableCard` is the block form (category /
// contract-type pickers) with an optional leading icon and
// description.
// ============================================================

import React from "react";

/** Small green tick shown on a selected control. */
function SelectedTick({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 10l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ------------------------------------------------------------
// SelectableOption — compact chip
// ------------------------------------------------------------

export interface SelectableOptionProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  label: React.ReactNode;
  selected?: boolean;
  startIcon?: React.ReactNode;
  /** Show a leading tick when selected. Default true. */
  showTick?: boolean;
}

export function SelectableOption({
  label,
  selected = false,
  startIcon,
  showTick = true,
  disabled,
  className = "",
  ...rest
}: SelectableOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        "text-caption font-medium transition-colors duration-150 ease-standard touch-target",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/40",
        selected
          ? "border-control-selected-border bg-control-selected-surface text-control-selected"
          : "border-control-unselected-border bg-control-unselected-bg text-onSurfaceVariant hover:border-control-selected/50 hover:text-onSurface",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {selected && showTick && <SelectedTick className="h-3.5 w-3.5 shrink-0" />}
      {startIcon && <span className="h-4 w-4 shrink-0">{startIcon}</span>}
      {label}
    </button>
  );
}

// ------------------------------------------------------------
// SelectableCard — block option
// ------------------------------------------------------------

export interface SelectableCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect" | "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  selected?: boolean;
  /** Leading adornment — an icon or a circular badge. */
  icon?: React.ReactNode;
  /** Trailing slot; defaults to a green tick when selected. */
  trailing?: React.ReactNode;
  /** Show the default trailing tick when selected. Default true. */
  showTick?: boolean;
}

export function SelectableCard({
  title,
  description,
  selected = false,
  icon,
  trailing,
  showTick = true,
  disabled,
  className = "",
  ...rest
}: SelectableCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={[
        "flex w-full items-start gap-3 rounded-large border-2 p-4 text-start",
        "transition-colors duration-150 ease-standard touch-target",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/40",
        selected
          ? "border-control-selected-border bg-control-selected-surface"
          : "border-control-unselected-border bg-control-unselected-bg hover:border-control-selected/40",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon && (
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-0.5 transition-colors duration-150",
            selected
              ? "bg-control-selected text-control-selected-foreground"
              : "bg-surfaceVariant text-onSurfaceVariant",
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={[
            "block text-labelLarge",
            selected ? "text-control-selected font-medium" : "text-onSurface",
          ].join(" ")}
        >
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-bodySmall text-muted">{description}</span>
        )}
      </span>

      {trailing ??
        (selected && showTick ? (
          <SelectedTick className="mt-1 h-5 w-5 shrink-0 text-control-selected" />
        ) : null)}
    </button>
  );
}
