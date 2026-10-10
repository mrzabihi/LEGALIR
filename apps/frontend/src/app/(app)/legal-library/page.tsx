// ============================================================
// LEGALIR — Legal Library (کتابخانه حقوقی) — public list
// ============================================================
// A product section of its OWN, distinct from the blog: it reads the real,
// published-only library store through its own API + hooks (namespace
// ["library", …]). Nothing here is hard-coded — every card, topic and filter
// comes from the backend; drafts and archived sources never reach this surface.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TextField } from "@legalir/ui";
import type { LegalContentType, V1LegalLibraryListItem } from "@legalir/types";
import { useLegalLibraryItems, useLegalLibraryTopics } from "@/hooks/useDashboard";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconClose } from "@/lib/icons";

// ============================================================
// Inline SVG helpers
// ============================================================

function SvgIcon({
  children,
  size = 20,
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconSearch = () => (
  <SvgIcon size={20}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </SvgIcon>
);

const IconClock = () => (
  <SvgIcon size={14}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </SvgIcon>
);

const IconShield = () => (
  <SvgIcon size={14}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
  </SvgIcon>
);

const IconCheckCircle = () => (
  <SvgIcon size={14}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </SvgIcon>
);

const IconArrowLeft = () => (
  <SvgIcon size={16}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </SvgIcon>
);

const IconBookOpen = () => (
  <SvgIcon size={20}>
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
  </SvgIcon>
);

// ============================================================
// Source-type presentation
// ============================================================

/** Filter chips — real `LegalContentType` values (the blog's article type is
 *  intentionally absent: the library is a separate section). */
const SOURCE_FILTERS: { key: "" | LegalContentType; label: string }[] = [
  { key: "", label: "همه" },
  { key: "LAW_ARTICLE", label: "قانون" },
  { key: "UNIFICATION_RULING", label: "رأی وحدت رویه" },
  { key: "JUDICIAL_DECISION", label: "رأی قضایی" },
  { key: "REGULATION", label: "آیین‌نامه" },
  { key: "LEGAL_GUIDE", label: "راهنما" },
  { key: "HOW_TO", label: "راهنمای عملی" },
  { key: "CHECKLIST", label: "چک‌لیست" },
  { key: "FAQ", label: "پرسش و پاسخ" },
  { key: "LEGAL_TOOL", label: "ابزار حقوقی" },
  { key: "TEMPLATE_GUIDE", label: "قالب و راهنما" },
];

/** Per-type accent (icon tile + type badge) keeping the library's own identity. */
const TYPE_STYLE: Record<LegalContentType, { badge: string; tile: string }> = {
  LAW_ARTICLE: { badge: "bg-primary/8 text-primary-700", tile: "from-primary-600 to-primary-800" },
  REGULATION: { badge: "bg-warning-container text-warning", tile: "from-amber-500 to-amber-700" },
  UNIFICATION_RULING: { badge: "bg-secondary/10 text-secondary-700", tile: "from-secondary to-secondary-light" },
  JUDICIAL_DECISION: { badge: "bg-info-container text-info", tile: "from-sky-500 to-sky-700" },
  LEGAL_GUIDE: { badge: "bg-secondary/10 text-secondary-700", tile: "from-secondary to-secondary-light" },
  HOW_TO: { badge: "bg-primary/8 text-primary-700", tile: "from-primary-600 to-primary-800" },
  CHECKLIST: { badge: "bg-success-container text-success", tile: "from-emerald-500 to-teal-600" },
  FAQ: { badge: "bg-info-container text-info", tile: "from-sky-500 to-sky-700" },
  LEGAL_TOOL: { badge: "bg-primary/8 text-primary-700", tile: "from-blue-500 to-cyan-500" },
  TEMPLATE_GUIDE: { badge: "bg-primary/8 text-primary-700", tile: "from-primary-600 to-primary-800" },
  BLOG_ARTICLE: { badge: "bg-surface-container text-on-surface-variant", tile: "from-neutral-500 to-neutral-700" },
  SOURCE: { badge: "bg-surface-container text-on-surface-variant", tile: "from-neutral-500 to-neutral-700" },
};

/** Honest verification label derived from the real `verificationStatus`. */
function verificationChip(status: V1LegalLibraryListItem["verificationStatus"]): {
  label: string;
  className: string;
} | null {
  switch (status) {
    case "VERIFIED_OFFICIAL":
      return { label: "تأیید رسمی", className: "bg-success-container text-success" };
    case "VERIFIED_SECONDARY":
      return { label: "تأیید ثانویه", className: "bg-success-container text-success" };
    case "DEMO_VERIFIED":
      return { label: "بررسی‌شده", className: "bg-info-container text-info" };
    case "OUTDATED":
      return { label: "نیازمند به‌روزرسانی", className: "bg-warning-container text-warning" };
    case "SUPERSEDED":
      return { label: "منسوخ", className: "bg-warning-container text-warning" };
    default:
      return null;
  }
}

// ============================================================
// Card
// ============================================================

function SourceCard({ item }: { item: V1LegalLibraryListItem }) {
  const style = TYPE_STYLE[item.sourceType] ?? TYPE_STYLE.SOURCE;
  const chip = verificationChip(item.verificationStatus);

  return (
    <Link
      href={`/legal-library/${encodeURIComponent(item.id)}`}
      className="card-lift card-press group flex flex-col gap-3 rounded-2xl border border-divider/60 bg-surface p-4 shadow-elevation-1 transition-colors hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-200 group-hover:scale-110 ${style.tile}`}
        >
          <IconBookOpen />
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-labelSmall font-medium ${style.badge}`}
        >
          {item.sourceTypeFa}
        </span>
      </div>

      <h3 className="line-clamp-2 text-titleSmall font-semibold text-on-surface transition-colors group-hover:text-primary">
        {item.title}
      </h3>

      {item.summary && (
        <p className="line-clamp-2 text-caption leading-relaxed text-muted">{item.summary}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-labelSmall text-on-surface-variant">
        {chip && (
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 ${chip.className}`}>
            <IconCheckCircle />
            {chip.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-muted">
          <IconClock />
          {toPersianNumber(item.readingTime)} دقیقه
        </span>
        {item.authority && (
          <span className="inline-flex min-w-0 items-center gap-1 text-muted">
            <IconShield />
            <span className="truncate">{item.authority}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-divider/60 bg-surface p-4 shadow-elevation-1">
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-surface-container" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-surface-container" />
      </div>
      <div className="h-5 w-3/4 animate-pulse rounded bg-surface-container" />
      <div className="h-4 w-full animate-pulse rounded bg-surface-container" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-container" />
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function LegalLibraryPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<"" | LegalContentType>("");
  const [activeTopic, setActiveTopic] = useState("");

  // Debounce the search so each keystroke does not fire its own request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      sourceType: activeType || undefined,
      topic: activeTopic || undefined,
      sort: "newest" as const,
      pageSize: 60,
    }),
    [search, activeType, activeTopic]
  );

  const itemsQuery = useLegalLibraryItems(params);
  const topicsQuery = useLegalLibraryTopics();

  const items = itemsQuery.data?.items ?? [];
  const topics = topicsQuery.data ?? [];

  const hasFilters = Boolean(search.trim() || activeType || activeTopic);
  const showEmpty = !itemsQuery.isLoading && !itemsQuery.isError && items.length === 0;

  function resetFilters() {
    setSearchInput("");
    setActiveType("");
    setActiveTopic("");
  }

  return (
    <div className="mx-auto max-w-7xl p-4 tablet:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-h2 text-on-surface">کتابخانه حقوقی</h1>
        <p className="max-w-2xl text-body-2 text-muted">
          قوانین، مقررات، آرای قضایی، راهنماها و ابزارهای حقوقی — دسترسی سریع به دانش حقوقی
          معتبر با جستجوی هوشمند و دسته‌بندی موضوعی.
        </p>
      </div>

      {/* Search */}
      <div className="mb-5 max-w-xl">
        <TextField
          type="search"
          label="جستجو در کتابخانه حقوقی"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="جستجو در قوانین، راهنماها، آرا و ابزارهای حقوقی..."
          leadingIcon={<IconSearch />}
          endAdornment={
            searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08]"
                aria-label="پاک کردن جستجو"
              >
                <IconClose size={18} />
              </button>
            ) : undefined
          }
          fullWidth
        />
      </div>

      {/* Topics — real topics from the library store */}
      {topics.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-titleSmall font-semibold text-on-surface">موضوعات</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {topics.map((t) => {
              const active = activeTopic === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTopic(active ? "" : t.slug)}
                  className={[
                    "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-caption font-medium transition-all touch-target",
                    active
                      ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                      : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
                  ].join(" ")}
                >
                  {t.icon && <span aria-hidden="true">{t.icon}</span>}
                  {t.titleFa}
                  <span className="text-labelSmall text-muted">
                    {toPersianNumber(t.contentCount)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Type filter chips */}
      <div
        role="tablist"
        aria-label="فیلتر نوع منبع حقوقی"
        className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {SOURCE_FILTERS.map((filter) => {
          const active = activeType === filter.key;
          return (
            <button
              key={filter.key || "all"}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setActiveType(filter.key)}
              className={[
                "shrink-0 rounded-xl border px-4 py-2 text-caption font-medium transition-all touch-target",
                active
                  ? "border-control-selected-border bg-control-selected-surface text-control-selected"
                  : "border-divider/60 bg-surface text-on-surface hover:border-control-selected/50",
              ].join(" ")}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {itemsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : itemsQuery.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-error/20 bg-error-container">
            <SvgIcon size={30} className="text-error">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </SvgIcon>
          </div>
          <p className="text-body-1 font-medium text-on-surface">بارگذاری کتابخانه ناموفق بود</p>
          <p className="max-w-md text-body-2 text-muted">
            ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            type="button"
            onClick={() => itemsQuery.refetch()}
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98] touch-target"
          >
            تلاش دوباره
          </button>
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-divider/40 bg-surface-container">
            <IconSearch />
          </div>
          <p className="text-body-1 font-medium text-on-surface">
            {hasFilters ? "منبعی با این فیلترها یافت نشد" : "هنوز منبعی در کتابخانه منتشر نشده است"}
          </p>
          <p className="max-w-md text-body-2 text-muted">
            {hasFilters
              ? "عبارت جستجو یا دسته‌بندی دیگری را امتحان کنید."
              : "به‌زودی منابع حقوقی در این بخش منتشر می‌شود."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 rounded-xl border border-divider bg-surface px-5 py-2.5 text-body-2 font-medium text-on-surface transition-colors hover:bg-surface-container touch-target"
            >
              نمایش همه منابع
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {items.map((item) => (
            <SourceCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mb-4 mt-12 rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/5 to-secondary/5 p-6 text-center">
        <p className="mb-1 text-body-1 font-medium text-on-surface">
          منبع حقوقی مورد نظر خود را پیدا نکردید؟
        </p>
        <p className="mb-4 text-body-2 text-muted">
          می‌توانید درخواست افزودن منبع جدید را ثبت کنید یا از مشاور هوش مصنوعی LEGALIR کمک بگیرید.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98] touch-target"
          >
            <IconArrowLeft />
            پرسش از مشاور
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 rounded-xl border border-divider px-6 py-2.5 text-button font-medium text-on-surface transition-colors hover:bg-surface-container active:scale-[0.98] touch-target"
          >
            درخواست منبع جدید
          </Link>
        </div>
      </div>
    </div>
  );
}
