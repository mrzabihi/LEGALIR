// ============================================================
// LEGALIR — Configurable contracts (SECTION 1)
// ============================================================
// The first thing the library answers: «چه قراردادی می‌توانم بسازم؟»
//
// It renders every IMPLEMENTED definition from the registry — so a new
// domain appears here the moment its definition is registered — filtered
// by the shared search query and the category grid, ranked by the
// Persian-aware scorer. Both filters run on the COMPLETE registry, so a
// search never misses a template that the grid has not revealed yet.
//
// TWO LAYOUTS, one rule — the first row is always a rail:
//
//   • «همه» (the default) — the first THREE results stay in the shared
//     `CardRail` (the page's familiar opening row), and every remaining
//     template opens BELOW it in an ordered GRID on this same page. No
//     route change: selecting «همه» must never leave /contracts.
//
//   • a specific category — the rail holds that category's results
//     (usually few), so the block stays one compact row.
//
// The grid mounts progressively rather than all at once:
//   · up to `LAZY_AFTER` extra cards mount immediately, each with a
//     short staggered rise so the expansion reads as a continuation
//     rather than a jump;
//   · beyond that, an IntersectionObserver reveals further batches as
//     the user scrolls near the end, and a real «نمایش بقیهٔ قالب‌ها»
//     button stays available when the observer cannot run (older
//     browsers, tests, reduced motion). Every template is therefore
//     always reachable.
//
// Below everything, a Promotional Banner Card («همه قراردادهای LEGALIR»)
// remains a real link to the paginated full listing
// (`/contracts/templates`) — that page keeps its own search, filter,
// count and pagination; it is an alternative destination, not the only
// way to see the whole registry.
// ============================================================

"use client";

import React from "react";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { searchTemplates } from "@/lib/contracts/search";
import { matchesTemplateCategory, type TemplateCategory } from "@/lib/contracts/categories";
import { toPersianNumber } from "@/lib/persian-utils";
import { ContractTemplateCard } from "./contract-template-card";
import { IconFiles, IconRefresh } from "@/lib/icons";
import { trackContractEvent } from "@/lib/contracts/analytics";
import { Button } from "@legalir/ui";
import { CardRail, PromoCard } from "@/components/shared";

/** The opening row always holds this many cards on the «همه» view. */
const RAIL_COUNT = 3;

/**
 * Extra cards mounted immediately below the rail. Above this the grid
 * grows in place (observer / button), so a large registry never pays for
 * every card up front. The current registry (14 types) is below it, so
 * the whole set is present on first paint.
 */
const LAZY_AFTER = 12;

/** Card width per breakpoint — a narrow peek on phones, elastic above. */
const ITEM_WIDTH =
  "h-full w-[76vw] shrink-0 snap-start tablet:w-[calc((100%-1rem)/2)] laptop:w-[calc((100%-2rem)/3)]";

/**
 * The track's own chrome: a phone-only bleed to the page gutter (so a
 * card's edge aligns with the content) plus the matching scroll-padding,
 * because scroll-snap aligns to the scrollport and ignores padding. The
 * logical property keeps the gutter correct in either writing direction.
 */
const TRACK_CLASS =
  "-mx-4 px-4 pb-1 [scroll-padding-inline-start:1rem] tablet:mx-0 tablet:gap-4 tablet:px-0 tablet:[scroll-padding-inline-start:0px]";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface ContractTemplateGridProps {
  query: string;
  category: TemplateCategory;
  onStart: (definition: ContractDefinition) => void;
  /** Opens the structure preview for a template. */
  onPreview?: (definition: ContractDefinition) => void;
  /** The type currently being created, if any. */
  startingTypeId?: string | null;
  /** Resets the search (used by the no-results state). */
  onClearQuery?: () => void;
}

