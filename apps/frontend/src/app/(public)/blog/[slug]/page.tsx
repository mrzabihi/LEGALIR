"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  IconCalendar,
  IconPerson,
  IconCategory,
  IconArrowBack,
  IconArrowForward,
  IconLinkSource,
  IconServices,
  IconStar,
  IconCheck,
} from "@/lib/icons";
import { useBlogPost } from "@/hooks/useDashboard";
import { toPersianDate } from "@/lib/persian-utils";
import type { V1BlogPostDetail } from "@legalir/types";

// ============================================================
// Deterministic cover gradients
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

function formatDate(iso: string): string {
  try {
    return toPersianDate(iso, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

// ============================================================
// Minimal safe markdown renderer (headings + paragraphs + bold)
// ============================================================

interface MdBlock {
  type: "heading" | "paragraph";
  text: string;
}

function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("## ") || line.startsWith("# ")) {
      blocks.push({ type: "heading", text: line.replace(/^#+\s*/, "").trim() });
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "paragraph") {
        last.text += ` ${line}`;
      } else {
        blocks.push({ type: "paragraph", text: line });
      }
    }
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-on-surface">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownBody({ body }: { body: string }) {
  const blocks = parseMarkdown(body);
  return (
    <div className="space-y-6">
      {blocks.map((block, i) =>
        block.type === "heading" ? (
          <h2
            key={i}
            className="text-h3 text-primary-800 mb-2 pb-2 border-b border-divider"
          >
            {block.text}
          </h2>
        ) : (
          <p key={i} className="text-body-1 text-neutral-700 leading-loose text-justify">
            {renderInline(block.text)}
          </p>
        )
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function TableOfContents({ post }: { post: V1BlogPostDetail }) {
  const [collapsed, setCollapsed] = useState(false);
  const headings = parseMarkdown(post.body).filter((b) => b.type === "heading");

  if (headings.length === 0) return null;

  return (
    <nav className="rounded-xl bg-neutral-50 border border-neutral-200 p-5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-titleMedium text-primary-800">فهرست مطالب</h4>
        <span className="text-caption text-neutral-400">
          {collapsed ? "نمایش" : "پنهان"}
        </span>
      </button>

      {!collapsed && (
        <ul className="mt-4 space-y-2 animate-slide-up-fade">
          {headings.map((h, i) => (
            <li key={i}>
              <span className="block text-body-2 text-neutral-600 py-1 border-r-2 border-transparent pr-3 leading-relaxed">
                {h.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/blog/${slug}`;
    const shareData = { title, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [title, slug]);

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-body-2 text-neutral-600 bg-neutral-50 border border-neutral-300 hover:border-primary-300 hover:text-primary-700 transition-all"
      aria-label="اشتراک‌گذاری"
    >
      {copied ? (
        <>
          <IconCheck size={16} className="text-success" />
          <span className="text-success text-caption">کپی شد</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden="true">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
          اشتراک‌گذاری
        </>
      )}
    </button>
  );
}

function BookmarkButton() {
  const [bookmarked, setBookmarked] = useState(false);
  return (
    <button
      onClick={() => setBookmarked(!bookmarked)}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-body-2 border transition-all ${
        bookmarked
          ? "bg-secondary-50 text-secondary-700 border-secondary-300"
          : "bg-neutral-50 text-neutral-600 border-neutral-300 hover:border-primary-300 hover:text-primary-700"
      }`}
      aria-label={bookmarked ? "حذف از نشان‌ها" : "ذخیره در نشان‌ها"}
    >
      <IconStar size={16} className={bookmarked ? "text-secondary-600" : ""} />
      {bookmarked ? "ذخیره شد" : "ذخیره"}
    </button>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center min-h-[60vh]">
      <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h2 className="text-h2 text-primary-800 mb-3">مقاله مورد نظر یافت نشد</h2>
      <p className="text-body-1 text-neutral-500 mb-8 max-w-md leading-relaxed">
        مقاله‌ای با این آدرس وجود ندارد. ممکن است حذف شده باشد یا آدرس را اشتباه وارد کرده باشید.
      </p>
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 rounded-medium bg-primary-700 text-white px-6 py-3 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1"
      >
        <IconArrowBack size={18} rtlFlip />
        بازگشت به وبلاگ
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
      <div className="h-10 w-2/3 rounded-md skeleton-shimmer" />
      <div className="h-4 w-full rounded-md skeleton-shimmer" />
      <div className="h-4 w-5/6 rounded-md skeleton-shimmer" />
      <div className="h-4 w-full rounded-md skeleton-shimmer" />
      <div className="h-4 w-2/3 rounded-md skeleton-shimmer" />
      <div className="h-40 w-full rounded-xl skeleton-shimmer mt-8" />
    </div>
  );
}

function DetailHeaderSkeleton() {
  return (
    <header className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-12 tablet:py-16">
      <div className="mx-auto max-w-4xl px-4 space-y-4">
        <div className="h-4 w-32 rounded-md bg-white/20 skeleton-shimmer" />
        <div className="h-6 w-40 rounded-full bg-white/20 skeleton-shimmer" />
        <div className="h-10 w-3/4 rounded-md bg-white/20 skeleton-shimmer" />
        <div className="h-4 w-64 rounded-md bg-white/20 skeleton-shimmer" />
      </div>
    </header>
  );
}

// ============================================================
// Main Article Detail Page
// ============================================================

export default function BlogArticlePage() {
  const params = useParams();
  const slug = params?.["slug"] as string;
  const { data: post, isLoading, error } = useBlogPost(slug);

  if (isLoading) {
    return (
      <>
        <DetailHeaderSkeleton />
        <LoadingState />
      </>
    );
  }

  if (error || !post) {
    return <NotFoundState />;
  }

  const imageColor = gradientFor(post.category);

  return (
    <>
      {/* Article Header */}
      <header className="bg-gradient-to-b from-primary-800 to-primary-900 text-white py-12 tablet:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-2 text-caption text-primary-200/70 mb-6">
            <Link href="/blog" className="hover:text-white transition-colors">
              وبلاگ
            </Link>
            <span className="text-primary-300/50">/</span>
            <span className="text-primary-100/80">{post.category}</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-labelSmall bg-white/15 text-white/90 border border-white/20 mb-4">
            <IconCategory size={12} />
            {post.category}
          </span>

          <h1 className="text-h1 text-white mb-4 leading-snug">{post.titleFa}</h1>

          <div className="flex flex-wrap items-center gap-4 text-body-2 text-primary-100/70">
            <span className="flex items-center gap-1.5">
              <IconPerson size={16} />
              {post.author}
            </span>
            <span className="text-primary-200/40 hidden tablet:inline">|</span>
            <span className="flex items-center gap-1.5">
              <IconCalendar size={16} />
              {formatDate(post.publishedAt)}
            </span>
            <span className="text-primary-200/40 hidden tablet:inline">|</span>
            <span className="tabular-nums">{post.readingTime} دقیقه مطالعه</span>
          </div>
        </div>
      </header>

      {/* Cover Image Placeholder */}
      <section className="bg-neutral-100 border-b border-neutral-200">
        <div className="mx-auto max-w-4xl">
          <div className={`bg-gradient-to-br ${imageColor} h-48 tablet:h-64 flex items-center justify-center relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-6 right-8 w-28 h-28 rounded-full border-2 border-white" />
              <div className="absolute bottom-3 left-10 w-20 h-20 rounded-full border border-white" />
              <div className="absolute top-14 left-14 w-36 h-36 rounded-full border border-white/60" />
              <div className="absolute -bottom-3 right-24 w-24 h-24 rounded-full border-2 border-white/50" />
            </div>
            <div className="relative z-10 text-center">
              <span className="text-white/80 text-body-1 block mb-1">LEGALIR Blog</span>
              <span className="text-white/40 text-caption">{post.category}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content with Sidebar */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-10">
            {/* Main content */}
            <div className="flex-1 min-w-0 max-w-[720px] mx-auto">
              <MarkdownBody body={post.body} />

              <hr className="my-12 border-divider" />

              {/* Related Sources */}
              {post.relatedSources.length > 0 && (
                <section className="mb-12">
                  <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
                    <IconLinkSource size={22} className="text-primary-600" />
                    منابع مرتبط
                  </h3>
                  <div className="grid tablet:grid-cols-2 gap-4">
                    {post.relatedSources.map((source) => (
                      <Link
                        key={source.id}
                        href={`/legal-library/${source.id}`}
                        className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all group/source"
                      >
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary-50 text-primary-700 text-labelSmall shrink-0 mt-0.5 group-hover/source:bg-primary-100 transition-colors">
                          <IconLinkSource size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-body-2 text-primary-800 font-medium mb-0.5 group-hover/source:text-primary-600 transition-colors line-clamp-2">
                            {source.title}
                          </p>
                          <span className="text-caption text-neutral-400">
                            {source.relationTypeFa || source.sourceTypeFa}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Related Services */}
              {post.relatedServices.length > 0 && (
                <section className="mb-12">
                  <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
                    <IconServices size={22} className="text-primary-600" />
                    خدمات مرتبط LEGALIR
                  </h3>
                  <div className="grid tablet:grid-cols-2 gap-4">
                    {post.relatedServices.map((service) => (
                      <Link
                        key={service.id}
                        href={service.href}
                        className="p-5 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100/50 hover:shadow-elevation-4 transition-all group/service"
                      >
                        <h4 className="text-titleMedium text-primary-800 mb-2 group-hover/service:text-primary-600 transition-colors">
                          {service.title}
                        </h4>
                        <p className="text-body-2 text-neutral-500 mb-4 leading-relaxed">
                          {service.description}
                        </p>
                        <span className="inline-flex items-center gap-1 text-button text-primary-700 group-hover/service:gap-2 transition-all">
                          {service.cta}
                          <IconArrowBack size={14} rtlFlip />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Share + Bookmark Row */}
              <div className="flex flex-wrap items-center gap-3 mb-12 pt-6 border-t border-divider">
                <ShareButton title={post.titleFa} slug={post.slug} />
                <BookmarkButton />
              </div>

              {/* Previous / Next */}
              <nav className="grid tablet:grid-cols-2 gap-4 pt-6 border-t border-divider">
                {post.previousPost ? (
                  <Link
                    href={`/blog/${post.previousPost.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all"
                  >
                    <span className="text-neutral-400 group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
                      <IconArrowForward size={20} />
                    </span>
                    <div className="text-right min-w-0">
                      <span className="text-caption text-neutral-400 block mb-1">مقاله قبلی</span>
                      <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {post.previousPost.titleFa}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {post.nextPost && (
                  <Link
                    href={`/blog/${post.nextPost.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all tablet:text-left"
                  >
                    <div className="min-w-0">
                      <span className="text-caption text-neutral-400 block mb-1">مقاله بعدی</span>
                      <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {post.nextPost.titleFa}
                      </span>
                    </div>
                    <span className="text-neutral-400 group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
                      <IconArrowBack size={20} />
                    </span>
                  </Link>
                )}
              </nav>
            </div>

            {/* Sidebar */}
            <aside className="hidden laptop:block w-64 shrink-0">
              <div className="sticky top-24">
                <TableOfContents post={post} />
                <div className="mt-6">
                  <Link
                    href="/blog"
                    className="flex items-center gap-2 text-body-2 text-neutral-500 hover:text-primary-700 transition-colors"
                  >
                    <IconArrowBack size={16} rtlFlip />
                    همه مقالات
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-neutral-50 border-t border-neutral-200 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-h2 text-primary-800 mb-3">سوال حقوقی دارید؟</h2>
          <p className="text-body-1 text-neutral-500 mb-8 max-w-lg mx-auto leading-relaxed">
            از هوش مصنوعی LEGALIR بپرسید و تحلیل حقوقی با استناد به قوانین معتبر دریافت کنید.
          </p>
          <Link
            href="/auth/mobile?intent=chat"
            className="inline-block rounded-medium bg-primary-700 text-white px-10 py-4 text-button hover:bg-primary-800 transition-colors touch-target shadow-elevation-1 hover:shadow-elevation-4"
          >
            شروع پرسش و پاسخ حقوقی
          </Link>
        </div>
      </section>
    </>
  );
}
