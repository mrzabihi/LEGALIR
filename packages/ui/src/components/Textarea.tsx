"use client";

// ============================================================
// LEGALIR — Material Design 3 Outlined Textarea
// ============================================================
// Multi-line sibling of TextField. Same floating-label behaviour
// and notch, but the label rests on the first line and the box
// grows with its content (`rows` / `autoResize`).
// ============================================================

import React, { forwardRef, useId, useLayoutEffect, useRef } from "react";
import { OutlinedFieldShell, FieldMessage } from "./field-shell";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  supportingText?: string;
  errorMessage?: string;
  error?: boolean;
  /** Legacy aliases. */
  helperText?: string;
  errorText?: string;
  fullWidth?: boolean;
  /** Grow the box to fit its content instead of scrolling. */
  autoResize?: boolean;
  showCharCount?: boolean;
  /** Force the value direction (e.g. `ltr` for codes). */
  inputDir?: "ltr" | "rtl";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    supportingText,
    errorMessage,
    error,
    helperText,
    errorText,
    fullWidth = false,
    autoResize = false,
    showCharCount,
    disabled,
    readOnly,
    required,
    maxLength,
    rows = 3,
    value,
    defaultValue,
    id: externalId,
    className = "",
    inputDir,
    placeholder,
    onChange,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resolvedError = errorMessage ?? errorText;
  const resolvedHelper = supportingText ?? helperText;
  const hasError = Boolean(resolvedError) || Boolean(error);

  const errorId = resolvedError ? `${id}-error` : undefined;
  const helperId = resolvedHelper && !resolvedError ? `${id}-helper` : undefined;

  const charCount = typeof value === "string" ? value.length : 0;

  // Auto-resize: keep the box exactly as tall as its content.
  useLayoutEffect(() => {
    if (!autoResize) return;
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize, value]);

  const setRefs = (node: HTMLTextAreaElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
  };

  return (
    <div className={fullWidth ? "w-full" : "inline-flex w-64 flex-col"}>
      <OutlinedFieldShell
        id={id}
        label={label}
        required={required}
        hasError={hasError}
        disabled={disabled}
        align="stretch"
        className={className}
      >
        <div className="relative flex min-w-0 flex-1">
          <textarea
            ref={setRefs}
            id={id}
            rows={rows}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            placeholder={placeholder ?? " "}
            dir={inputDir}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId || helperId}
            onChange={onChange}
            className={[
              "peer w-full resize-none bg-transparent px-3 pt-6 pb-2",
              "text-bodyMedium text-onSurface border-none outline-none",
              "placeholder:opacity-0 group-focus-within/field:placeholder:opacity-100",
              "placeholder:text-onSurfaceVariant/60 transition-opacity duration-short3",
              autoResize ? "overflow-hidden" : "",
            ].join(" ")}
            {...rest}
          />
        </div>
      </OutlinedFieldShell>

      <FieldMessage
        id={errorId || helperId}
        error={resolvedError}
        helper={resolvedHelper}
        counter={showCharCount && maxLength ? `${charCount}/${maxLength}` : undefined}
      />
    </div>
  );
});
