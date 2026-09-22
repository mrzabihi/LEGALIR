"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Password Field
// ============================================================
// TextField with a built-in show/hide toggle. The toggle sits on
// the inline-end edge (correct in RTL and LTR) and is a real
// button with an accessible label.
// ============================================================

import React, { forwardRef, useId, useState } from "react";
import { OutlinedFieldShell, FieldMessage, type FieldSize } from "./field-shell";

export interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  label?: string;
  supportingText?: string;
  errorMessage?: string;
  error?: boolean;
  helperText?: string;
  errorText?: string;
  fullWidth?: boolean;
  inputSize?: FieldSize;
  leadingIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
  /** Force the value direction (passwords are usually `ltr`). */
  inputDir?: "ltr" | "rtl";
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      supportingText,
      errorMessage,
      error,
      helperText,
      errorText,
      fullWidth = false,
      inputSize = "medium",
      leadingIcon,
      startIcon,
      disabled,
      readOnly,
      required,
      id: externalId,
      className = "",
      inputDir = "ltr",
      ...rest
    },
    ref
  ) {
    const generatedId = useId();
    const id = externalId || generatedId;
    const [visible, setVisible] = useState(false);

    const resolvedError = errorMessage ?? errorText;
    const resolvedHelper = supportingText ?? helperText;
    const resolvedStart = leadingIcon ?? startIcon;
    const hasError = Boolean(resolvedError) || Boolean(error);

    const errorId = resolvedError ? `${id}-error` : undefined;
    const helperId = resolvedHelper && !resolvedError ? `${id}-helper` : undefined;

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
          endAdornment={
            <button
              type="button"
              onClick={() => setVisible((p) => !p)}
              disabled={disabled}
              className="flex h-10 w-10 items-center justify-center rounded-full text-onSurfaceVariant transition-colors hover:text-onSurface focus-visible:outline-none"
              aria-label={visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
              aria-pressed={visible}
            >
              <EyeIcon off={visible} />
            </button>
          }
          className={className}
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <input
              ref={ref}
              id={id}
              type={visible ? "text" : "password"}
              dir={inputDir}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
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
