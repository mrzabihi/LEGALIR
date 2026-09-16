// ============================================================
// LEGALIR — Contract List (Phase 10)
// ============================================================

"use client";

import { useContracts } from "@/hooks/useContracts";
import { ContractCard } from "./contract-card";
import { ContractFilterBar } from "./filter-bar";
import { useState } from "react";
import type { V1ContractState, V1ContractCategory } from "@legalir/types";
import Link from "next/link";

export function ContractList() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<V1ContractState | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<V1ContractCategory | undefined>();
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useContracts({
    search: search || undefined,
    state: stateFilter,
    category: categoryFilter,
    sort,
  });

  return (
    <div className="space-y-4" dir="rtl">
      {/* Action bar — page title lives in PageContextHeader */}
      <div className="flex items-center justify-end">
        <Link
          href="/contracts/new"
          className="rounded-medium bg-primary text-white px-5 py-3 text-button hover:bg-primary-dark transition-colors touch-target inline-flex items-center gap-2"
        >
          <span aria-hidden="true">+</span>
          قرارداد جدید
        </Link>
      </div>

      {/* Filters */}
      <ContractFilterBar
        search={search}
        onSearchChange={setSearch}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3" aria-label="در حال بارگذاری">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-large bg-surface p-4 shadow-elevation-1 border border-divider animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-medium bg-surface-container-high" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-surface-container-high rounded-small" />
                  <div className="h-4 w-32 bg-surface-container-high rounded-small" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-h3 text-on-surface mb-2">خطا در دریافت اطلاعات</h3>
          <p className="text-body-2 text-muted mb-4">
            {(error as Error)?.message ?? "خطای نامشخص"}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-medium bg-primary text-white px-5 py-3 text-button touch-target"
          >
            تلاش مجدد
          </button>
        </div>
      ) : !data?.items.length ? (
        <div className="rounded-large bg-surface p-8 shadow-elevation-1 border border-divider text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-h3 text-on-surface mb-2">
            {search || stateFilter || categoryFilter
              ? "قراردادی با این شرایط یافت نشد"
              : "هنوز قراردادی ایجاد نکرده‌اید"}
          </h3>
          <p className="text-body-2 text-muted mb-4">
            {search || stateFilter || categoryFilter
              ? "لطفاً فیلترها را تغییر دهید"
              : "با پاسخ به پرسش‌نامه، پیش‌نویس قرارداد شخصی‌سازی‌شده دریافت کنید"}
          </p>
          {!search && !stateFilter && !categoryFilter && (
            <Link
              href="/contracts/new"
              className="rounded-medium bg-primary text-white px-5 py-3 text-button touch-target inline-block"
            >
              ساخت قرارداد
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}
    </div>
  );
}
