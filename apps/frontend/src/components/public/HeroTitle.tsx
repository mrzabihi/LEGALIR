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
// mode.
//
// Safety contract (this heading can never end up blank):
//   • The full sentence is server-rendered inside `sr-only`, which is the
//     heading's accessible name from the first byte — assistive tech never
//     depends on the timer.
//   • `.hero-type-char` is hidden by CSS, and `@media (scripting: none)`
//     shows every glyph at once, so a JS-less render reads the whole
//     sentence (see globals.css).
//   • `prefers-reduced-motion: reduce` skips the timers entirely and
//     settles the finished sentence on the first client frame.
//   • A failed chunk leaves the CSS `scripting: none` fallback in charge,
//     never a half-typed heading.
//
// Motion: the run happens once on mount and stops — it never replays or
// loops.

import { useEffect, useMemo, useState } from "react";

interface HeroTitleProps {
  /** The full sentence to reveal. Also the accessible name of the <h1>. */
  text: string;
  className?: string;
  /** Optional delay (ms) before the first glyph lands, for staggering. */
  delayMs?: number;
}

/** Average per-character typing speed — tuned so the 25-character hero
 *  sentence lands just under two seconds: fast enough to read as a flourish,
 *  slow enough that every word is legible as it arrives. */
const PER_CHAR_MS = 72;

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

export function HeroTitle({ text, className, delayMs = 0 }: HeroTitleProps) {
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
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        revealed += 1;
        setCount(revealed);
        if (revealed >= total) window.clearInterval(interval);
      }, PER_CHAR_MS);
    }, delayMs);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [total, delayMs]);

  const done = count >= total;

  return (
    <h1 className={className}>
      {/* The accessible name, present from the first byte. */}
      <span className="sr-only">{text}</span>

      {/* Visual layer — decorative, never announced. */}
      <span aria-hidden="true">
        {graphemes.map((char, i) => (
          <span
            key={i}
            className="hero-type-char"
            style={{ opacity: i < count ? 1 : 0 }}
          >
            {char}
            {/* The caret rides inside the FINAL glyph. As a sibling inline
                block it was a legal line-break opportunity, and on a 390px
                phone it wrapped onto its own line 316px from the end of the
                text. Nested here it can only ever sit where typing stopped,
                and it appears only once the sentence is complete. */}
            {i === total - 1 && (
              <span className={done ? "hero-type-cursor is-on" : "hero-type-cursor"}>
                |
              </span>
            )}
          </span>
        ))}
      </span>
    </h1>
  );
}
