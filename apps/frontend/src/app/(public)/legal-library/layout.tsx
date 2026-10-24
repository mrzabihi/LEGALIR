// ============================================================
// LEGALIR — Legal library segment layout (server component)
// ============================================================
// The library LISTING page is a client component (it owns the search/filter
// state), so it cannot export metadata and would otherwise inherit the root
// title/description — a duplicate-title defect on an indexable page. This thin
// server layout supplies the metadata, exactly like `(public)/blog/layout.tsx`.
//
// Source detail pages (`[slug]/page.tsx`, also a client component) are covered
// by `[slug]/layout.tsx`, which derives its metadata from the same store the
// API serves.
// ============================================================

import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/social-card";

const TITLE = "کتابخانه حقوقی | قوانین، آرای قضایی و راهنماهای معتبر";
const DESCRIPTION =
  "کتابخانه حقوقی لیگالیر: متن قوانین و مقررات، آرای وحدت رویه و آرای قضایی، راهنماها، چک‌لیست‌ها و ابزارهای حقوقی — با جستجوی هوشمند و دسته‌بندی موضوعی.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/legal-library" },
  // Declared in full because a child route's `openGraph` REPLACES the root
  // object wholesale — omitting `images` here would drop the share card.
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/legal-library",
    images: [OG_IMAGE],
  },
  // Twitter metadata is replaced wholesale per segment (not deep-merged), so
  // omitting this block would leave the card advertising the root site title.
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function LegalLibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
