// ============================================================
// LEGALIR — All calculators grid (client)
// ============================================================
// The full, searchable, filterable catalog. Search and the same two
// filters as the home page compose (the result is bounded by both), the
// live result count is always shown, and clearing restores the complete
// list. The `category` / `status` / `q` query params seed the initial
// state so a category link lands pre-filtered; an unknown value falls
// back to «همه» rather than silently showing an empty grid.
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconArrowBack, IconCalculator } from "@/lib/icons";
import {
  applyCalculatorQuery,
  categoryOptions,
  listCalculatorCards,
  statusOptions,
} from "@/lib/calculators/catalog";
import { CalculatorCard, CalculatorControls } from "@/components/calculators";

export function AllCalculators() {
  const searchParams = useSearchParams();

  const allCards = useMemo(() => listCalculatorCards(), []);
  const categories = useMemo(() => categoryOptions(allCards), [allCards]);
  const statuses = useMemo(() => statusOptions(allCards), [allCards]);

  // Seed from the URL, validating against the real option sets so a
  // stale/hand-typed param never hides the whole catalog.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(() => {
    const raw = searchParams.get("category");
    return raw && categories.some((c) => c.id === raw) ? raw : "all";
  });
  const [status, setStatus] = useState(() => {
    const raw = searchParams.get("status");
    return raw && statuses.some((s) => s.id === raw) ? raw : "all";
  });

  const trimmed = query.trim();
  const hasActiveFilter = trimmed.length > 0 || category !== "all" || status !== "all";

  const results = useMemo(
    () => applyCalculatorQuery(allCards, trimmed, { category, status }),
    [allCards, trimmed, category, status]
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }, []);

  return (
    <div className="mx-auto max-w-6xl overflow-x-clip p-4 tablet:p-6" dir="rtl">
      <header className="mb-5">
        <Link
          href="/calculators"
          className="mb-3 inline-flex items-center gap-1.5 rounded-small text-caption font-medium text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <IconArrowBack size={16} />
          بازگشت به محاسبه‌گرها
        </Link>
        <h1 className="text-h2 font-bold text-on-surface">همهٔ محاسبه‌گرهای حقوقی</h1>
        <p className="mt-1.5 max-w-2xl text-body-2 leading-relaxed text-on-surface-variant">
          فهرست کامل محاسبه‌گرها با جستجو و فیلتر بر پایه دسته‌بندی و مبنای قانونی.
        </p>
      </header>

      <div className="mb-5">
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
          hasActiveFilter={hasActiveFilter}
          onClearFilters={clearFilters}
          placeholder="مثلاً: دیه، حق‌الوکاله، مالیات"
        />
      </div>

      <div className="mb-4 flex items-baseline justify-between gap-3" aria-live="polite">
        <p className="text-body-2 text-on-surface-variant">
          {results.length.toLocaleString("fa-IR")} محاسبه‌گر
          {hasActiveFilter ? " مطابق با جستجو و فیلتر" : " در دسترس"}
        </p>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 rounded-small text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            پاک کردن فیلترها
          </button>
        )}
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
    </div>
  );
}
