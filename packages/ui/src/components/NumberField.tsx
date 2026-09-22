"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Number Field
// ============================================================
// Numeric input with the shared outlined floating label. Persian
// digits are normalised to ASCII on the way out so the existing
// payload/validation logic is untouched.
// ============================================================

import React, { forwardRef, useId } from "react";
import { OutlinedFieldShell, FieldMessage, type FieldSize } from "./field-shell";

export interface NumberFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value"> {
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  supportingText?: string;
  errorMessage?: string;
  error?: boolean;
  helperText?: string;
  errorText?: string;
  fullWidth?: boolean;
  inputSize?: FieldSize;
  min?: number;
  max?: number;
  /** Allow decimal values (default: integers only). */
  allowDecimal?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  suffix?: React.ReactNode;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalizeDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField(
    {
      label,
      value,
      onChange,
      supportingText,
      errorMessage,
      error,
      helperText,
      errorText,
      fullWidth = false,
      inputSize = "medium",
      min,
      max,
      allowDecimal = false,
      leadingIcon,
      trailingIcon,
      startIcon,
      endIcon,
      suffix,
      disabled,
      readOnly,
      required,
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
    const resolvedStart = leadingIcon ?? startIcon;
    const resolvedEnd = trailingIcon ?? endIcon;
    const hasError = Boolean(resolvedError) || Boolean(error);

    const errorId = resolvedError ? `${id}-error` : undefined;
    const helperId = resolvedHelper && !resolvedError ? `${id}-helper` : undefined;

    const displayValue = value === null || value === undefined ? "" : String(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = normalizeDigits(e.target.value);
      const cleaned = allowDecimal
        ? raw.replace(/[^\d.]/g, "")
        : raw.replace(/[^\d]/g, "");
      if (cleaned.trim() === "") return onChange(null);
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return;
      let next = n;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(next);
    };

    return (
      <div className={fullWidth ? "w-full" : "inline-flex w-64 flex-col"}>
        <OutlinedFieldShell
          id={id}
          label={label}
          required={required}
          hasError={hasError}
          disabled={disabled}
          size={inputSize}
          startIcon={resolvedStart}
          endIcon={resolvedEnd}
          className={className}
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <input
              ref={ref}
              id={id}
              type="text"
              inputMode={allowDecimal ? "decimal" : "numeric"}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              value={displayValue}
              onChange={handleChange}
              placeholder=" "
              aria-invalid={hasError || undefined}
              aria-describedby={errorId || helperId}
              className={[
                "peer w-full bg-transparent text-onSurface",
                "border-none outline-none",
                inputSize === "small" ? "text-bodySmall py-1.5" : "text-bodyMedium py-1.5",
                "placeholder:opacity-0 group-focus-within/field:placeholder:opacity-100",
                "placeholder:text-onSurfaceVariant/60 transition-opacity duration-short3",
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
        />
      </div>
    );
  }
);
