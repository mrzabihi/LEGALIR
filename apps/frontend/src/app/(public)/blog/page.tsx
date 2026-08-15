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

// ============================================================
// Mock Blog Post Data
// ============================================================

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorTitle: string;
  readingTime: number; // minutes
  publishedDate: string; // Jalali date string
  imageColor: string; // placeholder gradient color
  featured?: boolean;
}

const categories = [
  "همه",
  "قراردادها",
  "املاک و مستغلات",
  "خانواده",
  "تجارت",
  "حقوق کار",
] as const;

const blogPosts: BlogPost[] = [
  {
    slug: "vajh-eltizam-contracts",
    title: "وجه التزام در قراردادها: راهنمای جامع حقوقی",
    excerpt:
      "وجه التزام یکی از مهم‌ترین شروط قراردادی است که طرفین برای تضمین اجرای تعهدات درج می‌کنند. در این مقاله نحوه تعیین، مطالبه و تعدیل وجه التزام بر اساس قوانین ایران و رویه قضایی را بررسی می‌کنیم.",
    category: "قراردادها",
    author: "دکتر مریم حسینی",
    authorTitle: "وکیل پایه یک دادگستری",
    readingTime: 12,
    publishedDate: "۱۵ مرداد ۱۴۰۵",
    imageColor: "from-primary-700 to-primary-900",
    featured: true,
  },
  {
    slug: "malk-mustajir-legal-guide",
    title: "راهنمای حقوقی مالک و مستأجر: آنچه باید بدانید",
    excerpt:
      "رابطه مالک و مستأجر از رایج‌ترین و پرچالش‌ترین موضوعات حقوقی در ایران است. در این راهنما، حقوق و تکالیف قانونی طرفین، شرایط فسخ و تخلیه، سرقفلی و حق کسب و پیشه را به زبان ساده توضیح می‌دهیم.",
    category: "املاک و مستغلات",
    author: "علی رضایی",
    authorTitle: "مشاور حقوقی املاک",
    readingTime: 15,
    publishedDate: "۱۰ مرداد ۱۴۰۵",
    imageColor: "from-secondary-600 to-secondary-800",
  },
  {
    slug: "ai-legal-analysis-future",
    title: "هوش مصنوعی و آینده تحلیل حقوقی در ایران",
    excerpt:
      "فناوری هوش مصنوعی به سرعت در حال تغییر شیوه ارائه خدمات حقوقی در جهان است. در این مقاله نقش AI در تحلیل اسناد حقوقی، پیش‌بینی آرای قضایی و دسترسی‌پذیر کردن دانش حقوقی را از منظر نظام حقوقی ایران بررسی می‌کنیم.",
    category: "تجارت",
    author: "سارا محمدی",
    authorTitle: "پژوهشگر حقوق و فناوری",
    readingTime: 8,
    publishedDate: "۵ مرداد ۱۴۰۵",
    imageColor: "from-primary-600 to-secondary-700",
  },
  {
    slug: "divorce-legal-process-guide",
    title: "روند قانونی طلاق توافقی: مراحل، مدارک و نکات مهم",
    excerpt:
      "طلاق توافقی سریع‌ترین و کمدردسرترین روش انحلال نکاح در حقوق ایران است. در این مقاله گام‌به‌گام مراحل طلاق توافقی، مدارک مورد نیاز، حقوق مالی زوجه و حضانت فرزندان را شرح می‌دهیم.",
    category: "خانواده",
    author: "دکتر مریم حسینی",
    authorTitle: "وکیل پایه یک دادگستری",
    readingTime: 10,
    publishedDate: "۱ مرداد ۱۴۰۵",
    imageColor: "from-primary-800 to-neutral-900",
  },
];

// ============================================================
// Sub-components
// ============================================================

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <article className="group rounded-xl bg-surface border border-neutral-200 shadow-sm hover:shadow-elevation-4 transition-all duration-medium1 overflow-hidden flex flex-col">
      {/* Cover image placeholder with gradient */}
      <Link href={`/blog/${post.slug}`} className="block">
        <div
          className={`h-48 bg-gradient-to-br ${post.imageColor} flex items-center justify-center relative overflow-hidden`}
        >
          {/* Abstract decorative shapes */}
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
      </Link>

      {/* Card content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Category badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-labelSmall bg-primary-50 text-primary-700 border border-primary-200/60">
            <IconCategory size={12} />
            {post.category}
          </span>
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`} className="group/link">
          <h3 className="text-h4 text-primary-800 mb-2 group-hover/link:text-primary-600 transition-colors line-clamp-2 leading-snug">
            {post.title}
          </h3>
        </Link>

        {/* Excerpt */}
        <p className="text-body-2 text-neutral-500 mb-4 flex-1 line-clamp-3 leading-relaxed">
          {post.excerpt}
        </p>

        {/* Meta: author, date, reading time */}
        <div className="flex items-center gap-4 text-caption text-neutral-400 pt-3 border-t border-divider">
          <span className="flex items-center gap-1.5">
            <IconPerson size={14} />
            {post.author}
          </span>
          <span className="flex items-center gap-1.5">
            <IconCalendar size={14} />
            {post.publishedDate}
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

