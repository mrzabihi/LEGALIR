import { test, expect } from "@playwright/test";

/**
 * The social share card, asserted where it is actually observable: the HTML a
 * crawler receives and the bytes it would fetch.
 *
 * This is an e2e spec rather than a unit test on purpose. The tag is emitted by
 * Next from the root layout's `metadata`; a component test never runs that
 * pipeline, so a unit test could only assert the constant's shape — exactly the
 * kind of assertion that stays green while `og:image` is missing from the page.
 * Before this file existed, `og:image` was absent from every route and nothing
 * in the repo noticed.
 *
 * Three routes are checked because they are different route groups: a page that
 * exports its own `metadata` (as `/` does) replaces the root `openGraph` object
 * wholesale, so a card declared only on the root still has to survive there.
 */

const CARD_PATH = "/assets/social/legalir-og.png";
const ROUTES = ["/", "/pricing", "/about"] as const;

test.describe("Social share card", () => {
  for (const route of ROUTES) {
    test(`${route} emits og:image and twitter:image pointing at the card`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `GET ${route}`).toBe(200);

      const og = page.locator('meta[property="og:image"]');
      const ogWidth = page.locator('meta[property="og:image:width"]');
      const ogHeight = page.locator('meta[property="og:image:height"]');
      const twitter = page.locator('meta[name="twitter:image"]');

      await expect(og).toHaveCount(1);
      await expect(twitter).toHaveCount(1);

      // Absolute, because a crawler has no page context to resolve a relative
      // path against. `metadataBase` is what makes this so; without it the tag
      // would carry a bare `/assets/...`.
      const ogUrl = await og.getAttribute("content");
      expect(ogUrl).not.toBeNull();
      expect(ogUrl!.startsWith("http")).toBe(true);
      expect(new URL(ogUrl!).pathname).toBe(CARD_PATH);

      // The declared intrinsic size lets a crawler lay the card out before the
      // image arrives. A mismatch against the real pixels is caught by the unit
      // test on the descriptor.
      expect(await ogWidth.getAttribute("content")).toBe("1200");
      expect(await ogHeight.getAttribute("content")).toBe("630");

      // Same asset on both protocols: a divergent twitter:image is the classic
      // silent inconsistency, and nothing else in the suite would see it.
      expect(await twitter.getAttribute("content")).toBe(ogUrl);

      // And the card is actually fetchable at that URL, not merely named.
      const asset = await page.request.get(ogUrl!);
      expect(asset.status()).toBe(200);
      expect(asset.headers()["content-type"]).toContain("image/png");
      const bytes = (await asset.body()).length;
      expect(bytes, "card payload").toBeGreaterThan(20_000);
    });
  }

  test("the card decodes at the declared size", async ({ page }) => {
    // A 200 carrying an HTML error body would satisfy the request assertions
    // above; decoding it proves the bytes are a real PNG of the declared size.
    await page.goto(CARD_PATH, { waitUntil: "domcontentloaded" });
    const natural = await page.evaluate(() => {
      const img = document.querySelector("img");
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    expect(natural, `browser could not decode ${CARD_PATH}`).not.toBeNull();
    expect(natural!.w).toBe(1200);
    expect(natural!.h).toBe(630);
  });
});
