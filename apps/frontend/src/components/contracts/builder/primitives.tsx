// ============================================================
// LEGALIR — Contract Builder primitives
// ============================================================
// Small, shared building blocks for the property-contract wizard:
// a section card, a labelled field row, a Jalali date field, a
// money field (toman in, rial stored), a choice group, a toggle row
// and a repeatable-row shell.
//
// Every one of these is a thin wrapper over the existing design
// system — no new visual language is introduced.
// ============================================================

"use client";

import React from "react";
import {
  TextField,
  Select,
  Switch,
  RadioGroup,
  Button,
  NumberField as NumberFieldUI,
  MoneyField as MoneyFieldUI,
} from "@legalir/ui";
import { JalaliDatePicker } from "@/components/shared/JalaliDatePicker";
import { toman, toToman } from "@/lib/contracts/money";
import { isoToJalaliString, jalaliStringToIso } from "@/lib/contracts/dates";
import type { Money } from "@legalir/types";

// ------------------------------------------------------------
// Section card
// ------------------------------------------------------------

export function SectionCard({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-large bg-surface border border-divider shadow-elevation-1 overflow-hidden">
      <header className="px-4 py-3 border-b border-divider bg-surface-container-low flex items-start justify-between gap-3">
        <div>
          <h3 className="text-titleMedium text-on-surface">{title}</h3>
          {description && <p className="text-caption text-muted mt-0.5">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

/** A responsive two-column grid for field pairs. */
export function FieldGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const cols =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 tablet:grid-cols-3"
        : "grid-cols-1 tablet:grid-cols-2";
  return <div className={`grid ${cols} gap-3`}>{children}</div>;
}

// ------------------------------------------------------------
// Text field
// ------------------------------------------------------------

export function Field({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  errorText,
  type = "text",
  inputMode,
  maxLength,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <TextField
      fullWidth
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      helperText={helperText}
      errorText={errorText}
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      disabled={disabled}
    />
  );
}

/** A numeric field that stores a number (or null when blank). */
export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  suffix,
  min = 0,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  helperText?: string;
  suffix?: string;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <NumberFieldUI
      fullWidth
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      placeholder={placeholder}
      helperText={suffix ? (helperText ? `${helperText} — ${suffix}` : suffix) : helperText}
      disabled={disabled}
    />
  );
}

// ------------------------------------------------------------
// Select
// ------------------------------------------------------------

export function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  helperText,
  disabled,
}: {
  label: string;
  value: T | "";
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      fullWidth
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      options={options}
      placeholder={placeholder}
      helperText={helperText}
      disabled={disabled}
    />
  );
}

/** A radio group rendered as a row of choices. */
export function RadioField<T extends string>({
  label,
  value,
  onChange,
  options,
  direction = "row",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  direction?: "row" | "column";
}) {
  return (
    <RadioGroup
      name={label}
      label={label}
      value={value}
      onChange={(v) => onChange(v as T)}
      options={options}
      direction={direction}
    />
  );
}

// ------------------------------------------------------------
// Toggle row
// ------------------------------------------------------------

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-medium border border-divider px-3 py-2.5 cursor-pointer transition-colors ${
        checked ? "bg-primary-50/60 border-primary/30" : "bg-surface"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <span className="min-w-0">
        <span className="block text-body-2 text-on-surface">{label}</span>
        {description && <span className="block text-caption text-muted mt-0.5">{description}</span>}
      </span>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
    </label>
  );
}

// ------------------------------------------------------------
// Jalali date field
// ------------------------------------------------------------

export function DateField({
  label,
  value,
  onChange,
  helperText,
  errorMessage,
  disabled,
  minYear,
  maxYear,
  defaultYear,
}: {
  /** ISO Gregorian value, or null. */
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  helperText?: string;
  /** Validation message — turns the control red and replaces the helper. */
  errorMessage?: string;
  disabled?: boolean;
  /** Earliest selectable Jalali year. Omit for the default (1300). */
  minYear?: number;
  /** Latest selectable Jalali year. Omit for the default (1450). */
  maxYear?: number;
  /** Resting year when empty. Omit for the default (1405). */
  defaultYear?: number;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-labelMedium text-on-surface-variant">{label}</span>
      <JalaliDatePicker
        value={isoToJalaliString(value)}
        onChange={(jalali) => onChange(jalaliStringToIso(jalali))}
        disabled={disabled}
        minYear={minYear}
        maxYear={maxYear}
        defaultYear={defaultYear}
        errorMessage={errorMessage}
      />
      {helperText && !errorMessage && (
        <p className="text-caption text-muted">{helperText}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Money field
// ------------------------------------------------------------

/**
 * A toman-denominated money input. The user types toman; the value is
 * stored canonically as integer rial via the central money utility.
 *
 * This is a thin adapter over the shared `MoneyField` from the design
 * system — the live grouping, the unit suffix and the «… تومان» words
 * line all come from there, so there is exactly one formatting path
 * for the whole product.
 */
export function MoneyField({
  label,
  value,
  onChange,
  helperText,
  placeholder,
  disabled,
}: {
  label: string;
  value: Money | null;
  onChange: (value: Money | null) => void;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <MoneyFieldUI
      fullWidth
      label={label}
      unit="IRT"
      value={value ? toToman(value) : null}
      onChange={(next) => onChange(next === null ? null : toman(next))}
      helperText={helperText}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

// ------------------------------------------------------------
// Repeatable rows
// ------------------------------------------------------------

export function RepeatableRow({
  index,
  onRemove,
  children,
  removeLabel = "حذف",
}: {
  index: number;
  onRemove?: () => void;
  children: React.ReactNode;
  removeLabel?: string;
}) {
  return (
    <div className="rounded-medium border border-divider bg-surface-container-low p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-labelMedium text-on-surface-variant">ردیف {index + 1}</span>
        {onRemove && (
          <Button variant="text" size="small" onClick={onRemove} type="button">
            {removeLabel}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

/** An inline "add another" button. */
export function AddRowButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outlined" size="small" onClick={onClick} type="button" disabled={disabled}>
      {label}
    </Button>
  );
}

// ------------------------------------------------------------
// Inline notice
// ------------------------------------------------------------

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "error";
  title?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "bg-info-50 border-info/30 text-on-surface",
    warning: "bg-warning-50 border-warning/40 text-on-surface",
    success: "bg-success-50 border-success/30 text-on-surface",
    error: "bg-error-50 border-error/30 text-on-surface",
  };
  return (
    <div className={`rounded-medium border px-3 py-2.5 text-body-2 ${tones[tone]}`}>
      {title && <p className="font-medium mb-0.5">{title}</p>}
      <div className="text-caption leading-6">{children}</div>
    </div>
  );
}
