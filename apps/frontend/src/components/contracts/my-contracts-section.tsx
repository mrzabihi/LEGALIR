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
//   • smart grouping on "همه" (نیازمند ادامه / در حال بررسی / آماده /
//     بایگانی);
//   • at most eight cards per group, with «مشاهده بیشتر» that expands
//     in place and preserves the active filters;
//   • status chips inline on desktop, in a bottom sheet on mobile.
// ============================================================

"use client";

import React from "react";
import type { UnifiedContract } from "@/lib/contracts/unified";
import {
  groupUnifiedContracts,
  resumableContracts,
  sortUnifiedContracts,
} from "@/lib/contracts/unified";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_ORDER,
  type ContractStatusGroup,
} from "@/lib/contracts/status";
import { faIncludes } from "@/lib/contracts/search";
import { trackContractEvent } from "@/lib/contracts/analytics";
import { Select } from "@legalir/ui";
import { IconFilter, IconHistory } from "@/lib/icons";
import { UserContractCard } from "./user-contract-card";
import { ContractsEmptyState } from "./contracts-empty-state";
import {
  CONTRACT_SORT_LABELS,
  ContractsFilterSheet,
  type ContractSortKey,
} from "./contracts-filter-sheet";

/** How many cards a group shows before «مشاهده بیشتر». */
const GROUP_LIMIT = 8;

interface MyContractsSectionProps {
  contracts: UnifiedContract[];
  isLoading: boolean;
  /** Opens the delete-confirmation dialog. */
  onDelete: (contract: UnifiedContract) => void;
  /** Copies a contract's id to the clipboard. */
  onCopyId: (contract: UnifiedContract) => void;
  /** The shared search query from the page header. */
  query: string;
  /** Called when the user asks to start a contract from the empty state. */
  onStart?: () => void;
}

export function MyContractsSection({
  contracts,
  isLoading,
  onDelete,
  onCopyId,
  query,
  onStart,
}: MyContractsSectionProps) {
  const [status, setStatus] = React.useState<ContractStatusGroup | "all">("all");
  const [type, setType] = React.useState("");
  const [sort, setSort] = React.useState<ContractSortKey>("updated");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const hasFilters = status !== "all" || type !== "" || query.trim() !== "";

  const filtered = React.useMemo(() => {
    let list = contracts;
    if (status !== "all") list = list.filter((c) => c.status === status);
    if (type) list = list.filter((c) => c.type === type);
    if (query.trim()) {
      list = list.filter(
        (c) => faIncludes(c.title, query) || faIncludes(c.typeFa, query)
      );
    }
    return list;
  }, [contracts, status, type, query]);

  const sorted = React.useMemo(() => {
    const base = sortUnifiedContracts(filtered);
    if (sort === "updated") return base;
    if (sort === "created") {
      return [...base].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return [...base].sort((a, b) => a.title.localeCompare(b.title, "fa"));
  }, [filtered, sort]);

  const drafts = React.useMemo(
    () => (status === "all" && !type ? resumableContracts(filtered) : []),
    [filtered, status, type]
  );
  const groups = React.useMemo(
    () => (status === "all" ? groupUnifiedContracts(sorted) : []),
    [sorted, status]
  );

  const clearFilters = () => {
    setStatus("all");
    setType("");
    setSort("updated");
  };

  const changeStatus = (next: ContractStatusGroup | "all") => {
    setStatus(next);
    trackContractEvent("contract_status_filtered", { status: next });
  };

  return (
    <section className="space-y-4" aria-labelledby="my-contracts-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-contracts-heading" className="text-h4 text-on-surface">
          قراردادهای من
        </h2>

        {/* Mobile: filters live in a bottom sheet. */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="tablet:hidden inline-flex h-10 items-center gap-1.5 rounded-medium border border-divider px-3 text-labelLarge text-on-surface"
        >
          <IconFilter size={18} />
          فیلترها
        </button>
      </div>

      {/* Desktop filter bar — status chips + type + sort. */}
      <div className="hidden tablet:flex items-center gap-3">
        <div
          role="tablist"
          aria-label="فیلتر وضعیت"
          className="flex flex-1 gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <StatusChip
            label="همه"
            selected={status === "all"}
            onClick={() => changeStatus("all")}
          />
          {CONTRACT_STATUS_ORDER.map((key) => (
            <StatusChip
              key={key}
              label={CONTRACT_STATUS_LABELS[key]}
              selected={status === key}
              onClick={() => changeStatus(key)}
            />
          ))}
        </div>

        <Select
          label="نوع قرارداد"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            trackContractEvent("contract_type_filtered", { type: e.target.value });
          }}
          placeholder="همه انواع"
          selectSize="small"
          className="shrink-0"
          options={uniqueTypes(contracts).map((t) => ({ value: t.type, label: t.typeFa }))}
        />

        <Select
          label="مرتب‌سازی"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as ContractSortKey);
            trackContractEvent("contract_sort_changed", { sort: e.target.value });
          }}
          selectSize="small"
          className="shrink-0"
          options={(Object.keys(CONTRACT_SORT_LABELS) as ContractSortKey[]).map((key) => ({
            value: key,
            label: CONTRACT_SORT_LABELS[key],
          }))}
        />
      </div>

      {isLoading ? (
        <ContractListSkeleton />
      ) : contracts.length === 0 ? (
        <ContractsEmptyState variant="no-contracts" onStart={onStart} />
      ) : filtered.length === 0 ? (
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

          {/* Grouped view on "همه", flat list when a status is chosen. */}
          {status === "all"
            ? groups.map((group) => {
                const expanded = expandedGroups[group.key] ?? false;
                const visible = expanded
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
                      {visible.map((contract) => (
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
                {sorted.map((contract) => (
                  <UserContractCard
                    key={contract.id}
                    contract={contract}
                    onDelete={onDelete}
                    onCopyId={onCopyId}
                  />
                ))}
              </div>
            )}

          {hasFilters && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={clearFilters}
                className="text-labelLarge text-primary hover:underline"
              >
                پاک کردن فیلترها
              </button>
            </div>
          )}
        </div>
      )}

      <ContractsFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        status={status}
        onStatusChange={changeStatus}
        type={type}
        onTypeChange={setType}
        sort={sort}
        onSortChange={setSort}
        onClear={clearFilters}
      />
    </section>
  );
}

/** The distinct contract types present in the list, for the type filter. */
function uniqueTypes(contracts: UnifiedContract[]): { type: string; typeFa: string }[] {
  const seen = new Map<string, string>();
  for (const c of contracts) {
    if (!seen.has(c.type)) seen.set(c.type, c.typeFa);
  }
  return [...seen.entries()].map(([type, typeFa]) => ({ type, typeFa }));
}

function StatusChip({
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
