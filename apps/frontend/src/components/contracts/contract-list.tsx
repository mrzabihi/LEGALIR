// ============================================================
// LEGALIR — Contract List (Phase 10)
// ============================================================

"use client";

import { useContracts } from "@/hooks/useContracts";
import {
  useDeletePropertyContract,
  usePropertyContracts,
} from "@/hooks/usePropertyContracts";
import { ContractCard } from "./contract-card";
import { PropertyContractCard } from "./property-contract-card";
import { ContractFilterBar } from "./filter-bar";
import { ContractTypeGrid } from "./type-grid";
import { useState } from "react";
import { ConfirmDialog, snackbar } from "@legalir/ui";
import type {
  PropertyContractListItem,
  V1ContractState,
  V1ContractCategory,
} from "@legalir/types";
import Link from "next/link";

export function ContractList() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<V1ContractState | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<V1ContractCategory | undefined>();
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");

  // The draft pending deletion, or null when the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<PropertyContractListItem | null>(null);
  const deleteContract = useDeletePropertyContract();

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    deleteContract.mutate(target.id, {
      onSuccess: () => {
        setPendingDelete(null);
        snackbar.show({ message: "پیش‌نویس قرارداد با موفقیت حذف شد.", variant: "success" });
      },
      onError: (err) => {
        // Keep the item in the list and surface the failure.
        snackbar.show({
          message: err instanceof Error ? err.message : "حذف پیش‌نویس با خطا مواجه شد.",
          variant: "error",
        });
      },
    });
  };

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

  // Contracts built in the Contract Operating System live in their own
  // table and endpoint, so they are listed separately from the legacy
  // V1 contracts. This is what makes "resume where you left off" work.
  const { data: propertyData } = usePropertyContracts({ pageSize: 20 });
  const propertyItems = propertyData?.items ?? [];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Always-visible type grid — the user can start any contract from
          here without leaving the list. Collapsed to one card row; a
          «مشاهده بیشتر» toggle reveals the rest in a scrollable list. */}
      <ContractTypeGrid />

      {/* Property contracts — the Contract Operating System */}
      {propertyItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-titleSmall text-on-surface">قراردادهای ملکی</h2>
          {propertyItems.map((contract) => (
            <PropertyContractCard
              key={contract.id}
              contract={contract}
              onDelete={setPendingDelete}
            />
          ))}
        </section>
      )}

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

      {/* Delete-draft confirmation. Nothing is deleted until the user
          explicitly confirms; cancel closes with no side effects. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleteContract.isPending) setPendingDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="حذف پیش‌نویس قرارداد؟"
        description="آیا از حذف این پیش‌نویس مطمئن هستید؟ پس از حذف، دیگر به اطلاعات این پیش‌نویس دسترسی نخواهید داشت و امکان ادامه یا ویرایش آن وجود ندارد."
        confirmLabel="حذف پیش‌نویس"
        cancelLabel="انصراف"
        destructive
        loading={deleteContract.isPending}
      />
    </div>
  );
}
