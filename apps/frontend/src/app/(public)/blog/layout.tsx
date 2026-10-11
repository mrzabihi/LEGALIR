// ============================================================
// LEGALIR — Blog segment layout (server component)
// ============================================================
// The blog LISTING page (blog/page.tsx) is a client component, so it cannot
// export metadata and would otherwise inherit the root title/description —
// producing a duplicate-title defect on an indexable page. This thin server
// layout supplies unique metadata for the /blog listing.
//
// Article pages (blog/[slug]/page.tsx) use `generateMetadata`, which OVERRIDES
// every field below — including `alternates.canonical` — so each article keeps
// its own title, description and canonical (see that file).
// ============================================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "وبلاگ حقوقی",
  description:
    "مقالات، راهنماها و تحلیل‌های حقوقی به زبان ساده — قراردادها، املاک، خانواده، چک و تجارت، همراه با ارجاع به منابع قانونی معتبر.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "وبلاگ حقوقی لیگالیر",
    description:
      "مقالات، راهنماها و تحلیل‌های حقوقی به زبان ساده، همراه با ارجاع به منابع قانونی معتبر.",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
