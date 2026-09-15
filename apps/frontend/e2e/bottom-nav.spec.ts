/**
 * ============================================================
 * LEGALIR — Mobile Bottom Navigation E2E
 * ============================================================
 * Regression guard: the floating bottom-nav pill is rendered inside a
 * `pointer-events-none` wrapper in AppShell, so the nav itself must
 * re-enable pointer events or every link becomes unclickable.
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

test.describe("Mobile bottom navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom-nav links are clickable and navigate", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "منوی پایین" });
    await expect(nav).toBeVisible();

    // The nav must accept pointer events despite the pointer-events-none wrapper.
    const servicesLink = nav.getByRole("link", { name: "خدمات" });
    await expect(servicesLink).toBeVisible();
    await servicesLink.click();

    await expect(page).toHaveURL(/\/services$/, { timeout: APP_READY_TIMEOUT });
  });
});
