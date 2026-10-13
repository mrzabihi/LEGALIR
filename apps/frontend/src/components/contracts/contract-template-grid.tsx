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
// ONE DOM, two layouts. The same list is a horizontally-snapping rail on
// phones and a responsive grid from `tablet` up, so there is no
// duplicated markup and no second source of truth for "which cards":
//
//   • Phone  — a native touch scroller. Each card is ~78vw so the next
//     card peeks in, signalling "there is more to the side". Snap points
//     keep a card settled at the inline edge. The rail is full-bleed to
//     the page gutter and scrolls INSIDE itself; the page never scrolls
//     sideways (it is the only `overflow-x` on the surface).
//   • Tablet+ — a grid: 2 columns, 3 from `laptop`. It is CAPPED at 3
//     per row, so cards stay readable instead of shrinking into slivers
//     on a wide screen.
//
// `auto-rows-fr` makes every row the same height and `h-full` lets each
// card fill it, so a grid of mixed-length titles still reads as one set
// of equal cards.
// ============================================================

"use client";

import React from "react";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { searchTemplates } from "@/lib/contracts/search";
import { matchesTemplateCategory, type TemplateCategory } from "@/lib/contracts/categories";
import { ContractTemplateCard } from "./contract-template-card";
import { IconChevronDown } from "@/lib/icons";

/** How many templates are shown before the "view all" toggle. */
const INITIAL_LIMIT = 8;

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

  // Collapse back to the capped view whenever the filters change, so
  // the user always sees the top of a fresh result set.
  React.useEffect(() => {
    setExpanded(false);
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
      {/* The single track. Base = phone rail; `tablet:` = grid. The
          negative margin bleeds the rail to the page's own gutter (p-4) so
          a card's edge aligns with the header above; it is reset from
          `tablet:` where the grid takes over. `overscroll-x-contain` keeps
          a hard swipe from chaining to the page. */}
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 tablet:mx-0 tablet:grid tablet:auto-rows-fr tablet:grid-cols-2 tablet:gap-4 tablet:overflow-visible tablet:px-0 tablet:pb-0 laptop:grid-cols-3">
        {visible.map((def, i) => (
          <div
            key={def.id}
            className="animate-slide-up-fade h-full w-[78vw] shrink-0 snap-start tablet:w-full tablet:snap-align-none"
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
