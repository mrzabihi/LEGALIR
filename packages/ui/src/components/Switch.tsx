"use client";

// ============================================================
// LEGALIR — Material Design 3 Switch
// ============================================================
// The one switch for the whole product.
//
//   OFF → very light track, subtle neutral border, white thumb
//   ON  → brand green track, white thumb
//
// The track colour and the thumb position are both driven by the real
// `<input>` via `peer-*`, so the visual can never disagree with the
// value. The thumb slides with a short, physical ease — no bounce.
// ============================================================

import React, { forwardRef, useId, useState } from "react";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, disabled, id: externalId, className = "", checked, defaultChecked, onChange, ...rest },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;

  // Mirror the real input's state so `aria-checked` can never drift from
  // the visual, whether the switch is controlled or uncontrolled.
  const [isChecked, setIsChecked] = useState(Boolean(checked ?? defaultChecked));
  const resolvedChecked = checked !== undefined ? Boolean(checked) : isChecked;

  return (
    <label
      htmlFor={id}
      className={[
        "group/switch inline-flex items-center gap-3 cursor-pointer select-none",
        disabled ? "opacity-[0.38] pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="relative inline-flex items-center">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={id}
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          aria-checked={resolvedChecked}
          onChange={(e) => {
            if (checked === undefined) setIsChecked(e.target.checked);
            onChange?.(e);
          }}
          className="peer sr-only"
          {...rest}
        />
        {/* Track */}
        <span
          aria-hidden="true"
          className={[
            "block h-[32px] w-[52px] rounded-full border-2",
            "bg-control-unselected-bg border-control-unselected-border",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-control-focus/40 peer-focus-visible:ring-offset-1",
            "peer-disabled:bg-control-disabled-bg peer-disabled:border-control-disabled-text",
            "peer-checked:bg-control-selected peer-checked:border-control-selected",
            "transition-[background-color,border-color,box-shadow] duration-200 ease-standard",
            // Thumb — white in both states, slides on the same ease.
            "after:absolute after:top-[4px] after:start-[4px]",
            "after:h-[24px] after:w-[24px] after:rounded-full",
            "after:bg-white after:shadow-elevation-1",
            "after:transition-transform after:duration-200 after:ease-standard",
            "peer-checked:after:translate-x-[20px]",
            "group-active/switch:after:scale-95",
          ].join(" ")}
        />
      </span>
      {label && <span className="text-bodyMedium text-onSurface">{label}</span>}
    </label>
  );
});
