"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Text Field
// ============================================================
// Floating-label text input. The label rests inside the field when
// empty and lifts into a real border notch on focus / fill /
// autofill. Behaviour is CSS-driven (see field-shell.tsx) so it is
// correct from the first paint for API values, restored drafts and
// browser autofill.
//
// Backward compatible: the legacy prop names (`helperText`,
// `errorText`, `startIcon`, `endIcon`, `inputSize`, `variant`) are
// still accepted alongside the MD3 names (`supportingText`,
// `errorMessage`, `leadingIcon`, `trailingIcon`).
// ============================================================

import React, { forwardRef, useId } from "react";
import {
  OutlinedFieldShell,
  FieldMessage,
  type FieldSize,
} from "./field-shell";

type TextFieldVariant = "filled" | "outlined";

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  /** MD3 name for helper text. */
  supportingText?: string;
  /** MD3 name for the error message. */
  errorMessage?: string;
  /** Boolean error state without a message. */
  error?: boolean;
  /** Legacy alias for `supportingText`. */
  helperText?: string;
  /** Legacy alias for `errorMessage`. */
  errorText?: string;
  variant?: TextFieldVariant;
  inputSize?: FieldSize;
  fullWidth?: boolean;
  /** MD3 name for a leading adornment. */
  leadingIcon?: React.ReactNode;
  /** MD3 name for a trailing adornment. */
  trailingIcon?: React.ReactNode;
  /** Legacy aliases for the adornments. */
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  /** Interactive trailing slot (e.g. a clear button) — not aria-hidden. */
  endAdornment?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Display character count if maxLength provided */
  showCharCount?: boolean;
  /** Force the value direction (e.g. `ltr` for phone/email). */
  inputDir?: "ltr" | "rtl";
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    supportingText,
    errorMessage,
    error,
    helperText,
    errorText,
    variant = "outlined",
    inputSize = "medium",
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    startIcon,
    endIcon,
    endAdornment,
    prefix,
    suffix,
    showCharCount,
    disabled,
    readOnly,
    required,
    maxLength,
    value,
    defaultValue,
    id: externalId,
    className = "",
    inputDir,
    placeholder,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  const resolvedError = errorMessage ?? errorText;
  const resolvedHelper = supportingText ?? helperText;
  const resolvedStart = leadingIcon ?? startIcon;
  const resolvedEnd = trailingIcon ?? endIcon;
  const hasError = Boolean(resolvedError) || Boolean(error);

  const errorId = resolvedError ? `${id}-error` : undefined;
  const helperId = resolvedHelper && !resolvedError ? `${id}-helper` : undefined;

  const charCount = typeof value === "string" ? value.length : 0;

  // A real placeholder is an example only; when a label is present it
  // stays hidden until the label has floated, so the two never overlap.
  const showPlaceholderOnFocusOnly = Boolean(label);

  return (
    <div className={fullWidth ? "w-full" : "inline-flex w-64 flex-col"}>
      <OutlinedFieldShell
        id={id}
        label={label}
        hasError={hasError}
        disabled={disabled}
        size={inputSize}
        required={required}
        startIcon={resolvedStart}
        endIcon={resolvedEnd}
        endAdornment={endAdornment}
        className={className}
      >
        {prefix && (
          <span className="shrink-0 text-bodyMedium text-onSurfaceVariant" aria-hidden="true">
            {prefix}
          </span>
        )}
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            placeholder={placeholder ?? " "}
            dir={inputDir}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId || helperId}
            className={[
              "peer w-full bg-transparent text-onSurface",
              "border-none outline-none",
              inputSize === "small" ? "text-bodySmall py-1.5" : "text-bodyMedium py-1.5",
              showPlaceholderOnFocusOnly
                ? "placeholder:opacity-0 group-focus-within/field:placeholder:opacity-100 placeholder:text-onSurfaceVariant/60"
                : "placeholder:text-onSurfaceVariant/60",
              "transition-opacity duration-short3",
            ].join(" ")}
            {...rest}
          />
        </div>
        {suffix && (
          <span className="shrink-0 text-bodyMedium text-onSurfaceVariant" aria-hidden="true">
            {suffix}
          </span>
        )}
      </OutlinedFieldShell>

      <FieldMessage
        id={errorId || helperId}
        error={resolvedError}
        helper={resolvedHelper}
        counter={showCharCount && maxLength ? `${charCount}/${maxLength}` : undefined}
      />
    </div>
  );
});
