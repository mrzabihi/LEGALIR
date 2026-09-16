/**
 * ============================================================
 * LEGALIR — Dashboard Points Card E2E
 * ============================================================
 * Verifies the 5th dashboard stat card:
 *  - it is the first card from the right (RTL DOM order),
 *  - its balance equals the header badge (shared source of truth),
 *  - it links to /points,
 *  - it survives a refresh without resetting,
 *  - it renders correctly on desktop and mobile, light and dark.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const reqRes = await request.post("/api/auth/otp/request", {
    data: { mobile: DEMO_MOBILE },
  });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sessionId = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data
    ?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP and create a session");

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

// Serial: the OTP endpoint rate-limits per mobile (3 requests / 5 min).
test.describe.configure({ mode: "serial" });

test.describe("Dashboard points card", () => {
  test("is the first stat card from the right and links to /points", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const card = page.locator('a[href="/points"]').last();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(card).toContainText("امتیاز من");

    // RTL: the first DOM child of the stat grid renders right-most.
    const isFirstInGrid = await card.evaluate((el) => {
      const grid = el.parentElement;
      return grid?.firstElementChild === el;
    });
    expect(isFirstInGrid).toBe(true);
  });

  test("shows the same balance as the header badge", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const headerBadge = page.locator('a[href="/points"]').first();
    const card = page.locator('a[href="/points"]').last();
    await expect(headerBadge).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Wait for the card's balance to leave the loading skeleton.
    const cardBalance = card.locator("p.tabular-nums");
    await expect(cardBalance).toBeVisible({ timeout: APP_READY_TIMEOUT });

    const headerNumber = (await headerBadge.innerText()).replace(
      /[^\u06F0-\u06F9\u0660-\u0669,٬]/g,
      "",
    );
    const cardNumber = (await cardBalance.innerText()).replace(
      /[^\u06F0-\u06F9\u0660-\u0669,٬]/g,
      "",
    );

    expect(headerNumber.length).toBeGreaterThan(0);
    expect(cardNumber).toBe(headerNumber);
  });

  test("keeps the balance after a refresh (no reset to zero)", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const card = page.locator('a[href="/points"]').last();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Wait past the loading skeleton — the balance is a Persian numeral.
    const balance = card.locator("p.tabular-nums");
    await expect(balance).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const before = (await balance.innerText()).trim();
    expect(before).toMatch(/[\u06F0-\u06F9]/);

    await page.reload();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(balance).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const after = (await balance.innerText()).trim();

    expect(after).toBe(before);
  });

  test("renders on mobile without horizontal overflow", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const card = page.locator('a[href="/points"]').last();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("renders in dark theme", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.addInitScript(() => localStorage.setItem("legalir-theme", "dark"));
    await page.goto("/dashboard");

    const card = page.locator('a[href="/points"]').last();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(card).toContainText("امتیاز من");
  });
});
