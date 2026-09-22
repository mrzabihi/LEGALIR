"use client";

import React, { useCallback, useRef, useEffect } from "react";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  /** LTR for numbers even in RTL context */
  numeric?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = true,
  numeric = true,
}: OTPInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value.slice(-1);
      if (char && numeric && !/^\d$/.test(char)) return;

      // Build from a fixed-length array so a digit typed into a later
      // box never shifts earlier digits (a plain string can't hold gaps).
      const chars = Array.from({ length }, (_, i) => value[i] ?? "");
      chars[index] = char;
      onChange(chars.join("").slice(0, length));

      // Auto-focus next
      if (char && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    },
    [value, length, onChange, numeric]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !value[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && index < length - 1) {
        // In RTL, left = next input
        inputsRef.current[index + 1]?.focus();
      }
      if (e.key === "ArrowRight" && index > 0) {
        // In RTL, right = previous input
        inputsRef.current[index - 1]?.focus();
      }
    },
    [value, length]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\s/g, "");
      const chars = numeric ? pasted.replace(/\D/g, "") : pasted;
      onChange(chars.slice(0, length));
    },
    [length, numeric, onChange]
  );

  return (
    <div dir="ltr" className="inline-flex gap-2" onPaste={handlePaste} data-otp-input>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type={numeric ? "text" : "text"}
          inputMode={numeric ? "numeric" : "text"}
          maxLength={1}
          value={value[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`رقم ${i + 1} از ${length}`}
          autoComplete="one-time-code"
          className={[
            "w-12 h-14 text-center text-titleLarge rounded-medium",
            "border outline-none transition-all duration-short3",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            hasError ? "border-error" : "border-outline",
            disabled ? "opacity-[0.38] bg-surfaceVariant/50" : "bg-transparent",
            "text-onSurface font-vazir",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
