/**
 * Public landing — visual and motion contract.
 *
 * These assertions guard the parts of the landing polish that live in CSS
 * and GSAP rather than in React, so a future refactor cannot quietly drop
 * them. Each one corresponds to something a user can actually perceive:
 *
 *   • the motion island boots (`html.ln-reveal-ready`) and a marker draws
 *   • card radius resolves to a token (20px), never a literal
 *   • hover lifts via the independent `translate` property + shadow
 *   • `.landing-glass` is translucent AND has a backdrop-filter
 *   • geometry never gets guillotined by the parallax drift
 *   • keyboard focus is visible and the CTA keeps its 44px target
 *   • a #hash jump lands below the sticky header
 *   • reduced motion paints everything and never arms the reveal
 *   • 390px: geometry hidden, no horizontal overflow, marker draws
 *
 * Run: npx playwright test e2e/landing-polish.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";

/**
 * Load the landing page and wait until it has actually settled.
 *
 * This replaces `waitUntil: "networkidle"`, which cost ~1.5s of network
 * silence per navigation *and* hid a real bug: the page grows ~750px as
 * the chapter images decode, so anything that measures a position before
 * that growth lands in the wrong place. Waiting on what actually moves the
 * layout — fonts, a stable document height, then the GSAP island — is both
 * faster and stricter than a network-quiet heuristic.
 */
