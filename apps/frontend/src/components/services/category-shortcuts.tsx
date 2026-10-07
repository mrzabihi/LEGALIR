// ============================================================
// LEGALIR — Category shortcuts
// ============================================================
// The quick-access row directly under the page intro. Each card is a
// real navigation link into the surface that owns that area of the
// product — contracts → /contracts, lawyers → /lawyers, documents →
// /documents, cases → /cases, library → /blog, plus the personal
// «مشاوره‌های من» → /consultations entry point.
//
// Layout: a 2-column grid on the narrowest phones, growing to a single
// row on desktop. A grid — not a horizontal scroller — so no label is
// ever clipped and nothing requires a sideways swipe.
//
// Each card carries a chevron affordance so it reads as "go there", not
// as an inert tile: the icon chip is the identity, the chevron is the
// action. The whole card is the target, keeping the touch area large.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronLeft } from "@/lib/icons";
import { trackServicesEvent, type ServiceCategory } from "@/lib/services/catalog";

interface CategoryShortcutsProps {
  categories: ServiceCategory[];
  /** Item count per category, rendered as a small meta line. */
  counts: Record<string, number>;
}

export function CategoryShortcuts({ categories, counts }: CategoryShortcutsProps) {
  return (
    <nav aria-label="دسترسی سریع به دسته‌بندی خدمات">
      {/* 2 / 3 / 4 / 7 columns. Seven only at the wide breakpoint: below
          that the scroll-area + sidebar push the content column under
          ~850px, where seven chips would each shrink below legibility. */}
      <ul className="grid grid-cols-2 gap-2.5 mobile-l:grid-cols-3 tablet:grid-cols-4 wide:grid-cols-7">
        {categories.map((category) => {
          const Icon = category.icon;
          const count = counts[category.id] ?? 0;
          // Counts only make sense for the categories that group catalog
          // items; navigation-only shortcuts carry their own subtitle.
          const meta =
            category.subtitle ?? `${count.toLocaleString("fa-IR")} خدمت`;

          return (
            <li key={category.id}>
              <Link
                href={category.href}
                onClick={() =>
                  trackServicesEvent("services_category_selected", {
                    categoryId: category.id,
                  })
                }
                className="group flex h-full flex-col items-start gap-2 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
              >
                <span className="flex w-full items-start justify-between">
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 items-center justify-center rounded-medium bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.05]`}
                  >
                    <Icon size={20} />
                  </span>
                  <IconChevronLeft
                    size={16}
                    aria-hidden="true"
                    className="mt-1 text-muted transition-all duration-short4 ease-standard group-hover:-translate-x-0.5 group-hover:text-primary"
                  />
                </span>
                <span className="text-caption font-semibold leading-snug text-on-surface">
                  {category.title}
                </span>
                <span className="text-labelSmall text-muted">{meta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
