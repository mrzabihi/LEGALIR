// ============================================================
// LEGALIR — My contracts (SECTION 2)
// ============================================================
// The second thing the page answers: "قراردادهایی که قبلاً ساخته یا
// شروع کرده‌ام کجا هستند؟"
//
// The rules this section owns:
//   • draft priority — resumable contracts surface first;
//   • a dedicated «ادامه دهید» block for drafts, hidden when there
//     are none;
//   • smart grouping on "همه" (نیازمند ادامه / آماده / بایگانی) — but
//     ONLY when no finer filter is active, so a filtered view is a
//     plain, predictable list;
//   • at most eight cards per group, with «مشاهده بیشتر» that expands
//     in place;
//   • the coarse lifecycle tabs inline on desktop, the finer axes
//     (draft / analysis / type / recency) behind «فیلترهای بیشتر»;
//   • the SAME finer axes in a mobile drawer.
//
// The filter state itself is NOT owned here — it lives in the URL and
// is passed in as `filters` / `onFiltersChange`, so browser Back works
// and a filtered view survives a refresh. This component only reads it
// and asks the page to change it.
// ============================================================

"use client";

import React from "react";
import type { UnifiedContract } from "@/lib/contracts/unified";
import { groupUnifiedContracts, resumableContracts } from "@/lib/contracts/unified";
import { CONTRACT_TABS, type ContractTab } from "@/lib/contracts/status";
import {
  activeFilterChips,
  applyContractFilters,
  contractTypeOptions,
  hasActiveFilters,
  removeFilterChip,
  sortContractList,
  CONTRACT_SORT_LABELS,
  CONTRACT_SORT_ORDER,
  type ActiveFilterChip,
  type ContractFilterState,
  type ContractSortKey,
} from "@/lib/contracts/filters";
import { trackContractEvent } from "@/lib/contracts/analytics";
import { Dialog, Drawer, Select } from "@legalir/ui";
import { IconClose, IconFilter, IconHistory, IconRefresh } from "@/lib/icons";
import { UserContractCard } from "./user-contract-card";
import { ContractsEmptyState } from "./contracts-empty-state";
import { ContractFilterPanel } from "./contract-filter-panel";

/** How many cards a group shows before «مشاهده بیشتر». */
const GROUP_LIMIT = 8;

interface MyContractsSectionProps {
  contracts: UnifiedContract[];
  isLoading: boolean;
  /** True when the list could not be loaded — shows a retry affordance. */
  isError?: boolean;
  /** Retry the failed list load. */
  onRetry?: () => void;
  /** Opens the delete-confirmation dialog. */
  onDelete: (contract: UnifiedContract) => void;
  /** Copies a contract's id to the clipboard. */
  onCopyId: (contract: UnifiedContract) => void;
  /** The whole filter state — owned by the page (URL-backed). */
  filters: ContractFilterState;
  /** Ask the page to replace the filter state. */
  onFiltersChange: (next: ContractFilterState) => void;
  /** Called when the user asks to start a contract from the empty state. */
  onStart?: () => void;
}

/** True when any axis beyond the coarse tab is narrowing the list. */
function hasFinerFilters(filters: ContractFilterState): boolean {
  return (
    filters.draft.length > 0 ||
    filters.analysis.length > 0 ||
    filters.types.length > 0 ||
    filters.dateRange !== "any"
  );
}

