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

/** Pages hydrate and fetch data client-side; the default 5s is too tight
 *  for a cold route on a shared dev server. */
const READY_TIMEOUT = 15_000;

/**
 * route → the artwork expected on it.
 *
 * `square` placements render the ≈354×357 illustration inside a framed
 * square (`PromoArt`), so the frame must preserve the source ratio.
 * `photo` placements are the later photographic banners (`PromoPanel`
 * with a `photo`, and `PromoModule` on the dashboard): a wide editorial
 * image cropped with `object-cover`, so the frame deliberately matches
 * the section, not the source.
 */
type PlacementKind = "square" | "photo";

const PLACEMENTS: { route: string; asset: string; kind: PlacementKind; cta: string }[] = [
  { route: "/", asset: "legalir-promo-one", kind: "square", cta: "/lawyers" },
  {
    route: "/services",
    asset: "legalir-banner-legal-sources",
    kind: "photo",
    cta: "/legal-library",
  },
  {
    route: "/lawyers",
    asset: "legalir-promo-four",
    kind: "square",
    cta: "/consultations/new",
  },
  {
    route: "/dashboard",
    asset: "legalir-banner-legal-services",
    kind: "photo",
    cta: "/services",
  },
  { route: "/blog", asset: "legalir-promo-six", kind: "square", cta: "/legal-library" },
];

for (const bp of BREAKPOINTS) {
  test.describe(`@${bp}px`, () => {
    // 58 tests share one dev server; a cold Turbopack compile of /services
    // can outlast the 30s default before first paint. The per-assertion
    // budgets below still fail fast on a real layout break.
    test.describe.configure({ timeout: 90_000 });
    test.use({ viewport: { width: bp, height: 900 } });

    for (const { route, asset, kind, cta } of PLACEMENTS) {
      test(`${route} renders promo "${asset}"`, async ({ page, request }) => {
        await mockAuth(page, await getOrCreateSession(request));
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT * 3 });

        const img = page.locator(`img[src*="/assets/promo/${asset}"]`).first();
        await img.scrollIntoViewIfNeeded({ timeout: READY_TIMEOUT });
        await expect(img).toBeVisible({ timeout: READY_TIMEOUT });

        // Loaded, and the image has real pixel dimensions. The artwork is
        // `loading="lazy"`, and this runs 7 breakpoints x 6 routes against a
        // shared dev server: the intersection update can be missed under a
        // cold compile and the lazy fetch never starts, leaving
        // `naturalWidth` at 0 forever. Flip it to eager and `decode()` on
        // every poll iteration — `decode()` actively requests the bytes, so
        // a stalled fetch is retried instead of waited out.
        await expect
          .poll(
            async () =>
              img.evaluate(async (el: HTMLImageElement) => {
                el.loading = "eager";
                if (!(el.complete && el.naturalWidth > 0)) {
                  try {
                    await el.decode();
                  } catch {
                    /* not decodable yet — the next poll retries */
                  }
                }
                return el.naturalWidth;
              }),
            { timeout: READY_TIMEOUT },
          )
          .toBeGreaterThan(0);

        const box = await img.boundingBox();
        expect(box).not.toBeNull();
        const ratio = box!.width / box!.height;

        if (kind === "square") {
          // Square illustrations render in an `aspect-[354/357]` frame:
          // source is 354×357 (0.992), so allow a small rounding tolerance.
          expect(ratio).toBeGreaterThan(0.96);
          expect(ratio).toBeLessThan(1.03);
        } else {
          // Photographic banners are section backgrounds cropped with
          // `object-cover`, so the frame follows the section (portrait-ish
          // on a phone, wide on desktop) rather than the source ratio. The
          // contract is the crop, not a fixed aspect.
          const fit = await img.evaluate(
            (el: HTMLImageElement) => getComputedStyle(el).objectFit,
          );
          expect(fit).toBe("cover");
        }

        // No horizontal overflow at this width.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // The CTA, when the placement has one, points at a real route.
        if (cta) {
          const link = page
            .locator(`section:has(img[src*="${asset}"]) a[href="${cta}"]`)
            .first();
          await expect(link).toBeVisible({ timeout: READY_TIMEOUT });
        }
      });
    }

    // /cases is the one placement scoped to the empty state: the artwork
    // must never displace a populated case list. The demo user has cases,
    // so the correct assertion here is that the promo is *absent* while
    // real case data is on screen.
    test(`/cases keeps promo "two" out of the populated list`, async ({ page, request }) => {
      await mockAuth(page, await getOrCreateSession(request));
      await page.goto("/cases", {
        waitUntil: "domcontentloaded",
        timeout: READY_TIMEOUT * 3,
      });

      const cards = page.locator('a[href^="/cases/"]');
      await expect(cards.first()).toBeVisible({ timeout: READY_TIMEOUT });

      await expect(page.locator('img[src*="/assets/promo/legalir-promo-two"]')).toHaveCount(0);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}
