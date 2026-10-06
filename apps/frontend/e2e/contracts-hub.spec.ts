/**
 * ============================================================
 * LEGALIR — Contracts hub E2E (/contracts)
 * ============================================================
 * Proves the unified contract surface behaves as ONE page with two
 * in-place views, not two routes wired together:
 *
 *   - both views render from a real segmented control (role=tablist);
 *   - switching a view never reloads the page and never changes the
 *     path — only the `?view=` search param moves;
 *   - the shared page header stays mounted across a switch;
 *   - `?view=coming-soon` deep-links straight to the second view;
 *   - the legacy `/contracts/my` redirects to `/contracts` and keeps
 *     the caller's other query params.
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

test.describe("Contracts hub", () => {
  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("renders the shared header and a two-view segmented control", async ({ page }) => {
    await page.goto("/contracts");

    // The header is the service context — one h1, above the switcher.
    await expect(
      page.getByRole("heading", { level: 1, name: "تنظیم قرارداد" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    const switcher = page.getByRole("tablist", { name: "نمای قراردادها" });
    await expect(switcher).toBeVisible();
    await expect(page.getByRole("tab", { name: "قراردادهای فعال" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "به‌زودی فعال می‌شوند" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // The active view hosts the workspace search.
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible();
  });

  test("switching views changes only the query — no reload, no path change, header fixed", async ({
    page,
  }) => {
    await page.goto("/contracts");
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // A marker on window proves the document was never re-created: a
    // real navigation/reload would wipe it.
    await page.evaluate(() => {
      (window as unknown as { __hubAlive?: number }).__hubAlive = 42;
    });

    await page.getByRole("tab", { name: "به‌زودی فعال می‌شوند" }).click();

    // The URL carries the view, the path is untouched.
    await expect(page).toHaveURL(/\/contracts\?view=coming-soon/, {
      timeout: APP_READY_TIMEOUT,
    });
    expect(new URL(page.url()).pathname).toBe("/contracts");

    // The document survived → no reload.
    expect(
      await page.evaluate(() => (window as unknown as { __hubAlive?: number }).__hubAlive),
    ).toBe(42);

    // The shared header is still the same single h1.
    await expect(
      page.getByRole("heading", { level: 1, name: "تنظیم قرارداد" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "به‌زودی فعال می‌شوند" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Switch back — the query drops, the path never moves.
    await page.getByRole("tab", { name: "قراردادهای فعال" }).click();
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/contracts");
    expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  });

  test("?view=coming-soon deep-links straight to the future-services view", async ({ page }) => {
    await page.goto("/contracts?view=coming-soon");

    await expect(page.getByRole("tab", { name: "به‌زودی فعال می‌شوند" })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: APP_READY_TIMEOUT },
    );
    await expect(
      page.getByRole("heading", { name: "قراردادهای در دست توسعه" }),
    ).toBeVisible();
    // The workspace search belongs to the other view only.
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toHaveCount(0);
  });

  test("legacy /contracts/my redirects to /contracts and preserves other params", async ({
    page,
  }) => {
    // A non-default filter must survive the redirect untouched.
    await page.goto("/contracts/my?tab=needs_work");

    await expect(page).toHaveURL(/\/contracts\?/, { timeout: APP_READY_TIMEOUT });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/contracts");
    expect(url.searchParams.get("tab")).toBe("needs_work");
    expect(url.searchParams.get("view")).toBe("active");

    // The active view is the one rendered.
    await expect(page.getByRole("tab", { name: "قراردادهای فعال" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  // Mobile/PWA QA — the hub must never scroll sideways on a phone, in
  // EITHER view, and the switcher must stay a reachable touch target.
  const VIEWPORTS = [
    { name: "320", width: 320, height: 720 },
    { name: "390", width: 390, height: 844 },
    { name: "430", width: 430, height: 932 },
    { name: "768", width: 768, height: 1024 },
    { name: "1440", width: 1440, height: 900 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/contracts");
      await expect(page.getByRole("tab", { name: "قراردادهای فعال" })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });
      const activeOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(activeOverflow).toBeLessThanOrEqual(1);

      // Same guarantee on the future-services view.
      await page.getByRole("tab", { name: "به‌زودی فعال می‌شوند" }).click();
      await expect(
        page.getByRole("heading", { name: "قراردادهای در دست توسعه" }),
      ).toBeVisible();
      const comingOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(comingOverflow).toBeLessThanOrEqual(1);
    });
  }
});
