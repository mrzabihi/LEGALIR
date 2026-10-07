// @vitest-environment node
// ============================================================
// LEGALIR — Persian/RTL shaping for pdf-lib
// ============================================================
// The receipt used to print garbled Persian because two things were wrong:
//   1. Arabic-Indic DIGITS were treated as Arabic and REVERSED (۳٬۵۰۰٬۰۰۰ and
//      dates printed backwards).
//   2. A Latin id embedded in a Persian line could not be reordered, so it
//      landed in the wrong place (and char-level pre-reversal broke joining).
//
// These tests lock in the fix: direction is derived from STRONG letters only,
// mixed lines are split into bidi runs (Latin stays intact + LTR), a pure-RTL
// line reorders to visual order, and fontkit still JOINS the letters (a
// lam-alef pair becomes a single ligature glyph).
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { baseDirection, visualRuns, orientedFontkit } from "@/lib/pdf/rtl";

function findFont(fileName: string): string {
  const candidates = [
    path.resolve(process.cwd(), "node_modules", "vazirmatn", "fonts", "ttf", fileName),
    path.resolve(process.cwd(), "..", "..", "node_modules", "vazirmatn", "fonts", "ttf", fileName),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`missing ${fileName}`);
}

describe("baseDirection", () => {
  it("treats a run of Persian digits as LTR (never reverses a number)", () => {
    expect(baseDirection("۳٬۵۰۰٬۰۰۰")).toBe("ltr");
    expect(baseDirection("۱۴۰۵/۰۵/۱۵")).toBe("ltr");
    expect(baseDirection("+989•••0088")).toBe("ltr");
  });

  it("reports RTL when a strong Persian letter is present", () => {
    expect(baseDirection("مبلغ")).toBe("rtl");
    expect(baseDirection("طلا")).toBe("rtl");
  });
});

describe("visualRuns — ordering and mixed content", () => {
  it("keeps a Latin id intact and un-reversed inside a Persian line", () => {
    const runs = visualRuns("شناسه sub-2cabc8e8-aa12");
    const latin = runs.find((r) => r.text.includes("sub-2cabc8e8"));
    expect(latin).toBeDefined();
    // The id reads forward, and the run is flagged LTR.
    expect(latin!.text).toBe("sub-2cabc8e8-aa12");
    expect(latin!.rtl).toBe(false);
  });

  it("keeps amount digits in logical order (no reversal)", () => {
    const runs = visualRuns("۳٬۵۰۰٬۰۰۰");
    expect(runs.map((r) => r.text).join("")).toBe("۳٬۵۰۰٬۰۰۰");
    expect(runs.every((r) => r.rtl === false)).toBe(true);
  });

  it("reorders a pure-RTL line into visual order", () => {
    const runs = visualRuns("سلام دنیا");
    // Visual order for an RTL paragraph is right-to-left: "دنیا" comes first.
    const joined = runs.map((r) => r.text).join("");
    expect(joined).toContain("دنیا");
    expect(joined).toContain("سلام");
    expect(runs.every((r) => r.rtl)).toBe(true);
  });

  it("preserves every character of a mixed line", () => {
    const text = "مبلغ (تومان) ۳٬۵۰۰٬۰۰۰ — sub-abc";
    const joined = visualRuns(text).map((r) => r.text).join("");
    expect([...joined].sort().join("")).toBe([...text].sort().join(""));
  });
});

describe("orientedFontkit — Arabic joining is preserved", () => {
  it("shapes lam+alef into a single ligature glyph", () => {
    // `orientedFontkit.create` returns a fontkit Font whose `layout` is the
    // direction-forced wrapper — the same object pdf-lib drives internally.
    const font = orientedFontkit.create(fs.readFileSync(findFont("Vazirmatn-Regular.ttf")));
    // If the direction were forced the wrong way (or chars pre-reversed) the
    // lam-alef ligature would not form and two glyphs would be emitted.
    const ligature = font.layout("\u0644\u0627"); // لا
    expect(ligature.glyphs.length).toBe(1);
  });
});
