"use client";

import React, { forwardRef, useId } from "react";

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, disabled, id: externalId, className = "", ...rest },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex items-center gap-3 cursor-pointer select-none",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ].join(" ")}
    >
      <span className="relative inline-flex items-center">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={id}
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        {/* Track */}
        <span
          className={[
            "block w-[52px] h-[32px] rounded-full transition-colors duration-short3",
            "bg-surfaceVariant",
            "peer-checked:bg-primary",
            "after:absolute after:top-[4px] after:start-[4px]",
            "after:w-[24px] after:h-[24px] after:rounded-full",
            "after:bg-surface after:shadow-elevation-1",
            "after:transition-transform after:duration-short3",
            "peer-checked:after:translate-x-[20px]",
          ].join(" ")}
        />
      </span>
      {label && <span className="text-bodyMedium text-onSurface">{label}</span>}
    </label>
  );
});
