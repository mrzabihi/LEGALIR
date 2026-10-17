"use client";

// ============================================================
// LEGALIR — Material Design 3 Switch (the one boolean control)
// ============================================================
// Every "on / off" decision in the product renders through this file:
//
//   ON  → brand-green track + white thumb at the END   · label «فعال»
//   OFF → brick-red track   + white thumb at the START · label «غیرفعال»
//
// The state is stated three ways — thumb position, colour, and a
// Persian text label — so it never depends on colour alone.
//
// Both track colour and thumb position are driven by the real
// `<input>` through `peer-*`, so the visual can never disagree with
// the value. The thumb uses logical flex order plus an RTL-mirrored
// translate, so it always travels toward the far edge of the track in
// both RTL and LTR.
//
// Interaction states
//   hover    → subtle surface tint (row layout)
//   focus    → 2px brand ring + offset (keyboard only)
//   pressed  → thumb compresses slightly
//   saving   → input locked, spinner + «در حال ذخیره…» replaces the label
//   error    → red message under the row, announced politely
//   disabled → the reason is rendered as text, not hidden in a tooltip
// ============================================================

import React, { forwardRef, useId, useState } from "react";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Visible label. Omit only when the caller supplies `aria-label`. */
  label?: React.ReactNode;
  /** Secondary line under the label (row layout). */
  description?: React.ReactNode;
  /** Render the visible «فعال»/«غیرفعال» text next to the track. Default true. */
  showState?: boolean;
  /** Text shown when ON. Default «فعال». */
  onLabel?: string;
  /** Text shown when OFF. Default «غیرفعال». */
  offLabel?: string;
  /**
   * `state` — an enable/disable decision: OFF is red.
   * `selection` — an "included / selected" flag: OFF is neutral, because a
   * long list of unselected rows painted red reads as errors, not choices.
   */
  tone?: "state" | "selection";
  /** A mutation is in flight: locks the input and shows «در حال ذخیره…». */
  saving?: boolean;
  /** Server/permission error to show under the row. */
  error?: string | null;
  /** Why the switch is disabled — rendered as text so everyone can read it. */
  disabledReason?: string;
  /** `inline` (track then label) or `row` (label block, then track). */
  layout?: "inline" | "row";
}

const SAVING_TEXT = "در حال ذخیره…";

/** Spinner used in the saving state. */
function InlineSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    description,
    showState = true,
    onLabel = "فعال",
    offLabel = "غیرفعال",
    tone = "state",
    saving = false,
    error,
    disabledReason,
    layout = "inline",
    disabled,
    id: externalId,
    className = "",
    checked,
    defaultChecked,
    onChange,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  // Mirror the real input's state so `aria-checked` can never drift from
  // the visual, whether the switch is controlled or uncontrolled.
  const [isChecked, setIsChecked] = useState(Boolean(checked ?? defaultChecked));
  const resolvedChecked = checked !== undefined ? Boolean(checked) : isChecked;

  const isBlocked = Boolean(disabled) || saving;

  // OFF colour language: red for enablement, neutral for selection.
  const offTrack =
    tone === "state"
      ? "bg-control-off border-control-off-border"
      : "bg-control-unselected-bg border-control-unselected-border";

  const stateText = resolvedChecked ? onLabel : offLabel;
  const stateTone = resolvedChecked
    ? "text-control-selected-text"
    : tone === "state"
      ? "text-control-off-text"
      : "text-muted";

  const input = (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      id={id}
      disabled={isBlocked}
      checked={checked}
      defaultChecked={defaultChecked}
      aria-checked={resolvedChecked}
      aria-busy={saving || undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      onChange={(e) => {
        if (checked === undefined) setIsChecked(e.target.checked);
        onChange?.(e);
      }}
      className="peer sr-only"
      {...rest}
    />
  );

  // `input` and the track are siblings, so `peer-focus-visible` on the track
  // reacts to real keyboard focus. The thumb's travel is driven by the same
  // resolved state as the label, so all three signals flip together.
  const control = (
    <span className="inline-flex items-center gap-2.5">
      {input}
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 p-0.5",
          "transition-[background-color,border-color,box-shadow] duration-short3 ease-standard",
          resolvedChecked
            ? "bg-control-selected border-control-selected"
            : offTrack,
          "peer-focus-visible:ring-2 peer-focus-visible:ring-control-focus",
          "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface",
          isBlocked ? "opacity-60" : "",
          // Thumb — white in both states, slides on the same short ease.
          // The track's flex row follows the writing direction, so the thumb
          // starts at the logical start edge; the translate is mirrored under
          // `rtl:` so it always travels to the far edge.
          "after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-elevation-1",
          "after:transition-transform after:duration-short3 after:ease-standard",
          resolvedChecked
            ? "after:translate-x-5 rtl:after:-translate-x-5"
            : "after:translate-x-0",
          "group-active/switch:after:scale-90",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {saving ? (
        // Visually shown, but hidden from the accessibility tree: the control's
        // accessible name must stay the label, and the progress message is
        // announced once through the `role="status"` region below.
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-caption text-muted"
        >
          <InlineSpinner />
          {SAVING_TEXT}
        </span>
      ) : (
        showState && (
          <span
            aria-hidden="true"
            className={`whitespace-nowrap text-caption font-medium transition-colors duration-short2 ${stateTone}`}
          >
            {stateText}
          </span>
        )
      )}
    </span>
  );

  const message =
    error || (disabled && disabledReason) ? (
      <span
        id={error ? `${id}-error` : undefined}
        role={error ? "alert" : undefined}
        className={`block text-caption ${error ? "text-error" : "text-muted"}`}
      >
        {error ?? disabledReason}
      </span>
    ) : null;

  // ---- Row layout: label block on the start, control on the end ----------
  if (layout === "row") {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label
          htmlFor={id}
          className={[
            "group/switch -mx-2 flex select-none items-start justify-between gap-4",
            "rounded-medium px-2 py-2.5 transition-colors",
            disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover",
          ].join(" ")}
        >
          <span className="min-w-0 flex-1">
            {label && (
              <span
                className={`block text-bodyMedium ${
                  disabled ? "text-muted" : "text-onSurface"
                }`}
              >
                {label}
              </span>
            )}
            {description && (
              <span className="mt-0.5 block text-caption text-muted">{description}</span>
            )}
          </span>
          <span className="touch-target-pad mt-0.5 shrink-0">{control}</span>
        </label>
        {message}
        {saving && (
          <span role="status" className="sr-only">
            {SAVING_TEXT}
          </span>
        )}
      </div>
    );
  }

  // ---- Inline layout: control then label --------------------------------
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={id}
        className={[
          "group/switch inline-flex select-none items-center gap-2.5",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span className={disabled ? "touch-target-pad opacity-60" : "touch-target-pad"}>
          {control}
        </span>
        {label && (
          <span className={`text-bodyMedium ${disabled ? "text-muted" : "text-onSurface"}`}>
            {label}
          </span>
        )}
      </label>
      {message}
      {saving && (
        <span role="status" className="sr-only">
          {SAVING_TEXT}
        </span>
      )}
    </div>
  );
});

/**
 * Card-row form of the switch: title → description → state → control.
 * Used by settings pages, drawers and any card that owns one boolean.
 */
export const SwitchRow = forwardRef<HTMLInputElement, SwitchProps>(function SwitchRow(
  props,
  ref
) {
  return <Switch ref={ref} layout="row" {...props} />;
});
