// ============================================================
// LEGALIR — Contract search box
// ============================================================
// The single search input that sits directly under the page title.
// It is a controlled input — the page owns the query so it can drive
// both the template grid and the "my contracts" list from one value,
// and mirror it into the URL.
// ============================================================

"use client";

import { TextField } from "@legalir/ui";
import { IconClose, IconSearch } from "@/lib/icons";

interface ContractSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called when the user submits (Enter) — used for the analytics ping. */
  onSubmit?: () => void;
}

export function ContractSearch({
  value,
  onChange,
  placeholder = "جستجوی قرارداد؛ مثلاً اجاره، NDA، خودرو یا استخدام",
  onSubmit,
}: ContractSearchProps) {
  return (
    <TextField
      type="search"
      label="جستجوی قرارداد"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit?.();
      }}
      placeholder={placeholder}
      leadingIcon={<IconSearch size={20} />}
      endAdornment={
        value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="پاک کردن جستجو"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-on-surface/[0.08] transition-colors"
          >
            <IconClose size={18} />
          </button>
        ) : undefined
      }
      fullWidth
    />
  );
}
