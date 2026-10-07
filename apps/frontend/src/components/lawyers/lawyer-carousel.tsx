"use client";

// ============================================================
// LEGALIR — Lawyer Carousel
// ============================================================
// A horizontal, snap-scrolling row of compact lawyer tiles. On touch
// widths it is a plain swipe scroller (no visible scrollbar); from
// `tablet` up two arrow buttons page through the overflow so a mouse user
// can reach it too. Arrows are hidden when the row does not overflow.
//
// Card sizing is container-relative, not viewport-relative, so the row
// never bleeds past the page gutter:
//   mobile  → 2 tiles per view
//   tablet  → 3 tiles per view
//   desktop → 4 tiles per view
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { LawyerListItem } from "@legalir/types";
import { IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";
import { LawyerCardCompact } from "./lawyer-card-compact";
import { LawyerCardCompactSkeleton } from "./lawyer-card-skeleton";

interface LawyerCarouselProps {
  lawyers: LawyerListItem[];
  /** Accessible name for the scroll region, e.g. «وکلای حقوق خانواده». */
  ariaLabel: string;
  /** Render skeleton tiles instead of data (loading state). */
  loading?: boolean;
  /** Number of skeleton tiles to show while loading. */
  skeletonCount?: number;
}

const CARD_WIDTH =
  "w-[calc((100%-0.75rem)/2)] tablet:w-[calc((100%-1.5rem)/3)] desktop:w-[calc((100%-2.25rem)/4)]";

export function LawyerCarousel({
  lawyers,
  ariaLabel,
  loading = false,
  skeletonCount = 4,
}: LawyerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const syncScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL: scrollLeft runs 0 → -max, so compare magnitudes.
    const pos = Math.abs(el.scrollLeft);
    setCanScrollStart(pos > 1);
    setCanScrollEnd(pos < max - 1);
  }, []);

  useEffect(() => {
    syncScroll();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncScroll, lawyers.length, loading]);

  const scrollBy = (dir: "start" | "end") => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.8, 200);
    // RTL: negative `left` advances toward the end of the list.
    el.scrollBy({ left: dir === "end" ? -step : step, behavior: "smooth" });
  };

  const showArrows = canScrollStart || canScrollEnd;

  return (
    <div className="relative">
      {/* Leading arrow (tablet+ only) */}
      <button
        type="button"
        onClick={() => scrollBy("start")}
        disabled={!canScrollStart}
        aria-label="نمایش وکلای قبلی"
        className={[
          "absolute -start-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-divider/60 bg-surface text-on-surface shadow-elevation-2 transition-opacity hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-0 tablet:flex",
          showArrows ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <IconChevronRightSmall size={18} />
      </button>

      <div
        ref={trackRef}
        onScroll={syncScroll}
        role="group"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide"
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className={`${CARD_WIDTH} shrink-0 snap-start`}>
                <LawyerCardCompactSkeleton />
              </div>
            ))
          : lawyers.map((lawyer) => (
              <div key={lawyer.id} className={`${CARD_WIDTH} shrink-0 snap-start`}>
                <LawyerCardCompact lawyer={lawyer} />
              </div>
            ))}
      </div>

      {/* Trailing arrow (tablet+ only) */}
      <button
        type="button"
        onClick={() => scrollBy("end")}
        disabled={!canScrollEnd}
        aria-label="نمایش وکلای بعدی"
        className={[
          "absolute -end-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-divider/60 bg-surface text-on-surface shadow-elevation-2 transition-opacity hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-0 tablet:flex",
          showArrows ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <IconChevronLeft size={18} />
      </button>
    </div>
  );
}
