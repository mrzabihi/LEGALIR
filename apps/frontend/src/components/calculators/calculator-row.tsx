// ============================================================
// LEGALIR — Calculator row (horizontal scroller)
// ============================================================
// A single horizontally-scrolling rail of calculator cards, used by the
// suggested row and by each category section. Layout is responsive by
// design:
//
//   • Mobile / tablet: a native touch scroller — cards snap to the
//     inline edge and the user swipes. The prev/next buttons are hidden
//     (`hidden desktop:flex`), so they never steal the swipe gesture or
//     cover a card.
//   • Desktop: the same rail, but with visible edge controls.
//
// RTL scroll direction — derived from a *measured* browser probe, not
// from names: in a `dir="rtl"` flex row, `scrollLeft` runs from 0 (the
// RIGHT/start edge) to `-(scrollWidth - clientWidth)` (the LEFT/end
// edge). Making `scrollLeft` MORE negative moves the cards to the LEFT;
// moving it toward 0 moves them to the RIGHT. So the two controls are
// bound to the physical direction they point:
//
//   ┌ left edge: ◀  → scrollLeft -= step (cards slide LEFT, revealing
//   │            the calculators further along, i.e. NEXT)
//   └ right edge: ▶ → scrollLeft += step (cards slide RIGHT, revealing
//                the earlier calculators, i.e. PREVIOUS)
//
// Each button is disabled (and faded out) once its direction can no
// longer move, and its `aria-label` matches what it actually does.
//
// The scroller never causes *page-level* horizontal scroll: it is
// clipped by `overflow-x-auto` inside a `min-w-0` track, and the page
// wrapper is `overflow-x-clip`.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";
import { CalculatorCard } from "./calculator-card";
import type { CalculatorCardModel } from "@/lib/calculators/catalog";

interface CalculatorRowProps {
  items: CalculatorCardModel[];
  /** Accessible name for the rail. */
  ariaLabel: string;
  /** Hide the legal-standing badge on each card. */
  showStatus?: boolean;
  className?: string;
}

/**
 * Card width per breakpoint. Every row uses the same width, so the first
 * card of every row begins on the same inline-start edge and the rows
 * read as one aligned column.
 */
const CARD_CLASS = "w-[240px] shrink-0 snap-start tablet:w-[256px]";

/** Fallback advance distance (card + gap) when width cannot be measured. */
const FALLBACK_STEP = 256;

/** Epsilon for the "are we at an edge?" checks (sub-pixel tolerance). */
const EDGE_EPS = 6;

export function CalculatorRow({ items, ariaLabel, showStatus, className = "" }: CalculatorRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  /** Recompute which directions can still move. */
  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // distance travelled from the start edge
    setCanRight(pos > EDGE_EPS); // cards to the right of the viewport are hidden
    setCanLeft(pos < max - EDGE_EPS); // cards further left exist
  }, []);

  useEffect(() => {
    update();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update, items]);

  /** One visible card step, measured at click time (RTL-safe). */
  const stepSize = useCallback((): number => {
    const el = scrollerRef.current;
    if (!el) return FALLBACK_STEP;
    const first = el.firstElementChild as HTMLElement | null;
    const second = el.children[1] as HTMLElement | undefined;
    if (first && second) {
      const d = Math.abs(
        second.getBoundingClientRect().left - first.getBoundingClientRect().left
      );
      if (d > 0) return Math.round(d);
    }
    if (first) {
      const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
      return Math.round(first.getBoundingClientRect().width + gap);
    }
    return FALLBACK_STEP;
  }, []);

  /** Slide the cards LEFT (reveal calculators further along). */
  const slideLeft = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const target = Math.max(-max, el.scrollLeft - stepSize());
    el.scrollTo({ left: target, behavior: "smooth" });
  }, [stepSize]);

  /** Slide the cards RIGHT (reveal earlier calculators). */
  const slideRight = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = Math.min(0, el.scrollLeft + stepSize());
    el.scrollTo({ left: target, behavior: "smooth" });
  }, [stepSize]);

  // Only offer the controls when there is actually overflow to scroll.
  const showControls = canLeft || canRight;

  return (
    <div className={`relative ${className}`}>
      {showControls && (
        <>
          {/*
            LEFT edge (RTL `end`) — the chevron POINTS LEFT and clicking
            slides the cards LEFT, revealing the calculators further along
            (the «بعدی» direction). Placement, icon and movement agree.
          */}
          <button
            type="button"
            onClick={slideLeft}
            disabled={!canLeft}
            aria-label="محاسبه‌گرهای بعدی"
            className="absolute -end-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface text-on-surface shadow-elevation-3 transition-all duration-short3 hover:bg-surface-container active:scale-95 disabled:pointer-events-none disabled:opacity-0 desktop:flex"
          >
            <IconChevronLeft size={20} />
          </button>
          {/*
            RIGHT edge (RTL `start`) — the chevron POINTS RIGHT and clicking
            slides the cards RIGHT, revealing the earlier calculators (the
            «قبلی» direction).
          */}
          <button
            type="button"
            onClick={slideRight}
            disabled={!canRight}
            aria-label="محاسبه‌گرهای قبلی"
            className="absolute -start-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface text-on-surface shadow-elevation-3 transition-all duration-short3 hover:bg-surface-container active:scale-95 disabled:pointer-events-none disabled:opacity-0 desktop:flex"
          >
            <IconChevronRightSmall size={20} />
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        dir="rtl"
        role="list"
        aria-label={ariaLabel}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain scroll-smooth py-1"
      >
        {items.map((card) => (
          <div key={card.slug} role="listitem" className={CARD_CLASS}>
            <CalculatorCard card={card} showStatus={showStatus} />
          </div>
        ))}
      </div>
    </div>
  );
}
