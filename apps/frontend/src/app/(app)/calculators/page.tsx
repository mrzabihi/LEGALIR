// ============================================================
// LEGALIR — Calculators catalog (محاسبه‌گرها) — discovery page
// ============================================================
// The home of the calculator domain, composed in the order a user
// actually needs it:
//
//   1. intro + prominent search
//   2. filter controls (category + legal standing)
//   3. Category Grid — one tile per real category, with its real count
//   4. «دسترسی سریع» — a grid of six real calculators, one per category
//   5. «محاسبه‌گرهای پیشنهادی» — the one rail: a short, curated set
//   6. one flat grid per real category, each under its own banner
//
// While a query or a filter is active the browse sections are replaced
// by a flat, scannable result grid — you are either browsing or
// searching, never half of each.
//
// Everything on this page derives from the calculator registry via
// `@/lib/calculators/catalog`, so a new calculator appears here with no
// edit to this file. The page is wrapped in `overflow-x-clip` and the one
// remaining rail is clipped by its own track, so the page itself never
// scrolls sideways on a phone.
//
// NOTHING in this file touches a formula, an input, an output or a
// validation rule: every calculator's own page and engine are untouched,
// and every card still links to its unchanged `/calculators/{slug}` path.
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@legalir/ui";
import { IconCalculator, IconChevronLeft } from "@/lib/icons";
import {
  QUICK_ACCESS_SLUGS,
  SUGGESTED_SLUGS,
  applyCalculatorQuery,
  cardsBySlugs,
  categoryOptions,
  groupCalculatorsByCategory,
  listCalculatorCards,
  statusOptions,
} from "@/lib/calculators/catalog";
import {
  CalculatorCard,
  CalculatorCategoryBanner,
  CalculatorControls,
} from "@/components/calculators";
import {
  CardRail,
  CategoryTile,
  PageContainer,
  PageIntroBanner,
  SectionHeader,
} from "@/components/shared";
import type { CalculatorCategoryTone } from "@/lib/calculators/catalog";

/**
 * One accent per semantic tone, resolved from tokens (never a hex), so a
 * category tile matches the tone its section banner already uses and dark
 * mode follows for free. Brand hues are preferred where they coincide.
 */
const CATEGORY_ACCENT: Record<CalculatorCategoryTone, string> = {
  primary: "var(--color-primary)",
  secondary: "var(--brand-gold)",
  success: "var(--brand-green)",
  warning: "var(--brand-gold)",
  error: "var(--color-error)",
  info: "var(--color-info)",
  neutral: "var(--brand-teal)",
};

/** The suggested rail keeps one card width at every breakpoint. */
const SUGGESTED_ITEM = "w-[240px] shrink-0 snap-start tablet:w-[256px]";

