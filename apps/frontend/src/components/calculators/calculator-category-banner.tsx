// ============================================================
// LEGALIR — Calculator category banner
// ============================================================
// The compact header that opens each category section. It is not a
// decorative image banner: there are no banner assets for the
// calculator categories, and inventing stock art would be dishonest.
// Instead it is built from the design system — a soft panel tinted with
// the category's own semantic tone (`meta.tone` → `toneClasses`), the
// category icon on a solid tone chip, the title, a one-line description
// of what that category computes, the item count, and a «مشاهدهٔ همهٔ
// این دسته» link into the full list pre-filtered to that category.
//
// The panel stays low-contrast — a section header, never a clickable
// card competing with the calculators beneath it — but the tint + icon
// give each category a colour a user can recognise at a glance.
// ============================================================

"use client";

import Link from "next/link";
import { IconChevronLeft } from "@/lib/icons";
import type { CalculatorCategoryMeta } from "@/lib/calculators/catalog";
import { toneClasses } from "./tone";

interface CalculatorCategoryBannerProps {
  meta: CalculatorCategoryMeta;
  /** Number of calculators in this category. */
  count: number;
}

export function CalculatorCategoryBanner({ meta, count }: CalculatorCategoryBannerProps) {
  const Icon = meta.icon;
  const tone = toneClasses(meta.tone);

  return (
    <div
      id={meta.anchor}
      className={`flex scroll-mt-4 items-center gap-3 rounded-large border px-3.5 py-3 ${tone.banner}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br ${meta.gradient} text-white shadow-elevation-1`}
      >
        <Icon size={22} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-h4 font-bold text-on-surface">{meta.title}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface/70 px-1.5 text-labelSmall font-medium tabular-nums text-on-surface-variant">
            {count.toLocaleString("fa-IR")}
          </span>
        </div>
        <p className="mt-0.5 truncate text-caption text-on-surface-variant">{meta.description}</p>
      </div>

      <Link
        href={`/calculators/all?category=${meta.id}`}
        className="hidden shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] bg-surface/70 px-3 py-1.5 text-labelLarge font-medium text-on-surface transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
      >
        مشاهدهٔ همه
        <IconChevronLeft size={16} />
      </Link>
    </div>
  );
}
