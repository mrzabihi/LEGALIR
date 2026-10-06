// ============================================================
// LEGALIR — Contracts workspace body (the «قراردادهای فعال» panel)
// ============================================================
// Rendered inside the /contracts hub's active view. The page header and
// the view switcher are owned by the hub; this body answers two questions,
// in this fixed order:
//
//   SECTION 1 — «چه قراردادی می‌توانم بسازم؟»
//     the template library, filtered by the shared search query and
//     the category chips.
//
//   SECTION 2 — «قراردادهایی که قبلاً ساخته یا شروع کرده‌ام کجا هستند؟»
//     the user's own contracts, drafts first, grouped by work remaining.
//
// The order is a product requirement, not a layout accident: the page
// must always offer "start something new" before "resume something old".
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
import {
  useCreatePropertyContract,
  useDeletePropertyContract,
  usePropertyContracts,
} from "@/hooks/usePropertyContracts";
import { DEFAULT_PROPERTY_KIND } from "@/lib/api/property-contracts";
import type { ContractDefinition } from "@/lib/contracts/registry";
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
import { ContractSearch } from "./contract-search";
import { ContractCategoryChips } from "./contract-category-chips";
import { ContractTemplateGrid } from "./contract-template-grid";
import { MyContractsSection } from "./my-contracts-section";

export function ContractList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- URL-backed state (single source of truth) ---------------------
  // The template category and the contract filter state are two
  // independent URL slices; both are read here and written back through
  // one helper so neither clobbers the other.
  const category = (searchParams.get("category") as TemplateCategory | null) ?? "all";
  const filters = React.useMemo(
    () => parseContractFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const writeParams = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
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

  const setQuery = (value: string) => setFilters({ ...filters, query: value });
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
  const create = useCreatePropertyContract();
  const [startingTypeId, setStartingTypeId] = React.useState<string | null>(null);

  const handleStart = React.useCallback(
    async (definition: ContractDefinition) => {
      setStartingTypeId(definition.id);
      trackContractEvent("contract_template_started", { type: definition.id });
      try {
        const created = await create.mutateAsync({
          type: definition.id,
          propertyKind: DEFAULT_PROPERTY_KIND,
          initiatorRole: definition.defaultInitiatorRole,
        });
        router.push(`/contracts/${created.id}`);
      } catch (e) {
        snackbar.show({
          message: e instanceof Error ? e.message : "ایجاد قرارداد ناموفق بود.",
          variant: "error",
        });
        setStartingTypeId(null);
      }
    },
    [create, router]
  );

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

  return (
    <div className="space-y-8" dir="rtl">
      {/* Search — directly under the hub's page title, driving both sections. */}
      <ContractSearch
        value={filters.query}
        onChange={setQuery}
        onSubmit={() => trackContractEvent("contract_search_performed", { query: filters.query })}
      />

      {/* SECTION 1 — what can I build? */}
      <section className="space-y-4" aria-labelledby="templates-heading">
        <div className="space-y-3">
          <h2 id="templates-heading" className="text-h4 text-on-surface">
            قالب‌های قرارداد
          </h2>
          <ContractCategoryChips value={category} onChange={setCategory} />
        </div>

        <ContractTemplateGrid
          query={filters.query}
          category={category}
          onStart={handleStart}
          startingTypeId={startingTypeId}
          onViewAll={() => trackContractEvent("contract_view_all_clicked")}
        />
      </section>

      {/* SECTION 2 — where is my existing work? */}
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
