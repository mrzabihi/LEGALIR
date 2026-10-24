// ============================================================
// LEGALIR — Legal Library (کتابخانه حقوقی) — public list
// ============================================================
// A product section of its OWN, distinct from the blog: it reads the real,
// published-only library store (`.data/legal-library.json`), never fixtures
// baked into the page. Drafts and archived sources are filtered out by
// `isPubliclyVisible`, so they can never reach this surface.
//
// A SERVER component: the first page of cards, the topics and the detail links
// are rendered into the HTML, which is what makes an indexable listing actually
// indexable. The filters/search live in the `LibraryBrowser` client island,
// seeded with this server payload.
//
// The route sits in the `(public)` group on purpose — that is what gives it the
// marketing header/footer and `index, follow` (see `robots.ts` / `sitemap.ts`,
// which both include it).
// ============================================================

import { filterLibraryItems, isPubliclyVisible, paginate, readLegalLibrary } from "@/lib/legal-library-db";
import { LIBRARY_PAGE_SIZE } from "./constants";
import { LibraryBrowser, LibraryFooterCta } from "./library-browser";

// The library is a JSON DB read from disk at request time.
export const dynamic = "force-dynamic";

export default function LegalLibraryPage() {
  const { items, topics } = readLegalLibrary();

  // Exactly the query the client island seeds: no search, no filters, newest
  // first. If these two drift, the server HTML and the hydrated grid disagree.
  const { items: page, pagination } = paginate(
    filterLibraryItems(
      items.filter(isPubliclyVisible),
      { sort: "newest" }
    ),
    1,
    LIBRARY_PAGE_SIZE
  );

  return (
    <div className="mx-auto max-w-7xl p-4 tablet:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="mb-2 text-h2 text-on-surface">کتابخانه حقوقی</h1>
        <p className="max-w-2xl text-body-2 text-muted">
          قوانین، مقررات، آرای قضایی، راهنماها و ابزارهای حقوقی — دسترسی سریع به دانش حقوقی
          معتبر با جستجوی هوشمند و دسته‌بندی موضوعی.
        </p>
      </div>

      <LibraryBrowser initialData={{ items: page, pagination }} topics={topics} />

      <LibraryFooterCta />
    </div>
  );
}