export default function CalculatorsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const allCards = useMemo(() => listCalculatorCards(), []);
  const quickAccess = useMemo(() => cardsBySlugs(QUICK_ACCESS_SLUGS), []);
  const suggested = useMemo(() => cardsBySlugs(SUGGESTED_SLUGS), []);
  const groups = useMemo(() => groupCalculatorsByCategory(allCards), [allCards]);
  const categories = useMemo(() => categoryOptions(allCards), [allCards]);
  const statuses = useMemo(() => statusOptions(allCards), [allCards]);

  const trimmed = query.trim();
  const isFiltering = trimmed.length > 0 || category !== "all" || status !== "all";
  // Widened back to `string` so the browse branch (where TS can prove the
  // filter is off) can still compare it against a tile id without the
  // compiler collapsing the comparison.
  const activeCategoryId: string = category;

  const results = useMemo(
    () => (isFiltering ? applyCalculatorQuery(allCards, trimmed, { category, status }) : []),
    [isFiltering, allCards, trimmed, category, status]
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }, []);

  return (
    <PageContainer className="overflow-x-clip" dir="rtl">
      {/* ============================================================
          1. Intro + search
          ============================================================ */}
      <PageIntroBanner
        className="mb-5"
        icon={IconCalculator}
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-3 py-1 text-caption text-on-surface-variant">
            <IconCalculator size={14} />
            {allCards.length.toLocaleString("fa-IR")} محاسبه‌گر حقوقی
          </span>
        }
        title="محاسبه‌گرهای حقوقی"
        description="محاسبات دقیق و مستند بر پایه قوانین و تعرفه‌های رسمی — بدون واسپاری به هوش مصنوعی. محاسبه‌گر خود را جستجو کنید یا از دسته‌بندی‌ها به آن برسید."
      />

      <div className="mb-6">
        <CalculatorControls
          query={query}
          onQueryChange={setQuery}
          onClearQuery={() => setQuery("")}
          categories={categories}
          activeCategory={category}
          onCategoryChange={setCategory}
          statuses={statuses}
          activeStatus={status}
          onStatusChange={setStatus}
          hasActiveFilter={isFiltering}
          onClearFilters={clearFilters}
        />
      </div>

      {/* ============================================================
          Search / filter mode — flat, scannable results
          ============================================================ */}
      {isFiltering ? (
        <section aria-live="polite">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-h4 font-bold text-on-surface">
              {results.length > 0
                ? `${results.length.toLocaleString("fa-IR")} محاسبه‌گر یافت شد`
                : "محاسبه‌گری یافت نشد"}
            </h2>
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-small text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              نمایش همه محاسبه‌گرها
            </button>
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface px-4 py-14 text-center">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-xlarge bg-surface-container text-muted"
              >
                <IconCalculator size={30} />
              </span>
              <p className="text-body-1 font-medium text-on-surface">
                محاسبه‌گری با این مشخصات پیدا نشد
              </p>
              <p className="max-w-sm text-body-2 text-on-surface-variant">
                عبارت دیگری را امتحان کنید یا فیلترها را پاک کنید تا فهرست کامل نمایش داده شود.
              </p>
              <Button type="button" onClick={clearFilters} className="mt-2">
                پاک کردن جستجو و فیلترها
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
              {results.map((card) => (
                <li key={card.slug} className="h-full">
                  <CalculatorCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* ============================================================
              2. Category grid — one tile per category that actually has
                 calculators, with its real count. Selecting a tile applies
                 the SAME category filter the dropdown writes, so the page
                 switches to its flat result grid without a new code path.
              ============================================================ */}
          <section aria-labelledby="categories-title" className="mb-10">
            <SectionHeader
              id="categories-title"
              title="دسته‌بندی محاسبه‌گرها"
              description="موضوع حقوقی خود را انتخاب کنید تا محاسبه‌گرهای همان دسته نمایش داده شوند."
            />
            <div
              role="group"
              aria-label="دسته‌بندی محاسبه‌گرها"
              className="grid grid-cols-2 gap-2.5 tablet:grid-cols-3 desktop:grid-cols-4"
            >
              {groups.map((group) => {
                const Icon = group.meta.icon;
                return (
                  <CategoryTile
                    key={group.meta.id}
                    label={group.meta.title}
                    description={group.meta.description}
                    countLabel={`${group.items.length.toLocaleString("fa-IR")} محاسبه‌گر`}
                    icon={<Icon size={20} />}
                    accent={CATEGORY_ACCENT[group.meta.tone]}
                    selected={activeCategoryId === group.meta.id}
                    onClick={() =>
                      // Selecting a category reuses the existing filter, so
                      // the page switches to its flat result grid exactly as
                      // it does from the dropdown.
                      setCategory(activeCategoryId === group.meta.id ? "all" : group.meta.id)
                    }
                  />
                );
              })}
            </div>
          </section>

          {/* ============================================================
              3. Quick access — six real calculators, one per category
              ============================================================ */}
          <section aria-labelledby="quick-access-title" className="mb-10">
            <SectionHeader
              id="quick-access-title"
              title="دسترسی سریع"
              description="پرکاربردترین محاسبه‌گرها برای شروع سریع"
              action={
                <Link
                  href="/calculators/all"
                  className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-labelLarge font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
                >
                  مشاهدهٔ همه
                  <IconChevronLeft size={16} />
                </Link>
              }
            />

            <ul className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-6">
              {quickAccess.map((card) => (
                <li key={card.slug} className="h-full">
                  <CalculatorCard card={card} showStatus={false} />
                </li>
              ))}
            </ul>

            <Link
              href="/calculators/all"
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-medium border border-[color:var(--color-outline-variant)] px-4 py-2.5 text-button font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden"
            >
              مشاهدهٔ همهٔ محاسبه‌گرها
              <IconChevronLeft size={16} />
            </Link>
          </section>

          {/* ============================================================
              4. Suggested — the one place a rail is appropriate: a short,
                 curated set. The complete list is always one link away and
                 lives in a flat grid, never behind a slider.
              ============================================================ */}
          {suggested.length > 0 && (
            <section aria-labelledby="suggested-title" className="mb-10">
              <SectionHeader
                id="suggested-title"
                title="محاسبه‌گرهای پیشنهادی"
                description="انتخاب‌شده‌ای از محاسبه‌گرهای پراستفاده"
              />
              <CardRail ariaLabel="محاسبه‌گرهای پیشنهادی" itemClassName={SUGGESTED_ITEM}>
                {suggested.map((card) => (
                  <CalculatorCard key={card.slug} card={card} />
                ))}
              </CardRail>
            </section>
          )}

          {/* ============================================================
              4. One row per real category
              ============================================================ */}
          {groups.map((group) => (
            <section key={group.meta.id} aria-label={group.meta.title} className="mb-10">
              {/* The banner keeps its count and its route to the full,
                  pre-filtered list, so every calculator in the category is
                  reachable without touching a rail. */}
              <CalculatorCategoryBanner meta={group.meta} count={group.items.length} />
              {/* A category is a flat, scannable grid — never a carousel.
                  Every card is a real link to its own calculator page. */}
              <ul
                aria-label={`محاسبه‌گرهای دسته ${group.meta.title}`}
                className="mt-3 grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4"
              >
                {group.items.map((card) => (
                  <li key={card.slug} className="h-full">
                    <CalculatorCard card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <p className="mt-8 text-center text-caption text-on-surface-variant">
        نتایج این محاسبه‌گرها جنبه اطلاع‌رسانی دارد و جایگزین نظر کارشناس حقوقی نیست.
      </p>
    </PageContainer>
  );
}
