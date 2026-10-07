// ============================================================
// LEGALIR — Contract Catalog (the /contracts discovery surface)
// ============================================================
// The catalog leads with a concise hero, a plain-language finder, and a
// category rail — then presents the services in two honest layers: a short
// «قراردادهای پرکاربرد» shortlist, and the full list *grouped by subject* so
// 28 cards never collapse into one uniform wall.
//
// The category rail filters by subject; a `?q=` query (if one is present in
// the URL, e.g. from a shared link) narrows by title/description/category/
// keywords via `searchContractServices`. Both live in the URL so a filtered
// view is shareable and survives reload. Filtering is fully client-side over
// the static catalog — no network.
//
// Every card links to a real service detail page. No wizard, no generated
// text, no invented data: this is a catalog of services, and each service
// is `coming-soon` until it ships.

"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CONTRACT_CATEGORIES,
  CONTRACT_SERVICE_COUNT,
  contractServicesByCategory,
  popularContractServices,
  populatedContractCategories,
  searchContractServices,
  type ContractCategoryId,
} from "@/lib/contract-services";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconContract, IconSparkle } from "@/lib/icons";
import { CategoryFilter, type CategoryFilterValue } from "./category-filter";
import { ContractServiceCard } from "./contract-service-card";
import { ContractFinder } from "./contract-finder";
import { ContractsEmptyState } from "./contracts-empty-state";
import { ContractLawyerSuggestion } from "./contract-lawyer-suggestion";

const CATEGORY_IDS = new Set<string>(CONTRACT_CATEGORIES.map((c) => c.id));

/** Coerce a raw `?category=` value into a known id, else «all». */
function readCategory(value: string | null): CategoryFilterValue {
  return value && CATEGORY_IDS.has(value) ? (value as ContractCategoryId) : "all";
}

interface ContractCatalogProps {
  /**
   * When `true`, drop the page hero and the page-level container so the
   * catalog can render inside a host that supplies its own header — the
   * «بزودی» panel of the unified /contracts hub.
   */
  embedded?: boolean;
  /**
   * Namespace for the filter query keys. The catalog shares the /contracts
   * URL with the workspace, which already owns `?category=` and `?q=`; a
   * prefix (e.g. `soon-`) keeps the two filter sets from colliding. Empty
   * by default so the standalone discovery page reads plain `?q=`/`?category=`.
   */
  paramPrefix?: string;
}

