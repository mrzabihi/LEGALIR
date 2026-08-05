"use client";

import React, { forwardRef, useId } from "react";

type TextFieldVariant = "filled" | "outlined";

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  errorText?: string;
  variant?: TextFieldVariant;
  inputSize?: "small" | "medium";
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  /** Display character count if maxLength provided */
  showCharCount?: boolean;
}

const variantClasses: Record<TextFieldVariant, string> = {
  filled:
    "bg-surfaceVariant/[0.5] border-b border-onSurfaceVariant hover:bg-surfaceVariant/[0.7] focus-within:bg-surfaceVariant focus-within:border-primary focus-within:border-b-2",
  outlined:
    "bg-transparent border border-outline hover:border-onSurface focus-within:border-primary focus-within:border-2",
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    helperText,
    errorText,
    variant = "outlined",
    inputSize = "medium",
    fullWidth = false,
    startIcon,
    endIcon,
    showCharCount,
    disabled,
    maxLength,
    value,
    id: externalId,
    className = "",
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;
  const errorId = errorText ? `${id}-error` : undefined;
  const helperId = helperText && !errorText ? `${id}-helper` : undefined;
  const charCount = typeof value === "string" ? value.length : 0;
  const hasError = Boolean(errorText);

  const containerClasses = [
    "relative flex items-center gap-2 rounded-small transition-all duration-short3 ease-standard",
    "cursor-text",
    hasError
      ? "border-error focus-within:border-error"
      : variantClasses[variant],
    inputSize === "small" ? "min-h-[48px] px-2" : "min-h-[56px] px-3",
    disabled ? "opacity-[0.38] pointer-events-none" : "",
    fullWidth ? "w-full" : "w-64",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={fullWidth ? "w-full" : "inline-flex flex-col"}>
      <div className={containerClasses}>
        {startIcon && (
          <span className="text-onSurfaceVariant shrink-0" aria-hidden="true">
            {startIcon}
          </span>
        )}
        <div className="relative flex-1">
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId || helperId}
            className={[
              "w-full bg-transparent text-onSurface",
              "outline-none border-none",
              "placeholder:text-onSurfaceVariant/60",
              inputSize === "small"
                ? "text-bodySmall py-1.5"
                : "text-bodyMedium pt-4 pb-1.5",
              // RTL handled natively by dir attribute
            ].join(" ")}
            {...rest}
          />
          {label && (
            <label
              htmlFor={id}
              className={[
                "absolute start-0 pointer-events-none transition-all duration-short3 ease-standard",
                "text-bodySmall text-onSurfaceVariant",
                inputSize === "small"
                  ? charCount > 0 || (value !== undefined && value !== "")
                    ? "-top-3 text-xs"
                    : "top-2"
                  : charCount > 0 || (value !== undefined && value !== "")
                    ? "-top-1 text-xs"
                    : "top-3 text-bodyMedium",
              ].join(" ")}
            >
              {label}
            </label>
          )}
        </div>
        {endIcon && (
          <span className="text-onSurfaceVariant shrink-0" aria-hidden="true">
            {endIcon}
          </span>
        )}
      </div>

      {/* Supporting text */}
      <div className="flex items-center justify-between min-h-[20px] px-3 mt-1">
        {errorText ? (
          <p id={errorId} className="text-labelSmall text-error" role="alert">
            {errorText}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-labelSmall text-onSurfaceVariant">
            {helperText}
          </p>
        ) : (
          <span />
        )}
        {showCharCount && maxLength && (
          <span className="text-labelSmall text-onSurfaceVariant">
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});
