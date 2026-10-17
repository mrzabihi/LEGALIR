// ============================================================
// LEGALIR — Contracts workspace body (the «قراردادهای فعال» panel)
// ============================================================
// Rendered inside the /contracts hub's active view. The page header and
// the view switcher are owned by the hub; this body answers two questions,
// in this fixed order:
//
//   SECTION 1 — «چه قراردادی می‌توانم بسازم؟»
//     the configurable-contract rail, filtered by the shared search
//     query and the category chips, with a prominent link to the full
//     paginated listing.
//
//   SECTION 2 — «قراردادهایی که قبلاً ساخته یا شروع کرده‌ام کجا هستند؟»
//     the user's own contracts, split into «نیازمند ادامه» and
//     «قراردادهای آماده» (plus «بایگانی»), three rows at a time.
//
//   SECTION 3 — two promotions for OTHER real services.
//
// The order is a product requirement, not a layout accident: the page
// must always offer "start something new" before "resume something old",
// and the promotions must never sit above either.
//
// The search query, the template category AND the whole contract filter
// state live in the URL, so a filtered view survives refresh,
// deep-linking and browser back/forward. This component OWNS that
// state (it is the single writer) and hands it down; the sections only
// read it and ask for changes.
// ============================================================

"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog, snackbar } from "@legalir/ui";
import { useContracts } from "@/hooks/useContracts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDeletePropertyContract, usePropertyContracts } from "@/hooks/usePropertyContracts";
import { useStartContract } from "@/hooks/useStartContract";
import {
  toUnifiedPropertyContract,
  toUnifiedV1Contract,
  type UnifiedContract,
} from "@/lib/contracts/unified";
import type { TemplateCategory } from "@/lib/contracts/categories";
import {
  parseContractFilters,
  serializeContractFilters,
  type ContractFilterState,
} from "@/lib/contracts/filters";
import { trackContractEvent } from "@/lib/contracts/analytics";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { ContractSearch } from "./contract-search";
import { ContractCategoryChips } from "./contract-category-chips";
import { ContractTemplateGrid } from "./contract-template-grid";
import { ContractTemplatePreview } from "./contract-template-preview";
import { MyContractsSection } from "./my-contracts-section";
import { ContractsPromos } from "./contracts-promos";

// How long typing must pause before the buffered query is applied to the
// grid and the URL. Long enough to finish a word, short enough to feel
// eager; the Enter key bypasses it and applies at once.
const SEARCH_DEBOUNCE_MS = 400;

interface ContractListProps {
  /**
   * Rendered right BELOW the search card — the hub's shared view switcher.
   * A slot (not a fixed child) so the hub owns ONE switcher element for
   * both views while the search card that must precede it lives here.
   */
  headerSlot?: React.ReactNode;
}

