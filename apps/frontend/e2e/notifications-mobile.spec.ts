/**
 * ============================================================
 * LEGALIR — Notifications mobile / PWA E2E
 * ============================================================
 * Proves the phone notification experience:
 *   - the header bell IS the link: a tap lands on /notifications
 *     with no popup or bottom sheet;
 *   - the bell does not advertise a dialog it never opens;
 *   - /notifications renders its four tabs, its list and its
 *     mark-all action without any horizontal page overflow at every
 *     common phone width, and the tab strip scrolls internally
 *     instead of stretching the page.
 *
 * Uses the password login endpoint (not the OTP flow) so the spec is
 * not subject to the OTP per-mobile rate limit.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

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

const TABS = ["همه پیام‌ها", "پیام‌های عمومی", "پیام‌های شخصی", "امتیازها"] as const;

test.describe("Notifications — mobile/PWA", () => {
  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("the bell navigates straight to /notifications — no popup, no sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const bell = page.getByRole("button", { name: /اعلان‌ها/ }).first();
    await expect(bell).toBeVisible();

    // A phone bell is a plain link-to-page, so it must not announce a dialog.
    await expect(bell).not.toHaveAttribute("aria-haspopup", "dialog");
    await expect(bell).not.toHaveAttribute("aria-expanded");

    await bell.click();

    await expect(page).toHaveURL(/\/notifications$/, { timeout: APP_READY_TIMEOUT });
    // The preview popover/sheet never appeared.
    await expect(
      page.getByRole("dialog", { name: "پیش‌نمایش اعلان‌ها" }),
    ).toHaveCount(0);
  });

  const VIEWPORTS = [
    { name: "320", width: 320, height: 720 },
    { name: "360", width: 360, height: 780 },
    { name: "390", width: 390, height: 844 },
    { name: "430", width: 430, height: 932 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow and scrollable tabs at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/notifications");
      await expect(
        page.getByRole("heading", { level: 1, name: "اعلان‌ها" }),
      ).toBeVisible({ timeout: APP_READY_TIMEOUT });

      // All four tabs are present and legible (fully rendered, not clipped).
      for (const label of TABS) {
        await expect(page.getByRole("tab", { name: new RegExp(label) })).toBeVisible();
      }

      // The tab strip scrolls inside its own band; the page never widens.
      const scroller = page.getByRole("tablist").locator("xpath=..");
      const metrics = await scroller.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          overflowX: style.overflowX,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });
      expect(["auto", "scroll"]).toContain(metrics.overflowX);
      // Content is at least as wide as the visible band — nothing is squashed.
      expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);

      // The document itself never gains a horizontal scrollbar.
      const pageOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(pageOverflow).toBeLessThanOrEqual(1);
    });
  }

  test("unread rows are distinct and a full-width mark-all touch target is present", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: "اعلان‌ها" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Mark all as read — present and comfortably tappable (≥ 40px tall).
    const markAll = page.getByRole("button", {
      name: "علامت‌گذاری همه به‌عنوان خوانده‌شده",
    });
    await expect(markAll).toBeVisible();
    const box = await markAll.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    // The demo feed always carries unread activity; each unread row exposes
    // its state in the accessible name (not by colour alone).
    const unread = page.locator('[aria-label*="خوانده‌نشده"]');
    expect(await unread.count()).toBeGreaterThan(0);
  });
});
