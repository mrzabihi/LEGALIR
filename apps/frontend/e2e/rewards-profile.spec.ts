/**
 * ============================================================
 * LEGALIR — Rewards & Profile Completion E2E (Spec Tasks 42–51)
 * ============================================================
 * Covers favicon presence, profile completion progression, reward
 * balance display, and daily-visit idempotency at the UI level.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Create a real session for the seeded demo user. The result is cached per
 * worker.
 *
 * Password login, not OTP: `/api/auth/otp/request` is rate-limited to
 * 3 requests / 5 min per mobile, so once any sibling spec spent the demo
 * number's budget this spec failed at session creation.
 */
let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data
    ?.sessionId;
  if (!sessionId) {
    throw new Error("Failed to create a demo session");
  }

  cachedSessionId = sessionId;
  return sessionId;
}

/**
 * Simulate an authenticated session:
 *  - `legalir-session` cookie → satisfies middleware + resolves the API user.
 *  - `legalir-auth` localStorage → satisfies the zustand `isAuthenticated()` check
 *    so `AppLayout` renders the app shell (TopBar/points card).
 */
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
    // NOTE: the storage key must be inlined — addInitScript serializes the
    // function body but NOT outer closure variables like AUTH_STORAGE_KEY.
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    sessionState,
  );
}

/**
 * The `AppSplashGate` shows a 4s splash on every full page load, and the app
 * content only renders after it finishes. Rather than race the splash overlay
 * (a `toBeHidden` check can pass before React mounts it), we wait directly on
 * the target content with a timeout long enough to cover the splash.
 */
const APP_READY_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Favicon (Task 42)
// ---------------------------------------------------------------------------

test.describe("Favicon (Task 42)", () => {
  const ROUTES = ["/", "/dashboard", "/profile", "/points", "/nonexistent-404"];

  for (const route of ROUTES) {
    test(`favicon link present on ${route}`, async ({ page }) => {
      await page.goto(route);
      const favicon = page.locator('link[rel="icon"], link[rel="shortcut icon"]');
      await expect(favicon.first()).toBeAttached();
    });
  }

  test("favicon.ico returns 200 (no 404)", async ({ request }) => {
    const res = await request.get("/favicon.ico");
    expect(res.status()).toBe(200);
  });

  test("apple-touch-icon returns 200", async ({ request }) => {
    const res = await request.get("/apple-touch-icon.png");
    expect(res.status()).toBe(200);
  });

  test("manifest returns 200", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Header points card (Task 50)
// ---------------------------------------------------------------------------

test.describe("Header points card (Task 50)", () => {
  test("points card is discoverable and links to My Points", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const pointsLink = page.locator('a[href="/points"]');
    await expect(pointsLink.first()).toBeAttached({ timeout: APP_READY_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// My Points page (Tasks 28–29, 31)
// ---------------------------------------------------------------------------

test.describe("My Points page (Tasks 28–29, 31)", () => {
  test("renders balance, earn rules, and future redemption teaser", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/points");

    // The page title is an h1; the breadcrumb also carries this label.
    await expect(
      page.getByRole("heading", { name: "امتیازهای من", level: 1 })
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("راه‌های کسب امتیاز")).toBeVisible();
    await expect(page.getByText("استفاده از امتیاز")).toBeVisible();
  });
});
