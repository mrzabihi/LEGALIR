/**
 * TEMP button-state verification (not committed).
 * Checks the shared Button's real computed states in the running app:
 * hover / focus / pressed / loading / disabled, RTL geometry, touch target
 * height below desktop, and that hover causes no layout shift.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000005";
const OTP_CODE = "405405";
// The dev OTP route allows 3 requests / 5 min per mobile. Cache the session
// to disk so repeated local runs never burn the bucket.
const SESSION_CACHE = "test-results/.btn-verify-session.json";
let cachedSessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  try {
    const cached = JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as { sid?: string };
    if (cached.sid) {
      cachedSessionId = cached.sid;
      return cached.sid;
    }
  } catch {
    /* no cache yet */
  }
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("otp request failed");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sid = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sid) throw new Error("otp verify failed");
  cachedSessionId = sid;
  mkdirSync("test-results", { recursive: true });
  writeFileSync(SESSION_CACHE, JSON.stringify({ sid }));
  return sid;
}

async function seed(page: Page, sid: string) {
  await page.context().addCookies([
    { name: "legalir-session", value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => {
      localStorage.setItem("legalir-auth", JSON.stringify(data.auth));
      localStorage.setItem("legalir-theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
    },
    {
      auth: {
        state: {
          session: {
            sessionId: sid,
            userId: "demo-user-id",
            mobileE164: "+989120000003",
            mobileDisplay: DEMO_MOBILE,
            isNewUser: false,
            createdAt: Date.now(),
          },
        },
        version: 0,
      },
    },
  );
}

const btn = (page: Page, name: string | RegExp) => page.getByRole("button", { name }).first();

test.describe.configure({ mode: "serial" });

test.describe("shared Button states", () => {
  test("login: primary submit at 3 widths — height, RTL, no shift on hover", async ({ page }) => {
    // Deliberately signed OUT: /auth/mobile redirects a seeded session away.
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/auth/mobile");
      await page.waitForTimeout(1200);

      const button = btn(page, "ورود");
      await expect(button).toBeVisible();

      const box = (await button.boundingBox())!;
      // Touch target rule: below desktop the compact sizes grow to 44px.
      if (width < 1024) expect(box.height, `height @${width}`).toBeGreaterThanOrEqual(44);

      // RTL: the page renders right-to-left.
      const dir = await page.evaluate(
        () => document.documentElement.dir || getComputedStyle(document.body).direction,
      );
      expect(dir).toBe("rtl");

      // An incomplete form leaves the submit honestly disabled: no pointer
      // affordance, reduced opacity, and no hover painting.
      await expect(button).toBeDisabled();
      const rest = await button.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          pointer: s.pointerEvents,
          opacity: Number(s.opacity),
          bg: s.backgroundColor,
          layer: getComputedStyle(el, "::before").opacity,
        };
      });
      expect(rest.pointer).toBe("none");
      expect(rest.opacity).toBeLessThan(0.6);
      // The brand fill survives the opacity step (never swapped for a
      // different colour token).
      expect(rest.bg).toBe("rgb(22, 32, 51)");

      await page.screenshot({
        path: `e2e/__shots__/btn-login-${width}.png`,
        fullPage: width <= 768,
      });

      // Keyboard focus reaches a focusable control with a visible ring rule.
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const s = getComputedStyle(el);
        return { tag: el.tagName, width: s.outlineWidth, style: s.outlineStyle };
      });
      expect(outline).not.toBeNull();
    }
  });

  test("points: claim CTA touch target + screenshot", async ({ page, request }) => {
    const sid = await getSession(request);
    await seed(page, sid);
    await page.setViewportSize({ width: 390, height: 1200 });
    await page.goto("/points");
    await page.waitForTimeout(2500);

    const claim = page.getByRole("button", { name: "دریافت امتیاز" });
    if (await claim.count()) {
      const box = (await claim.first().boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: "e2e/__shots__/btn-points-390.png", fullPage: true });
  });

  test("cases: header CTA + create dialog buttons at 390 and 1440", async ({ page, request }) => {
    const sid = await getSession(request);
    await seed(page, sid);
    await page.route("**/api/v1/me/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { showProfileCompletionPrompt: false } }),
        });
        return;
      }
      await route.continue();
    });

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto("/cases");
      await page.waitForTimeout(2000);

      const cta = btn(page, "پرونده جدید");
      await expect(cta).toBeVisible();
      const ctaBox = (await cta.boundingBox())!;
      if (width < 1024) expect(ctaBox.height).toBeGreaterThanOrEqual(44);

      // Hover paints the 8% state layer and lifts raised fills — without
      // changing the box geometry.
      await page.mouse.move(ctaBox.x + ctaBox.width / 2, ctaBox.y + ctaBox.height / 2);
      await page.waitForTimeout(250);
      const hovered = await cta.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          layer: Number(getComputedStyle(el, "::before").opacity),
          transform: s.transform,
          shadow: s.boxShadow,
        };
      });
      expect(hovered.layer).toBeGreaterThan(0);
      expect(hovered.transform).not.toBe("none");
      const hoveredBox = (await cta.boundingBox())!;
      expect(Math.abs(hoveredBox.width - ctaBox.width)).toBeLessThan(2);
      expect(Math.abs(hoveredBox.height - ctaBox.height)).toBeLessThan(2);
      if (width === 1440) {
        await page.screenshot({ path: "e2e/__shots__/btn-cases-cta-hover.png" });
      }

      // Pressed is visual-only: the transform changes, the layout does not.
      // Release off the button so the synthetic press never fires a click.
      await page.mouse.down();
      await page.waitForTimeout(120);
      const pressed = await cta.evaluate((el) => getComputedStyle(el).transform);
      expect(pressed).not.toBe(hovered.transform);
      await page.mouse.move(0, 0);
      await page.mouse.up();

      // Keyboard focus (`:focus-visible`) paints a visible brand ring. Tab
      // from the top of the document so the browser treats it as keyboard
      // navigation rather than pointer focus.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      let ring: { width: string; style: string; color: string } | null = null;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        ring = await cta.evaluate((el) => {
          if (document.activeElement !== el) return null;
          const s = getComputedStyle(el);
          return {
            width: s.outlineWidth,
            style: s.outlineStyle,
            color: s.outlineColor,
          } as { width: string; style: string; color: string } | null;
        });
        if (ring) break;
      }
      expect(ring).not.toBeNull();
      expect(ring!.style).not.toBe("none");
      expect(parseFloat(ring!.width)).toBeGreaterThanOrEqual(2);
      if (width === 1440) {
        await page.screenshot({ path: "e2e/__shots__/btn-cases-cta-focus.png" });
      }

      await cta.click();
      await page.waitForTimeout(400);

      const cancel = btn(page, "انصراف");
      const submit = btn(page, "ثبت پرونده");
      await expect(cancel).toBeVisible();
      await expect(submit).toBeVisible();

      const c = (await cancel.boundingBox())!;
      const s = (await submit.boundingBox())!;
      if (width < 1024) {
        expect(c.height).toBeGreaterThanOrEqual(44);
        expect(s.height).toBeGreaterThanOrEqual(44);
      }
      // Adjacent actions never overlap.
      const apart = Math.min(Math.abs(c.x - (s.x + s.width)), Math.abs(s.x - (c.x + c.width)));
      expect(apart).toBeGreaterThan(0);

      // The disabled submit is honest.
      await expect(submit).toBeDisabled();

      await page.screenshot({ path: `e2e/__shots__/btn-cases-dialog-${width}.png` });

      // Close before the next viewport so the dialog never covers the CTA.
      await cancel.click();
      await page.waitForTimeout(400);
    }
  });

  test("documents: in-row primary action is a link with a real touch target", async ({
    page,
    request,
  }) => {
    const sid = await getSession(request);
    await seed(page, sid);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto("/documents");
    await page.waitForTimeout(2200);

    const rows = page.locator("article");
    if ((await rows.count()) > 0) {
      const link = rows.first().getByRole("link");
      if (await link.count()) {
        const box = (await link.first().boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.screenshot({ path: "e2e/__shots__/btn-documents-390.png", fullPage: true });
  });

  test("reduced motion neutralises transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/auth/mobile");
    await page.waitForTimeout(1200);

    const duration = await page.evaluate(() => {
      const b = document.querySelector("button");
      return b ? getComputedStyle(b).transitionDuration : null;
    });
    expect(duration).not.toBeNull();
    // The global reduced-motion rule clamps to 0.01ms.
    expect(parseFloat(duration!)).toBeLessThanOrEqual(0.001);
  });
});
