"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Select
// ============================================================
// Native `<select>` styled as an MD3 outlined field.
//
// The label is ALWAYS floated onto the border notch. A native select
// has no `:placeholder-shown` state, so a resting label would sit on
// top of the placeholder/value text — the overlap this component
// exists to prevent. With the label pinned to the notch, the value
// area is free to show either the muted placeholder or the chosen
// option, with real vertical separation between the two.
//
//   ┌──── نوع فعالیت ─────────────┐
//   │ انتخاب کنید               ▼ │
//   └─────────────────────────────┘
// ============================================================

import React, { forwardRef, useId, useState } from "react";
import { OutlinedFieldShell, FieldMessage, type FieldSize } from "./field-shell";

interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  supportingText?: string;
  errorMessage?: string;
  error?: boolean;
  /** Legacy aliases. */
  helperText?: string;
  errorText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  selectSize?: FieldSize;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    supportingText,
    errorMessage,
    error,
    helperText,
    errorText,
    options,
    placeholder,
    fullWidth = false,
    selectSize = "medium",
    disabled,
    value,
    defaultValue,
    onChange,
    id: externalId,
    className = "",
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  const resolvedError = errorMessage ?? errorText;
  const resolvedHelper = supportingText ?? helperText;
  const hasError = Boolean(resolvedError) || Boolean(error);

  const errorId = resolvedError ? `${id}-error` : undefined;
  const helperId = resolvedHelper && !resolvedError ? `${id}-helper` : undefined;

  // Track "has a real value" for both controlled and uncontrolled use
  // so the placeholder can be muted until a choice is made.
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    String(defaultValue ?? "")
  );
  const currentValue = isControlled ? String(value ?? "") : internalValue;
  const hasValue = currentValue !== "";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  return (
    <div className={fullWidth ? "w-full" : "inline-flex w-64 flex-col"}>
      <OutlinedFieldShell
        id={id}
        label={label}
        hasError={hasError}
        disabled={disabled}
        size={selectSize}
        // Always floated: the label must never sit on the value text.
        forceFloat
        className={className}
      >
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          value={isControlled ? value : internalValue}
          defaultValue={isControlled ? undefined : defaultValue}
          onChange={handleChange}
          aria-invalid={hasError || undefined}
          aria-describedby={errorId || helperId}
          className={[
            "peer w-full appearance-none bg-transparent",
            // The shell already insets the content row by `ps-3`; only
            // the inline-end needs extra room to clear the chevron.
            "ps-0 pe-8",
            "border-none outline-none",
            hasValue ? "text-onSurface" : "text-onSurfaceVariant",
            selectSize === "small" ? "text-bodySmall py-1.5" : "text-bodyMedium py-1.5",
            disabled ? "" : "cursor-pointer",
          ].join(" ")}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron — sits on the inline-end edge in both LTR and RTL. */}
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-onSurfaceVariant"
          style={{ insetInlineEnd: "12px" }}
          aria-hidden="true"
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </span>
      </OutlinedFieldShell>

      <FieldMessage
        id={errorId || helperId}
        error={resolvedError}
        helper={resolvedHelper}
      />
    </div>
  );
});
