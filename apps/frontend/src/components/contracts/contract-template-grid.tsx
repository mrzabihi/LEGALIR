// ============================================================
// LEGALIR — Contract template grid (SECTION 1)
// ============================================================
// The first thing the page answers: «چه قراردادی می‌توانم بسازم؟»
//
// It renders every IMPLEMENTED definition from the registry — so a new
// domain appears here the moment its definition is registered — filtered
// by the shared search query and the category chips, ranked by the
// Persian-aware scorer, and capped until the user asks for the rest.
//
// ONE layout everywhere: a horizontally-snapping rail. Every card has a
// fixed height and a fixed width at each breakpoint, so a row never looks
// ragged and each card is exactly the same size as its neighbours:
//
//   • Phone  — a native touch scroller. Each card is ~76vw so the next
//     card peeks in, signalling "there is more to the side". Snap points
//     keep a card settled at the inline edge. The rail scrolls INSIDE
//     itself; the page never scrolls sideways (it is the only
//     `overflow-x` on the surface).
//   • Tablet+ — the same rail, plus a pair of round ‹ › buttons floating
//     on the edges so a pointer user can page through without a trackpad
//     gesture. Each button fades out once the rail reaches its end.
// ============================================================

"use client";

import React from "react";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { searchTemplates } from "@/lib/contracts/search";
import { matchesTemplateCategory, type TemplateCategory } from "@/lib/contracts/categories";
import { ContractTemplateCard } from "./contract-template-card";
import { IconChevronDown, IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";

/** How many templates are shown before the "view all" toggle. */
const INITIAL_LIMIT = 8;

/** Every card is exactly this tall, at every width, so a rail is uniform. */
const TRACK_HEIGHT = "h-[372px]";

interface ContractTemplateGridProps {
  query: string;
  category: TemplateCategory;
  onStart: (definition: ContractDefinition) => void;
  /** The type currently being created, if any. */
  startingTypeId?: string | null;
  /** Called when the user expands to see every template. */
  onViewAll?: () => void;
}

export function ContractTemplateGrid({
  query,
  category,
  onStart,
  startingTypeId = null,
  onViewAll,
}: ContractTemplateGridProps) {
  const [expanded, setExpanded] = React.useState(false);

  // The scroll rail, shared with the two edge buttons. `canPrev`/`canNext`
  // mirror its position so each arrow fades out once the rail reaches its
  // end. RTL reports `scrollLeft` as a negative offset from the start, so
  // the position is compared by magnitude — sign-agnostic.
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const syncArrows = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setCanPrev(pos > 2);
    setCanNext(pos < maxScroll - 2);
  }, []);

  // Re-measure on scroll, on resize, and whenever the visible set changes
  // (a new search, or the "view all" expansion) so the arrows track the
  // rail's real content width rather than a stale one.
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      ro?.disconnect();
    };
  }, [syncArrows, query, category, expanded]);

  // Page roughly one screenful per click, in the reading direction: `dir`
  // 1 shows the NEXT cards (toward the inline end).
  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el || typeof el.scrollBy !== "function") return;
    const step = Math.max(el.clientWidth * 0.85, 260);
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: (rtl ? -1 : 1) * dir * step, behavior: "smooth" });
  };

  // Collapse back to the capped view AND rewind the rail whenever the
  // filters change, so the user always sees the top of a fresh result set.
  React.useEffect(() => {
    setExpanded(false);
    const el = trackRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ left: 0 });
  }, [query, category]);

  const results = React.useMemo(() => {
    const inCategory = implementedContractDefinitions().filter((def) =>
      matchesTemplateCategory(def.id, category)
    );
    // `searchTemplates` returns the input unchanged for an empty query,
    // so the curated registry order is preserved when nothing is typed.
    // The registry's title field is `typeFa`, so map it to the searchable
    // shape rather than reshaping the definitions themselves.
    return searchTemplates(inCategory, query, (def) => ({
      id: def.id,
      titleFa: def.typeFa,
      descriptionFa: def.descriptionFa,
      categoryFa: def.categoryFa,
      keywords: def.keywords,
    }));
  }, [query, category]);

  const hasOverflow = results.length > INITIAL_LIMIT;
  const visible = expanded || !hasOverflow ? results : results.slice(0, INITIAL_LIMIT);

  if (results.length === 0) {
    return (
      <div className="rounded-large border border-divider bg-surface p-8 text-center">
        <p className="text-body-2 text-muted">
          قالبی با این شرایط پیدا نشد. عبارت دیگری را امتحان کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The relative wrapper hosts the two floating arrows; the rail is its
          only in-flow child. The rail's negative margin bleeds it to the
          page's own gutter (p-4) so a card's edge aligns with the header
          above; it is reset from `tablet:` where the rail sits flush.
          `overscroll-x-contain` keeps a hard swipe from chaining to the
          page. Every card is a fixed height and a fixed per-breakpoint
          width, so the rail is uniform. */}
      <div className="relative">
        <div
          ref={trackRef}
          className={`scrollbar-hide -mx-4 flex ${TRACK_HEIGHT} snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 tablet:mx-0 tablet:gap-4 tablet:px-0`}
        >
          {visible.map((def, i) => (
            <div
              key={def.id}
              className="animate-slide-up-fade h-full w-[76vw] shrink-0 snap-start tablet:w-[300px]"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <ContractTemplateCard
                definition={def}
                onStart={onStart}
                starting={startingTypeId === def.id}
                disabled={startingTypeId !== null}
              />
            </div>
          ))}
        </div>

        {/* Pointer navigation for tablet+. Touch users page by swiping, so
            the buttons stay hidden on phones. Each fades out at its end. */}
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={!canPrev}
          aria-label="قبلی"
          className="absolute start-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface/95 text-on-surface shadow-elevation-3 backdrop-blur-md transition-opacity duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-0 tablet:inline-flex"
        >
          <IconChevronRightSmall size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={!canNext}
          aria-label="بعدی"
          className="absolute end-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface/95 text-on-surface shadow-elevation-3 backdrop-blur-md transition-opacity duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-0 tablet:inline-flex"
        >
          <IconChevronLeft size={20} aria-hidden="true" />
        </button>
      </div>

      {hasOverflow && !expanded && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              onViewAll?.();
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-medium px-5 text-labelLarge text-primary transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            مشاهده همه قراردادها
            <IconChevronDown size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
