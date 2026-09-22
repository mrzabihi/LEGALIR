"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Field shell
// ============================================================
// The single source of truth for the outlined text-field look.
//
// The border lives on a real `<fieldset>` and the label sits in a
// `<legend>` — so the border is genuinely interrupted around the
// floating label (a true MD3 notch). No white background is painted
// behind the label, so it works in every theme.
//
// The floating-label motion is driven purely by CSS
// (`:placeholder-shown` + `:focus-within` + `:autofill`), so it is
// correct on the very first render for values coming from the API,
// restored drafts, browser autofill and password managers — no JS
// state, no layout shift, no hydration mismatch.
//
// The visible label is rendered by the shell itself (not by each
// field) so every field shares one label implementation. It is
// positioned relative to the *shell* — not the inner input — so the
// floated label lands exactly on the top border regardless of the
// input's own height.
// ============================================================

import React from "react";

export type FieldSize = "small" | "medium";

/** Height per size. Single-line fields are 56px (MD3). */
export const fieldSizeClasses: Record<FieldSize, string> = {
  small: "min-h-[48px]",
  medium: "min-h-[56px]",
};

/** Shared notch geometry — the legend gap and the label share this padding. */
const NOTCH_PAD = "px-1";

/** Inline-start inset of the label / notch, in px. */
const DEFAULT_INSET = 12; // start-3
const ICON_INSET = 40; // start-10 — clears a 24px leading icon + ms-3

/**
 * "The control has a value" selectors. Scoped to the real `input` /
 * `textarea` so the fieldset/legend/span siblings (which are never
 * `:placeholder-shown`) don't falsely match `:has(:not(...))`.
 */
const FILLED_NOTCH = [
  "group-has-[input:not(:placeholder-shown)]/field:max-w-full",
  "group-has-[textarea:not(:placeholder-shown)]/field:max-w-full",
  "group-has-[input:autofill]/field:max-w-full",
].join(" ");

const FILLED_LABEL = [
  "group-has-[input:not(:placeholder-shown)]/field:top-0",
  "group-has-[textarea:not(:placeholder-shown)]/field:top-0",
  "group-has-[input:autofill]/field:top-0",
].join(" ");

const FILLED_LABEL_TEXT = [
  "group-has-[input:not(:placeholder-shown)]/field:text-labelSmall",
  "group-has-[textarea:not(:placeholder-shown)]/field:text-labelSmall",
  "group-has-[input:autofill]/field:text-labelSmall",
].join(" ");

/**
 * The outlined container. Renders the notched border, the floating
 * label and the leading/trailing adornments. The consumer supplies
 * the actual `<input>` / `<textarea>` / `<select>` as `children`.
 */
