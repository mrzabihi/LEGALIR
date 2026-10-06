// ============================================================
// LEGALIR — Contract category filter
// ============================================================
// One control, two presentations:
//   • touch widths → a horizontal scroller (native swipe, no visible bar)
//   • `tablet` up  → arrow buttons page the rail with a mouse
//
// This mirrors the lawyer-marketplace category rail exactly, so the two
// catalogs feel like one product. Selecting a chip never clears the search
// query — filter and search compose.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTRACT_CATEGORIES,
  contractServicesByCategory,
  type ContractCategoryId,
} from "@/lib/contract-services";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";

export type CategoryFilterValue = ContractCategoryId | "all";

interface CategoryFilterProps {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL: scrollLeft runs 0 → -max, so compare magnitudes.
    const pos = Math.abs(el.scrollLeft);
    setCanScrollStart(pos > 1);
    setCanScrollEnd(pos < max - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const page = (dir: "start" | "end") => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.7, 160);
    el.scrollBy({ left: dir === "end" ? -step : step, behavior: "smooth" });
  };

  const chipClass = (selected: boolean) =>
    [
      "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-caption font-medium transition-all touch-target-min",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      selected
        ? "border-[color:var(--control-selected-border)] bg-[color:var(--control-selected-surface)] text-[color:var(--control-selected)]"
        : "border-[color:var(--color-divider)] bg-surface text-on-surface hover:border-[color-mix(in_srgb,var(--control-selected)_50%,transparent)]",
    ].join(" ");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => page("start")}
        disabled={!canScrollStart}
        aria-label="نمایش دسته‌های قبلی"
        className="hidden shrink-0 items-center justify-center rounded-full border border-[color:var(--color-divider)] bg-surface p-2 text-on-surface transition-colors hover:bg-surface-container disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
      >
        <IconChevronRightSmall size={18} />
      </button>

      <div
        ref={railRef}
        onScroll={sync}
        role="tablist"
        aria-label="دسته‌بندی قراردادها"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === "all"}
          onClick={() => onChange("all")}
          className={chipClass(value === "all")}
        >
          همه
        </button>
        {CONTRACT_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = contractServicesByCategory(category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={value === category.id}
              onClick={() => onChange(category.id)}
              className={chipClass(value === category.id)}
            >
              <Icon size={16} aria-hidden="true" />
              {category.title}
              <span className="text-[10px] opacity-70">{toPersianNumber(count)}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => page("end")}
        disabled={!canScrollEnd}
        aria-label="نمایش دسته‌های بعدی"
        className="hidden shrink-0 items-center justify-center rounded-full border border-[color:var(--color-divider)] bg-surface p-2 text-on-surface transition-colors hover:bg-surface-container disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
      >
        <IconChevronLeft size={18} />
      </button>
    </div>
  );
}
