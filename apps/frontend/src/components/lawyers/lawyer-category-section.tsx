"use client";

// ============================================================
// LEGALIR — Lawyer Category Section
// ============================================================
// One practice-area block: a header (large title + gradient accent +
// optional description + a «مشاهده همه» affordance) over a horizontal
// carousel of compact tiles.
//
// Each section is a visually distinct card — a tinted, bordered container
// with a soft brand wash at the top edge and a gradient accent bar beside
// the title — so consecutive categories read as separate blocks rather
// than one continuous list. The section is purely presentational; the page
// owns the data and the "view all" behaviour.
// ============================================================

import type { LawyerListItem } from "@legalir/types";
import { IconChevronLeft } from "@/lib/icons";
import { LawyerCarousel } from "./lawyer-carousel";

interface LawyerCategorySectionProps {
  title: string;
  description?: string;
  lawyers: LawyerListItem[];
  /** When provided, renders a «مشاهده همه» control in the header. */
  onViewAll?: () => void;
}

export function LawyerCategorySection({
  title,
  description,
  lawyers,
  onViewAll,
}: LawyerCategorySectionProps) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-divider/60 bg-surface-container/40 p-4 tablet:p-5">
      {/* Soft brand wash at the top edge — decorative only. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.07] to-transparent"
        aria-hidden="true"
      />

      <div className="relative mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary-400 to-primary-700"
              aria-hidden="true"
            />
            <h2 className="text-h2 text-on-surface">{title}</h2>
          </div>
          {description && (
            <p className="mt-1 ps-4 text-body-2 text-muted">{description}</p>
          )}
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            مشاهده همه
            <IconChevronLeft size={16} />
          </button>
        )}
      </div>

      <div className="relative">
        <LawyerCarousel lawyers={lawyers} ariaLabel={title} />
      </div>
    </section>
  );
}
