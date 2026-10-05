// ============================================================
// LEGALIR — Lawyer Marketplace
// ============================================================
// Browse verified lawyers. On mobile the page reads like a professional
// marketplace: a search bar, a scrollable category rail, a "recommended"
// carousel, then one horizontal carousel per practice area — so a long
// roster never becomes one exhausting vertical list. From `desktop` up the
// same sections render as wider carousels and a full grid.
//
// Filters (category, sort, remote, search) map 1:1 onto the
// /api/v1/lawyers query string. Demo lawyers are clearly badged «نمونه» —
// they are never presented as real practitioners.
// ============================================================

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLawyers } from "@/hooks/useLawyers";
import {
  IconSearch,
  IconInfo,
  IconRefresh,
  IconChevronLeft,
  IconChevronRightSmall,
  IconHandshake,
  IconFilter,
  IconSparkle,
} from "@/lib/icons";
import {
  LawyerCard,
  LawyerCarousel,
  LawyerCategorySection,
  LawyerFiltersSheet,
  type LawyerFilterValues,
} from "@/components/lawyers";
import { PromoPanel } from "@/components/shared";
import { LEGAL_CATEGORY_FA, type LawyerListFilters } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import { groupByPrimarySpecialty, featuredLawyers } from "@/lib/lawyers/grouping";
import { TextField } from "@legalir/ui";

const CATEGORY_OPTIONS = Object.entries(LEGAL_CATEGORY_FA);

