// ============================================================
// LEGALIR — LegalArticleHero
// ============================================================
// The article's opening surface. It carries the identity (eyebrow,
// title, subtitle) and the three framing facts the source deck
// presents as cards — موضوع اصلی / مرجع صادرکننده / اهمیت رأی.
//
// The hero is a full-bleed band; the text column inside it stays at
// the article's reading width so the title never runs edge to edge.
// ============================================================

import React from "react";
import Link from "next/link";
import { IconArrowBack, IconCalendar, IconPerson, IconCategory } from "@/lib/icons";
import type { ArticleHero } from "@/lib/blog/article-types";

interface LegalArticleHeroProps {
  hero: ArticleHero;
  /** The post's own title — the single H1 of the page. */
  title: string;
  /** The article's category, e.g. «قراردادها». */
  category: string;
  author: string;
  /** Already formatted for display. */
  publishedAt: string;
  readingTime: number;
}

export function LegalArticleHero({
  hero,
  title,
  category,
  author,
  publishedAt,
  readingTime,
}: LegalArticleHeroProps) {
  return (
    <header className="article-hero relative overflow-hidden bg-gradient-to-b from-primary-800 to-primary-900 text-white">
      {/* A restrained editorial motif — concentric rules, no imagery. */}
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]">
        <div className="absolute -top-16 start-1/4 h-72 w-72 rounded-full border-2 border-white" />
        <div className="absolute top-24 -start-10 h-56 w-56 rounded-full border border-white" />
        <div className="absolute -bottom-20 end-1/4 h-64 w-64 rounded-full border border-white/70" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 tablet:py-16">
        {/* Breadcrumb */}
        <nav
          aria-label="مسیر صفحه"
          className="flex items-center gap-2 text-caption text-primary-200/70 mb-6"
        >
          <Link href="/blog" className="hover:text-white transition-colors">
            وبلاگ
          </Link>
          <span aria-hidden="true" className="text-primary-300/50">/</span>
          <span className="text-primary-100/80">{category}</span>
        </nav>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-labelSmall bg-white/15 text-white/90 border border-white/20 mb-4">
          <IconCategory size={12} />
          {hero.eyebrow}
        </span>

        <h1 className="text-h1 text-white leading-snug mb-3">{title}</h1>

        <p className="text-h4 text-primary-100/90 leading-relaxed max-w-2xl">
          {hero.lead}
        </p>

        <p className="text-body-2 text-primary-100/70 leading-relaxed max-w-2xl mt-2">
          {hero.subtitle}
        </p>

        {/* Byline */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-2 text-primary-100/70 mt-6">
          <span className="flex items-center gap-1.5">
            <IconPerson size={16} />
            {author}
          </span>
          <span aria-hidden="true" className="text-primary-200/40 hidden tablet:inline">|</span>
          <span className="flex items-center gap-1.5">
            <IconCalendar size={16} />
            {publishedAt}
          </span>
          <span aria-hidden="true" className="text-primary-200/40 hidden tablet:inline">|</span>
          <span className="tabular-nums">{readingTime} دقیقه مطالعه</span>
        </div>
      </div>

      {/* The three framing facts — the source deck's opening cards. */}
      <div className="relative mx-auto max-w-4xl px-4 pb-12 tablet:pb-16">
        <dl className="grid gap-3 tablet:grid-cols-3">
          {hero.meta.map((item) => (
            <div
              key={item.label}
              className="rounded-large border border-white/15 bg-white/10 p-4 backdrop-blur-[2px]"
            >
              <dt className="text-caption text-primary-100/70 mb-1.5">
                {item.label}
              </dt>
              <dd className="text-body-2 text-white leading-relaxed">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

/** The back-to-blog affordance shown under the article. */
export function LegalArticleBackLink() {
  return (
    <Link
      href="/blog"
      className="inline-flex items-center gap-2 text-body-2 text-muted hover:text-primary-700 transition-colors"
    >
      <IconArrowBack size={16} rtlFlip />
      همه مقالات
    </Link>
  );
}