export function ContractCatalog({
  embedded = false,
  paramPrefix = "",
}: ContractCatalogProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = `${paramPrefix}q`;
  const categoryParam = `${paramPrefix}category`;

  // The URL is the single source of truth for the filters. A shared link
  // (`?category=…`, `?q=…`) reproduces the exact view, and back/forward
  // simply follows the query string.
  const query = searchParams.get(queryParam) ?? "";
  const category = readCategory(searchParams.get(categoryParam));

  const writeCategory = useCallback(
    (cat: CategoryFilterValue) => {
      const params = new URLSearchParams(searchParams.toString());
      if (cat !== "all") params.set(categoryParam, cat);
      else params.delete(categoryParam);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, categoryParam]
  );

  // Only this catalog's own two keys are cleared — the workspace's filter
  // params live in the same query string and must not be disturbed.
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(categoryParam);
    params.delete(queryParam);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const results = useMemo(() => searchContractServices(query, category), [query, category]);

  const isFiltering = query.trim() !== "" || category !== "all";

  const popular = useMemo(() => popularContractServices(), []);
  const populated = useMemo(() => populatedContractCategories(), []);

  return (
    <div
      className={embedded ? "" : "mx-auto max-w-6xl p-4 tablet:p-6"}
      dir="rtl"
    >
      {/* 1 — Hero. Suppressed when embedded: the host supplies the header. */}
      {!embedded && (
        <section className="overflow-hidden rounded-xlarge bg-gradient-to-br from-primary-700 to-primary-900 p-6 text-white shadow-elevation-3 tablet:p-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-medium">
              <IconSparkle size={14} aria-hidden="true" />
              {toPersianNumber(CONTRACT_SERVICE_COUNT)} خدمت قراردادی در{" "}
              {toPersianNumber(CONTRACT_CATEGORIES.length)} دسته‌بندی
            </span>
            <h1 className="mt-3 text-h2 font-bold">تنظیم و بررسی قرارداد</h1>
            <p className="mt-2 text-body-2 text-white/85">
              نوع قرارداد موردنیاز خود را پیدا کنید، جزئیات و قابلیت‌های هر خدمت را ببینید و وکلای
              متخصص همان حوزه را مرور کنید. خدمات قرارداد لیگالیر به‌تدریج فعال می‌شوند.
            </p>
          </div>
        </section>
      )}

      {/* 2 — Contract Finder (plain-language suggestion) */}
      <div className={embedded ? "" : "mt-6"}>
        <ContractFinder />
      </div>

      {/* 3 — Categories */}
      <section aria-labelledby="contract-categories-title" className="mt-8">
        <div className="mb-3">
          <h2 id="contract-categories-title" className="text-h3 font-bold text-on-surface">
            دسته‌بندی قراردادها
          </h2>
          <p className="mt-0.5 text-caption text-on-surface-variant">
            موضوع موردنظر را انتخاب کنید تا فهرست بر همان دسته فیلتر شود.
          </p>
        </div>
        <CategoryFilter value={category} onChange={writeCategory} />
      </section>

      {/* 4 / 5 — Filtered results, or the default popular + grouped catalog */}
      {isFiltering ? (
        <section aria-live="polite" className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-body-2 text-on-surface-variant">
              {toPersianNumber(results.length)} خدمت یافت شد
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-3 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              پاک کردن فیلترها
            </button>
          </div>

          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
              {results.map((service) => (
                <li key={service.id} className="h-full">
                  <ContractServiceCard service={service} />
                </li>
              ))}
            </ul>
          ) : (
            <ContractsEmptyState query={query.trim() || undefined} />
          )}
        </section>
      ) : (
        <>
          {/* 4 — Popular contracts */}
          <section aria-labelledby="contract-popular-title" className="mt-10">
            <div className="mb-3 flex items-center gap-2">
              <IconSparkle size={20} className="text-primary" aria-hidden="true" />
              <div>
                <h2 id="contract-popular-title" className="text-h3 font-bold text-on-surface">
                  قراردادهای پرکاربرد
                </h2>
                <p className="mt-0.5 text-caption text-on-surface-variant">
                  پرتقاضاترین خدمات قراردادی در لیگالیر
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
              {popular.map((service) => (
                <li key={service.id} className="h-full">
                  <ContractServiceCard service={service} />
                </li>
              ))}
            </ul>
          </section>

          {/* 5 — All contracts, grouped by subject */}
          <section aria-labelledby="contract-all-title" className="mt-10">
            <div className="mb-5 flex items-center gap-2">
              <IconContract size={20} className="text-primary" aria-hidden="true" />
              <div>
                <h2 id="contract-all-title" className="text-h3 font-bold text-on-surface">
                  همه قراردادها
                </h2>
                <p className="mt-0.5 text-caption text-on-surface-variant">
                  فهرست کامل خدمات، دسته‌بندی‌شده بر اساس موضوع
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {populated.map((cat) => {
                const items = contractServicesByCategory(cat.id);
                const CatIcon = cat.icon;
                return (
                  <div key={cat.id} id={cat.anchor} className="scroll-mt-24">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 items-center justify-center rounded-small bg-gradient-to-br ${cat.gradient} text-white`}
                      >
                        <CatIcon size={16} />
                      </span>
                      <h3 className="text-body-1 font-bold text-on-surface">{cat.title}</h3>
                      <span className="text-caption text-on-surface-variant">
                        {toPersianNumber(items.length)} خدمت
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
                      {items.map((service) => (
                        <li key={service.id} className="h-full">
                          <ContractServiceCard service={service} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* 6 — Lawyer suggestion (real, verified lawyers only) */}
      <div className="mt-10">
        <ContractLawyerSuggestion
          specialties={["contract", "commerce", "real_estate"]}
          title="نیاز فوری به وکیل دارید؟"
          description="تا زمان فعال‌سازی خدمات قراردادی، می‌توانید با وکلای متخصص قراردادها مشاوره بگیرید."
        />
      </div>
    </div>
  );
}
