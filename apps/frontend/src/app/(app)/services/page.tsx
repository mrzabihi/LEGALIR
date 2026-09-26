// ============================================================
// LEGALIR — Services discovery page (/services)
// ============================================================
// A discovery surface, not a card wall. The page is composed in the
// order a user actually needs it:
//
//   1. compact intro + prominent search
//   2. category shortcuts (anchors into the catalog below)
//   3. the primary campaign — consultation with a HUMAN lawyer
//   4. the six service banners
//   5. the «خدمات جدید» area + the compact NDA campaign
//   6. the complete catalog, grouped by user intent
//   7. the library / educational treatment
//
// Every title, description, href, icon and gradient comes from
// `@/lib/services/catalog`, which itself derives from the registries
// that own the data. Nothing on this page hard-codes service metadata,
// so adding a calculator or a contract type makes it appear here with
// no edit to this file.
//
// Search is a *mode*, not a filter chip: while a query is present the
// discovery sections are replaced by flat, scannable results. That
// keeps the interaction unambiguous — you are either browsing or
// searching, never half of each.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TextField } from "@legalir/ui";
import { IconClose, IconSearch, IconServices } from "@/lib/icons";
import {
  CATALOG_SIZE,
  LIBRARY_CAMPAIGN,
  NDA_CAMPAIGN,
  NEW_SERVICES,
  PRIMARY_CAMPAIGN,
  SECONDARY_CAMPAIGN,
  SERVICE_BANNERS,
  SERVICE_CATEGORIES,
  itemsByCategory,
  populatedCategories,
  searchCatalog,
  trackServicesEvent,
  type CatalogItem,
} from "@/lib/services/catalog";
import {
  CampaignBanner,
  CategoryShortcuts,
  NewServices,
  ServiceBanner,
  ServiceCard,
} from "@/components/services";

// ============================================================
// Search — matches the catalog and the service banners
// ============================================================

/**
 * Banners are searchable alongside catalog items so a query like
 * «اظهارنامه» surfaces the promotion as well as the service. Campaign
 * banners are deliberately excluded: they are promotions, not answers,
 * and mixing them into results would make the list harder to scan.
 */
function searchBanners(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SERVICE_BANNERS.filter((banner) =>
    [banner.title, banner.message, ...banner.keywords].join(" ").toLowerCase().includes(q)
  );
}

// ============================================================
// Page
// ============================================================

