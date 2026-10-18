// ============================================================
// LEGALIR — Lawyer Marketplace
// ============================================================
// Browse verified lawyers. At the top a single filter bar gathers the search
// box, the domain rail and the quick controls (specialty, province,
// consultation type) plus the active-filter chips and the result count; the
// remaining attributes live in the advanced bottom sheet.
//
// Below it the page reads like a professional marketplace, in this order:
//   1. «وکلای پیشنهادی» — a short curated rail (the page's only rail);
//   2. «سایر وکلا» — the complete remaining roster as a FLAT GRID;
//   3. one compact rail per legal DOMAIN — a topical shortcut whose
//      «مشاهده همه» narrows the page to that domain's flat result grid.
// The roster is therefore never reachable only through a horizontal
// gesture: the full list is a grid, and every domain can be opened into
// the same grid pre-filtered.
//
// Every filter maps 1:1 onto the /api/v1/lawyers query string (the same
// `LawyerSearchFilters` the backend honours), and the categories are the
// twenty top-level taxonomy domains — not a hard-coded list. Demo lawyers
// are clearly badged «نمونه»; they are never presented as real practitioners.
// ============================================================

"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@legalir/ui";
import { useLawyers } from "@/hooks/useLawyers";
import { IconInfo, IconRefresh, IconHandshake, IconSparkle, IconUsers, IconClose } from "@/lib/icons";
import {
  LawyerCard,
  LawyerCardCompact,
  LawyerCardCompactSkeleton,
  LawyerCardSkeleton,
  LawyerCategorySection,
  LawyerFiltersSheet,
  LawyerFilterBar,
  EMPTY_LAWYER_FILTERS,
  type LawyerFilterValues,
} from "@/components/lawyers";
import {
  CardRail,
  PageContainer,
  PageIntroBanner,
  PromoPanel,
  SectionHeader,
} from "@/components/shared";
import { type LawyerSearchFilters } from "@legalir/types";
import { groupByPrimaryDomain, featuredLawyers } from "@/lib/lawyers/grouping";

/** Short, factual one-liners for the canonical practice domains. */
/**
 * The roster grid. One definition, used by the loading skeleton and the
 * loaded list, so the reserved height and the final layout cannot drift.
 */
const ROSTER_GRID = "grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3";

/**
 * Featured rail tile width. Container-relative, never viewport-relative:
 * 2 tiles per view on phones, 3 from `tablet`, 4 from `desktop` — the
 * hand-rolled carousel's sizing, now owned by the shared rail.
 */
const FEATURED_ITEM =
  "w-[calc((100%-0.75rem)/2)] shrink-0 snap-start tablet:w-[calc((100%-1.5rem)/3)] desktop:w-[calc((100%-2.25rem)/4)]";

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
    <PageContainer dir="rtl">
      {/* --- Header --- */}
      <PageIntroBanner
        className="mb-5"
        icon={IconUsers}
        title="وکلای LEGALIR"
        description="وکلای تأییدشده را بر اساس تخصص، شهر، سابقه و بودجه مرور کنید و خودتان انتخاب کنید."
      />

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
      {/* The skeleton reserves the SAME shape as the loaded page: one short
          rail, then the flat roster grid — so nothing jumps on arrival. */}
      {isLoading && (
        <div className="space-y-8">
          <section>
            <div className="mb-3 h-6 w-40 animate-pulse rounded bg-surface-container" />
            <CardRail ariaLabel="وکلای پیشنهادی" itemClassName={FEATURED_ITEM}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-full">
                  <LawyerCardCompactSkeleton />
                </div>
              ))}
            </CardRail>
          </section>
          <section>
            <div className="mb-3 h-6 w-48 animate-pulse rounded bg-surface-container" />
            <div className={ROSTER_GRID}>
              {Array.from({ length: 6 }, (_, i) => (
                <LawyerCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* --- Error --- */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-large bg-error-container p-6 text-center">
          <p className="text-body-1 text-error">دریافت فهرست وکلا با مشکل مواجه شد.</p>
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={() => refetch()}
            startIcon={<IconRefresh size={16} />}
          >
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* --- Empty --- */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <IconInfo size={32} className="text-muted" />
          <p className="text-body-1 text-muted">
            {isFiltering ? "وکیلی با این مشخصات یافت نشد" : "در حال حاضر وکیلی در دسترس نیست"}
          </p>
          <p className="text-body-2 text-muted">
            {isFiltering ? "فیلترها را تغییر دهید یا جستجو را پاک کنید" : "لطفاً بعداً دوباره سر بزنید"}
          </p>
          {isFiltering && (
            <Button
              type="button"
              variant="secondary"
              onClick={clearFilters}
              startIcon={<IconClose size={16} />}
              className="mt-2"
            >
              پاک کردن فیلترها
            </Button>
          )}
        </div>
      )}

      {/* --- Filtered results (flat grid) --- */}
      {!isLoading && !isError && items.length > 0 && isFiltering && (
        <div>
          <div className="mb-3 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={clearFilters}
              startIcon={<IconClose size={16} />}
            >
              پاک کردن فیلترها
            </Button>
          </div>
          <div className={ROSTER_GRID}>
            {items.map((lawyer) => (
              <LawyerCard key={lawyer.id} lawyer={lawyer} />
            ))}
          </div>
        </div>
      )}

      {/* --- Grouped marketplace (default view) --- */}
      {!isLoading && !isError && items.length > 0 && !isFiltering && (
        <div>
          {/* Featured / recommended — the ONE rail on this page. It is
              short and curated, so a rail reads as a highlighted shelf
              rather than as a container the roster is hidden inside. */}
          {featured.length > 0 && (
            <section className="mb-8">
              <SectionHeader
                icon={<IconSparkle size={20} />}
                title="وکلای پیشنهادی"
                description="بر اساس تخصص، تجربه و امتیاز کاربران"
              />
              <CardRail ariaLabel="وکلای پیشنهادی" itemClassName={FEATURED_ITEM}>
                {featured.map((lawyer) => (
                  <div key={lawyer.id} className="h-full">
                    <LawyerCardCompact lawyer={lawyer} />
                  </div>
                ))}
              </CardRail>
            </section>
          )}

          {/* سایر وکلا — the complete remaining roster as a flat, scannable
              GRID. This is the page's main list: everyone not already on
              the featured shelf, reachable without a horizontal gesture. */}
          {rest.length > 0 && (
            <section className="mb-8">
              <SectionHeader
                title={restLabel}
                description="همهٔ وکلا به‌جز موارد نمایش‌داده‌شده در بالا؛ برای محدودکردن، جستجو یا فیلتر کنید."
              />
              <div className={ROSTER_GRID}>
                {rest.map((lawyer) => (
                  <LawyerCard key={lawyer.id} lawyer={lawyer} />
                ))}
              </div>
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
    </PageContainer>
  );
}
