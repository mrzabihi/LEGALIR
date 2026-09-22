"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Select
// ============================================================
// Native `<select>` styled as an MD3 outlined field with a floating
// label. The label lifts into the border notch whenever a real
// option is chosen (a placeholder option counts as "empty").
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
  // so the label floats correctly on first render (API/draft values).
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
        forceFloat={hasValue}
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
            "peer w-full appearance-none bg-transparent px-3",
            "text-onSurface border-none outline-none",
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
