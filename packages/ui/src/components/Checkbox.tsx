"use client";

import React, { forwardRef, useId } from "react";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, disabled, id: externalId, className = "", ...rest },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ].join(" ")}
    >
      <span className="relative flex items-center justify-center h-5 w-5">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={[
            "absolute inset-0 transition-all duration-short2",
            "fill-current text-outline peer-checked:text-primary",
          ].join(" ")}
        >
          <rect x="1" y="1" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
          <path
            className="opacity-0 peer-checked:opacity-100 transition-opacity duration-short2"
            d={indeterminate ? "M6 10h8" : "M5 10l3 3 6-6"}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label && <span className="text-bodyMedium text-onSurface">{label}</span>}
    </label>
  );
});
