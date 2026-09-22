"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconCalendar,
  IconPerson,
  IconCategory,
  IconSearch,
  IconClose,
} from "@/lib/icons";
import { useBlogPosts } from "@/hooks/useDashboard";
import { toPersianDate } from "@/lib/persian-utils";
import type { V1BlogListItem } from "@legalir/types";
import { TextField } from "@legalir/ui";

// ============================================================
// Deterministic cover gradients (coverImage is null in fixtures)
// ============================================================

const categoryGradients: Record<string, string> = {
  قراردادها: "from-primary-700 to-primary-900",
  "املاک و مستغلات": "from-secondary-600 to-secondary-800",
  تجارت: "from-primary-600 to-secondary-700",
  خانواده: "from-primary-800 to-neutral-900",
};

function gradientFor(category: string): string {
  return categoryGradients[category] ?? "from-primary-700 to-primary-900";
}

// Real cover art, keyed by slug. Posts without an entry fall back to the
// deterministic category gradient. Keeps a post's card cover identical to the
// featured hero cover for the same article.
const POST_COVERS: Record<string, string> = {
  "contract-penalty-clause": "/assets/blog/vajhe-eltezam.jpg",
};

function formatDate(iso: string): string {
  try {
    return toPersianDate(iso, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

// ============================================================
// Sub-components
// ============================================================

function BlogCard({ post }: { post: V1BlogListItem }) {
  const imageColor = gradientFor(post.category);
  const cover = POST_COVERS[post.slug];

  return (
    <article className="group rounded-xl bg-surface border border-neutral-200 shadow-sm hover:shadow-elevation-4 transition-all duration-medium1 overflow-hidden flex flex-col">
      {/* Cover — real artwork when the post ships one, otherwise the
          deterministic category gradient. Capped at 748×300 so the thumbnail
          stays small on the listing page at every breakpoint. */}
      <Link href={`/blog/${post.slug}`} className="block">
        {cover ? (
          <div className="relative h-48 max-h-[300px] w-full max-w-[748px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={post.titleFa}
              width={2048}
              height={1152}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className={`h-48 bg-gradient-to-br ${imageColor} flex items-center justify-center relative overflow-hidden`}
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-6 w-24 h-24 rounded-full border-2 border-white" />
              <div className="absolute bottom-2 left-8 w-16 h-16 rounded-full border border-white" />
              <div className="absolute top-10 left-12 w-32 h-32 rounded-full border border-white/60" />
            </div>
            <div className="relative z-10 text-center px-4">
              <span className="text-white/80 text-labelSmall block mb-1">
                LEGALIR Blog
              </span>
              <span className="text-white/50 text-bodySmall">
                {post.category}
              </span>
            </div>
          </div>
        )}
      </Link>

      {/* Card content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-labelSmall bg-primary-50 text-primary-700 border border-primary-200/60">
            <IconCategory size={12} />
            {post.category}
          </span>
        </div>

        <Link href={`/blog/${post.slug}`} className="group/link">
          <h3 className="text-h4 text-primary-800 mb-2 group-hover/link:text-primary-600 transition-colors line-clamp-2 leading-snug">
            {post.titleFa}
          </h3>
        </Link>

        <p className="text-body-2 text-neutral-500 mb-4 flex-1 line-clamp-3 leading-relaxed">
          {post.excerpt}
        </p>

        <div className="flex items-center gap-4 text-caption text-neutral-400 pt-3 border-t border-divider">
          <span className="flex items-center gap-1.5">
            <IconPerson size={14} />
            {post.author}
          </span>
          <span className="flex items-center gap-1.5">
            <IconCalendar size={14} />
            {formatDate(post.publishedAt)}
          </span>
          <span className="ms-auto tabular-nums">
            {post.readingTime} دقیقه مطالعه
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
        <IconSearch size={32} className="text-neutral-300" />
      </div>
      <h3 className="text-h3 text-primary-800 mb-2">
        {query ? "نتیجه‌ای یافت نشد" : "هنوز مقاله‌ای منتشر نشده است"}
      </h3>
      <p className="text-body-2 text-neutral-500 max-w-md leading-relaxed">
        {query
          ? `مقاله‌ای با عبارت "${query}" پیدا نکردیم. لطفاً عبارت دیگری را جستجو کنید یا فیلترها را تغییر دهید.`
          : "مقالات حقوقی LEGALIR به زودی منتشر خواهند شد. برای اطلاع از جدیدترین مطالب، دوباره سر بزنید."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="bg-neutral-50 py-16 min-h-[400px]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid tablet:grid-cols-2 laptop:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface border border-neutral-200 overflow-hidden"
            >
              <div className="h-48 skeleton-shimmer" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-20 rounded-md skeleton-shimmer" />
                <div className="h-5 w-3/4 rounded-md skeleton-shimmer" />
                <div className="h-4 w-full rounded-md skeleton-shimmer" />
                <div className="h-4 w-2/3 rounded-md skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-full bg-error-50 flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-error-600" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <h3 className="text-h3 text-primary-800 mb-2">خطا در دریافت مطالب</h3>
      <p className="text-body-2 text-neutral-500 max-w-md leading-relaxed mb-6">
        در دریافت مقالات وبلاگ مشکلی پیش آمد. لطفاً دوباره تلاش کنید.
      </p>
      <button
        onClick={onRetry}
        className="rounded-medium bg-primary-700 text-white px-6 py-3 text-button hover:bg-primary-800 transition-colors touch-target"
      >
        تلاش مجدد
      </button>
    </div>
  );
}

// ============================================================
// Blog Hero
// ROW 1: the page's single <h1> + description.
// ROW 2: animated LegalIR artwork (self-contained SMIL, served
//        statically from /public/assets/blog). Rendered as a plain
//        <img> so the SVG's internal motion runs without extra JS.
// ============================================================

function BlogHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-secondary-50/40 to-white">
      {/* ROW 1 — Blog heading + description */}
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center tablet:pt-16">
        <h1 className="text-[clamp(1.75rem,5vw,4rem)] font-bold leading-[1.35] text-primary-800">
          وبلاگ حقوقی لیــــــــــــــگالیـــــر
        </h1>
        <p className="mx-auto mt-4 max-w-[680px] text-body-1 leading-loose text-neutral-500 tablet:mt-5">
          مقالات، راهنماها و تحلیل‌های حقوقی به زبان ساده — دانش حقوقی برای همه
        </p>
      </div>

      {/* ROW 2 — Animated LegalIR artwork.
          The artwork is a wide 1672×720 banner (≈2.32:1). It is capped well
          below the text column so it reads as a framed hero accent rather
          than a full-bleed image that pushes the article list off-screen. */}
      <div className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-8 tablet:pb-16 tablet:pt-10">
        {/* Plain <img>: next/image would rasterize the SVG and strip its
            internal SMIL animation. Served statically, so no optimizer needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/blog/legalir-animated.svg"
          alt="لیگالیر — دستیار هوشمند حقوقی ایران"
          width={1672}
          height={720}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="mx-auto block h-auto w-full select-none rounded-2xl ring-1 ring-black/5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]"
        />
      </div>
    </section>
  );
}

// ============================================================
// Main Blog Listing Page
// ============================================================

export default function BlogPage() {
  const { data, isLoading, error, refetch } = useBlogPosts(1, 50);
  const [activeCategory, setActiveCategory] = useState<string>("همه");
  const [searchQuery, setSearchQuery] = useState("");

  const posts = useMemo(() => data?.items ?? [], [data?.items]);

  // Derive categories from actual content
  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => set.add(p.category));
    return ["همه", ...Array.from(set)];
  }, [posts]);

  // Filter and search posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (activeCategory !== "همه") {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter(
        (p) =>
          p.titleFa.includes(q) ||
          p.excerpt.includes(q) ||
          p.category.includes(q) ||
          p.tags.some((t) => t.includes(q))
      );
    }

    return result;
  }, [posts, activeCategory, searchQuery]);

  const featuredPost = posts.find((p) => p.featured);

  if (isLoading) {
    return (
      <>
        <BlogHero />
        <LoadingState />
      </>
    );
  }

  if (error) {
    return (
      <>
        <BlogHero />
        <ErrorState onRetry={() => refetch()} />
      </>
    );
  }

  return (
    <>
      <BlogHero />

      {/* Featured Post Hero */}
      {featuredPost && activeCategory === "همه" && !searchQuery.trim() && (
        <section className="bg-neutral-50 border-b border-neutral-200">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="rounded-xl overflow-hidden bg-surface border border-neutral-200 shadow-elevation-1 hover:shadow-elevation-4 transition-all duration-medium1">
              <div className="grid tablet:grid-cols-2">
                <div className="relative min-h-[280px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/blog/vajhe-eltezam.jpg"
                    alt={featuredPost.titleFa}
                    width={2048}
                    height={1152}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>

                <div className="p-8 flex flex-col justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-labelSmall bg-secondary-50 text-secondary-700 border border-secondary-200/60 mb-4 w-fit">
                    <IconCategory size={12} />
                    {featuredPost.category}
                    <span className="inline-block w-1 h-1 rounded-full bg-secondary-400 mx-0.5" />
                    مقاله ویژه
                  </span>

                  <Link href={`/blog/${featuredPost.slug}`}>
                    <h2 className="text-h2 text-primary-800 mb-3 hover:text-primary-600 transition-colors leading-snug">
                      {featuredPost.titleFa}
                    </h2>
                  </Link>

                  <p className="text-body-1 text-neutral-500 mb-6 leading-relaxed line-clamp-3">
                    {featuredPost.excerpt}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-caption text-neutral-400 mb-6">
                    <span className="flex items-center gap-1.5">
                      <IconPerson size={14} />
                      {featuredPost.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} />
                      {formatDate(featuredPost.publishedAt)}
                    </span>
                    <span className="tabular-nums">
                      {featuredPost.readingTime} دقیقه مطالعه
                    </span>
                  </div>

                  <Link
                    href={`/blog/${featuredPost.slug}`}
                    className="inline-flex items-center justify-center rounded-medium bg-primary-700 text-white px-6 py-3 text-button hover:bg-primary-800 transition-colors touch-target w-fit shadow-elevation-1 hover:shadow-elevation-3"
                  >
                    مطالعه مقاله
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search & Category Filters */}
      <section className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col tablet:flex-row tablet:items-center gap-4">
            <div className="flex-1 max-w-sm">
              <TextField
                type="search"
                label="جستجو در مقالات"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveCategory("همه");
                }}
                placeholder="جستجو در مقالات..."
                leadingIcon={<IconSearch size={18} />}
                endAdornment={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08]"
                      aria-label="پاک کردن جستجو"
                    >
                      <IconClose size={16} />
                    </button>
                  ) : undefined
                }
                inputSize="small"
                fullWidth
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearchQuery("");
                  }}
                  className={`px-4 py-2 rounded-full text-body-2 transition-all duration-short3 ${
                    activeCategory === cat
                      ? "bg-primary-700 text-white shadow-elevation-1"
                      : "bg-neutral-50 text-neutral-600 border border-neutral-300 hover:border-primary-300 hover:text-primary-700 cursor-pointer"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="bg-neutral-50 py-16 min-h-[400px]">
        <div className="mx-auto max-w-6xl px-4">
          {filteredPosts.length === 0 ? (
            <EmptyState query={searchQuery.trim() || undefined} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-h3 text-primary-800">
                  {activeCategory === "همه"
                    ? "همه مقالات"
                    : `مقالات ${activeCategory}`}
                </h2>
                <span className="text-body-2 text-neutral-400">
                  {filteredPosts.length} مقاله
                </span>
              </div>

              <div className="grid tablet:grid-cols-2 laptop:grid-cols-3 gap-6">
                {filteredPosts.map((post, idx) => (
                  <div
                    key={post.slug}
                    className="animate-scroll-reveal"
                    style={{
                      animationDelay: `${idx * 100}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <BlogCard post={post} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bottom CTA - Newsletter / Subscribe */}
      <section className="bg-white border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-h2 text-primary-800 mb-3">
            مطالب حقوقی را از دست ندهید
          </h2>
          <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
            جدیدترین مقالات، راهنماها و تحلیل‌های حقوقی LEGALIR را مستقیماً در
            ایمیل خود دریافت کنید
          </p>
          <div className="flex flex-col tablet:flex-row items-stretch tablet:items-end justify-center gap-3 max-w-md mx-auto">
            <div className="flex-1 w-full">
              <TextField
                label="ایمیل"
                type="email"
                placeholder="ایمیل خود را وارد کنید"
                inputDir="ltr"
                fullWidth
              />
            </div>
            <button className="w-full tablet:w-auto h-14 rounded-medium bg-primary-700 text-white px-6 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-3 whitespace-nowrap">
              عضویت در خبرنامه
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
