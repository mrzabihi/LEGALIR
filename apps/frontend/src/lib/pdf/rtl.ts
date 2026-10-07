// ============================================================
// LEGALIR — Persian/RTL text shaping for pdf-lib (server-only)
// ============================================================
// pdf-lib's `drawText` falls back to fontkit's OWN layout, which detects a
// script from the string and reverses right-to-left runs. That is correct for
// a run of pure Persian letters, but it has two failure modes that together
// produce the garbled receipts we saw:
//
//   1. A run made only of Persian/Arabic-INDIC DIGITS is classified as Arabic
//      (script "arab") and is therefore reversed — so `۳٬۵۰۰٬۰۰۰`, `۱۴۰۵/۰۱/۱۵`
//      and a masked phone print backwards.
//   2. A line that MIXES Persian with a Latin id or a phone number cannot be
//      reordered by fontkit at all, so the embedded Latin token lands in the
//      wrong place.
//
// The old renderer "fixed" this by reversing characters itself, which reverses
// the letter order *before* shaping — the letters then join into the wrong
// forms and the text is unreadable.
//
// This module fixes it correctly, in two coordinated steps:
//   • `visualRuns()` runs the Unicode Bidirectional Algorithm (bidi-js) and
//     splits a line into directional runs returned in VISUAL (left-to-right)
//     order, each run keeping its logical character order.
//   • `orientedFontkit` forces the direction of every fontkit `layout()` call
//     from the run's strong characters, so digits/ASCII are never reversed.
// Each run is then drawn left-to-right at its visual position: fontkit still
// connects the Persian letters (shaping), while we place the runs in the
// correct visual order and keep numbers/ids intact.
// ============================================================

import fontkit from "@pdf-lib/fontkit";
import bidiFactory from "bidi-js";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";

const bidi = bidiFactory();

/**
 * The base paragraph direction of a string, taken from its STRONG characters
 * only. Digits are deliberately ignored: a run of digits is a number and must
 * read left-to-right even when it sits inside a Persian line.
 */
export function baseDirection(text: string): "rtl" | "ltr" {
  for (const ch of text) {
    const t = bidi.getBidiCharTypeName(ch);
    if (t === "R" || t === "AL") return "rtl";
  }
  return "ltr";
}

export interface VisualRun {
  /** The run's characters, in logical order (so fontkit shapes them). */
  text: string;
  /** True when the run reads right-to-left (its bidi level is odd). */
  rtl: boolean;
}

/**
 * Split a logical string into directional runs, returned in visual order
 * (Unicode Bidirectional Algorithm rules X/§3.4 + reordering rule L2). Runs
 * keep their logical character order so fontkit can join the letters.
 */
export function visualRuns(text: string): VisualRun[] {
  if (!text) return [];
  const { levels } = bidi.getEmbeddingLevels(text, baseDirection(text));
  const lv = Array.from(levels);

  // Contiguous runs of equal embedding level, in logical order.
  const runs: { text: string; level: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const level = lv[i]!;
    let j = i + 1;
    while (j < text.length && lv[j] === level) j++;
    runs.push({ text: text.slice(i, j), level });
    i = j;
  }

  // Rule L2: from the highest level down to the lowest odd level, reverse each
  // maximal contiguous sequence whose level is >= the current level.
  let minOdd = Infinity;
  for (const l of lv) if (l % 2 === 1 && l < minOdd) minOdd = l;
  if (minOdd !== Infinity) {
    const maxLevel = lv.length ? Math.max(...lv) : 0;
    for (let level = maxLevel; level >= minOdd; level--) {
      let a = 0;
      while (a < runs.length) {
        if (runs[a]!.level >= level) {
          let b = a;
          while (b < runs.length && runs[b]!.level >= level) b++;
          runs.splice(a, b - a, ...runs.slice(a, b).reverse());
          a = b;
        } else {
          a++;
        }
      }
    }
  }

  return runs.map((r) => ({ text: r.text, rtl: r.level % 2 === 1 }));
}

/** The exact width of a string at a size, summed over its visual runs. */
export function measureRtl(font: PDFFont, text: string, size: number): number {
  return visualRuns(text).reduce((w, run) => w + font.widthOfTextAtSize(run.text, size), 0);
}

export interface DrawRtlOptions {
  /** Baseline Y (pdf-lib draws from the baseline up). */
  y: number;
  size: number;
  color: RGB;
  /** Right edge to align the text against. When set, text is right-aligned. */
  right?: number;
  /** Left start X — used only when `right` is not given. */
  x?: number;
}

/**
 * Draw one line of (possibly mixed) text with correct bidi ordering and
 * shaping, either right-aligned to `right` or left-aligned at `x`.
 */
export function drawRtl(
  page: PDFPage,
  font: PDFFont,
  text: string,
  opts: DrawRtlOptions
): void {
  const runs = visualRuns(text);
  const widths = runs.map((r) => font.widthOfTextAtSize(r.text, opts.size));
  const total = widths.reduce((a, b) => a + b, 0);
  let pen = opts.right !== undefined ? opts.right - total : (opts.x ?? 0);
  runs.forEach((run, k) => {
    if (run.text) {
      page.drawText(run.text, { x: pen, y: opts.y, size: opts.size, font, color: opts.color });
    }
    pen += widths[k]!;
  });
}

/**
 * `@pdf-lib/fontkit` wrapped so every `layout()` call is given an explicit
 * direction derived from the text's strong characters. Without this, fontkit
 * reverses runs of Persian digits (classified as Arabic) and numbers print
 * backwards.
 */
export const orientedFontkit: typeof fontkit = Object.assign(Object.create(fontkit) as typeof fontkit, {
  create(data: ArrayBuffer | Uint8Array, postscriptName?: string) {
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    const font = fontkit.create(buffer, postscriptName);
    // At runtime fontkit's `layout` accepts (string, features, script, language,
    // direction) and pdf-lib relies on the direction slot, but the shipped
    // `.d.ts` only declares the first two arguments. Cast to reach it.
    const layout = font.layout.bind(font) as (
      text: string,
      features?: unknown,
      script?: string,
      language?: string,
      direction?: "ltr" | "rtl"
    ) => ReturnType<typeof font.layout>;
    font.layout = ((text: string, features?: unknown) =>
      layout(
        text,
        features,
        undefined,
        undefined,
        baseDirection(typeof text === "string" ? text : "")
      )) as typeof font.layout;
    return font;
  },
});