export function MyContractsSection({
  contracts,
  isLoading,
  isError = false,
  onRetry,
  onDelete,
  onCopyId,
  filters,
  onFiltersChange,
  onStart,
}: MyContractsSectionProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const typeOptions = React.useMemo(() => contractTypeOptions(contracts), [contracts]);

  // The whole filter state, applied in one place (AND between groups,
  // OR within a group) then ordered by the chosen sort key.
  const visible = React.useMemo(() => {
    const filtered = applyContractFilters(contracts, filters);
    return sortContractList(filtered, filters.sort);
  }, [contracts, filters]);

  const chips = React.useMemo(() => activeFilterChips(filters), [filters]);
  const finerActive = hasFinerFilters(filters);

  // The «ادامه دهید» block and the grouped view are only meaningful on
  // the unfiltered «همه» view — a filtered list is shown flat.
  const showGrouped = filters.tab === "all" && !finerActive;
  const drafts = React.useMemo(
    () => (showGrouped ? resumableContracts(visible) : []),
    [visible, showGrouped]
  );
  const groups = React.useMemo(
    () => (showGrouped ? groupUnifiedContracts(visible) : []),
    [visible, showGrouped]
  );

  const setTab = (tab: ContractTab) => {
    onFiltersChange({ ...filters, tab });
    trackContractEvent("contract_status_filtered", { status: tab });
  };

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      tab: "all",
      query: "",
      draft: [],
      analysis: [],
      types: [],
      dateRange: "any",
      sort: "updated",
    });
  };

  const removeChip = (chip: ActiveFilterChip) => {
    onFiltersChange(removeFilterChip(filters, chip));
  };

  return (
    <section className="space-y-4" aria-labelledby="my-contracts-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-contracts-heading" className="text-h4 text-on-surface">
          قراردادهای من
        </h2>

        {/* Mobile: the finer axes live in a drawer. */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="tablet:hidden inline-flex h-10 items-center gap-1.5 rounded-medium border border-divider px-3 text-labelLarge text-on-surface"
        >
          <IconFilter size={18} />
          فیلترها
          {finerActive && (
            <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on">
              {filters.draft.length +
                filters.analysis.length +
                filters.types.length +
                (filters.dateRange !== "any" ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Desktop filter bar — the coarse tabs on one row, the finer axes
          behind «فیلترهای بیشتر», and the sort control. */}
      <div className="hidden tablet:flex items-center gap-3">
        <div
          role="tablist"
          aria-label="فیلتر وضعیت"
          className="flex flex-1 gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CONTRACT_TABS.map((tab) => (
            <TabChip
              key={tab.key}
              label={tab.labelFa}
              selected={filters.tab === tab.key}
              onClick={() => setTab(tab.key)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={[
            "shrink-0 inline-flex h-10 items-center gap-1.5 rounded-medium border px-3 text-labelLarge transition-colors",
            finerActive
              ? "border-primary text-primary"
              : "border-divider text-on-surface hover:border-control-selected/50",
          ].join(" ")}
        >
          <IconFilter size={18} />
          فیلترهای بیشتر
          {finerActive && (
            <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption text-primary-on">
              {filters.draft.length +
                filters.analysis.length +
                filters.types.length +
                (filters.dateRange !== "any" ? 1 : 0)}
            </span>
          )}
        </button>

        <Select
          label="مرتب‌سازی"
          value={filters.sort}
          onChange={(e) => {
            onFiltersChange({ ...filters, sort: e.target.value as ContractSortKey });
            trackContractEvent("contract_sort_changed", { sort: e.target.value });
          }}
          selectSize="small"
          className="shrink-0"
          options={CONTRACT_SORT_ORDER.map((key) => ({
            value: key,
            label: CONTRACT_SORT_LABELS[key],
          }))}
        />
      </div>

      {/* Result count + the removable active-filter chips. */}
      {!isLoading && !isError && contracts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted">
            {visible.length} قرارداد
          </span>
          {chips.map((chip) => (
            <button
              key={`${chip.group}:${chip.value}`}
              type="button"
              onClick={() => removeChip(chip)}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-divider bg-surface px-2.5 text-caption text-on-surface transition-colors hover:border-error/40 hover:text-error"
              aria-label={`حذف فیلتر ${chip.labelFa}`}
            >
              {chip.labelFa}
              <IconClose size={12} />
            </button>
          ))}
          {chips.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-caption text-primary hover:underline"
            >
              پاک کردن همه
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <ContractListSkeleton />
      ) : isError ? (
        <div
          className="flex flex-col items-center justify-center rounded-large border border-divider bg-surface px-4 py-12 text-center"
          role="alert"
        >
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-50 text-error">
            <IconRefresh size={28} />
          </span>
          <h3 className="text-titleMedium text-on-surface">بارگذاری قراردادها ناموفق بود</h3>
          <p className="mt-1 max-w-sm text-body-2 text-muted">
            ارتباط با سرور برقرار نشد. دوباره تلاش کنید.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-medium bg-primary px-4 text-labelLarge text-primary-on transition-colors hover:state-hover"
            >
              <IconRefresh size={18} />
              تلاش مجدد
            </button>
          )}
        </div>
      ) : contracts.length === 0 ? (
        <ContractsEmptyState variant="no-contracts" onStart={onStart} />
      ) : visible.length === 0 ? (
        <ContractsEmptyState variant="no-results" onClearFilters={clearFilters} />
      ) : (
        <div className="space-y-6">
          {/* «ادامه دهید» — the drafts the user can pick up right now.
              Hidden entirely when there are none. */}
          {drafts.length > 0 && (
            <div className="rounded-large border border-primary/30 bg-primary/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <IconHistory size={18} className="text-primary" />
                <h3 className="text-titleSmall text-on-surface">ادامه دهید</h3>
                <span className="text-caption text-muted">
                  {drafts.length} قرارداد نیمه‌تمام
                </span>
              </div>
              <div className="grid grid-cols-1 laptop:grid-cols-2 gap-3">
                {drafts.slice(0, 4).map((contract) => (
                  <UserContractCard
                    key={contract.id}
                    contract={contract}
                    onDelete={onDelete}
                    onCopyId={onCopyId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grouped view on the unfiltered «همه» tab, flat list otherwise. */}
          {showGrouped
            ? groups.map((group) => {
                const expanded = expandedGroups[group.key] ?? false;
                const shown = expanded
                  ? group.contracts
                  : group.contracts.slice(0, GROUP_LIMIT);
                return (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-titleSmall text-on-surface">{group.titleFa}</h3>
                      <span className="text-caption text-muted">
                        {group.contracts.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 laptop:grid-cols-2 gap-3">
                      {shown.map((contract) => (
                        <UserContractCard
                          key={contract.id}
                          contract={contract}
                          onDelete={onDelete}
                          onCopyId={onCopyId}
                        />
                      ))}
                    </div>
                    {group.contracts.length > GROUP_LIMIT && !expanded && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups((prev) => ({ ...prev, [group.key]: true }))
                        }
                        className="text-labelLarge text-primary hover:underline"
                      >
                        مشاهده بیشتر ({group.contracts.length - GROUP_LIMIT} مورد دیگر)
                      </button>
                    )}
                  </div>
                );
              })
            : (
              <div className="grid grid-cols-1 laptop:grid-cols-2 gap-3">
                {visible.map((contract) => (
                  <UserContractCard
                    key={contract.id}
                    contract={contract}
                    onDelete={onDelete}
                    onCopyId={onCopyId}
                  />
                ))}
              </div>
            )}
        </div>
      )}

      {/* Desktop «فیلترهای بیشتر» — the finer axes in a dialog. */}
      <Dialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="فیلترهای بیشتر"
        description="قراردادها را بر اساس وضعیت پیش‌نویس، وضعیت بررسی، نوع و بازه زمانی محدود کنید."
        maxWidth="md"
        actions={
          <>
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-medium px-4 text-labelLarge text-primary transition-colors hover:state-hover"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="h-10 rounded-medium bg-primary px-4 text-labelLarge text-primary-on transition-colors hover:state-hover"
            >
              اعمال
            </button>
          </>
        }
      >
        <ContractFilterPanel
          filters={filters}
          onChange={onFiltersChange}
          typeOptions={typeOptions}
        />
      </Dialog>

      {/* Mobile drawer — the SAME panel, so the two can never drift. */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="فیلتر و مرتب‌سازی"
        width={340}
      >
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-labelLarge text-on-surface">وضعیت</legend>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TABS.map((tab) => (
                <TabChip
                  key={tab.key}
                  label={tab.labelFa}
                  selected={filters.tab === tab.key}
                  onClick={() => setTab(tab.key)}
                />
              ))}
            </div>
          </fieldset>

          <ContractFilterPanel
            filters={filters}
            onChange={onFiltersChange}
            typeOptions={typeOptions}
          />

          <Select
            id="contract-sort-mobile"
            label="مرتب‌سازی"
            value={filters.sort}
            onChange={(e) =>
              onFiltersChange({ ...filters, sort: e.target.value as ContractSortKey })
            }
            fullWidth
            options={CONTRACT_SORT_ORDER.map((key) => ({
              value: key,
              label: CONTRACT_SORT_LABELS[key],
            }))}
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 flex-1 rounded-medium border border-outline text-labelLarge text-primary transition-colors hover:state-hover"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="h-11 flex-1 rounded-medium bg-primary text-labelLarge text-primary-on transition-colors hover:state-hover"
            >
              اعمال
            </button>
          </div>
        </div>
      </Drawer>
    </section>
  );
}

function TabChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`shrink-0 h-9 rounded-full border px-3.5 text-labelMedium transition-colors ${
        selected
          ? "border-control-selected-border bg-control-selected-surface text-control-selected"
          : "border-control-unselected-border bg-control-unselected-bg text-onSurface hover:border-control-selected/50"
      }`}
    >
      {label}
    </button>
  );
}

function ContractListSkeleton() {
  return (
    <div className="grid grid-cols-1 laptop:grid-cols-2 gap-3" aria-label="در حال بارگذاری">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-large border border-divider bg-surface p-4 shadow-elevation-1"
        >
          <div className="flex items-start gap-3">
            <div className="hidden mobile-l:block h-14 w-20 rounded-medium skeleton-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 rounded-small skeleton-shimmer" />
              <div className="h-4 w-28 rounded-small skeleton-shimmer" />
              <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
