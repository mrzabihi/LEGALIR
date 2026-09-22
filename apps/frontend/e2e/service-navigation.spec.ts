/**
 * ============================================================
 * LEGALIR — Service Navigation & Page Context E2E
 * ============================================================
 * Verifies the single-source-of-truth contract: selecting a service
 * from the Dashboard carries its context in the URL, and the
 * destination page's breadcrumb + header reflect that service.
 * Also covers refresh persistence, deep linking and back/forward.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const reqRes = await request.post("/api/auth/otp/request", {
    data: { mobile: DEMO_MOBILE },
  });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sessionId = verifyBody.data?.sessionId;
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

const APP_READY_TIMEOUT = 15_000;

/** The six dashboard services and the page context each must produce. */
const SERVICES = [
  { id: "legal_consultation", title: "مشاوره حقوقی", route: "/chat" },
  { id: "contract_review", title: "بررسی قرارداد", route: "/documents" },
  { id: "contract_drafting", title: "تنظیم قرارداد", route: "/contracts" },
  { id: "legal_notice", title: "تولید اظهارنامه", route: "/chat" },
  { id: "document_analysis", title: "تحلیل اسناد", route: "/documents" },
  { id: "legal_calculation", title: "محاسبات حقوقی", route: "/chat" },
] as const;

test.describe("Service navigation & page context", () => {
  // The OTP endpoint rate-limits to 3 requests / 5 min per mobile
  // (src/app/api/auth/otp/request/route.ts). Run serially so the
  // cached session is shared instead of re-requested per worker.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("dashboard quick actions deep-link with service context", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const quick = page.getByRole("heading", { name: "دسترسی سریع" });
    await expect(quick).toBeVisible();

    // Every service card is a link carrying ?service=<id>.
    for (const service of SERVICES) {
      const link = page.locator(`a[href="${service.route}?service=${service.id}"]`);
      await expect(link).toHaveCount(1);
    }
  });

  for (const service of SERVICES) {
    test(`selecting «${service.title}» shows its page context`, async ({ page }) => {
      await page.goto(`/dashboard`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      await page.locator(`a[href="${service.route}?service=${service.id}"]`).first().click();

      // URL carries the context.
      await expect(page).toHaveURL(
        new RegExp(`${service.route}\\?service=${service.id}`),
        { timeout: APP_READY_TIMEOUT },
      );

      // Breadcrumb marks the service as the current page.
      const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.getByText(service.title)).toBeVisible();
      await expect(breadcrumb.getByRole("link", { name: "داشبورد" })).toBeVisible();

      // Page header shows the same service title.
      await expect(
        page.getByRole("heading", { level: 1, name: service.title }),
      ).toBeVisible();
    });
  }

  test("page context survives a hard refresh (URL is the source of truth)", async ({ page }) => {
    await page.goto("/chat?service=legal_notice");
    await expect(
      page.getByRole("heading", { level: 1, name: "تولید اظهارنامه" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: "تولید اظهارنامه" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page).toHaveURL(/\/chat\?service=legal_notice/);
  });

  test("page context survives back/forward navigation", async ({ page }) => {
    await page.goto("/chat?service=legal_consultation");
    await expect(
      page.getByRole("heading", { level: 1, name: "مشاوره حقوقی" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page.goto("/documents?service=contract_review");
    await expect(
      page.getByRole("heading", { level: 1, name: "بررسی قرارداد" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page.goBack();
    await expect(
      page.getByRole("heading", { level: 1, name: "مشاوره حقوقی" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page.goForward();
    await expect(
      page.getByRole("heading", { level: 1, name: "بررسی قرارداد" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test("breadcrumb «داشبورد» link returns to the dashboard", async ({ page }) => {
    await page.goto("/documents?service=contract_review");
    await expect(
      page.getByRole("heading", { level: 1, name: "بررسی قرارداد" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("link", { name: "داشبورد" })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: APP_READY_TIMEOUT });
  });

  test("a route opened without a service param falls back to its default", async ({ page }) => {
    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { level: 1, name: "تحلیل اسناد" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test("an invalid service param does not crash and falls back to the default", async ({ page }) => {
    await page.goto("/chat?service=not-a-real-service");
    await expect(
      page.getByRole("heading", { level: 1, name: "مشاوره حقوقی" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test("legacy ?category= links still resolve to a service context", async ({ page }) => {
    await page.goto("/chat?category=notice");
    await expect(
      page.getByRole("heading", { level: 1, name: "تولید اظهارنامه" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });
});