async function gotoLanding(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.evaluate(async () => {
    // Fonts are the last thing that can shift text metrics, and they are
    // always requested — so this settles quickly and deterministically.
    await document.fonts.ready;

    // Images are deliberately NOT awaited. The below-the-fold plates are
    // lazy, and an off-screen lazy image never fires `load` at all, so
    // waiting on them blocks until the test times out. What measurement
    // actually needs is that the document has stopped changing height, so
    // sample it until it holds still for two frames, with a hard bound.
    await new Promise<void>((resolve) => {
      let last = -1;
      let stable = 0;
      let frames = 0;
      const tick = () => {
        const h = document.documentElement.scrollHeight;
        stable = h === last ? stable + 1 : 0;
        last = h;
        if (stable >= 2 || ++frames > 90) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  // The island adds this only after GSAP + ScrollTrigger register.
  await expect(page.locator("html")).toHaveClass(/ln-reveal-ready/, {
    timeout: 15_000,
  });
}

test.describe("landing polish — interaction layer", () => {
  // These assertions are about MOTION, so the browser must not be in
  // reduced-motion mode. Playwright defaults to `no-override`, which
  // inherits the host OS: with Windows animation effects off, Chromium
  // reports `reduce`, and the reduced-motion block in globals.css forces
  // `translate: none !important` on every hover — the lift test then fails
  // on a machine setting rather than on a regression.
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("reveal arms, marker draws, tokens resolve", async ({ page }) => {
    await gotoLanding(page);

    // First marker (hero headline) must complete its draw.
    const highlight = page.locator("[data-ln-highlight]").first();
    await expect(highlight).toHaveClass(/landing-highlight--draw/);
    await expect(highlight).toHaveClass(/is-drawn/, { timeout: 10_000 });

    // Radius must come from the token scale (20px = --ln-r-lg).
    const card = page.locator(".landing-card").first();
    await expect(card).toBeVisible();
    await expect
      .poll(async () => card.evaluate((el) => getComputedStyle(el).borderRadius))
      .toMatch(/^20px/);
  });

  /* The parallax drifts the whole geometry layer up by 7% of its own
     height. If a shape started too close to the section's top edge, that
     drift would push it past `overflow: hidden` and leave a straight
     horizontal cut where the shape should curve — the exact artifact the
     geometry component exists to avoid. This asserts each shape's resting
     headroom exceeds the worst-case drift. */
  test("geometry keeps headroom for the parallax drift", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoLanding(page);

    // `[data-ln-depth]` tweens `yPercent: 0 -> -7`, and `yPercent` is
    // relative to the element's OWN height — so the layer can rise by at
    // most 7% of its height. Asserting the resting gap against that bound
    // is a timing-free proof: no scroll, no scrub to settle, no flake.
    const layers = page.locator(".landing-geometry");
    const count = await layers.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const layer = layers.nth(i);
      const { headroom, drift } = await layer.evaluate((el) => {
        const child = el.firstElementChild;
        if (!child) return { headroom: Number.POSITIVE_INFINITY, drift: 0 };
        return {
          headroom: child.getBoundingClientRect().top - el.getBoundingClientRect().top,
          drift: el.clientHeight * 0.07,
        };
      });
      expect(headroom).toBeGreaterThanOrEqual(drift);
    }
  });

  test("card hover lifts with translate + shadow", async ({ page }) => {
    await gotoLanding(page);

    const card = page.locator("a.landing-card").first();
    await expect(card).toBeVisible();

    // Driving a real pointer over this card is not reliably reproducible:
    // the page runs its own smooth scroller, the lazy plates keep growing
    // the document mid-test, and every retry can slide the card out from
    // under the pointer again. So assert the CONTRACT instead of a
    // snapshot of one lucky frame: the hover rule must exist, target the
    // card, and declare a lift plus an elevation, and it must be gated on
    // a device that can actually hover.
    const contract = await page.evaluate(() => {
      const find = (rules: CSSRuleList): CSSStyleDeclaration[] => {
        const found: CSSStyleDeclaration[] = [];
        for (const rule of Array.from(rules)) {
          const r = rule as CSSStyleRule & {
            cssRules?: CSSRuleList;
            conditionText?: string;
          };
          // A group rule (media/supports) carries children; a style rule
          // has a selector. Both are checked, because modern Chrome exposes
          // an always-present — and often empty — `cssRules` on style rules
          // for nested CSS, so testing truthiness alone skips every rule.
          if (r.cssRules && r.cssRules.length > 0) {
            // `globals.css` also declares `.landing-card:hover` inside
            // `@media (prefers-reduced-motion: reduce)`, to reset the lift to
            // `none`. That rule is the motion-OFF variant of the same
            // selector, so including it would assert the opposite of the
            // contract being tested. Judge only the motion-on rules.
            if (!r.conditionText?.includes("prefers-reduced-motion")) {
              found.push(...find(r.cssRules));
            }
          }
          if (
            r.selectorText?.includes("landing-card") &&
            r.selectorText.includes(":hover") &&
            (r.style.translate || r.style.boxShadow)
          ) {
            found.push(r.style);
          }
        }
        return found;
      };

      const rules = Array.from(document.styleSheets).flatMap((sheet) => {
        try {
          return sheet.cssRules.length ? find(sheet.cssRules) : [];
        } catch {
          return [];
        }
      });

      return {
        hoverCapable: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
        rules: rules.map((s) => ({
          translate: s.getPropertyValue("translate").trim(),
          shadow: s.getPropertyValue("box-shadow").trim(),
        })),
      };
    });

    expect(contract.hoverCapable).toBe(true);
    expect(contract.rules.length).toBeGreaterThan(0);
    // At least one hover rule must carry the lift and the elevation. It is
    // not "every rule", because the stylesheet also ships the deliberate
    // reduced-motion reset for the same selector.
    expect(
      contract.rules.some((r) => /var\(--ln-lift\)/.test(r.translate))
    ).toBe(true);
    expect(
      contract.rules.some((r) => r.shadow.includes("--ln-shadow-2"))
    ).toBe(true);
  });

  test("glass surfaces are translucent and blurred", async ({ page }) => {
    await gotoLanding(page);

    const glass = page.locator(".landing-glass").first();
    await expect(glass).toBeVisible();

    const style = await glass.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        backdrop:
          s.backdropFilter ||
          (s as unknown as { webkitBackdropFilter?: string })
            .webkitBackdropFilter ||
          "",
      };
    });

    // rgba(...) with alpha < 1 — i.e. genuinely see-through.
    expect(style.bg).toMatch(/^rgba\(/);
    expect(style.backdrop).toMatch(/blur/);
  });

  test("keyboard focus is visible and the CTA is reachable", async ({ page }) => {
    await gotoLanding(page);

    const cta = page.getByRole("link", { name: /شروع مشاوره حقوقی/i }).first();
    await cta.scrollIntoViewIfNeeded();
    await cta.focus();

    const outline = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
    });
    expect(outline.style).not.toBe("none");
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
    expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");

    // The touch target the a11y spec requires must survive the lift.
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("anchor jump lands below the sticky header", async ({ page }) => {
    await gotoLanding(page);

    // Inject a real in-page anchor (the shipped page has none) and click
    // it, so the delegated handler is what moves the page.
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "#services-title";
      link.id = "qa-anchor";
      link.textContent = "qa";
      document.body.prepend(link);
    });
    await page.click("#qa-anchor");

    // Lenis eases toward the target over several frames; poll until the
    // heading has settled below the 84px sticky header instead of
    // guessing a duration. A miss is still a failure — it just fails when
    // the scroll stalls rather than when a fixed sleep is too short.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.querySelector("#services-title");
            if (!el) return -1;
            const top = el.getBoundingClientRect().top;
            return top >= 60 && top <= 140 ? top : -1;
          }),
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(60);

    expect(page.url()).toContain("#services-title");
    await page.evaluate(() => {
      document.querySelector("#qa-anchor")?.remove();
    });
  });
});

