"use client";

// ============================================================
// LEGALIR — Lawyer Category Section
// ============================================================
// One practice-area block: a header (large title + gradient accent +
// optional description + a «مشاهده همه» affordance) over a horizontal
// carousel of compact tiles.
//
// This block is a TOPICAL SHORTCUT, not the roster. The complete, flat
// list of every lawyer lives in the grid above it, so nothing is only
// reachable by scrolling this rail; «مشاهده همه» narrows the page to that
// domain's flat result grid. Keeping the shortcut compact is what makes
// twenty practice areas readable on a phone without turning the page into
// a forty-row wall of cards.
//
// Each section is a visually distinct card — a tinted, bordered container
// with a soft brand wash at the top edge and a gradient accent bar beside
// the title — so consecutive categories read as separate blocks rather
// than one continuous list. The section is purely presentational; the page
// owns the data and the "view all" behaviour.
// ============================================================

import type { LawyerListItem } from "@legalir/types";
import { Button } from "@legalir/ui";
import { IconChevronLeft } from "@/lib/icons";
import { SectionHeader } from "@/components/shared/section-header";
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
    <section className="relative mb-6 overflow-hidden rounded-xlarge border border-divider bg-surface-container-low p-4 tablet:p-5">
      {/* Soft brand wash at the top edge — decorative only. (A solid token,
          not a `/opacity` modifier: Tailwind 3.4 drops opacity on `var()`
          colours, so `from-primary/[0.07]` would emit nothing.) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary-container to-transparent"
        aria-hidden="true"
      />

      <div className="relative mb-4 flex items-end gap-3">
        {/* The category accent — a brand gradient rule that marks each
            practice-area block as a distinct unit. */}
        <span
          className="mb-1 h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary-400 to-primary-700"
          aria-hidden="true"
        />
        {/* The section title, description and «مشاهده همه» through the
            shared header, so a category heading and a page-level section
            heading carry the same weight and spacing. */}
        <SectionHeader
          className="mb-0 flex-1"
          title={title}
          description={description}
          action={
            onViewAll ? (
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={onViewAll}
                endIcon={<IconChevronLeft size={16} />}
                className="shrink-0"
              >
                مشاهده همه
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="relative">
        <LawyerCarousel lawyers={lawyers} ariaLabel={title} />
      </div>
    </section>
  );
}
