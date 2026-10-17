// ============================================================
// LEGALIR — Full configurable-contract listing
// ============================================================
// The destination of the hub's «مشاهده همه قراردادها» link. It answers
// one question completely: «چه قراردادی می‌توانم بسازم؟»
//
// PAGE PRIORITY (top → bottom), and the reason for it:
//   1. the CATALOG            — the page's subject; it owns the fold.
//   2. «قراردادهای من»        — compact, low-emphasis context.
//   3. PROMOTIONS             — last, so no banner can ever push the
//                               catalog, the search or the pager down.
//
// CATALOG RULES
//   · SEARCH  — the shared SearchField and the shared Persian-aware
//               scorer, so a query means the same thing here and on the
//               hub rail.
//   · FILTER  — the same four category chips, plus a visible, removable
//               summary of what is narrowing the list.
//   · PAGING  — at most `CONTRACTS_PAGE_SIZE` (20) cards per page, one
//               page mounted at a time. `?q=`, `?category=` and `?page=`
//               all live in the URL, so refresh, deep-linking and Back
//               restore the exact view. Out-of-range pages are clamped.
//
// Nothing is created until the user asks to start a contract; the
// preview only READS the registry definition.
// ============================================================

"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConfirmDialog, snackbar } from "@legalir/ui";
import { SearchField } from "@/components/shared";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStartContract } from "@/hooks/useStartContract";
import { useContracts } from "@/hooks/useContracts";
import { useDeletePropertyContract, usePropertyContracts } from "@/hooks/usePropertyContracts";
import {
  implementedContractDefinitions,
  type ContractDefinition,
} from "@/lib/contracts/registry";
import { searchTemplates } from "@/lib/contracts/search";
import {
  matchesTemplateCategory,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from "@/lib/contracts/categories";
import { paginate, CONTRACTS_PAGE_SIZE } from "@/lib/contracts/pagination";
import {
  toUnifiedPropertyContract,
  toUnifiedV1Contract,
  type UnifiedContract,
} from "@/lib/contracts/unified";
import { toPersianNumber } from "@/lib/persian-utils";
import { Button } from "@legalir/ui";
import {
  IconArrowForward,
  IconClose,
  IconRefresh,
  IconSearch,
} from "@/lib/icons";
import { ContractTemplateCard } from "./contract-template-card";
import { ContractTemplatePreview } from "./contract-template-preview";
import { ContractCategoryChips } from "./contract-category-chips";
import { PaginationBar } from "./pagination-bar";
import { CompactContractSections } from "./compact-contract-sections";
import { ContractsPromos } from "./contracts-promos";

const SEARCH_DEBOUNCE_MS = 350;

export function TemplatesBrowser() {
  const searchParams = useSearchParams();
  const { start, startingTypeId } = useStartContract();

  const query = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as TemplateCategory | null) ?? "all";
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  // One writer for all three URL slices, so a change in one never drops
  // the others. It starts from the URL as it is RIGHT NOW rather than
  // from a captured `searchParams` snapshot: a debounced query and a
  // chip click can land in the same tick, and the later write must not
  // rebuild the URL from a snapshot taken before the earlier one.
  // The URL write goes through the native History API rather than
  // `router.replace`: `q`, `category` and `page` are CLIENT-SIDE state
  // (the catalogue is read from the registry in memory), so there is
  // nothing for the server to re-render. Next.js integrates
  // `replaceState` with `useSearchParams`, and this path cannot be
  // dropped mid-transition the way a router navigation can — which
  // previously left the URL unchanged after a real filter change.
  const writeParams = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const base =
        typeof window === "undefined" ? searchParams.toString() : window.location.search;
      const next = new URLSearchParams(base);
      mutate(next);
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [searchParams]
  );

  // --- Search: type freely, commit on pause -------------------------
  const [searchInput, setSearchInput] = React.useState(query);
  const debounced = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  // The value THIS component last wrote to `?q=`. The sync effect below
  // must ignore it: adopting it would delete anything typed after the
  // pause, because the URL always trails the field by one debounce.
  const selfWrittenQuery = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (debounced === query) return;
    // Only commit a SETTLED debounce. While a newer keystroke (or a
    // programmatic clear) is still waiting out the delay, `debounced`
    // trails `searchInput`; writing it then would undo that action —
    // e.g. «پاک کردن جست‌وجو و فیلترها» would clear the URL and have the
    // stale query immediately pushed back in.
    if (debounced !== searchInput) return;
    selfWrittenQuery.current = debounced;
    writeParams((params) => {
      if (debounced) params.set("q", debounced);
      else params.delete("q");
      // A new query starts at page 1 — staying on page 4 of a smaller
      // result set would strand the user on an empty page.
      params.delete("page");
    });
  }, [debounced, searchInput, query, writeParams]);

  // Keep the field in sync when Back/Forward changes `?q=` — but never
  // overwrite the field with a value this component just committed.
  React.useEffect(() => {
    if (selfWrittenQuery.current === query) return;
    setSearchInput((current) => (current === query ? current : query));
  }, [query]);

  const commitQuery = (value: string) => {
    writeParams((params) => {
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page");
    });
  };

  const setCategory = (value: TemplateCategory) => {
    writeParams((params) => {
      if (value === "all") params.delete("category");
      else params.set("category", value);
      params.delete("page");
    });
  };

  const clearAll = () => {
    setSearchInput("");
    writeParams((params) => {
      params.delete("q");
      params.delete("category");
      params.delete("page");
    });
  };

  const goToPage = (next: number) => {
    writeParams((params) => {
      if (next <= 1) params.delete("page");
      else params.set("page", String(next));
    });
    // The pager sits under a long grid; bring the top of the catalog
    // back into view so the new page never opens mid-scroll.
    document.getElementById("templates-top")?.scrollIntoView({ block: "start" });
  };

  // --- Catalog data ---------------------------------------------------
  // The catalog is the registry — the project's real source of contract
  // types. `retryToken` exists only so an unexpected read failure can be
  // retried in place without a full reload.
  const [retryToken, setRetryToken] = React.useState(0);
  const catalog = React.useMemo(() => {
    // `retryToken` participates only so a retry re-runs this read.
    void retryToken;
    try {
      const inCategory = implementedContractDefinitions().filter((def) =>
        matchesTemplateCategory(def.id, category)
      );
      return {
        results: searchTemplates(inCategory, query, (def: ContractDefinition) => ({
          id: def.id,
          titleFa: def.typeFa,
          descriptionFa: def.descriptionFa,
          categoryFa: def.categoryFa,
          keywords: def.keywords,
        })),
        failed: false,
      };
    } catch {
      return { results: [] as ContractDefinition[], failed: true };
    }
  }, [query, category, retryToken]);

  const { items: pageItems, page: currentPage, totalPages, total } = paginate(
    catalog.results,
    page
  );

  const clearing = query !== "" || category !== "all";
  const activeCategoryLabel = TEMPLATE_CATEGORIES.find((c) => c.key === category)?.labelFa;

  // --- The user's own contracts (secondary section) -------------------
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

  const myContracts = React.useMemo<UnifiedContract[]>(() => {
    const os = (propertyData?.items ?? []).map(toUnifiedPropertyContract);
    const v1 = (v1Data?.items ?? []).map(toUnifiedV1Contract);
    return [...os, ...v1];
  }, [propertyData, v1Data]);

  const refetchAll = React.useCallback(() => {
    void refetchProperty();
    void refetchV1();
  }, [refetchProperty, refetchV1]);

  // --- Delete a draft / copy an id (shared with the hub) --------------
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

  // --- Preview -------------------------------------------------------
  const [previewed, setPreviewed] = React.useState<ContractDefinition | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1120px] p-4 tablet:p-6" dir="rtl">
      <Link
        href="/contracts"
        className="mb-3 inline-flex items-center gap-1 rounded-small text-caption text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <IconArrowForward size={14} aria-hidden="true" />
        بازگشت به قراردادها
      </Link>

      {/* ── SECTION 1: the catalog ─────────────────────────────────────
          The page's primary content. Nothing sits above it except a
          compact title and the (small) search/filter row. */}
      <section aria-labelledby="templates-heading">
        <div id="templates-top" className="scroll-mt-20">
          <header>
            <h1 id="templates-heading" className="text-h2 text-on-surface">
              همه قراردادهای قابل تنظیم
            </h1>
            <p className="mt-1 max-w-2xl text-body-2 text-on-surface-variant">
              قرارداد موردنظر را پیش‌نمایش بگیرید و سپس تنظیم آن را مرحله‌به‌مرحله آغاز کنید.
            </p>
          </header>

          {/* Search + filters — one compact row. The chips scroll inside
              themselves on a phone, so the block never wraps into a big
              wall above the catalog. */}
          <div className="mt-4 flex flex-col gap-2.5 laptop:flex-row laptop:items-center">
            <div className="min-w-0 flex-1 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface transition-colors focus-within:border-primary">
              <SearchField
                label="جستجوی قرارداد"
                placeholder="جستجو با نام یا کلیدواژه؛ مثلاً اجاره، NDA"
                value={searchInput}
                onChange={setSearchInput}
                onSubmit={() => commitQuery(searchInput)}
                reserveMessageSpace={false}
              />
            </div>
            <ContractCategoryChips
              value={category}
              onChange={setCategory}
              className="laptop:w-auto"
            />
          </div>

          {/* What is currently narrowing the list — the count and the
              active filters, with a single clear action. */}
          <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2">
            <p className="text-caption text-muted" aria-live="polite">
              {toPersianNumber(total)} قرارداد
              {query && <> برای «{query}»</>}
              {category !== "all" && <> در دستهٔ «{activeCategoryLabel}»</>}
            </p>
            {clearing && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-small text-caption font-medium text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                پاک کردن جست‌وجو و فیلترها
              </button>
            )}
          </div>
        </div>

        {catalog.failed ? (
          <div
            role="alert"
            className="mt-4 flex flex-col items-center justify-center rounded-large border border-divider bg-surface px-4 py-12 text-center"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-50 text-error">
              <IconRefresh size={26} aria-hidden="true" />
            </span>
            <h2 className="text-titleMedium text-on-surface">دریافت فهرست قراردادها ناموفق بود</h2>
            <p className="mt-1 max-w-sm text-body-2 text-muted">
              فهرست بارگذاری نشد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت صفحه را تازه کنید.
            </p>
            <Button
              type="button"
              onClick={() => setRetryToken((n) => n + 1)}
              startIcon={<IconRefresh size={18} />}
              className="mt-5"
            >
              تلاش مجدد
            </Button>
          </div>
        ) : catalog.results.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-large border border-divider bg-surface px-4 py-12 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-muted">
              <IconSearch size={26} aria-hidden="true" />
            </span>
            <h2 className="text-titleMedium text-on-surface">قراردادی با این شرایط پیدا نشد</h2>
            <p className="mt-1 max-w-sm text-body-2 text-muted">
              عبارت دیگری را امتحان کنید یا دسته‌بندی را تغییر دهید.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {query && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setSearchInput("");
                    commitQuery("");
                  }}
                  startIcon={<IconClose size={16} />}
                >
                  پاک کردن جست‌وجو
                </Button>
              )}
              <Button type="button" onClick={clearAll}>
                نمایش همه قراردادها
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul
              className="mt-4 grid auto-rows-fr grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3"
              aria-label="فهرست قراردادهای قابل تنظیم"
            >
              {pageItems.map((definition, i) => (
                <li
                  key={definition.id}
                  className="animate-slide-up-fade h-full"
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                >
                  <ContractTemplateCard
                    definition={definition}
                    onStart={start}
                    onPreview={setPreviewed}
                    starting={startingTypeId === definition.id}
                    disabled={startingTypeId !== null}
                  />
                </li>
              ))}
            </ul>

            <PaginationBar
              className="mt-6"
              page={currentPage}
              totalPages={totalPages}
              total={total}
              itemLabel="قالب قرارداد"
              pageSize={CONTRACTS_PAGE_SIZE}
              onPageChange={goToPage}
            />
          </>
        )}
      </section>

      {/* ── SECTION 2: my contracts, deliberately low-emphasis ────────── */}
      <CompactContractSections
        contracts={myContracts}
        isLoading={propertyLoading || v1Loading}
        isError={propertyError || v1Error}
        onRetry={refetchAll}
        onDelete={setPendingDelete}
        onCopyId={handleCopyId}
      />

      {/* ── SECTION 3: promotions — LAST, so they never displace the
             catalog, the search or the pager. ─────────────────────────── */}
      <div className="mt-10">
        <ContractsPromos />
      </div>

      <ContractTemplatePreview
        definition={previewed}
        onClose={() => setPreviewed(null)}
        onStart={start}
        starting={previewed !== null && startingTypeId === previewed.id}
      />

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
