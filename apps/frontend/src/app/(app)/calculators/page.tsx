// ============================================================
// LEGALIR — Calculators catalog (محاسبه‌گرها) — discovery page
// ============================================================
// The home of the calculator domain, composed in the order a user
// actually needs it:
//
//   1. intro + prominent search
//   2. filter chips (category + legal standing)
//   3. «دسترسی سریع» — a grid of six real calculators, one per category
//   4. «محاسبه‌گرهای پیشنهادی» — a curated horizontal row
//   5. one horizontal row per real category, each with its own banner
//
// While a query or a filter is active the browse sections are replaced
// by a flat, scannable result grid — you are either browsing or
// searching, never half of each.
//
// Everything on this page derives from the calculator registry via
// `@/lib/calculators/catalog`, so a new calculator appears here with no
// edit to this file. The page is wrapped in `overflow-x-clip` and every
// horizontal rail is clipped by its own track, so the page itself never
// scrolls sideways on a phone.
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
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
  CalculatorRow,
} from "@/components/calculators";

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
    <div className="mx-auto max-w-6xl overflow-x-clip p-4 tablet:p-6" dir="rtl">
      {/* ============================================================
          1. Intro + search
          ============================================================ */}
      <header className="mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-3 py-1 text-caption text-on-surface-variant">
          <IconCalculator size={14} />
          {allCards.length.toLocaleString("fa-IR")} محاسبه‌گر حقوقی
        </span>
        <h1 className="mt-3 text-h2 font-bold text-on-surface">محاسبه‌گرهای حقوقی</h1>
        <p className="mt-1.5 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
          محاسبات دقیق و مستند بر پایه قوانین و تعرفه‌های رسمی — بدون واسپاری به هوش مصنوعی.
          محاسبه‌گر خود را جستجو کنید یا از دسته‌بندی‌ها به آن برسید.
        </p>
      </header>

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
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
              >
                پاک کردن جستجو و فیلترها
              </button>
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
              2. Quick access — six real calculators, one per category
              ============================================================ */}
          <section aria-labelledby="quick-access-title" className="mb-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="quick-access-title" className="text-h4 font-bold text-on-surface">
                  دسترسی سریع
                </h2>
                <p className="mt-1 text-caption text-on-surface-variant">
                  پرکاربردترین محاسبه‌گرها برای شروع سریع
                </p>
              </div>
              <Link
                href="/calculators/all"
                className="hidden shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-labelLarge font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
              >
                مشاهدهٔ همه
                <IconChevronLeft size={16} />
              </Link>
            </div>

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
              3. Suggested — a curated horizontal row
              ============================================================ */}
          {suggested.length > 0 && (
            <section aria-labelledby="suggested-title" className="mb-10">
              <div className="mb-3">
                <h2 id="suggested-title" className="text-h4 font-bold text-on-surface">
                  محاسبه‌گرهای پیشنهادی
                </h2>
                <p className="mt-1 text-caption text-on-surface-variant">
                  انتخاب‌شده‌ای از محاسبه‌گرهای پراستفاده
                </p>
              </div>
              <CalculatorRow items={suggested} ariaLabel="محاسبه‌گرهای پیشنهادی" />
            </section>
          )}

          {/* ============================================================
              4. One row per real category
              ============================================================ */}
          {groups.map((group) => (
            <section key={group.meta.id} aria-label={group.meta.title} className="mb-10">
              <CalculatorCategoryBanner meta={group.meta} count={group.items.length} />
              <CalculatorRow
                items={group.items}
                ariaLabel={`محاسبه‌گرهای دسته ${group.meta.title}`}
                className="mt-3"
              />
            </section>
          ))}
        </>
      )}

      <p className="mt-8 text-center text-caption text-on-surface-variant">
        نتایج این محاسبه‌گرها جنبه اطلاع‌رسانی دارد و جایگزین نظر کارشناس حقوقی نیست.
      </p>
    </div>
  );
}
