// ============================================================
// LEGALIR — Configurable contracts rail (SECTION 1)
// ============================================================
// The first thing the page answers: «چه قراردادی می‌توانم بسازم؟»
//
// It renders every IMPLEMENTED definition from the registry — so a new
// domain appears here the moment its definition is registered — filtered
// by the shared search query and the category chips, ranked by the
// Persian-aware scorer.
//
// ONE layout everywhere: a horizontally-snapping rail. Every card has a
// fixed height and a fixed width at each breakpoint, so a row never looks
// ragged and each card is exactly the same size as its neighbours:
//
//   • Phone  — a native touch scroller. Each card is ~76vw so the next
//     card peeks in, signalling "there is more to the side". Snap points
//     keep a card settled at the inline edge. The rail scrolls INSIDE
//     itself; the page never scrolls sideways.
//   • Tablet+ — the same rail, but cards ELASTICALLY fill the row width
//     (two per row from `tablet`, three from `laptop`). A pair of round
//     ‹ › buttons floats on the edges so a pointer user can page through
//     without a trackpad gesture; each is disabled (and labelled as
//     such) once the rail reaches its end, and the pair is not rendered
//     at all when every card already fits.
//
// Below the rail, «مشاهده همه قراردادها» is a real link to the paginated
// full listing (`/contracts/templates`) — never an in-place expansion,
// so the hub always stays short and the listing can carry its own
// search, filter, count and pagination.
// ============================================================

"use client";

import React from "react";
import Link from "next/link";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { searchTemplates } from "@/lib/contracts/search";
import { matchesTemplateCategory, type TemplateCategory } from "@/lib/contracts/categories";
import { toPersianNumber } from "@/lib/persian-utils";
import { ContractTemplateCard } from "./contract-template-card";
import { IconArrowBack, IconChevronLeft, IconChevronRightSmall } from "@/lib/icons";
import { trackContractEvent } from "@/lib/contracts/analytics";

/** Every card is exactly this tall, at every width, so a rail is uniform. */
const TRACK_HEIGHT = "h-[372px]";

interface ContractTemplateGridProps {
  query: string;
  category: TemplateCategory;
  onStart: (definition: ContractDefinition) => void;
  /** Opens the structure preview for a template. */
  onPreview?: (definition: ContractDefinition) => void;
  /** The type currently being created, if any. */
  startingTypeId?: string | null;
}

export function ContractTemplateGrid({
  query,
  category,
  onStart,
  onPreview,
  startingTypeId = null,
}: ContractTemplateGridProps) {
  // The scroll rail, shared with the two edge buttons. `canPrev`/`canNext`
  // mirror its position so each arrow disables once the rail reaches its
  // end. RTL reports `scrollLeft` as a negative offset from the start, so
  // the position is compared by magnitude — sign-agnostic.
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  const syncArrows = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setHasOverflow(maxScroll > 2);
    setCanPrev(pos > 2);
    setCanNext(pos < maxScroll - 2);
  }, []);

  // Re-measure on scroll, on resize, and whenever the visible set changes
  // (a new search or category) so the arrows track the rail's real
  // content width rather than a stale one.
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
  }, [syncArrows, query, category]);

  // Page roughly one screenful per click, in the reading direction: `dir`
  // 1 shows the NEXT cards (toward the inline end).
  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el || typeof el.scrollBy !== "function") return;
    const step = Math.max(el.clientWidth * 0.85, 260);
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: (rtl ? -1 : 1) * dir * step, behavior: "smooth" });
  };

  // Rewind the rail whenever the filters change, so the user always sees
  // the start of a fresh result set.
  React.useEffect(() => {
    const el = trackRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ left: 0 });
  }, [query, category]);

  const results = React.useMemo(() => {
    const inCategory = implementedContractDefinitions().filter((def) =>
      matchesTemplateCategory(def.id, category)
    );
    // `searchTemplates` returns the input unchanged for an empty query,
    // so the curated registry order is preserved when nothing is typed.
    return searchTemplates(inCategory, query, (def) => ({
      id: def.id,
      titleFa: def.typeFa,
      descriptionFa: def.descriptionFa,
      categoryFa: def.categoryFa,
      keywords: def.keywords,
    }));
  }, [query, category]);

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
          page's own gutter (p-4) so a card's edge aligns with the content;
          it is reset from `tablet:` where the rail sits flush.
          `overscroll-x-contain` keeps a hard swipe from chaining to the
          page.

          `scroll-padding-inline-start` mirrors that gutter: scroll-snap
          aligns a card to the SCROLLPORT, which ignores `padding` — without
          it the first card snaps flush to the screen edge and its corner is
          clipped, and the rail rests at a negative offset. The logical
          property keeps the gutter correct in either writing direction. */}
      <div className="relative">
        <div
          ref={trackRef}
          className={`scrollbar-hide -mx-4 flex ${TRACK_HEIGHT} snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scroll-padding-inline-start:1rem] tablet:mx-0 tablet:gap-4 tablet:px-0 tablet:[scroll-padding-inline-start:0px]`}
        >
          {results.map((def, i) => (
            <div
              key={def.id}
              className="animate-slide-up-fade h-full w-[76vw] shrink-0 snap-start tablet:w-[calc((100%-1rem)/2)] laptop:w-[calc((100%-2rem)/3)]"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <ContractTemplateCard
                definition={def}
                onStart={onStart}
                onPreview={onPreview}
                starting={startingTypeId === def.id}
                disabled={startingTypeId !== null}
              />
            </div>
          ))}
        </div>

        {/* Pointer navigation for tablet+. Touch users page by swiping, so
            the buttons stay hidden on phones. They are only rendered when
            the rail actually overflows; at an end the arrow stays visible
            but disabled, so its direction is never a mystery. */}
        {hasOverflow && (
          <>
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={!canPrev}
              aria-label="قراردادهای قبلی"
              className="absolute start-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface/95 text-on-surface shadow-elevation-3 backdrop-blur-md transition-[opacity,background-color] duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
            >
              <IconChevronRightSmall size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={!canNext}
              aria-label="قراردادهای بعدی"
              className="absolute end-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-surface/95 text-on-surface shadow-elevation-3 backdrop-blur-md transition-[opacity,background-color] duration-short3 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30 tablet:inline-flex"
            >
              <IconChevronLeft size={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* A prominent, full-width path to the complete listing. It states
          how many templates there are, so the link's value is concrete. */}
      <div className="flex justify-center">
        <Link
          href="/contracts/templates"
          onClick={() => trackContractEvent("contract_view_all_clicked")}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] bg-surface px-6 text-labelLarge font-medium text-primary shadow-elevation-1 transition-colors duration-short3 hover:border-primary hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 tablet:w-auto"
        >
          مشاهده همه قراردادها
          <span className="text-caption font-normal text-muted">
            ({toPersianNumber(implementedContractDefinitions().length)} قالب)
          </span>
          <IconArrowBack size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
