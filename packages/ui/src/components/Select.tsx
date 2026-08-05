"use client";

import React, { forwardRef, useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  helperText?: string;
  errorText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  selectSize?: "small" | "medium";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    errorText,
    options,
    placeholder,
    fullWidth = false,
    selectSize = "medium",
    disabled,
    id: externalId,
    className = "",
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;
  const errorId = errorText ? `${id}-error` : undefined;
  const hasError = Boolean(errorText);

  return (
    <div className={fullWidth ? "w-full" : "inline-flex flex-col"}>
      {label && (
        <label htmlFor={id} className="mb-1 text-labelMedium text-onSurfaceVariant px-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={errorId}
          className={[
            "appearance-none w-full rounded-small px-3",
            "border outline-none transition-all duration-short3",
            "bg-surface text-onSurface",
            hasError ? "border-error" : "border-outline",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            disabled ? "opacity-[0.38] pointer-events-none" : "cursor-pointer",
            selectSize === "small" ? "h-10 text-bodySmall" : "h-12 text-bodyMedium",
            fullWidth ? "w-full" : "w-64",
            className,
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
        {/* Chevron icon */}
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-onSurfaceVariant"
          style={{ insetInlineEnd: "12px" }}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </div>
      </div>
      {errorText && (
        <p id={errorId} className="mt-1 px-1 text-labelSmall text-error" role="alert">
          {errorText}
        </p>
      )}
      {helperText && !errorText && (
        <p className="mt-1 px-1 text-labelSmall text-onSurfaceVariant">{helperText}</p>
      )}
    </div>
  );
});
