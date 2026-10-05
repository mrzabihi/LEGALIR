// ============================================================
// LEGALIR — Category shortcuts
// ============================================================
// The quick category access row directly under the search field.
//
// These are *anchors*, not filters: each one scrolls to the matching
// catalog section further down the page. That keeps the complete
// catalog visible at all times (nothing is ever filtered away) and
// means the shortcuts work identically on mobile and desktop.
//
// Layout: a 2-column grid on the narrowest phones, growing to a single
// row of six on desktop. A grid — not a horizontal scroller — so no
// label is ever clipped and nothing requires a sideways swipe.
// ============================================================

"use client";

import { trackServicesEvent, type ServiceCategory } from "@/lib/services/catalog";

interface CategoryShortcutsProps {
  categories: ServiceCategory[];
  /** Item count per category, rendered as a small badge. */
  counts: Record<string, number>;
}

export function CategoryShortcuts({ categories, counts }: CategoryShortcutsProps) {
  return (
    <nav aria-label="دسترسی سریع به دسته‌بندی خدمات">
      <ul className="grid grid-cols-2 gap-2.5 mobile-l:grid-cols-3 tablet:grid-cols-3 laptop:grid-cols-6">
        {categories.map((category) => {
          const Icon = category.icon;
          const count = counts[category.id] ?? 0;
          // Categories with an explicit `href` navigate to that route;
          // the rest scroll to their catalog section via the anchor.
          const href = category.href ?? `#${category.anchor}`;

          return (
            <li key={category.id}>
              <a
                href={href}
                onClick={() =>
                  trackServicesEvent("services_category_selected", {
                    categoryId: category.id,
                  })
                }
                className="group flex h-full flex-col items-start gap-2 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 items-center justify-center rounded-medium bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.05]`}
                >
                  <Icon size={18} />
                </span>
                <span className="text-caption font-semibold leading-snug text-on-surface">
                  {category.title}
                </span>
                <span className="text-labelSmall text-muted">
                  {count.toLocaleString("fa-IR")} خدمت
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
