// ============================================================
// LEGALIR — My contracts (SECTION 2)
// ============================================================
// The second thing the page answers: «قراردادهایی که قبلاً ساخته یا
// شروع کرده‌ام کجا هستند؟»
//
// The rules this section owns:
//   • TWO independent subsections on the unfiltered «همه» view —
//       «نیازمند ادامه»  — every contract the user must still finish,
//       «قراردادهای آماده» — every finished/ready contract.
//     Each has its own title, its own count, its own colour cue
//     (primary vs. success) and its own empty guidance when the whole
//     list is empty.
//   • at most THREE ROWS of cards per subsection before «مشاهده
//     بیشتر»: 3 on a phone (1 column), 6 on a tablet (2 columns), 9
//     from `laptop` up (3 columns). The column count drops with the
//     viewport, and the page itself never scrolls sideways.
//   • «بایگانی» keeps its own subsection, using the same treatment.
//   • a filtered view is shown flat — filters are the user's chosen
//     narrowing, so mixing in subsection headers would only add noise.
//   • the coarse lifecycle tabs inline on desktop, the finer axes
//     (draft / analysis / type / recency) behind «فیلترهای بیشتر»,
//     and the SAME finer axes in a mobile drawer.
//
// The filter state itself is NOT owned here — it lives in the URL and
// is passed in as `filters` / `onFiltersChange`.
// ============================================================

"use client";

import React from "react";
import type { UnifiedContract } from "@/lib/contracts/unified";
import { groupUnifiedContracts } from "@/lib/contracts/unified";
import { CONTRACT_TABS, type ContractTab } from "@/lib/contracts/status";
import {
  activeFilterChips,
  applyContractFilters,
  contractTypeOptions,
  removeFilterChip,
  sortContractList,
  CONTRACT_SORT_LABELS,
  CONTRACT_SORT_ORDER,
  type ActiveFilterChip,
  type ContractFilterState,
  type ContractSortKey,
} from "@/lib/contracts/filters";
import { trackContractEvent } from "@/lib/contracts/analytics";
import { toPersianNumber } from "@/lib/persian-utils";
import { Dialog, Drawer, Select, Button } from "@legalir/ui";
import {
  IconCheck,
  IconContract,
  IconFilter,
  IconHistory,
  IconRefresh,
} from "@/lib/icons";
import { ResultsBar, type ActiveFilter } from "@/components/shared";
import { UserContractCard } from "./user-contract-card";
import { ContractsEmptyState } from "./contracts-empty-state";
import { ContractFilterPanel } from "./contract-filter-panel";

/** Rows shown per subsection before «مشاهده بیشتر». */
const MAX_ROWS = 3;

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
  /**
   * The mobile filter drawer is CONTROLLED by the page, because the trigger
   * that opens it lives in the search card. Optional so the component
   * still renders standalone (unit tests) with it closed.
   */
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
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

/**
 * How many cards a subsection shows initially: exactly MAX_ROWS rows at
 * the CURRENT grid width (3 / 2 / 1 columns), so the grid is always a
 * complete rectangle and the cap is expressed in rows, not in cards.
 *
 * Starts at the desktop value so the first client render matches the
 * widest layout; the effect then narrows it on smaller viewports.
 */
function useInitialPerSubsection(): number {
  const [perSubsection, setPerSubsection] = React.useState(MAX_ROWS * 3);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const laptop = window.matchMedia("(min-width: 900px)");
    const tablet = window.matchMedia("(min-width: 600px)");
    const sync = () => {
      const columns = laptop.matches ? 3 : tablet.matches ? 2 : 1;
      setPerSubsection(MAX_ROWS * columns);
    };
    sync();
    laptop.addEventListener("change", sync);
    tablet.addEventListener("change", sync);
    return () => {
      laptop.removeEventListener("change", sync);
      tablet.removeEventListener("change", sync);
    };
  }, []);

  return perSubsection;
}

interface SubsectionTone {
  icon: React.ReactNode;
  /** The wrapper's tone — a tinted surface, never colour alone. */
  wrapper: string;
  /** The small label / icon colour for the subsection. */
  cue: string;
}

