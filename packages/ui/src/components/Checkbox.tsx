"use client";

// ============================================================
// LEGALIR — Material Design 3 Checkbox
// ============================================================
// The one checkbox for the whole product.
//
// The visual is driven *entirely* by the real `<input type="checkbox">`
// through `peer-*` variants, so the box can never disagree with the
// form value: if the input is checked, the box is green with a white
// tick — there is no second source of truth to drift.
//
//   unchecked → white surface, neutral outline, no tick
//   checked   → brand green fill, WHITE tick
//   hover     → green-tinted outline
//   pressed   → slight scale-down
//   focus     → soft green ring (keyboard only)
//   disabled  → muted surface + muted outline
//   error     → red outline (green still wins once checked)
//
// The whole label region is the click target, and the tick animates
// with a short scale+fade — no bounce, no flash.
// ============================================================

import React, { forwardRef, useId } from "react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  indeterminate?: boolean;
  /** Error styling — also set automatically from `aria-invalid`. */
  error?: boolean;
  /**
   * `inline` (default) — box then label, for a form field.
   * `row` — the label on the start and the box on the end, for a selectable
   * row or card. Mirrors `SwitchRow`, so a list of settings-style choices
   * reads consistently whichever control it uses.
   */
  layout?: "inline" | "row";
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    indeterminate,
    disabled,
    error,
    layout = "inline",
    id: externalId,
    className = "",
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  const hasError = Boolean(error) || ariaInvalid === true || ariaInvalid === "true";

  const control = (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        className="peer sr-only"
        {...rest}
      />

      {/* The box. A sibling of the input, so `peer-*` variants apply. */}
      <span
        aria-hidden="true"
        className={[
          "absolute inset-0 rounded-[5px] border-2",
          "bg-control-unselected-bg",
          hasError ? "border-error" : "border-control-unselected-border",
          // Hover / pressed / focus — keyboard-only ring.
          "group-hover/check:border-control-selected",
          "group-active/check:scale-95",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-control-focus peer-focus-visible:ring-offset-1",
          "peer-disabled:bg-control-disabled-bg peer-disabled:border-control-disabled-text",
          // Checked wins over error/hover: green fill, green border.
          "peer-checked:bg-control-selected peer-checked:border-control-selected",
          "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-standard",
          // Drive the tick from the box (a sibling of the input) — a
          // `peer-checked:` on the tick itself would never match, since
          // peer variants use the sibling combinator `~`.
          "peer-checked:[&>svg]:opacity-100 peer-checked:[&>svg]:scale-100",
        ].join(" ")}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="absolute inset-0 h-full w-full scale-75 opacity-0 transition-[opacity,transform] duration-150 ease-standard"
        >
          <path
            d={indeterminate ? "M6 10h8" : "M5 10l3 3 6-6"}
            stroke="var(--control-selected-foreground)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );

  const labelText = label && (
    <span className="min-w-0 text-bodyMedium text-onSurface">{label}</span>
  );

  return (
    <label
      htmlFor={id}
      className={[
        "group/check cursor-pointer select-none",
        layout === "row"
          ? // The row is the target: label block on the start, box on the end.
            "flex w-full items-center justify-between gap-3"
          : "inline-flex items-center gap-2",
        // Touch density: below desktop the whole label region is a 44px-tall
        // tap target (WCAG 2.2 / the brief's 44×44 floor). The 20px box keeps
        // its size — only the clickable row grows. Pointer users on desktop
        // keep the compact row.
        "max-desktop:min-h-11",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {layout === "row" ? (
        <>
          {labelText}
          {control}
        </>
      ) : (
        <>
          {control}
          {labelText}
        </>
      )}
    </label>
  );
});
