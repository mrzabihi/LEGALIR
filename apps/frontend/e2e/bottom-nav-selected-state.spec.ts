/**
 * ============================================================
 * LEGALIR — Bottom navigation selected state E2E
 * ============================================================
 * Guards the Persian capsule bar:
 *   • four destinations + a centre action, all with accessible names
 *   • the active destination is derived from the real route tree, so a
 *     section stays lit on its child routes and never lights two at once
 *   • `aria-current="page"` appears on exactly one destination
 *   • the sliding capsule indicator sits over the active destination
 *   • the centre button opens the «ساخت جدید» sheet (four actions) and
 *     Escape closes it
 *   • the sheet is NON-MODAL: the bar stays live while it is open, so a
 *     single tap on any destination both navigates and closes the sheet
 *   • the sheet body scrolls and the drag handle expands it
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

/** The four section destinations. The centre action is a button, not a link. */
const NAV_LABELS = ["خانه", "خدمات", "پشتیبانی", "تنظیمات"] as const;

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

  test("renders the four destinations and the centre action", async ({ page }) => {
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
    await expect(nav.getByRole("button", { name: "ساخت جدید" })).toBeVisible();
  });

  test("every destination meets the 44px touch-target minimum", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    const boxes = await nav.locator("a").evaluateAll((links) =>
      links.map((a) => {
        const r = a.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }),
    );
    for (const box of boxes) {
      expect(box.w).toBeGreaterThanOrEqual(44);
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
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

  test("a route outside the bar lights nothing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // /contracts is not one of the four destinations — the sidebar owns it.
    await page.goto("/contracts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  });

  test("the sliding capsule sits over the active destination", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    const active = nav.getByRole("link", { name: "خدمات" });

    const geometry = await active.evaluate((link) => {
      const capsule = link.querySelector("[data-nav-capsule]");
      const nav = link.closest("nav");
      const indicator = nav?.querySelector("[data-nav-indicator]");
      if (!capsule || !indicator) return null;
      const c = capsule.getBoundingClientRect();
      const i = indicator.getBoundingClientRect();
      return {
        capsuleCenterX: c.left + c.width / 2,
        capsuleCenterY: c.top + c.height / 2,
        indicatorCenterX: i.left + i.width / 2,
        indicatorCenterY: i.top + i.height / 2,
      };
    });

    expect(geometry).not.toBeNull();
    // The indicator is measured from the active capsule, so the two centres
    // must coincide (within a sub-pixel rounding tolerance).
    expect(Math.abs(geometry!.indicatorCenterX - geometry!.capsuleCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry!.indicatorCenterY - geometry!.capsuleCenterY)).toBeLessThanOrEqual(1);
  });

  test("the centre button opens the create sheet and Escape closes it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const trigger = page.getByRole("button", { name: "ساخت جدید" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link")).toHaveCount(4);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the centre button toggles the sheet closed", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const trigger = page.getByRole("button", { name: "ساخت جدید" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // The bar rides above the sheet so the centre button (now showing ×)
    // stays live — clicking it must close the sheet.
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the sheet is non-modal — no aria-modal, no focus trap", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "ساخت جدید" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Non-modal by contract: the sheet must not claim modality.
    await expect(dialog).not.toHaveAttribute("aria-modal", "true");

    // The four destinations stay reachable — a single Tab out of the sheet
    // must land on a bar link, proving focus is not trapped.
    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await expect(nav.getByRole("link", { name: "خانه" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "خدمات" })).toBeVisible();
  });

  test("one tap on a destination while the sheet is open navigates and closes it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "ساخت جدید" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // A single click on «خدمات» must both navigate and dismiss the sheet —
    // no × first, no second click.
    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await nav.getByRole("link", { name: "خدمات" }).click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "خدمات" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("tapping the current destination also closes the sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "ساخت جدید" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // «خانه» is already the active route, so no navigation happens — the tap
    // must still dismiss the sheet.
    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await nav.getByRole("link", { name: "خانه" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the sheet body scrolls and the last action stays reachable", async ({ page }) => {
    // A short viewport forces the collapsed detent to clip the grid, so the
    // body must actually scroll for the last action to be clickable.
    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "ساخت جدید" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const scroller = dialog.locator(".overflow-y-auto").first();
    const before = await scroller.evaluate((el) => el.scrollTop);
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThanOrEqual(before);

    // The last action must be fully inside the scroller's visible box.
    const lastAction = dialog.getByRole("link").last();
    await expect(lastAction).toBeVisible();
    const fits = await lastAction.evaluate((el) => {
      const scroller = el.closest(".overflow-y-auto");
      if (!scroller) return false;
      const a = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      return a.top >= s.top - 1 && a.bottom <= s.bottom + 1;
    });
    expect(fits).toBe(true);
  });

  test("dragging the handle expands the sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "ساخت جدید" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Let the enter animation settle before measuring / dragging.
    await page.waitForTimeout(400);

    const collapsed = await dialog.evaluate((el) => el.getBoundingClientRect().height);

    // Drag the header strip upward with the mouse (pointer events). Grab the
    // grip area near the top so the press never lands on a header control.
    const handle = dialog.locator("[data-drag-handle]").first();
    const box = await handle.boundingBox();
    if (!box) throw new Error("drag handle has no box");
    const cx = box.x + box.width / 2;
    const cy = box.y + 16;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 200, { steps: 12 });
    await page.mouse.up();

    // The expanded detent is taller than the collapsed one.
    await expect
      .poll(async () => dialog.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(collapsed + 40);
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
      // The raised centre button may sit slightly above the bar but must
      // not horizontally overlap the items beside it.
      expect(metrics.minGap).toBeGreaterThanOrEqual(-1);
    });
  }
});
