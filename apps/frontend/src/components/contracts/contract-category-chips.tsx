// ============================================================
// LEGALIR — Contract category chips (MD3 filter chips)
// ============================================================
// The four template buckets (همه / املاک / شخصی / تجاری) as a single
// horizontally-scrollable row of Material 3 filter chips.
//
// The selected chip is marked by MORE than colour: a leading check
// appears, so the active bucket is legible without relying on hue
// (WCAG 1.4.1). On mobile the row scrolls inside itself rather than
// wrapping, so the page never grows a second line of chips above the
// fold; the rail never pushes the PAGE into horizontal scroll.
// ============================================================

"use client";

import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/contracts/categories";
import { IconCheck } from "@/lib/icons";

interface ContractCategoryChipsProps {
  value: TemplateCategory;
  onChange: (category: TemplateCategory) => void;
  className?: string;
}

export function ContractCategoryChips({
  value,
  onChange,
  className = "",
}: ContractCategoryChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="دسته‌بندی قراردادها"
      className={`scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 ${className}`}
    >
      {TEMPLATE_CATEGORIES.map((category) => {
        const selected = category.key === value;
        return (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(category.key)}
            className={[
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-labelLarge transition-colors duration-short3",
              "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
              selected
                ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                : "border-[color:var(--color-outline-variant)] bg-surface text-on-surface-variant hover:bg-surface-hover hover:text-on-surface",
            ].join(" ")}
          >
            {selected && <IconCheck size={16} aria-hidden="true" />}
            {category.labelFa}
          </button>
        );
      })}
    </div>
  );
}
