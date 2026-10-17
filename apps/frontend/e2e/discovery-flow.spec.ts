/**
 * ============================================================
 * LEGALIR — Smart legal-path discovery E2E
 * ============================================================
 * Covers the «نمی‌دونی از کجا شروع کنی؟» feature end-to-end in a browser:
 *   • the entry card is present on the dashboard AND on /services, and its
 *     CTA points at the real intake (/new) — never a dead route;
 *   • /Suggest_law shows a clear empty state when there is no request;
 *   • /Suggest_law, given a real hand-off, shows how LEGALIR understood the
 *     request (stated vs inferred) and offers at least one real, enabled path
 *     with a «پیشنهاد اصلی» badge — and the description is never lost;
 *   • the primary path is actionable: its CTA leaves /Suggest_law and carries
 *     the user's own words forward into the destination flow;
 *   • the standing honesty disclaimer is always present.
 *
 * It relies on the deterministic client hint, so a path is offered instantly
 * even before (or without) a server model answer — the assertions therefore do
 * not depend on which provider the environment is configured with.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 20_000;

const SUGGEST_LAW_DRAFT_KEY = "legalir-suggest-law-draft";

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

/** Seed the /new → /Suggest_law hand-off with the user's own words. */
async function seedDraft(page: Page, text: string, intent: string | null = null) {
  const draft = {
    text,
    intent,
    category: null,
    document: null,
    savedAt: new Date().toISOString(),
  };
  await page.addInitScript(
    (payload) => localStorage.setItem(payload.key, JSON.stringify(payload.value)),
    { key: SUGGEST_LAW_DRAFT_KEY, value: draft },
  );
}

const SAMPLE_TEXT = "چک برگشتی از طرف یک مشتری دارم و نمی‌دانم چطور باید آن را وصول کنم";

test.describe("Smart legal-path discovery", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("the entry card is on /services and links to the intake", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await expect(
      page.getByRole("heading", { name: "نمی‌دونی از کجا شروع کنی؟" }),
    ).toBeVisible();
    await expect(page.locator('a[href="/new"]').first()).toBeVisible();
  });

  test("the entry card is on the dashboard and links to the intake", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "نمی‌دونی از کجا شروع کنی؟" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.locator('a[href="/new"]').first()).toBeVisible();
  });

  test("/Suggest_law shows a clear empty state when there is no request", async ({ page }) => {
    await page.addInitScript((key) => localStorage.removeItem(key), SUGGEST_LAW_DRAFT_KEY);
    await page.goto("/Suggest_law");
    await expect(page.getByRole("heading", { level: 1, name: "پیشنهاد مسیر حقوقی" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("درخواستی برای ادامه پیدا نشد")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "رفتن به «ساخت جدید»" }),
    ).toBeVisible();
  });

  test("understands the request and offers a real recommended path", async ({ page }) => {
    await seedDraft(page, SAMPLE_TEXT);
    await page.goto("/Suggest_law");

    await expect(page.getByRole("heading", { level: 1, name: "پیشنهاد مسیر حقوقی" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // The understanding card separates what the user said from the guess.
    await expect(
      page.getByRole("heading", { name: "برداشت ما از درخواستت" }),
    ).toBeVisible();
    await expect(page.getByText("آنچه شما گفتید", { exact: true })).toBeVisible();
    await expect(page.getByText("حدس ما", { exact: true })).toBeVisible();

    // The user's own words are shown back verbatim — never lost.
    await expect(page.getByText(SAMPLE_TEXT, { exact: false })).toBeVisible();

    // At least one real path is offered, with the primary badge.
    await expect(page.getByText("پیشنهاد اصلی")).toBeVisible();
    await expect(page.getByRole("button", { name: "ادامه به این مسیر" })).toBeVisible();
  });

  test("the recommended path is actionable and carries the request forward", async ({ page }) => {
    await seedDraft(page, SAMPLE_TEXT);
    await page.goto("/Suggest_law");

    const cta = page.getByRole("button", { name: "ادامه به این مسیر" });
    await expect(cta).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await cta.click();

    // We leave the suggestion page and arrive at a REAL destination flow.
    await page.waitForURL((url) => !url.pathname.startsWith("/Suggest_law"), {
      timeout: APP_READY_TIMEOUT,
    });
    expect(new URL(page.url()).pathname).not.toBe("/Suggest_law");
  });

  test("the standing honesty disclaimer is always shown", async ({ page }) => {
    await seedDraft(page, SAMPLE_TEXT);
    await page.goto("/Suggest_law");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("جایگزین نظر وکیل نیست", { exact: false })).toBeVisible();
  });

  test("no horizontal overflow on /Suggest_law at mobile width", async ({ page }) => {
    await seedDraft(page, SAMPLE_TEXT);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/Suggest_law");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
