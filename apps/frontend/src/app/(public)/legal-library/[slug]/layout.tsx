// ============================================================
// LEGALIR — Legal source detail layout (server component)
// ============================================================
// This file owns the route's metadata AND its not-found decision.
//
// Why the layout and not the page: `page.tsx` is a server component that needs
// `cookies()` (for the bookmark flag), so the response streams. When metadata
// resolves successfully, Next flushes the <head> before the page body runs — by
// which point a `notFound()` from the page can no longer change the status, and
// the unknown-source URL answers **200**. Measured, not assumed: the first
// version of this route did exactly that. Calling `notFound()` from
// `generateMetadata` aborts the render before anything is flushed, so an
// unknown/draft/archived id gets a real 404 instead of a soft one.
//
// `force-dynamic` because the library is a JSON DB read at request time: the
// metadata must reflect a source published a minute ago, and `next build` must
// not touch the file DB.
// ============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublishedSource } from "@/lib/legal-library-db";
import { OG_IMAGE } from "@/lib/social-card";

export const dynamic = "force-dynamic";

interface LayoutProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;

  // Same resolution rule as the API handler and the page body. A draft or
  // archived source must not be indexable — and must not answer 200.
  const hit = readPublishedSource(slug);
  if (!hit) notFound();

  const { item } = hit;

  // Admin-authored SEO overrides win when present; the real title/summary is
  // the honest fallback.
  const title = item.seoTitle?.trim() || item.title;
  const description = item.seoDescription?.trim() || item.summary;
  const canonical = `/legal-library/${encodeURIComponent(item.id)}`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      ...(description ? { description } : {}),
      url: canonical,
      images: [OG_IMAGE],
    },
    // Twitter metadata is replaced wholesale per segment, so without this block
    // the card would carry the root layout's site-wide title while `og:title`
    // carries the source's own — a mismatch nothing else in the suite sees.
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
      images: [OG_IMAGE.url],
    },
  };
}

export default function LegalSourceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
