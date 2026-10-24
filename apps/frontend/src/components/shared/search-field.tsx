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
    // `role="search"` is the landmark, and it belongs to the wrapper, not the
    // input: an `<input type="search">` announces its role as a textbox, so
    // the search landmark never exists unless an ancestor declares it.
    //
    // Every caller used to hand-roll `<form role="search">`. When the list
    // surfaces were migrated onto this shared field the landmark went with
    // the old markup, and `e2e/services-discovery.spec.ts` is the assertion
    // that noticed. Owning it here means it cannot be lost by a caller again.
    //
    // The landmark is deliberately unnamed. Naming it with `label` gave the
    // same string to the landmark and to the input inside it, so assistive
    // tech announced the name twice and `getByLabelText` in the unit tests
    // resolved to two nodes. WCAG asks a landmark to carry a name only when
    // several of its kind share a page, and every page renders this field
    // once — so the unlabeled `search` landmark is the honest choice.
    <div role="search" className={`w-full ${className}`}>
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
