import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { OG_IMAGE } from "@/lib/social-card";

// `og:image` was absent from every page for months and nothing noticed: tsc is
// happy, lint is happy, the pages render. Only a crawler or a real share
// preview shows the gap. So the descriptor is pinned here and the emitted tag
// is pinned end-to-end in `e2e/social-card.spec.ts`.
//
// This deliberately does NOT import `app/layout.tsx`. That module
// side-effect-imports `globals.css`, and a unit test importing it would make a
// stylesheet change look observable to the unit suite — the exact
// under-selection lie `scripts/affected.mjs --selftest` exists to prevent.

describe("social share card descriptor", () => {
  it("declares a card at the 1.91:1 size crawlers expect", () => {
    expect(OG_IMAGE.width).toBe(1200);
    expect(OG_IMAGE.height).toBe(630);
    expect(OG_IMAGE.url).toBe("/assets/social/legalir-og.png");
  });

  it("names the brand in its alt text", () => {
    // Crawlers treat a missing alt as decorative; this card is the brand.
    expect(OG_IMAGE.alt).toContain("لیگالیر");
    expect(OG_IMAGE.alt.length).toBeGreaterThan(10);
  });

  it("points at a real PNG whose pixels match the declared dimensions", () => {
    // Anchors the metadata to the bytes: a renamed card, or one regenerated at
    // a different size, fails here instead of in a crawler's preview.
    const file = path.resolve(__dirname, "../../../public", OG_IMAGE.url.replace(/^\//, ""));
    expect(fs.existsSync(file), `${file} is missing — run generate-og-image.mjs`).toBe(true);

    const png = fs.readFileSync(file);
    // PNG signature, then IHDR is always the first chunk: width at byte 16,
    // height at byte 20 (both big-endian uint32).
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.readUInt32BE(16)).toBe(OG_IMAGE.width);
    expect(png.readUInt32BE(20)).toBe(OG_IMAGE.height);
  });
});