test.describe("landing polish — reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("everything paints, nothing waits on the reveal", async ({ page }) => {
    // Deliberately NOT `gotoLanding` — the island must never arm under
    // reduced motion, so the helper's readiness wait would never resolve.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // The island bails before arming, so content is visible immediately.
    await expect(page.locator("html")).not.toHaveClass(/ln-reveal-ready/);

    const card = page.locator(".landing-card").first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

    // The stroke is forced fully drawn, never left at 0.
    const offset = await page
      .locator(".landing-highlight__stroke path")
      .first()
      .evaluate((el) => getComputedStyle(el).strokeDashoffset);
    expect(Number.parseFloat(offset)).toBe(0);
  });
});

test.describe("landing polish — mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no overflow, no geometry, marker still draws", async ({ page }) => {
    await gotoLanding(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Geometry is dropped below `tablet`.
    const discs = await page
      .locator(".landing-geometry")
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n).display)
      );
    for (const display of discs) expect(display).toBe("none");

    // The marker is a paint-only effect and survives on phones.
    const highlight = page.locator("[data-ln-highlight]").first();
    await expect(highlight).toHaveClass(/is-drawn/, { timeout: 10_000 });
  });
});

/**
 * The phone layouts the product is expected to hold at, measured on the real
 * page rather than asserted in prose.
 *
 * Two invariants, both of which the mobile redesign exists to protect:
 *
 *   1. No horizontal overflow. A single element poking past the measure turns
 *      the whole page into a sideways scroller, and on a phone that is far
 *      more destructive than any spacing mistake.
 *   2. No illustration owns a whole band. The old page dropped a picture to the
 *      full measure between two blocks of text on almost every chapter, so
 *      scrolling felt like a slideshow of plates. The chapter plates are now
 *      cells inside a composition; the bound below is what keeps them cells.
 *      It is measured against the VIEWPORT, not the section, because "a
 *      picture fills the screen" is the thing a reader actually notices.
 *
 * The hero is excluded from (2) on purpose: the first screen is allowed to be
 * dominated by the commissioned portrait — that is the one place a large image
 * is the point rather than filler.
 */
test.describe("landing polish — phone width sweep", () => {
  // 320 is the narrowest screen the product supports; 430 is a large phone,
  // where a layout that only works at 390 usually breaks.
  const WIDTHS = [320, 360, 390, 430];

  for (const width of WIDTHS) {
    test(`no overflow and no band-filling image at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await gotoLanding(page);

      const report = await page.evaluate(() => {
        const vh = window.innerHeight;
        const hero = document.querySelector(".landing-hero");
        const images = Array.from(
          document.querySelectorAll<HTMLImageElement>("main img")
        )
          // The hero is the deliberate exception, see the block comment above.
          .filter((img) => !hero?.contains(img))
          .map((img) => ({
            src: img.currentSrc.split("/").pop() ?? "",
            screens: +(img.getBoundingClientRect().height / vh).toFixed(2),
          }));
        return {
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          images,
        };
      });

      expect(report.overflow).toBeLessThanOrEqual(1);

      const offenders = report.images.filter((img) => img.screens > 0.5);
      expect(
        offenders,
        `images filling more than half a screen at ${width}px`
      ).toEqual([]);
    });
  }
});
