// ============================================================
// LEGALIR — Blog article page
// ============================================================
// A server component, so the article is fully rendered HTML for
// crawlers and the metadata/JSON-LD come from the same real data the
// page shows — no client round-trip, no invented fields.
//
// Two rendering paths, one route:
//   • a slug with a rich legal-article document renders through the
//     typed block system (LegalArticle);
//   • every other slug keeps the legacy markdown body, unchanged.
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readBlog } from "@/lib/legal-library-db";
import { getLegalArticle } from "@/lib/blog/contract-penalty-clause";
import { articleHeadings } from "@/lib/blog/article-types";
import { toPersianDate } from "@/lib/persian-utils";
import {
  IconArrowBack,
  IconArrowForward,
  IconCalendar,
  IconCategory,
  IconLinkSource,
  IconPerson,
  IconServices,
} from "@/lib/icons";
import {
  LegalArticle,
  LegalArticleBackLink,
  LegalArticleHero,
} from "@/components/blog/legal-article";
import { ArticleToc } from "@/components/blog/article-toc";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { ArticleActions } from "@/components/blog/article-actions";

// The blog JSON-DB is read from disk at request time.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(iso: string): string {
  try {
    return toPersianDate(iso, { dateStyle: "long" });
  } catch {
    return iso;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = readBlog().details[slug];
  if (!post) return { title: "مقاله یافت نشد" };

  const title = post.seoTitle ?? post.titleFa;
  const description = post.seoDescription ?? post.excerpt;

  return {
    title,
    description,
    alternates: post.canonicalUrl ? { canonical: post.canonicalUrl } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// ------------------------------------------------------------
// Legacy markdown body (unchanged behaviour for other slugs)
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Shared footer sections (sources, services, prev/next)
// ------------------------------------------------------------

function RelatedSources({
  sources,
}: {
  sources: { id: string; title: string; relationTypeFa?: string; sourceTypeFa?: string }[];
}) {
  if (sources.length === 0) return null;
  return (
    <section className="mb-12">
      <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
        <IconLinkSource size={22} className="text-primary-600" />
        منابع مرتبط
      </h3>
      <div className="grid tablet:grid-cols-2 gap-4">
        {sources.map((source) => (
          <Link
            key={source.id}
            href={`/legal-library/${source.id}`}
            className="flex items-start gap-3 p-4 rounded-large border border-divider bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all group/source"
          >
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-medium bg-primary-50 text-primary-700 text-labelSmall shrink-0 mt-0.5 group-hover/source:bg-primary-100 transition-colors">
              <IconLinkSource size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-body-2 text-primary-800 font-medium mb-0.5 group-hover/source:text-primary-600 transition-colors line-clamp-2">
                {source.title}
              </p>
              <span className="text-caption text-muted">
                {source.relationTypeFa || source.sourceTypeFa}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RelatedServices({
  services,
}: {
  services: { id: string; title: string; description: string; href: string; cta: string }[];
}) {
  if (services.length === 0) return null;
  return (
    <section className="mb-12">
      <h3 className="text-h3 text-primary-800 mb-5 flex items-center gap-2">
        <IconServices size={22} className="text-primary-600" />
        خدمات مرتبط LEGALIR
      </h3>
      <div className="grid tablet:grid-cols-2 gap-4">
        {services.map((service) => (
          <Link
            key={service.id}
            href={service.href}
            className="p-5 rounded-large bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100/50 hover:shadow-elevation-4 transition-all group/service"
          >
            <h4 className="text-titleMedium text-primary-800 mb-2 group-hover/service:text-primary-600 transition-colors">
              {service.title}
            </h4>
            <p className="text-body-2 text-muted mb-4 leading-relaxed">
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
  );
}

function PrevNext({
  previousPost,
  nextPost,
}: {
  previousPost: { slug: string; titleFa: string } | null;
  nextPost: { slug: string; titleFa: string } | null;
}) {
  return (
    <nav className="grid tablet:grid-cols-2 gap-4 pt-6 border-t border-divider">
      {previousPost ? (
        <Link
          href={`/blog/${previousPost.slug}`}
          className="group flex items-start gap-3 p-4 rounded-large border border-divider bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all"
        >
          <span className="text-muted group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
            <IconArrowForward size={20} />
          </span>
          <div className="text-right min-w-0">
            <span className="text-caption text-muted block mb-1">مقاله قبلی</span>
            <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
              {previousPost.titleFa}
            </span>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {nextPost && (
        <Link
          href={`/blog/${nextPost.slug}`}
          className="group flex items-start gap-3 p-4 rounded-large border border-divider bg-surface hover:border-primary-300 hover:bg-primary-50/50 transition-all tablet:text-left"
        >
          <div className="min-w-0">
            <span className="text-caption text-muted block mb-1">مقاله بعدی</span>
            <span className="text-body-2 text-primary-800 font-medium line-clamp-2 group-hover:text-primary-600 transition-colors">
              {nextPost.titleFa}
            </span>
          </div>
          <span className="text-muted group-hover:text-primary-600 transition-colors mt-0.5 shrink-0">
            <IconArrowBack size={20} />
          </span>
        </Link>
      )}
    </nav>
  );
}

function BottomCta() {
  return (
    <section className="bg-neutral-50 border-t border-divider py-16">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-h2 text-primary-800 mb-3">سوال حقوقی دارید؟</h2>
        <p className="text-body-1 text-muted mb-8 max-w-lg mx-auto leading-relaxed">
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
  );
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = readBlog().details[slug];
  if (!post) notFound();

  const richDoc = getLegalArticle(slug);
  const publishedAt = formatDate(post.publishedAt);

  // ---- Rich legal-article path ----
  if (richDoc) {
    const headings = articleHeadings(richDoc);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.titleFa,
      description: post.excerpt,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      inLanguage: "fa-IR",
      author: { "@type": "Organization", name: post.author },
      publisher: { "@type": "Organization", name: "LEGALIR" },
      articleSection: post.category,
      keywords: post.tags.join(", "),
    };

    return (
      <>
        <script
          type="application/ld+json"
          // Real data only — every field comes from the post record.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <ReadingProgress />

        {/* The public layout already provides the <main> landmark; this
            page only marks its own content as the skip-link target. */}
        <article id="main-content">
          <LegalArticleHero
              hero={richDoc.hero}
              title={post.titleFa}
              category={post.category}
              author={post.author}
              publishedAt={publishedAt}
              readingTime={post.readingTime}
            />

            <div className="bg-surface py-10 tablet:py-14">
              {/* The container is wide enough that the article column keeps
                  its visual width (1000–1200px) even with the TOC rail
                  beside it. The rail only appears at `wide`, where there is
                  room for both. */}
              <div className="mx-auto max-w-[1440px] px-4">
                <div className="flex gap-10">
                  {/* Reading column */}
                  <div className="flex-1 min-w-0">
                    {/* Mobile TOC — a disclosure above the article. */}
                    <div className="wide:hidden mb-8">
                      <ArticleToc headings={headings} variant="disclosure" />
                    </div>

                    <LegalArticle doc={richDoc} />

                    <div className="mx-auto max-w-[780px] px-4">
                      <hr className="my-12 border-divider" />

                      <RelatedSources sources={post.relatedSources} />
                      <RelatedServices services={post.relatedServices} />

                      <div className="flex flex-wrap items-center gap-3 mb-12 pt-6 border-t border-divider">
                        <ArticleActions title={post.titleFa} slug={post.slug} />
                      </div>

                      <PrevNext
                        previousPost={post.previousPost}
                        nextPost={post.nextPost}
                      />

                      <div className="mt-8">
                        <LegalArticleBackLink />
                      </div>
                    </div>
                  </div>

                  {/* Desktop TOC rail — only where the article column can
                      keep its full visual width beside it. */}
                  <aside className="hidden wide:block w-64 shrink-0">
                    <div className="sticky top-24">
                      <ArticleToc headings={headings} variant="rail" />
                    </div>
                  </aside>
                </div>
              </div>
            </div>
        </article>

        <BottomCta />
      </>
    );
  }

  // ---- Legacy markdown path (unchanged) ----
  return (
    <>
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
              {publishedAt}
            </span>
            <span className="text-primary-200/40 hidden tablet:inline">|</span>
            <span className="tabular-nums">{post.readingTime} دقیقه مطالعه</span>
          </div>
        </div>
      </header>

      <div id="main-content" className="bg-surface py-12">
        <div className="mx-auto max-w-4xl px-4">
          <MarkdownBody body={post.body} />

          <hr className="my-12 border-divider" />

          <RelatedSources sources={post.relatedSources} />
          <RelatedServices services={post.relatedServices} />

          <div className="flex flex-wrap items-center gap-3 mb-12 pt-6 border-t border-divider">
            <ArticleActions title={post.titleFa} slug={post.slug} />
          </div>

          <PrevNext previousPost={post.previousPost} nextPost={post.nextPost} />
        </div>
      </div>

      <BottomCta />
    </>
  );
}
