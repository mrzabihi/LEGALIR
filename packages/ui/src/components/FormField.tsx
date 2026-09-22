"use client";

// ============================================================
// LEGALIR — FormField wrapper
// ============================================================
// Groups a label, an arbitrary control (radio group, custom
// picker, chip set…) and its supporting/error text with the same
// spacing and typography as the outlined fields, so non-text
// controls stay visually consistent with the rest of the form.
// ============================================================

import React, { useId } from "react";
import { FieldMessage } from "./field-shell";

export interface FormFieldProps {
  label?: React.ReactNode;
  /** Rendered below the control; hidden when `errorMessage` is set. */
  supportingText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  required?: boolean;
  /** id of the control this label describes (for `htmlFor`). */
  htmlFor?: string;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  supportingText,
  errorMessage,
  required,
  htmlFor,
  fullWidth = true,
  className = "",
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const labelId = `${htmlFor ?? generatedId}-label`;
  const messageId = errorMessage
    ? `${htmlFor ?? generatedId}-error`
    : supportingText
      ? `${htmlFor ?? generatedId}-helper`
      : undefined;

  return (
    <div className={[fullWidth ? "w-full" : "", className].filter(Boolean).join(" ")}>
      {label && (
        <label
          id={labelId}
          htmlFor={htmlFor}
          className="mb-1.5 block px-1 text-labelMedium text-onSurfaceVariant"
        >
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}
      {children}
      <FieldMessage
        id={messageId}
        error={errorMessage}
        helper={supportingText}
        reserveSpace={Boolean(errorMessage || supportingText)}
      />
    </div>
  );
}
