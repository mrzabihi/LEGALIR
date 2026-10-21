// ============================================================
// LEGALIR — Hand-drawn marker highlight
// ============================================================
// A keyword inside a heading gets a hand-drawn stroke under it. Three
// constraints shaped the implementation:
//
//   • It must never cost the heading its semantics. The children are the
//     real text nodes; the stroke is a sibling SVG marked `aria-hidden` at
//     negative z-index. Nothing is duplicated into a pseudo-element or a
//     `data-` attribute, so the accessible name of the heading is exactly
//     the copy.
//
//   • It must read as a hand, not as an underline. The path is two
//     slightly asymmetric control points with a rising tail — the shape a
//     person makes when they underline in a hurry — stroked at 3.2px with
//     round caps and 55% opacity.
//
//   • It must be free when the animation cannot run. `pathLength="1"`
//     normalises every path to one unit, so the draw is a single CSS
//     transition on `stroke-dashoffset`. With reduced motion the stroke is
//     painted solid in the same frame; with no JS at all (`--draw` absent)
//     the path is simply present.
//
// The stroke is sized in `em` against the heading it sits in, so it grows
// with the type instead of needing a per-instance measurement.

import type { ReactNode } from "react";

export interface LandingHighlightProps {
  children: ReactNode;
  /**
   * Animate the stroke when it scrolls into view. Only the first highlight
   * on the page should set this — repeating the draw on every heading
   * turns a signature gesture into wallpaper.
   */
  draw?: boolean;
  className?: string;
}

/**
 * Two strokes. `wave` is the marker under a phrase inside a sentence;
 * `underline` is the flatter, longer sweep used under a display heading
 * where a wave would fight the type.
 */
const PATHS = {
  wave: "M3 11.6C42 4.9 104 3.4 166 5.9c18 .8 32 1.5 47 2.6",
  underline: "M3 9.4C62 5.4 138 4.7 213 6.6",
} as const;

export function LandingHighlight({
  children,
  draw = false,
  className = "",
}: LandingHighlightProps) {
  return (
    <span
      className={`landing-highlight ${draw ? "landing-highlight--draw" : ""} ${className}`}
      /* Only the animated instance is registered with the motion island.
         A static marker needs no ScrollTrigger at all, so it is not
         offered one. */
      data-ln-highlight={draw ? "1" : undefined}
    >
      {children}
      <svg
        aria-hidden="true"
        focusable="false"
        className="landing-highlight__stroke"
        viewBox="0 0 216 18"
        preserveAspectRatio="none"
      >
        <path d={PATHS.wave} pathLength={1} />
      </svg>
    </span>
  );
}

/** Display-heading variant: same mechanic, flatter arc. */
export function LandingHighlightWide({
  children,
  draw = false,
  className = "",
}: LandingHighlightProps) {
  return (
    <span
      className={`landing-highlight landing-highlight--wide ${draw ? "landing-highlight--draw" : ""} ${className}`}
      data-ln-highlight={draw ? "1" : undefined}
    >
      {children}
      <svg
        aria-hidden="true"
        focusable="false"
        className="landing-highlight__stroke"
        viewBox="0 0 216 18"
        preserveAspectRatio="none"
      >
        <path d={PATHS.underline} pathLength={1} />
      </svg>
    </span>
  );
}
