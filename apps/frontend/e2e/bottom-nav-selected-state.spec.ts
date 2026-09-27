/**
 * ============================================================
 * LEGALIR — Bottom navigation selected state E2E
 * ============================================================
 * Guards the refined active treatment:
 *   • the indicator is centred *behind* its icon, not detached above it
 *   • the active item is derived from the real route tree, so a section
 *     stays lit on its child routes and never lights two items at once
 *   • `aria-current="page"` appears on exactly one destination
 *   • the bar survives 320/360/390/430 px without overflow or collision
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 20_000;

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

async function mockAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  const sessionState = {
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
  };
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    sessionState,
  );
}

/** The four section destinations plus the centre action. */
const NAV_LABELS = ["خانه", "خدمات", "ساخت جدید", "پشتیبانی", "تنظیمات"] as const;

const VIEWPORTS = [
  { name: "320", width: 320, height: 640 },
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
] as const;

test.describe("Bottom navigation selected state", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("renders all five destinations with accessible names", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await expect(nav).toBeVisible();
    for (const label of NAV_LABELS) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("the indicator is centred behind its icon, not detached above it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    const active = nav.getByRole("link", { name: "خانه" });

    const geometry = await active.evaluate((link) => {
      const box = link.querySelector("span.relative.flex");
      if (!box) return null;
      const indicator = box.querySelector("span[aria-hidden='true']");
      const icon = box.querySelector("span.relative");
      if (!indicator || !icon) return null;
      const b = box.getBoundingClientRect();
      const i = indicator.getBoundingClientRect();
      const g = icon.getBoundingClientRect();
      return {
        boxTop: b.top,
        boxBottom: b.bottom,
        indicatorCenterX: i.left + i.width / 2,
        indicatorCenterY: i.top + i.height / 2,
        iconCenterX: g.left + g.width / 2,
        iconCenterY: g.top + g.height / 2,
        indicatorWidth: i.width,
        indicatorHeight: i.height,
      };
    });

    expect(geometry).not.toBeNull();
    // Centred on the icon in both axes — the old `top-1` rectangle sat
    // above the icon and left a visible gap.
    expect(Math.abs(geometry!.indicatorCenterX - geometry!.iconCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry!.indicatorCenterY - geometry!.iconCenterY)).toBeLessThanOrEqual(1);
    // The capsule hugs the icon rather than spanning the whole item.
    expect(geometry!.indicatorWidth).toBeLessThanOrEqual(60);
    expect(geometry!.indicatorHeight).toBeLessThanOrEqual(32);
  });

  test("exactly one destination carries aria-current=page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ["/dashboard", "/services", "/support", "/profile"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });
      const nav = page.getByRole("navigation", { name: "منوی پایین" });
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test("a route outside the bar lights nothing, and never the centre action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // /contracts/new is a real nested route under the app shell, but
    // /contracts is not one of the five bottom-nav destinations — the
    // sidebar owns it. Nothing in the bar may claim to be current.
    await page.goto("/contracts/new");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    // The centre action is a verb: it must NOT stay lit on /contracts/new.
    await expect(nav.getByRole("link", { name: "ساخت جدید" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  });

  test("the centre action is lit only on its own route", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/new");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await expect(nav.getByRole("link", { name: "ساخت جدید" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  for (const viewport of VIEWPORTS) {
    test(`no overflow or collision at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      const nav = page.getByRole("navigation", { name: "منوی پایین" });
      const metrics = await nav.evaluate((el) => {
        const doc = document.documentElement;
        const links = Array.from(el.querySelectorAll("a"));
        // The bar is RTL, so DOM order runs right-to-left. Sort by x
        // before measuring gaps, otherwise every gap reads as negative.
        const rects = links
          .map((a) => a.getBoundingClientRect())
          .sort((a, b) => a.left - b.left);
        // Horizontal gaps between adjacent items — a negative gap means
        // the centre action is overlapping its neighbours.
        const gaps: number[] = [];
        for (let i = 1; i < rects.length; i++) {
          gaps.push(rects[i]!.left - rects[i - 1]!.right);
        }
        return {
          docOverflow: doc.scrollWidth - doc.clientWidth,
          navOverflow: el.scrollWidth - el.clientWidth,
          minGap: Math.min(...gaps),
        };
      });

      expect(metrics.docOverflow).toBeLessThanOrEqual(1);
      expect(metrics.navOverflow).toBeLessThanOrEqual(1);
      // The raised FAB may sit slightly above the bar but must not
      // horizontally overlap the items beside it.
      expect(metrics.minGap).toBeGreaterThanOrEqual(-1);
    });
  }
});
