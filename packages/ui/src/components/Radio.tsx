"use client";

import React, { forwardRef, useId } from "react";

interface RadioOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  direction?: "row" | "column";
  label?: string;
  errorText?: string;
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  direction = "column",
  label,
  errorText,
  className = "",
}: RadioGroupProps) {
  const errorId = errorText ? `${name}-error` : undefined;

  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-labelMedium text-onSurfaceVariant">{label}</legend>}
      <div
        className={[
          "flex gap-3",
          direction === "row" ? "flex-row flex-wrap" : "flex-col",
        ].join(" ")}
        role="radiogroup"
        aria-describedby={errorId}
      >
        {options.map((opt) => (
          <Radio
            key={opt.value}
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            label={opt.label}
            disabled={opt.disabled}
          />
        ))}
      </div>
      {errorText && (
        <p id={errorId} className="mt-1 text-labelSmall text-error" role="alert">
          {errorText}
        </p>
      )}
    </fieldset>
  );
}

interface RadioProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  disabled?: boolean;
}

const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { name, value, checked, onChange, label, disabled },
  ref
) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
      ].join(" ")}
    >
      <span className="relative flex items-center justify-center h-5 w-5">
        <input
          ref={ref}
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="absolute inset-0">
          <circle
            cx="10"
            cy="10"
            r="9"
            className="fill-none stroke-outline peer-checked:stroke-primary transition-colors duration-short2"
            strokeWidth="2"
          />
          <circle
            cx="10"
            cy="10"
            r="5"
            className="fill-primary opacity-0 peer-checked:opacity-100 transition-opacity duration-short2"
          />
        </svg>
      </span>
      {label && <span className="text-bodyMedium text-onSurface">{label}</span>}
    </label>
  );
});
