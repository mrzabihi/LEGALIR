// ============================================================
// LEGALIR — Contract category chips
// ============================================================
// The four template buckets (همه / املاک / شخصی / تجاری) as a single
// horizontally-scrollable chip row. On mobile the row scrolls rather
// than wrapping, so the page never grows a second line of chips above
// the fold.
// ============================================================

"use client";

import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/contracts/categories";

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
      className={`flex gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
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
            className={`shrink-0 h-9 rounded-full px-4 text-labelLarge transition-colors duration-short3 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
              selected
                ? "bg-primary text-primary-on"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            {category.labelFa}
          </button>
        );
      })}
    </div>
  );
}
