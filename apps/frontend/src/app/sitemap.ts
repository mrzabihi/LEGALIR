import type { MetadataRoute } from "next";
import { readBlog, isBlogPostPubliclyVisible } from "@/lib/legal-library-db";
import { absoluteUrl } from "@/lib/site";

// ============================================================
// LEGALIR — sitemap.xml (Next.js metadata route)
// ============================================================
// Lists ONLY publicly indexable content: the marketing pages and the published
// blog articles. Every authenticated surface (dashboard, subscription, app
// features) and the admin panel are deliberately EXCLUDED — they are noindexed
// in metadata and disallowed in robots.ts.
//
// Read at request time (force-dynamic) so newly published articles appear
// without a rebuild and the file-backed DB is not touched during `next build`.
// ============================================================

export const dynamic = "force-dynamic";

/** Static public pages, relative to the site origin. Order = priority order. */
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Published blog articles only — a draft/archived post is excluded so a
  // search engine never indexes an unpublished article.
  let postEntries: MetadataRoute.Sitemap = [];
  try {
    const { items, details } = readBlog();
    const posts = Object.values(details).filter((post) =>
      isBlogPostPubliclyVisible(items.find((i) => i.slug === post.slug), post)
    );
    postEntries = posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updatedAt ? new Date(post.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    // A read failure must never break the sitemap; the static pages still ship.
    postEntries = [];
  }

  return [...staticEntries, ...postEntries];
}
