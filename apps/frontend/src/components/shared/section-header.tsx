// ============================================================
// LEGALIR — Section header (the «عنوان بخش» primitive)
// ============================================================
// In-page section titles had drifted into three different type scales
// (`text-h3` on /lawyers, `text-h4 font-bold` on /calculators,
// `text-titleMedium font-semibold` on /dashboard) and five hand-rolled
// copies of the same "title + one-line description + trailing action"
// layout. Moving between sections therefore changed the visual weight
// of what is the same structural element.
//
// This component owns that pattern once:
//
//   title        REQUIRED — the section's heading, in the page's outline
//   description  optional one-line explanation, muted 12px
//   icon         optional leading glyph, tinted with the primary colour
//   action       optional trailing control («مشاهده همه» / a link)
//   level        heading level for the outline (2 by default)
//
// Purely presentational. It renders no data and owns no state, so a page
// keeps every fetch, filter and navigation behaviour it already had.
// ============================================================

import React from "react";

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** Optional one-line explanation shown under the title. */
  description?: React.ReactNode;
  /** Optional leading glyph (an icon element). */
  icon?: React.ReactNode;
  /** Optional trailing control — a link or button. */
  action?: React.ReactNode;
  /** Heading level for the document outline. Defaults to 2. */
  level?: 2 | 3;
  /** Anchor target, so a section can be labelled by its own heading. */
  id?: string;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  icon,
  action,
  level = 2,
  id,
  className,
}: SectionHeaderProps) {
  const Heading = level === 3 ? "h3" : "h2";

  return (
    <div className={`mb-3 flex items-end justify-between gap-3${className ? ` ${className}` : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="shrink-0 text-primary" aria-hidden="true">
              {icon}
            </span>
          )}
          <Heading id={id} className="text-h4 font-bold text-on-surface">
            {title}
          </Heading>
        </div>
        {description && (
          <p className="mt-1 text-caption text-on-surface-variant">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