export function ContractTemplateGrid({
  query,
  category,
  onStart,
  onPreview,
  startingTypeId = null,
  onClearQuery,
}: ContractTemplateGridProps) {
  const results = React.useMemo(() => {
    const inCategory = implementedContractDefinitions().filter((def) =>
      matchesTemplateCategory(def.id, category)
    );
    // `searchTemplates` returns the input unchanged for an empty query,
    // so the curated registry order is preserved when nothing is typed.
    // Name + keywords only, matching the full listing's search: description
    // prose («اجارهٔ زیرساخت ابری») must not widen «اجاره» to cloud services.
    return searchTemplates(inCategory, query, (def) => ({
      id: def.id,
      titleFa: def.typeFa,
      keywords: def.keywords,
    }));
  }, [query, category]);

  const totalTemplates = implementedContractDefinitions().length;

  // «همه» → rail + grid. A specific category → the rail alone, as before.
  const expands = category === "all";
  const railItems = expands ? results.slice(0, RAIL_COUNT) : results;
  const gridItems = expands ? results.slice(RAIL_COUNT) : [];

  // --- Staged mounting of the grid ----------------------------------
  // `revealAll` flips when the sentinel nears the viewport or the user
  // asks for the rest. It resets whenever the result set changes, so a
  // fresh search always starts from the same quiet first batch.
  const [revealAll, setRevealAll] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    setRevealAll(false);
  }, [query, category]);

  const needsLazyLoad = gridItems.length > LAZY_AFTER;
  const mountedGrid = needsLazyLoad && !revealAll ? gridItems.slice(0, LAZY_AFTER) : gridItems;
  const remaining = gridItems.length - mountedGrid.length;

  React.useEffect(() => {
    if (!needsLazyLoad || revealAll) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // With reduced motion the reveal is instant — no animation to wait
    // for, so simply show everything rather than making the user scroll.
    if (prefersReducedMotion()) {
      setRevealAll(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealAll(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [needsLazyLoad, revealAll, mountedGrid.length]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-large border border-divider bg-surface px-4 py-10 text-center">
        <p className="text-body-2 font-medium text-on-surface">
          قالبی با این شرایط پیدا نشد
        </p>
        <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted">
          عبارت دیگری را امتحان کنید یا دسته‌بندی دیگری را انتخاب کنید.
        </p>
        {onClearQuery && query && (
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={onClearQuery}
            startIcon={<IconRefresh size={16} />}
            className="mt-2"
          >
            پاک کردن جست‌وجو
          </Button>
        )}
      </div>
    );
  }

  const renderCard = (def: ContractDefinition, index: number, inGrid: boolean) => (
    <div
      key={def.id}
      className="animate-slide-up-fade h-full"
      // The first row is already on screen, so its stagger is a whisper.
      // Grid cards rise in reading order, which is what makes the
      // expansion feel continuous rather than simultaneous.
      style={{ animationDelay: `${Math.min(index, inGrid ? 8 : 4) * (inGrid ? 45 : 25)}ms` }}
    >
      <ContractTemplateCard
        definition={def}
        onStart={onStart}
        onPreview={onPreview}
        starting={startingTypeId === def.id}
        disabled={startingTypeId !== null}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <CardRail
        ariaLabel="قراردادهای قابل تنظیم"
        resetKey={`${query}::${category}`}
        itemClassName={ITEM_WIDTH}
        trackClassName={`h-[372px] ${TRACK_CLASS}`}
      >
        {railItems.map((def, i) => renderCard(def, i, false))}
      </CardRail>

      {/* The rest of «همه», on THIS page, in a regular grid. */}
      {gridItems.length > 0 && (
        <section aria-labelledby="contracts-grid-heading" className="space-y-2.5 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="contracts-grid-heading" className="text-titleSmall text-on-surface">
              همهٔ قالب‌های قابل تنظیم
            </h3>
            <p className="text-labelSmall text-muted" aria-live="polite">
              {toPersianNumber(results.length)} قالب
            </p>
          </div>

          <ul
            className="grid auto-rows-fr grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3"
            aria-label="فهرست همهٔ قراردادهای قابل تنظیم"
          >
            {mountedGrid.map((def, i) => (
              <li key={def.id}>{renderCard(def, i, true)}</li>
            ))}
          </ul>

          {remaining > 0 && (
            <>
              {/* Scroll sentinel — the grid continues as the user nears it. */}
              <div ref={sentinelRef} aria-hidden="true" className="h-1" />
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => setRevealAll(true)}
                >
                  نمایش بقیهٔ قالب‌ها ({toPersianNumber(remaining)})
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {/* The full listing is one prominent, real destination. The card
          states the registry's real total so its value is concrete, and
          keeps the existing analytics event on the click. */}
      <PromoCard
        layout="row"
        eyebrow="کتابخانهٔ قراردادها"
        title="همه قراردادهای LEGALIR"
        message={`${toPersianNumber(totalTemplates)} قالب آماده؛ جست‌وجو، فیلتر و صفحه‌بندی در فهرست کامل.`}
        cta="مشاهده همه قراردادها"
        href="/contracts/templates"
        icon={<IconFiles size={20} aria-hidden="true" />}
        onClick={() => trackContractEvent("contract_view_all_clicked")}
      />
    </div>
  );
}
