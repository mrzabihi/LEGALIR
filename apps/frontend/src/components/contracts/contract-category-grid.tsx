// ============================================================
// LEGALIR — Contract category grid (the hub's Category Grid)
// ============================================================
// The four template buckets (همه / املاک / شخصی / تجاری) as a scannable
// grid of tiles rather than a strip of chips. A chip answers «which
// filter is on?»; a tile answers «what kind of contract do I need?»,
// which is the question this page is actually asking first.
//
// Each tile is the SAME `CategoryTile` used by /calculators, so the two
// browse surfaces share one selection language (icon block, name,
// count, check glyph). Nothing here is invented: every label comes from
// `TEMPLATE_CATEGORIES`, every count is derived from the registered
// definitions through `matchesTemplateCategory`, and the selection is
// still written to `?category=` by the page that owns the URL state.
//
// The chip row stays in place where a single-line filter fits better
// (/contracts/templates and the embedded catalog); this grid replaces
// only the hub's filter row.
// ============================================================

"use client";

import type { ReactNode } from "react";
import { CategoryTile } from "@/components/shared";
import {
  TEMPLATE_CATEGORIES,
  matchesTemplateCategory,
  type TemplateCategory,
} from "@/lib/contracts/categories";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconBriefcase, IconGrid, IconHome, IconUsers } from "@/lib/icons";

interface CategoryPresentation {
  icon: ReactNode;
  accent: string;
}

/** One icon + one accent per bucket, drawn only from the brand tokens. */
const PRESENTATION: Record<TemplateCategory, CategoryPresentation> = {
  all: { icon: <IconGrid size={20} aria-hidden="true" />, accent: "var(--brand-teal)" },
  property: { icon: <IconHome size={20} aria-hidden="true" />, accent: "var(--brand-green)" },
  personal: { icon: <IconUsers size={20} aria-hidden="true" />, accent: "var(--brand-gold)" },
  business: {
    icon: <IconBriefcase size={20} aria-hidden="true" />,
    accent: "var(--color-primary)",
  },
};

interface ContractCategoryGridProps {
  value: TemplateCategory;
  onChange: (category: TemplateCategory) => void;
  className?: string;
}

export function ContractCategoryGrid({
  value,
  onChange,
  className = "",
}: ContractCategoryGridProps) {
  // Counts are computed from the SAME registry the rail reads, so a tile
  // can never promise more templates than the rail below can show.
  const definitions = implementedContractDefinitions();
  const countFor = (category: TemplateCategory) =>
    category === "all"
      ? definitions.length
      : definitions.filter((def) => matchesTemplateCategory(def.id, category)).length;

  return (
    <div
      role="group"
      aria-label="دسته‌بندی قراردادها"
      className={["grid grid-cols-2 gap-2.5 tablet:grid-cols-4", className]
        .filter(Boolean)
        .join(" ")}
    >
      {TEMPLATE_CATEGORIES.map((category) => (
        <CategoryTile
          key={category.key}
          label={category.labelFa}
          countLabel={`${toPersianNumber(countFor(category.key))} قالب`}
          icon={PRESENTATION[category.key].icon}
          accent={PRESENTATION[category.key].accent}
          selected={category.key === value}
          onClick={() => onChange(category.key)}
        />
      ))}
    </div>
  );
}
