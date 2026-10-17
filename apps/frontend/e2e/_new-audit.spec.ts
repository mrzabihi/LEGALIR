/**
 * TEMP verification spec (NOT COMMITTED) — verify the reworked /new launcher
 * and the «ساخت جدید» create-action sheet after the modal redesign.
 *
 * Checks: direct /new load, refresh, back/forward; the sheet opened from both
 * entry points; the featured (legal-chat) card is one full-width entry; the
 * three specialist cards fall into a two-column grid (2 + 1) at `mobile-l`+
 * and a single stacked column on phones; Escape closes the sheet. Captures
 * fresh screenshots for visual review.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  // Password login (not OTP) — avoids the per-mobile OTP rate limit that
  // repeated E2E runs would otherwise trip.
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
  await page.addInitScript(
    (sid) =>
      localStorage.setItem(
        "legalir-auth",
        JSON.stringify({
          state: {
            session: {
              sessionId: sid,
              userId: "demo-user-id",
              mobileE164: "+989120000003",
              mobileDisplay: "09120000003",
              isNewUser: false,
              createdAt: Date.now(),
            },
          },
          version: 0,
        })
      ),
    sessionId
  );
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
}

test("VERIFY desktop: direct /new renders the launcher (no sheet)", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "ساخت جدید" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "e2e/__shots__/verify-new-desktop.png", fullPage: true });
});

test("VERIFY desktop: /new survives refresh", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "ساخت جدید" })).toBeVisible();
});

test("VERIFY desktop: sheet has a full-width chat card + two-column 2+1 grid", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "ساخت جدید" }).first().click();
  await page.waitForTimeout(900);

  await expect(page).toHaveURL(/\/new$/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const links = dialog.getByRole("link");
  await expect(links).toHaveCount(5);
  // Assert destinations by href — a card's description mentions another
  // service's name, so a name-regex would match more than one card.
  for (const href of [
    "/chat",
    "/contracts/new",
    "/contracts/review",
    "/chat?service=legal_notice",
    "/lawyers",
  ]) {
    await expect(dialog.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(dialog.getByText("شروع پیشنهادی")).toBeVisible();
  // The soft-shapes artwork is present as a decorative layer.
  await expect(dialog.locator('img[src*="legalir-soft-shapes"]')).toHaveCount(1);

  // Geometry: featured card spans the body; draft + review share row one;
  // notice sits alone on row two; the lawyer card closes the sheet full-width.
  // Target by href — a description mentions another service's name, so a
  // name-regex would match more than one card.
  const featured = await dialog.locator('a[href="/chat"]').boundingBox();
  const draft = await dialog.locator('a[href="/contracts/new"]').boundingBox();
  const review = await dialog.locator('a[href="/contracts/review"]').boundingBox();
  const notice = await dialog.locator('a[href="/chat?service=legal_notice"]').boundingBox();
  const lawyer = await dialog.locator('a[href="/lawyers"]').boundingBox();
  expect(featured && draft && review && notice && lawyer).toBeTruthy();
  if (featured && draft && review && notice && lawyer) {
    // Row 1: draft & review level; row 2: notice below.
    expect(Math.abs(draft.y - review.y)).toBeLessThan(8);
    expect(notice.y).toBeGreaterThan(draft.y + 8);
    // Featured card is wider than a single grid cell (full width).
    expect(featured.width).toBeGreaterThan(draft.width + 20);
    // The lawyer-consultation card closes the sheet, below the specialist grid.
    expect(lawyer.y).toBeGreaterThan(notice.y + 8);
    expect(lawyer.width).toBeGreaterThan(draft.width + 20);
  }

  await page.screenshot({ path: "e2e/__shots__/verify-sheet-desktop.png" });
});

test("VERIFY mobile: single-column grid, no horizontal scroll, Escape closes", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.locator("[data-center-action]").click();
  await page.waitForTimeout(900);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link")).toHaveCount(5);

  // No horizontal scroll inside the sheet.
  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // Single column: draft & review are stacked (same x, review below draft).
  const draft = await dialog.locator('a[href="/contracts/new"]').boundingBox();
  const review = await dialog.locator('a[href="/contracts/review"]').boundingBox();
  if (draft && review) {
    expect(Math.abs(draft.x - review.x)).toBeLessThan(8);
    expect(review.y).toBeGreaterThan(draft.y + 8);
  }

  await page.screenshot({ path: "e2e/__shots__/verify-sheet-mobile.png" });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("VERIFY dark theme: sheet stays legible with the artwork dimmed", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.addInitScript(() => localStorage.setItem("legalir-theme", "dark"));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "ساخت جدید" }).first().click();
  await page.waitForTimeout(900);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The theme actually applied.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // The artwork is present but dimmed (opacity < 0.5) so the cards read.
  const artOpacity = await dialog
    .locator('img[src*="legalir-soft-shapes"]')
    .evaluate((el) => {
      let node: HTMLElement | null = el.parentElement;
      while (node && node !== document.body) {
        const o = parseFloat(getComputedStyle(node).opacity);
        if (!Number.isNaN(o) && o < 1) return o;
        node = node.parentElement;
      }
      return 1;
    });
  expect(artOpacity).toBeLessThan(0.5);
  await page.screenshot({ path: "e2e/__shots__/verify-sheet-dark.png" });
});

test("VERIFY reduced-motion: cards appear immediately (animation neutralised)", async ({
  page,
  request,
}) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.locator("[data-center-action]").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // With motion reduced, no card stays at opacity 0 through a stagger delay.
  const opacity = await dialog
    .locator('a[href="/lawyers"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).opacity));
  expect(opacity).toBe(1);
});

test("VERIFY: every create card navigates to its real destination on click", async ({
  page,
  request,
}) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 390, height: 844 });

  const cases: { href: string; url: RegExp }[] = [
    { href: "/chat", url: /\/chat$/ },
    { href: "/contracts/new", url: /\/contracts\/new$/ },
    { href: "/contracts/review", url: /\/contracts\/review$/ },
    { href: "/chat?service=legal_notice", url: /\/chat\?service=legal_notice$/ },
    { href: "/lawyers", url: /\/lawyers$/ },
  ];

  for (const c of cases) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.locator("[data-center-action]").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator(`a[href="${c.href}"]`).click();
    await expect(page).toHaveURL(c.url, { timeout: 15_000 });
    // Tapping a destination dismisses the sheet.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("VERIFY: back/forward after opening the launcher", async ({ page, request }) => {
  const sid = await getOrCreateSession(request);
  await mockAuth(page, sid);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "ساخت جدید" }).first().click();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/new$/);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  await page.goForward();
  await expect(page).toHaveURL(/\/new$/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1, name: "ساخت جدید" })).toBeVisible();
});