const SUBSECTION_TONES: Record<string, SubsectionTone> = {
  "needs-work": {
    icon: <IconHistory size={16} aria-hidden="true" />,
    wrapper:
      "border-[color:color-mix(in_srgb,var(--color-primary)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--color-primary-container)_46%,transparent)]",
    cue: "text-primary",
  },
  ready: {
    icon: <IconCheck size={16} aria-hidden="true" />,
    wrapper: "border-[color:var(--color-outline-variant)] bg-surface-container-low",
    cue: "text-success-700",
  },
  archived: {
    icon: <IconContract size={16} aria-hidden="true" />,
    wrapper: "border-divider bg-surface-container-low/60",
    cue: "text-muted",
  },
};

/** The two primary subsections, always rendered — an empty one still
 *  tells the user what belongs there. «بایگانی» appears only when it has
 *  contracts, because it is not a step in the workflow. */
const PRIMARY_SUBSECTIONS = [
  { key: "needs-work", titleFa: "نیازمند ادامه" },
  { key: "ready", titleFa: "قراردادهای آماده" },
] as const;

const SUBSECTION_EMPTY_HINT: Record<string, string> = {
  "needs-work": "قراردادی برای ادامه ندارید؛ همه قراردادهای شما تکمیل شده‌اند.",
  ready: "قراردادهای تکمیل‌شده پس از آماده شدن متن، در این بخش قرار می‌گیرند.",
};

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
  drawerOpen = false,
  onDrawerOpenChange,
}: MyContractsSectionProps) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  // How many extra row-pages the user asked for, per subsection.
  const [extraPages, setExtraPages] = React.useState<Record<string, number>>({});
  const setDrawerOpen = (open: boolean) => onDrawerOpenChange?.(open);
  const initialPerSubsection = useInitialPerSubsection();

  const typeOptions = React.useMemo(() => contractTypeOptions(contracts), [contracts]);

  // The whole filter state, applied in one place (AND between groups,
  // OR within a group) then ordered by the chosen sort key.
  const visible = React.useMemo(() => {
    const filtered = applyContractFilters(contracts, filters);
    return sortContractList(filtered, filters.sort);
  }, [contracts, filters]);

  const chips = React.useMemo(() => activeFilterChips(filters), [filters]);
  const finerActive = hasFinerFilters(filters);

  // The shared results bar takes the same active filters, each individually
  // removable, so this list reads with one results/clear vocabulary.
  const activeFilterList: ActiveFilter[] = React.useMemo(
    () =>
      chips.map((chip) => ({
        key: `${chip.group}:${chip.value}`,
        label: chip.labelFa,
        onRemove: () => removeChip(chip),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chips, filters]
  );

  // The subsectioned view is only meaningful on the unfiltered «همه»
  // view — a filtered list is shown flat.
  const showGrouped = filters.tab === "all" && !finerActive;
  const groups = React.useMemo(
    () => (showGrouped ? groupUnifiedContracts(visible) : []),
    [visible, showGrouped]
  );

  // A narrowing filter can shrink a list; the extra-page counters must
  // not carry over and open a subsection on page 3 of nothing.
  React.useEffect(() => {
    setExtraPages({});
  }, [filters]);

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
      {/* The mobile filter trigger lives in the search card above, so this
          heading is a clean full-width line. */}
      <h2 id="my-contracts-heading" className="text-h4 text-on-surface">
        قراردادهای من
      </h2>

      {/* Desktop filter bar — the coarse tabs on one row, the finer axes
          behind «فیلترهای بیشتر», and the sort control. */}
      <div className="hidden items-center gap-3 tablet:flex">
        <div
          role="tablist"
          aria-label="فیلتر وضعیت"
          className="-mb-1 flex flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-medium border px-3 text-labelLarge transition-colors",
            finerActive
              ? "border-primary text-primary"
              : "border-divider text-on-surface hover:border-control-selected",
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
        <ResultsBar
          countLabel={`${toPersianNumber(visible.length)} قرارداد`}
          filters={activeFilterList}
          onClearAll={clearFilters}
        />
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
            <Button
              type="button"
              onClick={onRetry}
              startIcon={<IconRefresh size={18} />}
              className="mt-6"
            >
              تلاش مجدد
            </Button>
          )}
        </div>
      ) : contracts.length === 0 ? (
        <ContractsEmptyState variant="no-contracts" onStart={onStart} />
      ) : visible.length === 0 ? (
        <ContractsEmptyState variant="no-results" onClearFilters={clearFilters} />
      ) : showGrouped ? (
        <div className="space-y-5">
          {/* The two workflow subsections always render; «بایگانی» only
              when it holds something. A group is looked up by key, so an
              empty one keeps its heading, its tone and its guidance. */}
          {[
            ...PRIMARY_SUBSECTIONS.map((s) => ({ key: s.key, titleFa: s.titleFa })),
            ...groups.filter((g) => g.key === "archived").map((g) => ({
              key: g.key,
              titleFa: g.titleFa,
            })),
          ].map(({ key, titleFa }) => {
            const group = groups.find((g) => g.key === key);
            const groupContracts = group?.contracts ?? [];
            const tone = SUBSECTION_TONES[key] ?? SUBSECTION_TONES["ready"]!;
            const limit = initialPerSubsection * (1 + (extraPages[key] ?? 0));
            const shown = groupContracts.slice(0, limit);
            const remaining = groupContracts.length - shown.length;
            return (
              <section
                key={key}
                aria-labelledby={`contracts-group-${key}`}
                className={`rounded-large border p-3 tablet:p-4 ${tone.wrapper}`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full bg-surface ${tone.cue}`}
                  >
                    {tone.icon}
                  </span>
                  <h3
                    id={`contracts-group-${key}`}
                    className="text-titleSmall text-on-surface"
                  >
                    {titleFa}
                  </h3>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-caption text-on-surface-variant">
                    {toPersianNumber(groupContracts.length)} قرارداد
                  </span>
                </div>

                {groupContracts.length === 0 ? (
                  <p className="rounded-medium bg-surface px-3 py-4 text-center text-body-2 text-muted">
                    {SUBSECTION_EMPTY_HINT[key]}
                  </p>
                ) : (
                  <ul className="grid auto-rows-fr grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
                    {shown.map((contract) => (
                      <li key={contract.id} className="h-full">
                        <UserContractCard
                          contract={contract}
                          layout="card"
                          onDelete={onDelete}
                          onCopyId={onCopyId}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {remaining > 0 && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() =>
                        setExtraPages((prev) => ({
                          ...prev,
                          [key]: (prev[key] ?? 0) + 1,
                        }))
                      }
                    >
                      مشاهده بیشتر
                      <span className="text-caption text-muted">
                        ({toPersianNumber(remaining)} مورد دیگر)
                      </span>
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          {visible.map((contract) => (
            <li key={contract.id} className="h-full">
              <UserContractCard
                contract={contract}
                layout="card"
                onDelete={onDelete}
                onCopyId={onCopyId}
              />
            </li>
          ))}
        </ul>
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
            {/* Clearing is not the dialog's purpose — it stays a quiet
                text action; applying is the one primary commit. */}
            <Button type="button" variant="text" onClick={clearFilters}>
              پاک کردن
            </Button>
            <Button type="button" onClick={() => setMoreOpen(false)}>
              اعمال
            </Button>
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
            <Button type="button" variant="outlined" onClick={clearFilters} fullWidth className="flex-1">
              پاک کردن
            </Button>
            <Button type="button" onClick={() => setDrawerOpen(false)} fullWidth className="flex-1">
              اعمال
            </Button>
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
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-labelMedium transition-colors ${
        selected
          ? "border-control-selected-border bg-control-selected-surface text-control-selected"
          : "border-control-unselected-border bg-control-unselected-bg text-onSurface hover:border-control-selected"
      }`}
    >
      {selected && <IconCheck size={14} aria-hidden="true" />}
      {label}
    </button>
  );
}

function ContractListSkeleton() {
  return (
    <div
      className="grid auto-rows-fr grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3"
      aria-label="در حال بارگذاری"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-large border border-divider bg-surface p-4 shadow-elevation-1"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-medium skeleton-shimmer" />
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