/** Short, factual one-liners for the canonical practice areas. */
const CATEGORY_DESCRIPTION_FA: Record<string, string> = {
  family: "دعاوی خانواده، طلاق، مهریه و نفقه",
  contract: "تنظیم، بازبینی و دعاوی قراردادها",
  real_estate: "خرید، فروش، اجاره و دعاوی ملکی",
  labor: "روابط کار، بیمه و تأمین اجتماعی",
  commerce: "معاملات تجاری و اختلافات بازرگانی",
  criminal: "دفاع در پرونده‌های کیفری و جرائم",
  tax: "دعاوی مالیاتی و پرونده‌های مالیاتی",
  companies: "ثبت، تغییرات و دعاوی شرکت‌های تجاری",
  checks: "چک، سفته و اسناد تجاری",
  immigration: "مهاجرت، اقامت و امور کنسولی",
  cyber: "جرائم رایانه‌ای و دعاوی فضای مجازی",
  other: "سایر حوزه‌های حقوقی",
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

  // Seed the category filter from ?category= so links from chat land
  // pre-filtered on the topic the user was discussing.
  const [category, setCategory] = useState<string>(() => searchParams.get("category") ?? "");
  const [sort, setSort] = useState<LawyerFilterValues["sort"]>("relevance");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo<LawyerListFilters>(
    () => ({
      search: search || undefined,
      category: category || undefined,
      sort,
      remoteOnly: remoteOnly || undefined,
      pageSize: 60,
    }),
    [search, category, sort, remoteOnly]
  );

  const { data, isLoading, isError, refetch } = useLawyers(filters);
  const items = useMemo(() => data?.items ?? [], [data]);

  // A filter is "active" when the user has narrowed the roster — the page
  // then shows a flat result grid instead of the grouped marketplace.
  const isFiltering = Boolean(search || category || remoteOnly || sort !== "relevance");
  const activeFilterCount =
    (category ? 1 : 0) + (remoteOnly ? 1 : 0) + (sort !== "relevance" ? 1 : 0);

  const groups = useMemo(() => groupByPrimarySpecialty(items), [items]);
  const featured = useMemo(() => featuredLawyers(items), [items]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setSort("relevance");
    setRemoteOnly(false);
  };

  // --- Category rail scroller ---
  // On touch widths the row is a plain horizontal scroller. From `tablet`
  // up the native scrollbar is hidden and two arrow buttons page through
  // the categories instead, so a mouse user can reach the overflow.
  const chipsRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const syncChipScroll = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL: scrollLeft runs 0 → -max, so compare magnitudes.
    const pos = Math.abs(el.scrollLeft);
    setCanScrollStart(pos > 1);
    setCanScrollEnd(pos < max - 1);
  }, []);

  useEffect(() => {
    syncChipScroll();
    const el = chipsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncChipScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncChipScroll]);

  const scrollChips = (dir: "start" | "end") => {
    const el = chipsRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.7, 160);
    // RTL: negative `left` advances toward the end of the list.
    el.scrollBy({ left: dir === "end" ? -step : step, behavior: "smooth" });
  };

  const chipClass = (selected: boolean) =>
    [
      "shrink-0 rounded-full border px-4 py-2 text-caption font-medium transition-all touch-target-min",
      selected
        ? "border-control-selected-border bg-control-selected-surface text-control-selected"
        : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
    ].join(" ");

  return (
    <div className="mx-auto max-w-6xl p-4 tablet:p-6" dir="rtl">
      {/* --- Header --- */}
      <div className="mb-5">
        <h1 className="mb-2 text-h2 text-on-surface">وکلای LEGALIR</h1>
        <p className="text-body-2 text-muted">
          وکلای تأییدشده را بر اساس تخصص، شهر و بودجه مرور کنید و خودتان انتخاب کنید.
        </p>
      </div>

      {/* --- Search + filter trigger --- */}
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1 tablet:max-w-xl">
          <TextField
            type="search"
            label="جستجوی وکیل"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="نام وکیل، تخصص یا حوزه حقوقی..."
            leadingIcon={<IconSearch size={20} />}
            fullWidth
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label="فیلترها"
          className="relative flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-divider/60 bg-surface px-3 text-body-2 font-medium text-on-surface transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 desktop:hidden"
        >
          <IconFilter size={18} />
          <span className="hidden mobile-l:inline">فیلترها</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
              {toPersianNumber(activeFilterCount)}
            </span>
          )}
        </button>
      </div>

      {/* --- Category rail --- */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollChips("start")}
          disabled={!canScrollStart}
          aria-label="نمایش تخصص‌های قبلی"
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider/60 bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
        >
          <IconChevronRightSmall size={18} />
        </button>

        <div
          ref={chipsRef}
          onScroll={syncChipScroll}
          role="tablist"
          aria-label="دسته‌بندی تخصص‌ها"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === ""}
            onClick={() => setCategory("")}
            className={chipClass(category === "")}
          >
            همه
          </button>
          {CATEGORY_OPTIONS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={category === code}
              onClick={() => setCategory(code)}
              className={chipClass(category === code)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollChips("end")}
          disabled={!canScrollEnd}
          aria-label="نمایش تخصص‌های بعدی"
          className="hidden shrink-0 items-center justify-center rounded-full border border-divider/60 bg-surface p-2 text-on-surface transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
        >
          <IconChevronLeft size={18} />
        </button>
      </div>

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
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-body-2 text-muted">
              {toPersianNumber(items.length)} وکیل یافت شد
            </p>
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

          {/* همه وکلا — 4 tiles per row on desktop, 2 on mobile */}
          <section className="mb-8">
            <h2 className="mb-3 text-h3 text-on-surface">همه وکلا</h2>
            <LawyerCarousel lawyers={items} ariaLabel="همه وکلا" />
          </section>

          {/* One carousel per practice area */}
          {groups.map((group) => (
            <LawyerCategorySection
              key={group.category}
              title={`وکلای ${group.label}`}
              description={CATEGORY_DESCRIPTION_FA[group.category]}
              lawyers={group.lawyers}
              onViewAll={() => setCategory(group.category)}
            />
          ))}
        </div>
      )}

      {/* Supporting visual for the human-lawyer journey.
          Deliberately placed *after* the results: search, filtering and
          lawyer selection are the page's job, so nothing promotional may
          sit between the user and the list. It renders in both the
          populated and the empty state, so the human-lawyer path is
          always offered — without ever implying the AI chat connects to
          a human lawyer. */}
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
        value={{ category, sort, remoteOnly }}
        onApply={(next) => {
          setCategory(next.category);
          setSort(next.sort);
          setRemoteOnly(next.remoteOnly);
        }}
      />
    </div>
  );
}
