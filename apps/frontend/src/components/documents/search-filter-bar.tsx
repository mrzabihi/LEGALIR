// ============================================================
// LEGALIR — Search & Filter Bar
// Search input, status filter tabs, sort dropdown (Phase 9)
// ============================================================

"use client";

import { useCallback, type ChangeEvent } from "react";
import { IconSearch, IconClose } from "@/lib/icons";
import { TextField, Select, IconButton } from "@legalir/ui";
import type { V1DocumentFilter } from "@legalir/types";

// ============================================================
// Constants
// ============================================================

const STATUS_OPTIONS: { value: V1DocumentFilter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "ready", label: "آماده" },
  { value: "processing", label: "در حال پردازش" },
  { value: "failed", label: "خطا" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "name", label: "نام" },
];

// ============================================================
// SearchFilterBar component
// ============================================================

interface SearchFilterBarProps {
  search: string;
  status: string;
  sort: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

export function SearchFilterBar({
  search,
  status,
  sort,
  onSearchChange,
  onStatusChange,
  onSortChange,
}: SearchFilterBarProps) {
  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const handleClearSearch = useCallback(() => {
    onSearchChange("");
  }, [onSearchChange]);

  const handleStatusChange = useCallback(
    (value: string) => {
      onStatusChange(value);
    },
    [onStatusChange]
  );

  const handleSortChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onSortChange(e.target.value);
    },
    [onSortChange]
  );

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Search input */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TextField
            value={search}
            onChange={handleSearchChange}
            placeholder="جستجوی اسناد..."
            aria-label="جستجوی اسناد"
            startIcon={<IconSearch size={20} className="text-muted" />}
            fullWidth
          />
        </div>
        {search && (
          <IconButton
            label="پاک کردن جستجو"
            onClick={handleClearSearch}
            size="small"
            variant="standard"
          >
            <IconClose size={16} />
          </IconButton>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap tablet:flex-nowrap">
        {/* Status tabs */}
        <div
          role="tablist"
          aria-label="فیلتر وضعیت"
          className="flex items-center gap-1 overflow-x-auto pb-1 flex-1 scrollbar-hide"
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="tab"
              type="button"
              aria-selected={status === opt.value}
              aria-label={opt.label}
              onClick={() => handleStatusChange(opt.value)}
              className={[
                "shrink-0 px-3 py-1.5 rounded-medium text-caption font-medium transition-colors",
                status === opt.value
                  ? "bg-primary text-white"
                  : "bg-surface text-on-surface hover:bg-surface-hover border border-divider",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="shrink-0 min-w-[140px]">
          <Select
            value={sort}
            onChange={handleSortChange}
            options={SORT_OPTIONS}
            aria-label="مرتب‌سازی"
            placeholder="مرتب‌سازی"
            fullWidth
          />
        </div>
      </div>
    </div>
  );
}
