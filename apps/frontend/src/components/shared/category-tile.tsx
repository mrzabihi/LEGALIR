// ============================================================
// LEGALIR — Category tile (the shared Category Grid cell)
// ============================================================
// The «grid of categories» pattern, used by /contracts and
// /calculators. A category is a browsing decision, not a work item, so
// the tile is deliberately shallow: an icon block, the category name, a
// one-line description of what lives inside, and a count.
//
// Design rules encoded here:
//   • One accent per tile, expressed as a CSS custom property, so the
//     icon block and the selected/hover outline can share a hue without
//     a second hand-tuned colour per category.
//   • Selected state is never colour-only: a check glyph appears beside
//     the label as well (WCAG 1.4.1).
//   • The whole tile is one real <button> — a single large touch target
//     with an unambiguous pressed state.
//   • Text truncates to keep every tile in a row the same height, so the
//     grid never looks ragged.
// ============================================================

"use client";

import type { CSSProperties, ReactNode } from "react";
import { IconCheck } from "@/lib/icons";

export interface CategoryTileProps {
  label: string;
  /** One short line describing what the category contains. */
  description?: string;
  /** Pre-formatted count line, e.g. «۱۲ محاسبه‌گر». */
  countLabel?: string;
  /** The category's icon element. */
  icon: ReactNode;
  /** Accent colour for the icon block (any CSS colour). */
  accent?: string;
  selected?: boolean;
  onClick: () => void;
  /** Accessible label; defaults to the visible label. */
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_ACCENT = "var(--brand-green)";

export function CategoryTile({
  label,
  description,
  countLabel,
  icon,
  accent = DEFAULT_ACCENT,
  selected = false,
  onClick,
  ariaLabel,
  className = "",
}: CategoryTileProps) {
  const accentVars = {
    "--ct-accent": accent,
    "--ct-soft": `color-mix(in srgb, ${accent} 11%, transparent)`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      style={accentVars}
      className={[
        "group flex h-full w-full flex-col gap-2.5 rounded-large border p-3.5 text-start",
        "transition-[border-color,box-shadow,background-color] duration-short3 ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]",
        selected
          ? "border-[var(--ct-accent)] bg-[var(--ct-soft)] shadow-elevation-2"
          : "border-[color:var(--color-outline-variant)] bg-surface hover:border-[color:color-mix(in_srgb,var(--ct-accent)_45%,transparent)] hover:shadow-elevation-2",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-[var(--ct-soft)] text-[var(--ct-accent)] transition-transform duration-short3 ease-standard group-hover:scale-105 motion-reduce:transform-none"
        >
          {icon}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5 pt-0.5">
          <span className="truncate text-body-2 font-semibold text-on-surface">{label}</span>
          {selected && (
            <IconCheck
              size={15}
              className="shrink-0 text-[var(--ct-accent)]"
              aria-hidden="true"
            />
          )}
        </span>
      </div>

      {/* The description takes the tile's FULL width. Nested under the
          40px icon it had ~95px on a two-column phone grid, where a real
          category line («هزینه دادرسی، حق‌الوکاله، کارشناسی، داوری و اجرا»)
          needed three or four lines and the two-line clamp hid half the
          sentence. Full width, the same text fits its two lines. */}
      {description && (
        <span className="line-clamp-2 text-caption leading-relaxed text-on-surface-variant">
          {description}
        </span>
      )}

      {countLabel && (
        <span className="mt-auto inline-flex w-fit items-center rounded-full bg-surface-container px-2 py-0.5 text-labelSmall text-on-surface-variant">
          {countLabel}
        </span>
      )}
    </button>
  );
}
