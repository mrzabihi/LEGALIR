// ============================================================
// LEGALIR — Category shortcuts
// ============================================================
// The quick-access row directly under the page intro. Each card is a
// real navigation link into the surface that owns that area of the
// product — contracts → /contracts, lawyers → /lawyers, documents →
// /documents, cases → /cases, library → /blog, plus the personal
// «مشاوره‌های من» → /consultations entry point.
//
// Layout: the six product areas tile a grid that always divides evenly —
// two columns on the narrowest phones, three from `mobile-l`, six in one
// row from `wide` — so no shortcut is ever stranded alone with dead space
// beside it. (Seven cards never divide evenly across 2/3/4 columns: the
// seventh used to sit by itself under a half-empty row.) The personal
// «مشاوره‌های من» entry point is a different kind of thing — the user's own
// requests, not a product area — so it is set apart as one full-width bar
// beneath the grid. A grid, not a horizontal scroller, so no label is ever
// clipped and nothing requires a sideways swipe.
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
  // The product areas are one family; «مشاوره‌های من» is the user's own
  // destination. Splitting them keeps the grid even (6 tiles) and gives
  // the personal entry point the prominence it deserves — without ever
  // stranding a lone tile under a half-empty row.
  const areas = categories.filter((c) => c.inCatalog);
  const personal = categories.filter((c) => !c.inCatalog);

  return (
    <nav
      aria-label="دسترسی سریع به دسته‌بندی خدمات"
      className="space-y-2.5"
    >
      {/* 2 / 3 / 6 columns — all divisors of the six product areas, so
          the row is always full. Six only at `wide`: below that the
          scroll-area + sidebar push the content column narrower, where
          six chips would each shrink below legibility. */}
      <ul className="grid grid-cols-2 gap-2.5 mobile-l:grid-cols-3 wide:grid-cols-6">
        {areas.map((category) => (
          <li key={category.id}>
            <ShortcutCard category={category} counts={counts} />
          </li>
        ))}
      </ul>

      {personal.length > 0 && (
        <ul className="grid grid-cols-1 gap-2.5">
          {personal.map((category) => (
            <li key={category.id}>
              <ShortcutCard category={category} counts={counts} horizontal />
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

interface ShortcutCardProps {
  category: ServiceCategory;
  counts: Record<string, number>;
  /** Lay the identity and the action on one row — for the full-width bar. */
  horizontal?: boolean;
}

function ShortcutCard({ category, counts, horizontal = false }: ShortcutCardProps) {
  const Icon = category.icon;
  const count = counts[category.id] ?? 0;
  // Counts only make sense for the categories that group catalog items;
  // navigation-only shortcuts carry their own subtitle.
  const meta = category.subtitle ?? `${count.toLocaleString("fa-IR")} خدمت`;

  const iconChip = (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${category.gradient} text-white shadow-elevation-1 transition-transform duration-short4 ease-standard group-hover:scale-[1.05]`}
    >
      <Icon size={20} />
    </span>
  );

  const chevron = (extra = "") => (
    <IconChevronLeft
      size={16}
      aria-hidden="true"
      className={`shrink-0 text-muted transition-all duration-short4 ease-standard group-hover:-translate-x-0.5 group-hover:text-primary ${extra}`}
    />
  );

  return (
    <Link
      href={category.href}
      onClick={() =>
        trackServicesEvent("services_category_selected", {
          categoryId: category.id,
        })
      }
      className="group flex h-full flex-col items-start gap-2 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-3 transition-all duration-short4 ease-standard hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] hover:shadow-elevation-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] touch-target"
    >
      {horizontal ? (
        <span className="flex w-full items-center gap-3">
          {iconChip}
          <span className="min-w-0 flex-1">
            <span className="block text-caption font-semibold leading-snug text-on-surface">
              {category.title}
            </span>
            <span className="mt-0.5 block text-labelSmall text-muted">{meta}</span>
          </span>
          {chevron()}
        </span>
      ) : (
        <>
          <span className="flex w-full items-start justify-between">
            {iconChip}
            {chevron("mt-1")}
          </span>
          <span className="text-caption font-semibold leading-snug text-on-surface">
            {category.title}
          </span>
          <span className="text-labelSmall text-muted">{meta}</span>
        </>
      )}
    </Link>
  );
}
