// ============================================================
// LEGALIR — Calculator catalog controls
// ============================================================
// The search field + filter row shared by the catalog home and the
// /calculators/all page. It owns no state: the query and the active
// filters live in the page, so the two surfaces stay in sync and a
// filter chosen on the home page carries straight through to the full
// list via the URL.
//
// Two filters are offered, and only with real data:
//   • دسته (category) — the registry's own categories
//   • اعتبار (legal standing) — the registry's own `status` values
// Each is a compact dropdown (`CalculatorFilter`) that shows its current
// selection and opens to a real option list. The two sit on ONE row —
// `grid-cols-2` — so they stay side by side down to the narrowest phone;
// every part is `min-w-0` so nothing overflows the page. A «پاک کردن»
// button appears only while a query or filter is active.
// ============================================================

"use client";

import { TextField } from "@legalir/ui";
import { IconClose, IconSearch } from "@/lib/icons";
import { CalculatorFilter } from "./calculator-filter";
import type { ControlOption } from "./types";

export type { ControlOption } from "./types";

interface CalculatorControlsProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;

  categories: ControlOption[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;

  statuses: ControlOption[];
  activeStatus: string;
  onStatusChange: (id: string) => void;

  /** True when any query or filter is active. */
  hasActiveFilter: boolean;
  onClearFilters: () => void;

  /** Placeholder for the search field (varies per surface). */
  placeholder?: string;
}

export function CalculatorControls({
  query,
  onQueryChange,
  onClearQuery,
  categories,
  activeCategory,
  onCategoryChange,
  statuses,
  activeStatus,
  onStatusChange,
  hasActiveFilter,
  onClearFilters,
  placeholder = "نام محاسبه‌گر را جستجو کنید…",
}: CalculatorControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        aria-label="جستجوی محاسبه‌گر"
        className="w-full"
      >
        <TextField
          type="search"
          label="جستجو در محاسبه‌گرها"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              onClearQuery();
            }
          }}
          placeholder={placeholder}
          leadingIcon={<IconSearch size={20} />}
          endAdornment={
            query ? (
              <button
                type="button"
                onClick={onClearQuery}
                aria-label="پاک کردن جستجو"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <IconClose size={18} />
              </button>
            ) : undefined
          }
          fullWidth
        />
      </form>

      <div className="flex items-center gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-lg">
          <CalculatorFilter
            label="دسته"
            allLabel="همهٔ دسته‌ها"
            options={categories}
            value={activeCategory}
            onChange={onCategoryChange}
          />
          {statuses.length > 1 && (
            <CalculatorFilter
              label="اعتبار"
              allLabel="همهٔ سطوح"
              options={statuses}
              value={activeStatus}
              onChange={onStatusChange}
            />
          )}
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex shrink-0 items-center gap-1 rounded-small text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <IconClose size={14} />
            <span className="hidden mobile-l:inline">پاک کردن</span>
          </button>
        )}
      </div>
    </div>
  );
}
