// ============================================================
// LEGALIR — Contract template grid (SECTION 1)
// ============================================================
// The first thing the page answers: "چه قراردادی می‌توانم بسازم؟"
//
// It renders every IMPLEMENTED definition from the registry — so a new
// domain appears here the moment its definition is registered — filtered
// by the shared search query and the category chips, ranked by the
// Persian-aware scorer, and capped at eight cards until the user asks
// for the rest.
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
      {/* 2 → 3 → 5 columns. Two per row even on phones, so the grid reads as a
          proper 2-up list rather than one full-width card per row. Five only at
          `wide` (1440px+): below that the sidebar leaves too little room for
          five readable cards. `auto-rows-fr` makes every row the same height
          (not just within a row) and `h-full` lets each card stretch to fill
          it, so all cards are exactly equal. */}
      <div className="grid grid-cols-2 laptop:grid-cols-3 wide:grid-cols-5 auto-rows-fr gap-3 tablet:gap-4">
        {visible.map((def, i) => (
          <div
            key={def.id}
            className="animate-slide-up-fade h-full"
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
            className="inline-flex items-center gap-1.5 h-10 rounded-medium px-5 text-labelLarge text-primary hover:bg-primary/10 transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            مشاهده همه قراردادها
            <IconChevronDown size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