export default function ServicesPage() {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  const results = useMemo(
    () => (isSearching ? searchCatalog(trimmed) : []),
    [isSearching, trimmed]
  );
  const bannerResults = useMemo(
    () => (isSearching ? searchBanners(trimmed) : []),
    [isSearching, trimmed]
  );

  const categories = useMemo(() => populatedCategories(), []);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const category of SERVICE_CATEGORIES) {
      out[category.id] = itemsByCategory(category.id).length;
    }
    return out;
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    trackServicesEvent("services_search_cleared");
    searchRef.current?.focus();
  }, []);

  // Report the search once the user pauses, so a fast typist produces
  // one event rather than one per keystroke. Only the fact that a
  // search happened is sent — never the term itself.
  useEffect(() => {
    if (!isSearching) return;
    const timer = window.setTimeout(() => {
      trackServicesEvent("services_search_performed");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isSearching, trimmed]);

  const hasResults = results.length > 0 || bannerResults.length > 0;

  return (
    <div className="mx-auto max-w-6xl p-4 tablet:p-6" dir="rtl">
      {/* ============================================================
          1. Intro + search
          ============================================================ */}
      <header className="mb-5 grid gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,420px)] laptop:items-end laptop:gap-8">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-3 py-1 text-caption text-on-surface-variant">
            <IconServices size={14} />
            {CATALOG_SIZE.toLocaleString("fa-IR")} خدمت حقوقی
          </span>
          <h1 className="mt-3 text-h2 font-bold text-on-surface">خدمات لیگالیر</h1>
          <p className="mt-1.5 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
            خدمات حقوقی قانون‌مدار لیگالیر — از پرسش و تحلیل سند تا تنظیم قرارداد، محاسبه‌گرهای
            دقیق و مشاوره با وکیل انسانی.
          </p>
        </div>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="w-full"
          aria-label="جستجو در خدمات"
        >
          <TextField
            ref={searchRef}
            type="search"
            label="جستجو در خدمات"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                clearSearch();
              }
            }}
            placeholder="مثلاً: اظهارنامه، مهریه، NDA"
            leadingIcon={<IconSearch size={20} />}
            endAdornment={
              query ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="پاک کردن جستجو"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <IconClose size={18} />
                </button>
              ) : undefined
            }
            fullWidth
          />
        </form>
      </header>

      {/* ============================================================
          Search mode — flat, scannable results
          ============================================================ */}
      {isSearching ? (
        <section aria-live="polite" className="mt-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-h4 font-bold text-on-surface">
              {hasResults
                ? `${(results.length + bannerResults.length).toLocaleString("fa-IR")} نتیجه برای «${trimmed}»`
                : `نتیجه‌ای برای «${trimmed}» یافت نشد`}
            </h2>
            <button
              type="button"
              onClick={clearSearch}
              className="shrink-0 rounded-small text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              نمایش همه خدمات
            </button>
          </div>

          {!hasResults && (
            <div className="flex flex-col items-center gap-3 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface px-4 py-14 text-center">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-xlarge bg-surface-container text-muted"
              >
                <IconSearch size={30} />
              </span>
              <p className="text-body-1 font-medium text-on-surface">
                خدمتی با این مشخصات پیدا نشد
              </p>
              <p className="max-w-sm text-body-2 text-on-surface-variant">
                عبارت دیگری را امتحان کنید یا از دسته‌بندی‌ها برای مرور کامل خدمات استفاده کنید.
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
              >
                نمایش همه خدمات
              </button>
            </div>
          )}

          {bannerResults.length > 0 && (
            <div className="mb-6 grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
              {bannerResults.map((banner) => (
                <ServiceBanner key={banner.id} banner={banner} />
              ))}
            </div>
          )}

          {results.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
              {results.map((item: CatalogItem) => (
                <li key={item.id} className="h-full">
                  <ServiceCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* ============================================================
              2. Category shortcuts
              ============================================================ */}
          <section className="mb-6">
            <h2 className="mb-3 text-h4 font-bold text-on-surface">دسته‌بندی خدمات</h2>
            <CategoryShortcuts categories={categories} counts={counts} />
          </section>

          {/* ============================================================
              3. Primary campaign — human lawyer consultation
              ============================================================ */}
          <CampaignBanner banner={PRIMARY_CAMPAIGN} size="hero" className="mb-6" />

          {/* ============================================================
              4. The six service banners
              ============================================================ */}
          <section aria-labelledby="service-banners-title" className="mb-8">
            <div className="mb-3">
              <h2 id="service-banners-title" className="text-h4 font-bold text-on-surface">
                خدمات پرکاربرد
              </h2>
              <p className="mt-1 text-caption text-on-surface-variant">
                سریع‌ترین راه شروع — هر خدمت با یک کلیک
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
              {SERVICE_BANNERS.map((banner) => (
                <ServiceBanner key={banner.id} banner={banner} />
              ))}
            </div>
          </section>

          {/* ============================================================
              5. New services + compact NDA campaign
              ============================================================ */}
          <div className="mb-10 grid gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-stretch">
            <NewServices services={NEW_SERVICES} />
            <CampaignBanner banner={NDA_CAMPAIGN} size="vertical" />
          </div>

          {/* ============================================================
              6. The complete catalog, grouped by user intent
              ============================================================ */}
          <section aria-labelledby="catalog-title" className="mb-4">
            <h2 id="catalog-title" className="text-h3 font-bold text-on-surface">
              فهرست کامل خدمات
            </h2>
            <p className="mt-1 text-body-2 text-on-surface-variant">
              همه خدمات لیگالیر، دسته‌بندی‌شده بر اساس کاری که می‌خواهید انجام دهید.
            </p>
          </section>

          {categories.map((category, index) => {
            const items = itemsByCategory(category.id);
            const Icon = category.icon;

            return (
              <div key={category.id}>
                {/* The secondary campaign sits between the first and
                    second catalog sections — mid-page, where attention
                    naturally dips. */}
                {index === 1 && (
                  <CampaignBanner banner={SECONDARY_CAMPAIGN} size="panel" className="mb-8" />
                )}

                <section
                  id={category.anchor}
                  aria-labelledby={`${category.anchor}-title`}
                  className="mb-8 scroll-mt-4"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1`}
                    >
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3
                        id={`${category.anchor}-title`}
                        className="text-h4 font-bold text-on-surface"
                      >
                        {category.title}
                      </h3>
                      <p className="mt-0.5 text-caption text-on-surface-variant">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
                    {items.map((item) => (
                      <li key={item.id} className="h-full">
                        <ServiceCard item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            );
          })}

          {/* ============================================================
              7. Library / educational treatment
              ============================================================ */}
          <CampaignBanner banner={LIBRARY_CAMPAIGN} size="panel" className="mb-6" />

          {/* Fallback route to the AI assistant for anything the catalog
              does not cover. */}
          <div className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 text-center">
            <p className="text-body-1 font-medium text-on-surface">
              خدمت مورد نظر خود را پیدا نکردید؟
            </p>
            <p className="mt-1 text-body-2 text-on-surface-variant">
              موضوع خود را برای مشاور هوش مصنوعی لیگالیر شرح دهید تا مسیر حقوقی مناسب پیشنهاد شود.
            </p>
            <Link
              href="/chat?service=legal_consultation"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
            >
              شروع گفت‌وگو با مشاور هوش مصنوعی
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
