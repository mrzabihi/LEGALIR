// ============================================================
// LEGALIR — Lawyer Marketplace
// ============================================================
// Browse verified lawyers. At the top a single filter bar gathers the search
// box, the domain rail and the quick controls (specialty, province,
// consultation type) plus the active-filter chips and the result count; the
// remaining attributes live in the advanced bottom sheet. Below it the page
// reads like a professional marketplace — a "recommended" carousel, then the
// remaining lawyers («سایر وکلا», minus the recommended faces so nothing shows
// twice), then one carousel per legal DOMAIN — so a ~250-lawyer roster never
// becomes one exhausting vertical list. From `desktop` up the same sections
// render as wider carousels and a full grid.
//
// Every filter maps 1:1 onto the /api/v1/lawyers query string (the same
// `LawyerSearchFilters` the backend honours), and the categories are the
// twenty top-level taxonomy domains — not a hard-coded list. Demo lawyers
// are clearly badged «نمونه»; they are never presented as real practitioners.
// ============================================================

"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLawyers } from "@/hooks/useLawyers";
import { IconInfo, IconRefresh, IconHandshake, IconSparkle } from "@/lib/icons";
import {
  LawyerCard,
  LawyerCarousel,
  LawyerCategorySection,
  LawyerFiltersSheet,
  LawyerFilterBar,
  EMPTY_LAWYER_FILTERS,
  type LawyerFilterValues,
} from "@/components/lawyers";
import { PromoPanel } from "@/components/shared";
import { type LawyerSearchFilters } from "@legalir/types";
import { groupByPrimaryDomain, featuredLawyers } from "@/lib/lawyers/grouping";

/** Short, factual one-liners for the canonical practice domains. */
const DOMAIN_DESCRIPTION_FA: Record<string, string> = {
  family: "دعاوی خانواده، طلاق، مهریه و نفقه",
  criminal: "دفاع در پرونده‌های کیفری و جرائم",
  property_real_estate: "خرید، فروش، اجاره و دعاوی ملکی",
  finance_banking: "بانک، تسهیلات و دعاوی مالی",
  commercial: "معاملات تجاری و اختلافات بازرگانی",
  contracts: "تنظیم، بازبینی و دعاوی قراردادها",
  labor: "روابط کار، بیمه و تأمین اجتماعی",
  medical: "قصور پزشکی و دعاوی درمان",
  tax: "دعاوی مالیاتی و پرونده‌های مالیاتی",
  administrative: "دعاوی اداری و دیوان عدالت",
  intellectual_property: "مالکیت فکری، برند و حق تألیف",
  technology_cyber: "جرائم رایانه‌ای و حقوق فناوری",
  immigration: "مهاجرت، اقامت و امور کنسولی",
  inheritance: "ارث، انحصار وراثت و تقسیم ترکه",
  international: "دعاوی بین‌الملل و قراردادهای فرامرزی",
  insurance: "دعاوی بیمه و خسارت",
  transportation: "حمل‌ونقل و دعاوی رانندگی",
  energy_resources: "انرژی، معدن و منابع طبیعی",
  sports_culture: "ورزش، فرهنگ و رسانه",
  enforcement: "اجرای احکام و تأمین خواسته",
};