// ============================================================
// Main Blog Listing Page
// ============================================================

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string>("همه");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and search posts
  const filteredPosts = useMemo(() => {
    let result = [...blogPosts];

    if (activeCategory !== "همه") {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter(
        (p) =>
          p.title.includes(q) ||
          p.excerpt.includes(q) ||
          p.category.includes(q)
      );
    }

    return result;
  }, [activeCategory, searchQuery]);

  const featuredPost = blogPosts.find((p) => p.featured);
  const isEmpty = filteredPosts.length === 0;

  return (
    <>
      {/* ========================================================
          Page Header - Gradient
          ======================================================== */}
      <section className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-16 tablet:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-h1 text-white mb-4">وبلاگ حقوقی LEGALIR</h1>
          <p className="text-body-1 text-primary-100/80 max-w-xl mx-auto leading-relaxed">
            مقالات، راهنماها و تحلیل‌های حقوقی به زبان ساده — دانش حقوقی برای همه
          </p>
        </div>
      </section>

      {/* ========================================================
          Featured Post Hero
          ======================================================== */}
      {featuredPost && activeCategory === "همه" && !searchQuery.trim() && (
        <section className="bg-neutral-50 border-b border-neutral-200">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="rounded-xl overflow-hidden bg-surface border border-neutral-200 shadow-elevation-1 hover:shadow-elevation-4 transition-all duration-medium1">
              <div className="grid tablet:grid-cols-2">
                {/* Featured image placeholder */}
                <div
                  className={`bg-gradient-to-br ${featuredPost.imageColor} flex items-center justify-center min-h-[280px] relative overflow-hidden`}
                >
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-8 right-8 w-32 h-32 rounded-full border-2 border-white" />
                    <div className="absolute bottom-4 left-10 w-20 h-20 rounded-full border border-white" />
                    <div className="absolute top-20 left-12 w-40 h-40 rounded-full border border-white/60" />
                    <div className="absolute -bottom-4 right-20 w-28 h-28 rounded-full border-2 border-white/50" />
                  </div>
                  <div className="relative z-10 text-center px-4">
                    <span className="text-white/80 text-labelLarge block mb-1">
                      LEGALIR Blog
                    </span>
                    <span className="text-white/50 text-bodyMedium">
                      مقاله ویژه
                    </span>
                  </div>
                </div>

                {/* Featured content */}
                <div className="p-8 flex flex-col justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-labelSmall bg-secondary-50 text-secondary-700 border border-secondary-200/60 mb-4 w-fit">
                    <IconCategory size={12} />
                    {featuredPost.category}
                    <span className="inline-block w-1 h-1 rounded-full bg-secondary-400 mx-0.5" />
                    مقاله ویژه
                  </span>

                  <Link href={`/blog/${featuredPost.slug}`}>
                    <h2 className="text-h2 text-primary-800 mb-3 hover:text-primary-600 transition-colors leading-snug">
                      {featuredPost.title}
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
                      {featuredPost.publishedDate}
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

      {/* ========================================================
          Search & Category Filters
          ======================================================== */}
      <section className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col tablet:flex-row tablet:items-center gap-4">
            {/* Search bar */}
            <div className="relative flex-1 max-w-sm">
              <IconSearch
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveCategory("همه");
                }}
                placeholder="جستجو در مقالات..."
                className="w-full pr-10 pl-10 py-2.5 rounded-large border border-neutral-300 bg-surface text-body-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  aria-label="پاک کردن جستجو"
                >
                  <IconClose size={16} />
                </button>
              )}
            </div>

            {/* Category chips */}
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

      {/* ========================================================
          Blog Posts Grid
          ======================================================== */}
      <section className="bg-neutral-50 py-16 min-h-[400px]">
        <div className="mx-auto max-w-6xl px-4">
          {isEmpty ? (
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

      {/* ========================================================
          Bottom CTA - Newsletter / Subscribe
          ======================================================== */}
      <section className="bg-white border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-h2 text-primary-800 mb-3">
            مطالب حقوقی را از دست ندهید
          </h2>
          <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
            جدیدترین مقالات، راهنماها و تحلیل‌های حقوقی LEGALIR را مستقیماً در
            ایمیل خود دریافت کنید
          </p>
          <div className="flex flex-col tablet:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="ایمیل خود را وارد کنید"
              className="flex-1 w-full px-4 py-3 rounded-large border border-neutral-300 bg-surface text-body-2 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all text-left dir-ltr"
              dir="ltr"
            />
            <button className="w-full tablet:w-auto rounded-medium bg-primary-700 text-white px-6 py-3 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-3 whitespace-nowrap">
              عضویت در خبرنامه
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
