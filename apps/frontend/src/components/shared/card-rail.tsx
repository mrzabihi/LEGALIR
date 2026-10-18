// ============================================================
// LEGALIR — Card rail (the one horizontal carousel primitive)
// ============================================================
// A single, accessible implementation of the "row of cards you can
// swipe" pattern that contracts, calculators and lawyers all need.
// Before this file each of those surfaces hand-rolled its own scroller,
// arrow maths and RTL handling, so the three rails could (and did)
// disagree about direction, disabled states and keyboard access.
//
// Behaviour this component owns, once:
//
//   • TOUCH — a native, snapping scroller. Each card is a little narrower
//     than the viewport, so the next card always peeks in and signals that
//     the row continues.
//   • DESKTOP — the same track plus a pair of round edge buttons. They are
//     rendered only while the track actually overflows, and each one
//     disables at its end so a click never does nothing silently.
//   • RTL — `scrollLeft` runs from 0 at the START (right) edge to a
//     negative value at the END (left) edge, so every position check
//     compares magnitudes and every step is applied with the measured
//     direction rather than a hard-coded sign.
//   • KEYBOARD — the track is focusable and exposed as a named region, so
//     arrow keys / Home / End scroll it like any native scroll container.
//     The buttons are real <button>s with labels.
//   • MOTION — a user with `prefers-reduced-motion: reduce` gets an
//     instant jump (`behavior: auto`) instead of a smooth slide.
//
// The rail never causes PAGE-level horizontal scroll: the track clips its
// own overflow and the page column stays fixed.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";

export interface CardRailProps {
  /** Accessible name for the scroll region, e.g. «قراردادهای قابل تنظیم». */
  ariaLabel: string;
  /** The cards, in reading order. */
  children: ReactNode[];
  /** Width of one item per breakpoint. */
  itemClassName?: string;
  /** Role of the scroll region. `group` by default. */
  role?: "group" | "region" | "list";
  /**
   * Rewinds the rail to its start whenever this value changes. Pass the
   * active filter/search signature so a fresh result set always opens at
   * its first card instead of the scroll offset of the previous one.
   */
  resetKey?: string;
  /** Extra classes for the scrollable track. */
  trackClassName?: string;
  /** Extra classes for the positioning wrapper. */
  className?: string;
}

/** Sub-pixel tolerance for the "are we at an edge?" checks. */
const EDGE_EPS = 4;

const DEFAULT_ITEM =
  "w-[78vw] shrink-0 snap-start tablet:w-[calc((100%-1rem)/2)] laptop:w-[calc((100%-2rem)/3)]";

/** Honour the OS "reduce motion" setting for programmatic scrolling. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CardRail({
  ariaLabel,
  children,
  itemClassName = DEFAULT_ITEM,
  role = "group",
  resetKey,
  trackClassName = "",
  className = "",
}: CardRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canStart, setCanStart] = useState(false);
  const [canEnd, setCanEnd] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setOverflows(max > EDGE_EPS);
    setCanStart(pos > EDGE_EPS);
    setCanEnd(pos < max - EDGE_EPS);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro?.disconnect();
    };
  }, [sync, children.length]);

  // Rewind to the first card when the caller swaps the result set (a new
  // search or category). Without this a filtered rail would open scrolled
  // to wherever the previous set happened to rest, hiding its first hit.
  useEffect(() => {
    const el = trackRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ left: 0 });
  }, [resetKey]);

  /** Page roughly one screenful toward the *end* (1) or *start* (-1). */
  const page = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el || typeof el.scrollBy !== "function") return;
    const step = Math.max(el.clientWidth * 0.85, 240);
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({
      left: (rtl ? -1 : 1) * dir * step,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  /** Keep the arrow state honest after a native keyboard scroll. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      window.requestAnimationFrame(sync);
    },
    [sync]
  );

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        dir="rtl"
        role={role}
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={[
          "scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-1",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          trackClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children.map((child, i) => (
          <div key={i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>

      {/* Pointer navigation. Hidden on phones (swipe owns that gesture) and
          rendered only when there is something to scroll to. The start
          button points right (toward the RTL start edge) and moves the
          cards back that way; the end button mirrors it. */}
      {overflows && (
        <>
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={!canStart}
            aria-label={`${ariaLabel} — قبلی`}
            className="absolute -start-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface text-on-surface shadow-elevation-2 transition-[opacity,background-color] duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30 tablet:flex"
          >
            <IconChevronRightSmall size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={!canEnd}
            aria-label={`${ariaLabel} — بعدی`}
            className="absolute -end-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface text-on-surface shadow-elevation-2 transition-[opacity,background-color] duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30 tablet:flex"
          >
            <IconChevronLeft size={18} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
