// ============================================================
// LEGALIR — Contracts page body
// ============================================================
// The page answers two questions, in this fixed order:
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
// The search query and the category live in the URL, so a filtered view
// survives refresh, deep-linking and browser back/forward. Both sections
// read the SAME query — one input drives the whole page.
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
import { trackContractEvent } from "@/lib/contracts/analytics";
import { ContractSearch } from "./contract-search";
import { ContractCategoryChips } from "./contract-category-chips";
import { ContractTemplateGrid } from "./contract-template-grid";
import { MyContractsSection } from "./my-contracts-section";

export function ContractList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- URL-backed filters (single source of truth) -------------------
  const query = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as TemplateCategory | null) ?? "all";

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `/contracts?${qs}` : "/contracts", { scroll: false });
    },
    [router, searchParams]
  );

  const setQuery = (value: string) => setParam("q", value);
  const setCategory = (value: TemplateCategory) => {
    setParam("category", value === "all" ? "" : value);
    trackContractEvent("contract_category_selected", { category: value });
  };

  // --- Data ----------------------------------------------------------
  // Contract-OS contracts and legacy V1 contracts live in separate
  // tables/endpoints; both are folded into one `UnifiedContract` list so
  // the page has a single, lifecycle-agnostic view of the user's work.
  const { data: propertyData, isLoading: propertyLoading } = usePropertyContracts({
    pageSize: 50,
  });
  const { data: v1Data, isLoading: v1Loading } = useContracts({});

  const contracts = React.useMemo<UnifiedContract[]>(() => {
    const os = (propertyData?.items ?? []).map(toUnifiedPropertyContract);
    const v1 = (v1Data?.items ?? []).map(toUnifiedV1Contract);
    return [...os, ...v1];
  }, [propertyData, v1Data]);

  const isLoading = propertyLoading || v1Loading;

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

  return (
    <div className="space-y-8" dir="rtl">
      {/* Search — directly under the page title, driving both sections. */}
      <ContractSearch
        value={query}
        onChange={setQuery}
        onSubmit={() => trackContractEvent("contract_search_performed", { query })}
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
          query={query}
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
        onDelete={setPendingDelete}
        onCopyId={handleCopyId}
        query={query}
        onStart={() => {
          document
            .getElementById("templates-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
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