export default function LawyersPage() {
  const searchParams = useSearchParams();

  // Raw input is debounced into `search` so the list does not re-query on
  // every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Seed the specialty filter from ?category= so links from chat land
  // pre-filtered on the topic the user was discussing.
  const seededCategory = searchParams.get("category") ?? "";
  const [filters, setFilters] = useState<LawyerFilterValues>(() => ({
    ...EMPTY_LAWYER_FILTERS,
    specialtyIds: seededCategory ? [seededCategory] : [],
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo<LawyerSearchFilters>(
    () => ({
      search: search || undefined,
      specialtyIds: filters.specialtyIds.length ? filters.specialtyIds : undefined,
      professionalRanks: filters.professionalRanks.length ? filters.professionalRanks : undefined,
      organizationTypes: filters.organizationTypes.length ? filters.organizationTypes : undefined,
      province: filters.province || undefined,
      city: filters.city || undefined,
      experienceBand: filters.experienceBand || undefined,
      minRating: filters.minRating ?? undefined,
      serviceIds: filters.serviceIds.length ? filters.serviceIds : undefined,
      onlineOnly: filters.onlineOnly || undefined,
      acceptingClientsOnly: filters.acceptingClientsOnly || undefined,
      sort: filters.sort,
      pageSize: 60,
    }),
    [search, filters]
  );

  const { data, isLoading, isError, refetch } = useLawyers(query);
  const items = useMemo(() => data?.items ?? [], [data]);

  // A filter is "active" when the user has narrowed the roster — the page
  // then shows a flat result grid instead of the grouped marketplace.
  const isFiltering = Boolean(
    search ||
      filters.specialtyIds.length ||
      filters.professionalRanks.length ||
      filters.organizationTypes.length ||
      filters.province ||
      filters.city ||
      filters.experienceBand ||
      filters.minRating !== null ||
      filters.serviceIds.length ||
      filters.onlineOnly ||
      filters.acceptingClientsOnly ||
      filters.sort !== "relevance"
  );

  const groups = useMemo(() => groupByPrimaryDomain(items), [items]);
  const featured = useMemo(() => featuredLawyers(items), [items]);

  // The «سایر وکلا» row excludes the faces already shown in «وکلای پیشنهادی»,
  // so the same lawyer never appears twice on one screen. When nothing is
  // featured the whole roster is shown unchanged.
  const rest = useMemo(() => {
    const featuredIds = new Set(featured.map((l) => l.id));
    return items.filter((l) => !featuredIds.has(l.id));
  }, [items, featured]);
  const restLabel = featured.length > 0 ? "سایر وکلا" : "همه وکلا";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setFilters(EMPTY_LAWYER_FILTERS);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 tablet:p-6" dir="rtl">
      {/* --- Header --- */}
      <div className="mb-5">
        <h1 className="mb-2 text-h2 text-on-surface">وکلای LEGALIR</h1>
        <p className="text-body-2 text-muted">
          وکلای تأییدشده را بر اساس تخصص، شهر، سابقه و بودجه مرور کنید و خودتان انتخاب کنید.
        </p>
      </div>

      {/* --- Search + quick filters --- */}
      <LawyerFilterBar
        search={search}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onClearSearch={() => {
          setSearchInput("");
          setSearch("");
        }}
        filters={filters}
        onFiltersChange={setFilters}
        onOpenAdvanced={() => setFiltersOpen(true)}
        onClearAll={clearFilters}
        resultCount={items.length}
        showResultCount={!isLoading && !isError}
      />

      {/* --- Loading --- */}
      {isLoading && (
        <div className="space-y-8">
          <section>
            <div className="mb-3 h-6 w-40 animate-pulse rounded bg-surface-container" />
            <LawyerCarousel lawyers={[]} ariaLabel="وکلای پیشنهادی" loading skeletonCount={4} />
          </section>
          <section>
            <div className="mb-3 h-6 w-48 animate-pulse rounded bg-surface-container" />
            <LawyerCarousel lawyers={[]} ariaLabel="در حال بارگذاری" loading skeletonCount={4} />
          </section>
        </div>
      )}

      {/* --- Error --- */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-6 text-center">
          <p className="text-body-1 text-error">دریافت فهرست وکلا با مشکل مواجه شد.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      )}

      {/* --- Empty --- */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <IconInfo size={32} className="text-muted" />
          <p className="text-body-1 text-muted">
            {isFiltering ? "وکیلی با این مشخصات یافت نشد" : "در حال حاضر وکیلی در دسترس نیست"}
          </p>
          <p className="text-body-2 text-muted/60">
            {isFiltering ? "فیلترها را تغییر دهید یا جستجو را پاک کنید" : "لطفاً بعداً دوباره سر بزنید"}
          </p>
          {isFiltering && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 rounded-full border border-divider/60 bg-surface px-4 py-2 text-body-2 font-medium text-on-surface transition-colors hover:bg-surface-hover"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      )}

      {/* --- Filtered results (flat grid) --- */}
      {!isLoading && !isError && items.length > 0 && isFiltering && (
        <div>
          <div className="mb-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-3 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary/10"
            >
              پاک کردن فیلترها
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            {items.map((lawyer) => (
              <LawyerCard key={lawyer.id} lawyer={lawyer} />
            ))}
          </div>
        </div>
      )}

      {/* --- Grouped marketplace (default view) --- */}
      {!isLoading && !isError && items.length > 0 && !isFiltering && (
        <div>
          {/* Featured / recommended */}
          {featured.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <IconSparkle size={20} className="text-primary" />
                <div>
                  <h2 className="text-h3 text-on-surface">وکلای پیشنهادی</h2>
                  <p className="mt-0.5 text-caption text-muted">
                    بر اساس تخصص، تجربه و امتیاز کاربران
                  </p>
                </div>
              </div>
              <LawyerCarousel lawyers={featured} ariaLabel="وکلای پیشنهادی" />
            </section>
          )}

          {/* سایر وکلا — everyone not already shown in «وکلای پیشنهادی» */}
          {rest.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-h3 text-on-surface">{restLabel}</h2>
              <LawyerCarousel lawyers={rest} ariaLabel={restLabel} />
            </section>
          )}

          {/* One carousel per legal domain */}
          {groups.map((group) => (
            <LawyerCategorySection
              key={group.category}
              title={`وکلای ${group.label}`}
              description={DOMAIN_DESCRIPTION_FA[group.category]}
              lawyers={group.lawyers}
              onViewAll={() =>
                setFilters((s) => ({ ...s, specialtyIds: [group.category] }))
              }
            />
          ))}
        </div>
      )}

      {/* Supporting visual for the human-lawyer journey. */}
      <PromoPanel
        art="four"
        eyebrow="مشاوره با وکیل انسانی"
        title="جلسه مشاوره، حضوری یا آنلاین"
        message="وکیل منتخب شما پرونده را بررسی می‌کند، مدارک را می‌خواند و مسیر حقوقی را گام‌به‌گام توضیح می‌دهد. هزینه و زمان جلسه پیش از رزرو مشخص است."
        cta="رزرو جلسه مشاوره"
        href="/consultations/new"
        icon={IconHandshake}
        imageSide="start"
        size="panel"
        className="mt-8"
      />

      {/* --- Advanced filters (mobile bottom sheet) --- */}
      <LawyerFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={setFilters}
      />
    </div>
  );
}
