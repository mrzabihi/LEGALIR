"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Money Field
// ============================================================
// The one money input for the whole product. It formats the amount
// with Persian digits and thousands grouping *while the user types*,
// keeps the caret stable, and shows a live «سه میلیون تومان» helper
// line underneath.
//
// The value it emits is always a clean integer in the field's own
// unit — never a formatted string. Formatting is presentation only,
// so arithmetic downstream is safe.
//
// The unit is explicit (`unit` prop), never inferred from the
// displayed text, so a rial field can never be mistaken for a toman
// one.
// ============================================================

import React, { forwardRef, useId, useState } from "react";
import { OutlinedFieldShell, FieldMessage, type FieldSize } from "./field-shell";
import { useCaretAnchor } from "../lib/use-caret-anchor";
import {
  formatMoneyWords,
  formatPersianAmount,
  parseFormattedNumber,
} from "../lib/number-format";

/** Currency unit. Rial is the base unit; Toman = Rial / 10. */
export type MoneyFieldUnit = "IRT" | "IRR";

/** Persian label for each unit. */
export const MONEY_UNIT_LABEL: Record<MoneyFieldUnit, string> = {
  IRT: "تومان",
  IRR: "ریال",
};

export interface MoneyFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "onChange" | "value" | "type" | "inputMode"
  > {
  label?: string;
  /** Canonical amount in the field's own `unit` (integer), or null. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Display/entry unit. Defaults to toman. */
  unit?: MoneyFieldUnit;
  supportingText?: string;
  errorMessage?: string;
  error?: boolean;
  /** Legacy aliases. */
  helperText?: string;
  errorText?: string;
  fullWidth?: boolean;
  inputSize?: FieldSize;
  min?: number;
  max?: number;
  /** Show the live «… تومان» words line. Default true. */
  showWords?: boolean;
  /** Show the grouped Persian-digit preview line. Default false. */
  showPreview?: boolean;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(
  function MoneyField(
    {
      label,
      value,
      onChange,
      unit = "IRT",
      supportingText,
      errorMessage,
      error,
      helperText,
      errorText,
      fullWidth = false,
      inputSize = "medium",
      min,
      max,
      showWords = true,
      showPreview = false,
      required,
      disabled,
      readOnly,
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

    const unitLabel = MONEY_UNIT_LABEL[unit];
    const { ref: caretRef, remember } = useCaretAnchor();

    // The displayed text is derived from the canonical value, but kept
    // in local state so the user's in-progress typing (e.g. a trailing
    // separator) is not clobbered mid-keystroke.
    const [text, setText] = useState(() =>
      value === null || value === undefined ? "" : formatPersianAmount(value)
    );
    const [lastValue, setLastValue] = useState(value);

    // Re-sync when the value changes from outside (reset, draft load).
    if (value !== lastValue) {
      setLastValue(value);
      setText(value === null || value === undefined ? "" : formatPersianAmount(value));
    }

    const clamp = (n: number): number => {
      let next = n;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      return next;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      remember(el.value, el.selectionStart ?? el.value.length);

      // Drop anything that is not a digit or a separator before parsing,
      // so a stray keystroke never wipes an otherwise valid amount.
      const cleaned = el.value.replace(/[^\d۰-۹٠-٩.,\u066C\u066B\u060C\s]/g, "");
      const parsed = parseFormattedNumber(cleaned);
      if (parsed === null) {
        setText("");
        onChange(null);
        return;
      }
      const next = clamp(Math.trunc(parsed));
      setText(formatPersianAmount(next));
      onChange(next);
    };

    const words = showWords && !hasError ? formatMoneyWords(value, unitLabel) : "";
    const preview =
      showPreview && !hasError && value !== null && value !== undefined
        ? `${formatPersianAmount(value)} ${unitLabel}`
        : "";

    return (
      <div className={fullWidth ? "w-full" : "inline-flex w-64 flex-col"}>
        <OutlinedFieldShell
          id={id}
          label={label}
          required={required}
          hasError={hasError}
          disabled={disabled}
          size={inputSize}
          className={className}
        >
          <input
            ref={(node) => {
              caretRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={id}
            type="text"
            inputMode="numeric"
            dir="ltr"
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            value={text}
            onChange={handleChange}
            placeholder=" "
            aria-invalid={hasError || undefined}
            aria-describedby={errorId || helperId}
            className={[
              "peer w-full bg-transparent text-onSurface text-end",
              "border-none outline-none tabular-nums",
              inputSize === "small" ? "text-bodySmall py-1.5" : "text-bodyMedium py-1.5",
              "placeholder:opacity-0 group-focus-within/field:placeholder:opacity-100",
              "placeholder:text-onSurfaceVariant/60 transition-opacity duration-short3",
            ].join(" ")}
            {...rest}
          />
          {/* Currency unit — a real suffix with its own inset so it can
              never collide with the typed amount. */}
          <span
            className="ms-2 shrink-0 text-bodyMedium text-onSurfaceVariant"
            aria-hidden="true"
          >
            {unitLabel}
          </span>
        </OutlinedFieldShell>

        <FieldMessage
          id={errorId || helperId}
          error={resolvedError}
          helper={resolvedHelper}
        />

        {preview && (
          <p className="px-3 text-labelSmall text-onSurfaceVariant">{preview}</p>
        )}
        {words && (
          <p className="px-3 text-labelSmall text-onSurfaceVariant/80">{words}</p>
        )}
      </div>
    );
  }
);
