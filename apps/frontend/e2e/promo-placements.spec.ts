// ============================================================
// Promo placements — responsive verification
// ============================================================
// Verifies the six Legalir promotional images across the seven
// required breakpoints: no distortion, no crop of the square frame,
// no horizontal overflow, and a valid CTA route on every placement.
// ============================================================

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sessionId) throw new Error("Failed to create a demo session");
  cachedSessionId = sessionId;
  return sessionId;
}

/** `/services`, `/dashboard`, `/lawyers` and `/cases` are auth-gated. */
async function mockAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId,
          userId: "demo-user-id",
          mobileE164: "+989120000003",
          mobileDisplay: DEMO_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

const BREAKPOINTS = [320, 360, 390, 430, 768, 1024, 1440];

/** route → the promo art key expected on it */
const PLACEMENTS: { route: string; art: string; cta: string }[] = [
  { route: "/", art: "one", cta: "/lawyers" },
  { route: "/services", art: "three", cta: "/legal-library" },
  { route: "/lawyers", art: "four", cta: "/consultations/new" },
  { route: "/dashboard", art: "five", cta: "/services" },
  { route: "/blog", art: "six", cta: "/legal-library" },
];

for (const bp of BREAKPOINTS) {
  test.describe(`@${bp}px`, () => {
    test.use({ viewport: { width: bp, height: 900 } });

    for (const { route, art, cta } of PLACEMENTS) {
      test(`${route} renders promo "${art}"`, async ({ page, request }) => {
        await mockAuth(page, await getOrCreateSession(request));
        await page.goto(route, { waitUntil: "domcontentloaded" });

        const img = page.locator(`img[src*="/assets/promo/legalir-promo-${art}"]`).first();
        await img.scrollIntoViewIfNeeded();
        await expect(img).toBeVisible();

        // Loaded, and the frame preserves the source aspect ratio.
        await expect
          .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);

        const box = await img.boundingBox();
        expect(box).not.toBeNull();
        const ratio = box!.width / box!.height;
        // Source is 354×357 (0.992). Allow a small tolerance for rounding.
        expect(ratio).toBeGreaterThan(0.96);
        expect(ratio).toBeLessThan(1.03);

        // No horizontal overflow at this width.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // The CTA, when the placement has one, points at a real route.
        if (cta) {
          const link = page
            .locator(`section:has(img[src*="legalir-promo-${art}"]) a[href="${cta}"]`)
            .first();
          await expect(link).toBeVisible();
        }
      });
    }

    // /cases is the one placement scoped to the empty state: the artwork
    // must never displace a populated case list. The demo user has cases,
    // so the correct assertion here is that the promo is *absent* while
    // real case data is on screen.
    test(`/cases keeps promo "two" out of the populated list`, async ({ page, request }) => {
      await mockAuth(page, await getOrCreateSession(request));
      await page.goto("/cases", { waitUntil: "domcontentloaded" });

      const cards = page.locator('a[href^="/cases/"]');
      await expect(cards.first()).toBeVisible();

      await expect(page.locator('img[src*="/assets/promo/legalir-promo-two"]')).toHaveCount(0);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}