export function OutlinedFieldShell({
  id,
  label,
  required,
  hasError,
  disabled,
  size = "medium",
  align = "center",
  startIcon,
  endIcon,
  endAdornment,
  labelInset,
  forceFloat = false,
  inputDir,
  className = "",
  children,
}: {
  id: string;
  label?: React.ReactNode;
  required?: boolean;
  hasError?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  /** Vertical alignment of the content row — `stretch` for textareas. */
  align?: "center" | "stretch";
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  /** Interactive trailing slot (e.g. password toggle) — not aria-hidden. */
  endAdornment?: React.ReactNode;
  /**
   * Force the *content* (leading adornment + input) into LTR. Use for
   * value types that read left-to-right — phone numbers, emails — so
   * the leading adornment sits on the left, ahead of the digits,
   * instead of being stranded on the opposite side of an RTL shell.
   * The label and notch keep their natural page direction (RTL).
   */
  inputDir?: "ltr" | "rtl";
  /**
   * Override the inline-start inset (px) of the label + notch. Use
   * when a leading adornment is wider than a standard 24px icon.
   */
  labelInset?: number;
  /**
   * Force the label into its floated position. Needed for controls
   * that have no `:placeholder-shown` state (e.g. `<select>`), where
   * the CSS "has a value" selectors cannot detect a chosen option.
   */
  forceFloat?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const borderClasses = hasError
    ? "border-error group-focus-within/field:border-error"
    : "border-outline group-focus-within/field:border-primary";

  // The label + notch always follow the page direction (RTL), so they only
  // need to clear a leading icon when that icon sits on the same side — i.e.
  // when the content is NOT forced LTR.
  const inset = labelInset ?? (startIcon && !inputDir ? ICON_INSET : DEFAULT_INSET);
  const isStretch = align === "stretch";

  return (
    <div
      className={[
        "group/field relative flex gap-2 rounded-small",
        // LTR content in an RTL page: reverse the flex order so the leading
        // adornment still lands on the left while the label + notch keep
        // their natural RTL (right) anchor.
        inputDir === "ltr" ? "flex-row-reverse" : "",
        isStretch ? "items-stretch" : "items-center",
        isStretch ? "" : fieldSizeClasses[size],
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Real MD3 notch: the fieldset draws the border, the legend
          opens a gap in it sized to the label. The legend's start
          padding matches the label inset so the gap lines up with
          the floated label exactly. */}
      {label && (
        <fieldset
          aria-hidden="true"
          style={{ paddingInlineStart: inset - 4, paddingInlineEnd: 8 }}
          className={[
            "pointer-events-none absolute inset-0 m-0 rounded-small border",
            "transition-colors duration-short3 ease-standard",
            borderClasses,
          ].join(" ")}
        >
          <legend
            className={[
              "block h-0 max-w-[0.01px] overflow-hidden whitespace-nowrap",
              "text-labelSmall transition-[max-width] duration-short3 ease-standard",
              "group-focus-within/field:max-w-full",
              forceFloat ? "max-w-full" : "",
              FILLED_NOTCH,
            ].join(" ")}
          >
            {/* The notch padding lives on the inner span (not the legend) so
                the collapsed legend can shrink to ~0.01px — otherwise the
                legend's own padding would hold the border gap open even when
                the label sits inside the field. */}
            <span className={["inline-block opacity-0", NOTCH_PAD].join(" ")}>
              {label}
              {required && " *"}
            </span>
          </legend>
        </fieldset>
      )}

      {startIcon && (
        <span
          dir={inputDir}
          className={[
            "shrink-0 text-onSurfaceVariant",
            // `ms-3` resolves to margin-right in RTL, so once the row is
            // reversed for LTR content the adornment ends up flush against
            // the border — add a physical left inset to match the label.
            inputDir === "ltr" ? "me-3 ms-3" : "ms-3",
          ].join(" ")}
          aria-hidden="true"
        >
          {startIcon}
        </span>
      )}

      <div dir={inputDir} className="relative flex min-w-0 flex-1 items-center">
        {children}
      </div>

      {endAdornment && <span className="me-1 shrink-0">{endAdornment}</span>}
      {endIcon && (
        <span className="me-3 shrink-0 text-onSurfaceVariant" aria-hidden="true">
          {endIcon}
        </span>
      )}

      {label && (
        <FloatingLabel
          htmlFor={id}
          hasError={hasError}
          disabled={disabled}
          inset={inset}
          align={align}
          forceFloat={forceFloat}
        >
          {label}
          {required && <span className="text-error"> *</span>}
        </FloatingLabel>
      )}
    </div>
  );
}

/**
 * The floating label. Positioned relative to the shell: it rests
 * vertically centred inside the field and lifts onto the top border
 * when focused, filled or autofilled.
 *
 * It is a real `<label htmlFor>` (not `pointer-events-none`) so a
 * click on it focuses the input.
 */
export function FloatingLabel({
  htmlFor,
  children,
  hasError,
  disabled,
  inset = DEFAULT_INSET,
  align = "center",
  forceFloat = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hasError?: boolean;
  disabled?: boolean;
  inset?: number;
  align?: "center" | "stretch";
  forceFloat?: boolean;
}) {
  const color = hasError
    ? "text-error"
    : disabled
      ? "text-onSurfaceVariant"
      : "text-onSurfaceVariant group-focus-within/field:text-primary";

  // Resting position: centred for single-line fields, near the first
  // line for textareas.
  const resting = align === "stretch" ? "top-4" : "top-1/2 -translate-y-1/2";

  return (
    <label
      htmlFor={htmlFor}
      style={{ insetInlineStart: inset }}
      className={[
        "absolute z-[1] cursor-text",
        "text-bodyMedium transition-all duration-short3 ease-standard",
        color,
        forceFloat ? "top-0 text-labelSmall" : resting,
        // Lifted (focused / filled / autofilled) — lands on the top border.
        "group-focus-within/field:top-0 group-focus-within/field:text-labelSmall",
        FILLED_LABEL,
        FILLED_LABEL_TEXT,
      ].join(" ")}
    >
      {children}
    </label>
  );
}

/**
 * Supporting text row — error message, helper text and/or a
 * character counter. Always reserves a line so showing an error
 * never shifts the surrounding form grid.
 */
export function FieldMessage({
  id,
  error,
  helper,
  counter,
  reserveSpace = true,
}: {
  id?: string;
  error?: React.ReactNode;
  helper?: React.ReactNode;
  counter?: React.ReactNode;
  reserveSpace?: boolean;
}) {
  const hasContent = Boolean(error || helper || counter);
  if (!hasContent && !reserveSpace) return null;

  return (
    <div
      className={[
        "flex items-start justify-between gap-2 px-3",
        reserveSpace ? "min-h-[20px] mt-1" : "mt-1",
      ].join(" ")}
    >
      {error ? (
        <p id={id} className="text-labelSmall text-error" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={id} className="text-labelSmall text-onSurfaceVariant">
          {helper}
        </p>
      ) : (
        <span />
      )}
      {counter && (
        <span className="shrink-0 text-labelSmall text-onSurfaceVariant">{counter}</span>
      )}
    </div>
  );
}