export function ContractList({ headerSlot }: ContractListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The mobile filter drawer is opened from the search card (below), so its
  // open state lives here and is handed down to the section that owns it.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // --- URL-backed state (single source of truth) ---------------------
  // The template category and the contract filter state are two
  // independent URL slices; both are read here and written back through
  // one helper so neither clobbers the other.
  const category = (searchParams.get("category") as TemplateCategory | null) ?? "all";
  const filters = React.useMemo(
    () => parseContractFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  // The writer always starts from the URL as it is RIGHT NOW rather than
  // from a captured `searchParams` snapshot: the debounced query, a
  // category chip and a filter change can land in the same tick, and the
  // later write must not rebuild the URL from an older snapshot.
  const writeParams = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const base =
        typeof window === "undefined" ? searchParams.toString() : window.location.search;
      const next = new URLSearchParams(base);
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `/contracts?${qs}` : "/contracts", { scroll: false });
    },
    [router, searchParams]
  );

  const setFilters = React.useCallback(
    (next: ContractFilterState) => {
      const serialized = serializeContractFilters(next);
      writeParams((params) => {
        // Replace the whole filter slice, leaving `category` untouched.
        for (const key of ["tab", "q", "draft", "analysis", "type", "range", "sort"]) {
          params.delete(key);
        }
        serialized.forEach((value, key) => params.set(key, value));
      });
    },
    [writeParams]
  );

  // --- Search: type freely, query on pause --------------------------
  // `searchInput` is what the user is typing; the query that actually
  // filters the grid (and lands in the URL) is only written once typing
  // pauses. Enter bypasses the wait and applies at once. This keeps the
  // URL — and every result — quiet between keystrokes instead of
  // re-filtering on every character.
  const [searchInput, setSearchInput] = React.useState(filters.query);
  const debouncedQuery = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  // The value THIS component last committed to `?q=`. The sync effect
  // below must ignore it: adopting it would delete anything typed after
  // the pause, because the URL always trails the field by one debounce.
  const selfWrittenQuery = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (debouncedQuery === filters.query) return;
    selfWrittenQuery.current = debouncedQuery;
    setFilters({ ...filters, query: debouncedQuery });
  }, [debouncedQuery, filters, setFilters]);

  // Keep the field in sync when Back/Forward changes `?q=` — but never
  // overwrite the field with a value this component just committed.
  React.useEffect(() => {
    if (selfWrittenQuery.current === filters.query) return;
    setSearchInput((current) => (current === filters.query ? current : filters.query));
  }, [filters.query]);

  const submitQuery = () => {
    trackContractEvent("contract_search_performed", { query: searchInput });
    if (searchInput !== filters.query) setFilters({ ...filters, query: searchInput });
  };

  const setCategory = (value: TemplateCategory) => {
    writeParams((params) => {
      if (value === "all") params.delete("category");
      else params.set("category", value);
    });
    trackContractEvent("contract_category_selected", { category: value });
  };

  // --- Data ----------------------------------------------------------
  // Contract-OS contracts and legacy V1 contracts live in separate
  // tables/endpoints; both are folded into one `UnifiedContract` list so
  // the page has a single, lifecycle-agnostic view of the user's work.
  const {
    data: propertyData,
    isLoading: propertyLoading,
    isError: propertyError,
    refetch: refetchProperty,
  } = usePropertyContracts({ pageSize: 50 });
  const {
    data: v1Data,
    isLoading: v1Loading,
    isError: v1Error,
    refetch: refetchV1,
  } = useContracts({});

  const contracts = React.useMemo<UnifiedContract[]>(() => {
    const os = (propertyData?.items ?? []).map(toUnifiedPropertyContract);
    const v1 = (v1Data?.items ?? []).map(toUnifiedV1Contract);
    return [...os, ...v1];
  }, [propertyData, v1Data]);

  const isLoading = propertyLoading || v1Loading;
  const isError = propertyError || v1Error;
  const refetchAll = React.useCallback(() => {
    void refetchProperty();
    void refetchV1();
  }, [refetchProperty, refetchV1]);

  // --- Start a new contract -----------------------------------------
  // The shared hook owns the create → wizard flow, so the rail and the
  // full /contracts/templates listing behave identically.
  const { start: handleStart, startingTypeId } = useStartContract();

  // The structure preview is read-only; starting remains the card's CTA.
  const [previewed, setPreviewed] = React.useState<ContractDefinition | null>(null);

  // --- Delete a draft ------------------------------------------------
  const [pendingDelete, setPendingDelete] = React.useState<UnifiedContract | null>(null);
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
        snackbar.show({
          message: err instanceof Error ? err.message : "حذف پیش‌نویس با خطا مواجه شد.",
          variant: "error",
        });
      },
    });
  };

  const handleCopyId = (contract: UnifiedContract) => {
    void navigator.clipboard?.writeText(contract.referenceCode).then(
      () => snackbar.show({ message: "شناسه قرارداد کپی شد.", variant: "success" }),
      () => snackbar.show({ message: "کپی شناسه انجام نشد.", variant: "error" })
    );
  };

  const scrollToTemplates = React.useCallback(() => {
    document
      .getElementById("templates-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // How many finer filters are active — surfaced as a count on the mobile
  // filter trigger inside the search card.
  const finerActiveCount =
    filters.draft.length +
    filters.analysis.length +
    filters.types.length +
    (filters.dateRange !== "any" ? 1 : 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* One tight top block: the search card, then the hub's view switcher
          directly BELOW it. Keeping them in the same wrapper lets the gap
          between them be small without fighting the outer `space-y-6`. */}
      <div className="space-y-3">
        <ContractSearch
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={submitQuery}
          onOpenFilters={() => setDrawerOpen(true)}
          filterCount={finerActiveCount}
        />
        {headerSlot}
      </div>

      {/* SECTION 1 — what can I build?  The most important section: it sits
          first, immediately under the search, and never below anything
          else. */}
      <section className="space-y-3.5" aria-labelledby="templates-heading">
        <div className="space-y-1">
          <h2 id="templates-heading" className="text-h4 text-on-surface">
            قراردادهای قابل تنظیم
          </h2>
          <p className="text-body-2 text-on-surface-variant">
            قرارداد موردنظرت را انتخاب و تدوین را شروع کن.
          </p>
          {/* The category chips sit one small step below the intro, so the
              heading, the one-line helper and the filters read as one block
              rather than three stacked rows. */}
          <div className="pt-1.5">
            <ContractCategoryChips value={category} onChange={setCategory} />
          </div>
        </div>

        <ContractTemplateGrid
          query={filters.query}
          category={category}
          onStart={handleStart}
          onPreview={setPreviewed}
          startingTypeId={startingTypeId}
        />
      </section>

      {/* SECTION 2 — where is my existing work? A search that is actively
          filtering is about ONE list, so the section says so explicitly
          rather than letting a shrunk list look like missing data. */}
      <MyContractsSection
        contracts={contracts}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetchAll}
        onDelete={setPendingDelete}
        onCopyId={handleCopyId}
        filters={filters}
        onFiltersChange={setFilters}
        onStart={scrollToTemplates}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
      />

      {/* SECTION 3 — other LEGALIR services. Deliberately last: it can
          never push the primary action down or compete with it. */}
      <ContractsPromos />

      {/* Read-only structure preview. Its footer carries the single
          committing action, so "look inside" and "start" stay distinct. */}
      <ContractTemplatePreview
        definition={previewed}
        onClose={() => setPreviewed(null)}
        onStart={handleStart}
        starting={previewed !== null && startingTypeId === previewed.id}
      />

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
