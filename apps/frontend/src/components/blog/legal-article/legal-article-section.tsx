// ============================================================
// LEGALIR — LegalArticleSection
// ============================================================
// The reading column. Every block in the article renders inside one
// of these, so the measure (720–820px) and the vertical rhythm are
// defined once and never re-specified per block.
//
// A section can be marked `wide` to break out to the visual width
// (1000–1200px) — used for the timeline and the card grids, which
// read better with more room than running prose.
// ============================================================

import React from "react";

interface LegalArticleSectionProps {
  children: React.ReactNode;
  /** Break out of the reading measure to the visual width. */
  wide?: boolean;
  className?: string;
}

export function LegalArticleSection({
  children,
  wide = false,
  className = "",
}: LegalArticleSectionProps) {
  return (
    <div
      className={`mx-auto w-full px-4 ${
        wide ? "max-w-[1120px]" : "max-w-[780px]"
      } ${className}`}
    >
      {children}
    </div>
  );
}
