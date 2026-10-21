// ============================================================
// LEGALIR — Shared search field (MD3 search bar)
// ============================================================
// The one search input used across the list surfaces (/history,
// /cases, /contracts, /documents). It wraps the shared MD3 TextField
// so every list gets the identical look and the identical a11y:
//
//   • a REAL label (the placeholder never doubles as the label);
//   • the leading search glyph on the START edge (the right in RTL);
//   • a labelled clear button that appears only when there is text;
//   • continuous Persian typing is preserved — the value is fully
//     controlled by the caller, so composed characters never drop.
//
// It owns no debounce: the caller decides how the query reaches the
// network, because each surface has its own data source.
// ============================================================

"use client";

import type { Ref } from "react";
import { TextField } from "@legalir/ui";
import { IconClose, IconSearch } from "@/lib/icons";

export interface SearchFieldProps {
  /** Current query value (fully controlled). */
  value: string;
  onChange: (value: string) => void;
  /** The accessible label — required, e.g. «جست‌وجو در پرونده‌ها». */
  label: string;
  /** A concrete, non-redundant example, e.g. «مثلاً اجاره، NDA». */
  placeholder?: string;
  /** Called when the user submits with Enter. */
  onSubmit?: () => void;
  /** Called when Escape is pressed while the query is non-empty. */
  onEscape?: () => void;
  className?: string;
  autoFocus?: boolean;
  /** The underlying input, for callers that refocus after a clear. */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * Reserve the empty helper row below the field (default). Set `false` when
   * the field sits inside bespoke chrome (e.g. a search card) where the blank
   * row would add dead height.
   */
  reserveMessageSpace?: boolean;
  /**
   * Field height. `small` (48px) keeps a search card compact when it sits
   * below the page's primary content; list pages keep the MD3 `medium`
   * default (56px).
   */
  inputSize?: "small" | "medium";
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  onSubmit,
  onEscape,
  className = "",
  autoFocus = false,
  inputRef,
  reserveMessageSpace = true,
  inputSize = "medium",
}: SearchFieldProps) {
  return (
    <div className={`w-full ${className}`}>
      <TextField
        ref={inputRef}
        type="search"
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onEscape?.();
          }
        }}
        placeholder={placeholder}
        inputSize={inputSize}
        leadingIcon={<IconSearch size={inputSize === "small" ? 18 : 20} />}
        endAdornment={
          value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="پاک کردن جست‌وجو"
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-short3 hover:bg-surface-hover hover:text-on-surface touch-target-pad"
            >
              <IconClose size={18} />
            </button>
          ) : undefined
        }
        fullWidth
        autoFocus={autoFocus}
        reserveMessageSpace={reserveMessageSpace}
      />
    </div>
  );
}
