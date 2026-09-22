"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Number Field
// ============================================================
// Numeric input with the shared outlined floating label. Persian
// digits are normalised to ASCII on the way out so the existing
// payload/validation logic is untouched.
//
// Set `group` for large counts (areas, counts, years of service) to
// get live thousands grouping with a stable caret. Money must use
// `MoneyField` instead — it carries the unit and the words line.
// ============================================================

import React, { forwardRef, useId, useState } from "react";
import { OutlinedFieldShell, FieldMessage, type FieldSize } from "./field-shell";
import { useCaretAnchor } from "../lib/use-caret-anchor";
import {
  formatPersianAmount,
  normalizeDigits,
} from "../lib/number-format";

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
  /** Group thousands live and render Persian digits (default: false). */
  group?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  suffix?: React.ReactNode;
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
      group = false,
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

    const { ref: caretRef, remember } = useCaretAnchor();

    const render = (n: number | null | undefined): string => {
      if (n === null || n === undefined) return "";
      return group ? formatPersianAmount(n) : String(n);
    };

    const [text, setText] = useState(() => render(value));
    const [lastValue, setLastValue] = useState(value);

    // Re-sync when the value changes from outside (reset, draft load).
    if (value !== lastValue) {
      setLastValue(value);
      setText(render(value));
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      if (group) remember(el.value, el.selectionStart ?? el.value.length);

      const raw = normalizeDigits(el.value);
      const cleaned = allowDecimal
        ? raw.replace(/[^\d.]/g, "")
        : raw.replace(/[^\d]/g, "");
      if (cleaned.trim() === "") {
        setText("");
        return onChange(null);
      }
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return;
      let next = n;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      setText(render(next));
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
              ref={(node) => {
                caretRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref) ref.current = node;
              }}
              id={id}
              type="text"
              inputMode={allowDecimal ? "decimal" : "numeric"}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              value={text}
              onChange={handleChange}
              placeholder=" "
              aria-invalid={hasError || undefined}
              aria-describedby={errorId || helperId}
              className={[
                "peer w-full bg-transparent text-onSurface",
                "border-none outline-none",
                group ? "tabular-nums" : "",
                inputSize === "small" ? "text-bodySmall py-1.5" : "text-bodyMedium py-1.5",
                "placeholder:opacity-0 group-focus-within/field:placeholder:opacity-100",
                "placeholder:text-onSurfaceVariant/60 transition-opacity duration-short3",
              ]
                .filter(Boolean)
                .join(" ")}
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
