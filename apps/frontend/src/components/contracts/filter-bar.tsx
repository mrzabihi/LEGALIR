// ============================================================
// LEGALIR — Contract Filter Bar (Phase 10)
// ============================================================

import type { V1ContractState, V1ContractCategory } from "@legalir/types";
import { V1_CONTRACT_STATE_LABELS } from "@legalir/types";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  stateFilter: V1ContractState | undefined;
  onStateFilterChange: (state: V1ContractState | undefined) => void;
  categoryFilter: V1ContractCategory | undefined;
  onCategoryFilterChange: (cat: V1ContractCategory | undefined) => void;
  sort: "newest" | "oldest" | "title";
  onSortChange: (sort: "newest" | "oldest" | "title") => void;
}

const stateOptions: V1ContractState[] = [
  "draft",
  "collecting",
  "generated",
  "under_review",
  "approved",
  "exported",
  "archived",
];

export function ContractFilterBar({
  search,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sort,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو در قراردادها..."
          className="w-full rounded-medium bg-surface-container px-4 py-3 text-body-2 text-on-surface placeholder:text-muted border border-divider focus:outline-none focus:ring-2 focus:ring-primary touch-target"
          aria-label="جستجو در قراردادها"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col tablet:flex-row gap-2">
        {/* State Filter — equal-width chips in a single row */}
        <div className="flex flex-1 gap-1">
          <button
            onClick={() => onStateFilterChange(undefined)}
            className={`flex-1 min-w-0 rounded-small px-2 py-1.5 text-caption text-center transition-colors touch-target ${
              !stateFilter
                ? "bg-primary text-white"
                : "bg-surface-container text-muted hover:bg-surface-container-high"
            }`}
          >
            همه
          </button>
          {stateOptions.map((s) => (
            <button
              key={s}
              onClick={() => onStateFilterChange(s)}
              className={`flex-1 min-w-0 rounded-small px-2 py-1.5 text-caption text-center transition-colors touch-target ${
                stateFilter === s
                  ? "bg-primary text-white"
                  : "bg-surface-container text-muted hover:bg-surface-container-high"
              }`}
            >
              {V1_CONTRACT_STATE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ms-auto rtl:ms-auto rtl:me-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter ?? ""}
            onChange={(e) =>
              onCategoryFilterChange(
                (e.target.value as V1ContractCategory) || undefined
              )
            }
            className="rounded-medium bg-surface-container px-3 py-1.5 text-caption border border-divider touch-target"
            aria-label="دسته‌بندی"
          >
            <option value="">همه دسته‌ها</option>
            <option value="personal">شخصی</option>
            <option value="business">تجاری</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "newest" | "oldest" | "title")
            }
            className="rounded-medium bg-surface-container px-3 py-1.5 text-caption border border-divider touch-target"
            aria-label="مرتب‌سازی"
          >
            <option value="newest">جدیدترین</option>
            <option value="oldest">قدیمی‌ترین</option>
            <option value="title">الفبا</option>
          </select>
        </div>
      </div>
    </div>
  );
}
