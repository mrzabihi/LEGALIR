// ============================================================
// LEGALIR — Lawyer Marketplace (PART 3)
// ============================================================
// Browse verified lawyers. Filters (category, province, max fee, remote,
// search) map 1:1 onto the /api/v1/lawyers query string. Demo lawyers are
// clearly badged «نمونه» — they are never presented as real practitioners.
// ============================================================

"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLawyers } from "@/hooks/useLawyers";
import { IconSearch, IconInfo, IconRefresh } from "@/lib/icons";
import { LawyerCard, LawyerCardSkeleton } from "@/components/lawyers";
import { LEGAL_CATEGORY_FA, type LawyerListFilters } from "@legalir/types";
import { Select, TextField, Checkbox } from "@legalir/ui";

const CATEGORY_OPTIONS = Object.entries(LEGAL_CATEGORY_FA);

const SORT_OPTIONS: { key: NonNullable<LawyerListFilters["sort"]>; label: string }[] = [
  { key: "relevance", label: "مرتبط‌ترین" },
  { key: "rating", label: "بیشترین امتیاز" },
  { key: "experience", label: "بیشترین سابقه" },
  { key: "price_asc", label: "ارزان‌ترین" },
  { key: "price_desc", label: "گران‌ترین" },
];

export default function LawyersPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  // Seed the category filter from ?category= so links from chat land
  // pre-filtered on the topic the user was discussing.
  const [category, setCategory] = useState<string>(() => searchParams.get("category") ?? "");
  const [sort, setSort] = useState<NonNullable<LawyerListFilters["sort"]>>("relevance");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filters = useMemo<LawyerListFilters>(
    () => ({
      search: search.trim() || undefined,
      category: category || undefined,
      sort,
      remoteOnly: remoteOnly || undefined,
      pageSize: 24,
    }),
    [search, category, sort, remoteOnly]
  );

  const { data, isLoading, isError, refetch } = useLawyers(filters);
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="mb-2 text-h2 text-on-surface">وکلای LEGALIR</h1>
        <p className="text-body-2 text-muted">
          وکلای تأییدشده را بر اساس تخصص، شهر و بودجه مرور کنید و خودتان انتخاب کنید.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-xl">
        <TextField
          type="search"
          label="جستجوی وکیل"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام یا تخصص..."
          leadingIcon={<IconSearch size={20} />}
          fullWidth
        />
      </div>

      {/* Category chips */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={[
            "shrink-0 rounded-xl px-4 py-2 text-caption font-medium transition-all touch-target",
            category === ""
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "border border-divider/60 bg-surface text-on-surface hover:bg-surface-hover",
          ].join(" ")}
        >
          همه تخصص‌ها
        </button>
        {CATEGORY_OPTIONS.map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => setCategory(code)}
            className={[
              "shrink-0 rounded-xl px-4 py-2 text-caption font-medium transition-all touch-target",
              category === code
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "border border-divider/60 bg-surface text-on-surface hover:bg-surface-hover",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort + remote */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Select
          label="ترتیب نمایش"
          value={sort}
          onChange={(e) => setSort(e.target.value as NonNullable<LawyerListFilters["sort"]>)}
          selectSize="small"
          options={SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
        />
        <Checkbox
          label="فقط مشاوره آنلاین"
          checked={remoteOnly}
          onChange={(e) => setRemoteOnly(e.target.checked)}
          className="text-caption text-on-surface"
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LawyerCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-6 text-center">
          <p className="text-body-1 text-error">خطا در بارگذاری فهرست وکلا</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <IconInfo size={32} className="text-muted" />
          <p className="text-body-1 text-muted">وکیلی با این مشخصات یافت نشد</p>
          <p className="text-body-2 text-muted/60">فیلترها را تغییر دهید یا جستجو را پاک کنید</p>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {items.map((lawyer) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} />
          ))}
        </div>
      )}
    </div>
  );
}
