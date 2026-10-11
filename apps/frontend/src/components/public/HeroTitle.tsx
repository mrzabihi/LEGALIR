"use client";

// ============================================================
// LEGALIR — Landing hero title with a one-shot typewriter reveal
// ============================================================
// The heading is split into grapheme clusters and each cluster is a
// sibling inline <span>. Every span is in the layout from the first
// frame, so revealing them in turn never reflows the HERO and never
// slices a Persian letter or its combined point-mark away from its
// base character — a naive per-code-unit slice would render «دستیا…»
// as broken, standalone glyphs.
//
// The reveal is advanced in JS (a counter stepped every PER_CHAR_MS) and
// written as an inline `opacity`. This is not a CSS keyframe animation on
// purpose: a per-span `animation-delay` + `animation-fill-mode` version ran
// into a Chromium bug where the fill of *finished* animations is dropped
// once enough of them accumulate, leaving the tail of the sentence hidden
// in both headless and headed Chrome. Inline opacity has no such failure
// mode. The reduced-motion and no-JS fallbacks live in globals.css.
//
// Accessibility: the *whole* sentence is exposed once, on the container
// via `aria-label`, and the animated glyph spans are `aria-hidden`. A
// screen reader therefore reads «دستیار هوشمند حقوقی ایران» a single
// time and never hears the characters typed out. The full sentence is
// also always in the DOM (only opacity changes), so the E2E accessibility
// spec's accessible-name query still matches.
//
// Motion: the run happens once on mount and stops — it never replays or
// loops. Under `prefers-reduced-motion` no timers run; globals.css shows
// the finished sentence at once with a calm, non-blinking cursor.

import { useEffect, useMemo, useState } from "react";

interface HeroTitleProps {
  /** The full sentence to reveal. Also the accessible name of the <h1>. */
  text: string;
  className?: string;
}

/** Average per-character typing speed — tuned so the ~24-character hero
 *  sentence lands in the 2–3s band the design calls for. */
const PER_CHAR_MS = 105;

/**
 * Split into user-perceived characters. `Intl.Segmenter` keeps Persian
 * grapheme clusters (base letter + combining marks) intact; when it is
 * unavailable (older engines) we fall back to code-point iteration,
 * which is still safe for Persian because no sequence here combines
 * across code points.
 */
function toGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("fa", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

export function HeroTitle({ text, className }: HeroTitleProps) {
  const graphemes = useMemo(() => toGraphemes(text), [text]);
  const total = graphemes.length;
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Reduced motion — skip the timers entirely and settle the full
    // sentence at once. (globals.css also forces the glyphs visible so
    // there is not even a one-frame empty heading.)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(total);
      return;
    }

    let revealed = 0;
    const id = window.setInterval(() => {
      revealed += 1;
      setCount(revealed);
      if (revealed >= total) window.clearInterval(id);
    }, PER_CHAR_MS);
    return () => window.clearInterval(id);
  }, [total]);

  const done = count >= total;

  return (
    <h1 className={className} aria-label={text}>
      {graphemes.map((char, i) => (
        <span
          key={i}
          className="hero-type-char"
          aria-hidden="true"
          style={{ opacity: i < count ? 1 : 0 }}
        >
          {char}
        </span>
      ))}
      {/* Decorative only — never announced. Appears once typing completes. */}
      <span
        className={done ? "hero-type-cursor is-on" : "hero-type-cursor"}
        aria-hidden="true"
      >
        |
      </span>
    </h1>
  );
}
