/**
 * ============================================================
 * LEGALIR — Profile Completion Incentive & Persistent Prompt E2E
 * ============================================================
 * Covers the full behavior matrix at the UI level:
 *   - Complete profile            → prompt never appears
 *   - Incomplete + enabled        → prompt appears on Dashboard
 *   - Incomplete + انصراف          → closes, reappears on re-login
 *   - Incomplete + suppress       → persists, never reappears on re-login
 *   - User isolation              → one user's suppress never leaks to another
 *
 * The seeded demo user (09120000003) has a 100%-complete profile, so the
 * incomplete-profile scenarios use freshly-created users (empty profile →
 * completionPercent 0) created through the real OTP flow.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

// Demo user has a 100%-complete profile (امیر رضایی).
const COMPLETE_MOBILE = "09120000003";

// Fresh users — no profile row → completionPercent 0 → prompt eligible.
// Each test gets a UNIQUE mobile so a suppress persisted in one test can never
// leak into another (the JSON DB is shared and persists across tests, and the
// suite runs fully parallel).
function freshMobile(): string {
  // 091 + 8 random digits → 11 chars, always matches /^09\d{9}$/.
  const rand = Math.floor(10000000 + Math.random() * 90000000);
  return `091${rand}`;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

/**
 * Create a real session for a given mobile: log in if the account already
 * exists, otherwise register it. A brand-new mobile yields a brand-new user
 * with an empty profile (incomplete).
 *
 * Deliberately NOT the OTP flow: `/api/auth/otp/request` is rate-limited to
 * 3 requests / 5 min per mobile, and the suite's other specs spend that
 * budget on the shared demo number, so the "complete profile" case (which
 * uses `COMPLETE_MOBILE`) failed with `RATE_LIMITED` on repeat runs. Both
 * `login` and `register` are unlimited and return the same session shape.
 */
async function createSessionFor(request: APIRequestContext, mobile: string): Promise<SessionInfo> {
  const credentials = { mobile, password: DEMO_PASSWORD };

  let res = await request.post("/api/auth/login", { data: credentials });
  if (!res.ok()) {
    // Not registered yet — create the account (same empty-profile state the
    // OTP flow produced for a fresh mobile).
    res = await request.post("/api/auth/register", { data: credentials });
  }
  if (!res.ok()) {
    throw new Error(`Failed to create a session for ${mobile} (${res.status()})`);
  }

  const body = (await res.json()) as {
    data?: { sessionId?: string; user?: { id?: string; mobileDisplay?: string } };
  };
  const sessionId = body.data?.sessionId;
  if (!sessionId) throw new Error("Failed to create a session");

  return {
    sessionId,
    userId: body.data?.user?.id ?? "unknown-user",
    mobileDisplay: body.data?.user?.mobileDisplay ?? mobile,
  };
}

/**
 * Simulate an authenticated session:
 *  - `legalir-session` cookie → satisfies middleware + resolves the API user.
 *  - `legalir-auth` localStorage → satisfies the zustand `isAuthenticated()` check
 *    so `AppLayout` renders the app shell.
 */
async function mockAuth(page: Page, session: SessionInfo) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: session.sessionId, url: "http://localhost:3000" },
  ]);

  const sessionState = {
    state: {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        mobileE164: `+98${session.mobileDisplay.replace(/^0/, "")}`,
        mobileDisplay: session.mobileDisplay,
        isNewUser: false,
        createdAt: Date.now(),
      },
    },
    version: 0,
  };
  await page.addInitScript(
    // NOTE: the storage key must be inlined — addInitScript serializes the
    // function body but NOT outer closure variables.
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    sessionState,
  );
}

/**
 * The `AppSplashGate` shows a 4s splash on every full page load, and the app
 * content only renders after it finishes. Wait on the target content with a
 * timeout long enough to cover the splash.
 */
const APP_READY_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Behavior matrix
// ---------------------------------------------------------------------------

test.describe("Profile Completion Prompt — behavior matrix", () => {
  test("complete profile → prompt never appears", async ({ page, request }) => {
    const session = await createSessionFor(request, COMPLETE_MOBILE);
    await mockAuth(page, session);
    await page.goto("/dashboard");

    // Dashboard shell renders…
    await expect(page.getByText("پروفایلت رو کامل کن")).not.toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // …and the prompt dialog is absent.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("incomplete profile + prompt enabled → prompt appears with reward", async ({
    page,
    request,
  }) => {
    const session = await createSessionFor(request, freshMobile());
    await mockAuth(page, session);
    await page.goto("/dashboard");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(dialog.getByText("پروفایلت رو کامل کن")).toBeVisible();
    // Real product-backed reward value (PROFILE_COMPLETED = 1000).
    await expect(dialog.getByText(/۱٬۰۰۰ امتیاز/)).toBeVisible();
    // Three distinct actions.
    await expect(dialog.getByRole("button", { name: "انصراف" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "تکمیل پروفایل" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "دیگر این پیام را به من نشان نده" })).toBeVisible();
  });

  test("انصراف closes the modal and it reappears on re-login", async ({ page, request }) => {
    const mobile = freshMobile();
    const session = await createSessionFor(request, mobile);
    await mockAuth(page, session);
    await page.goto("/dashboard");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await dialog.getByRole("button", { name: "انصراف" }).click();
    await expect(dialog).toHaveCount(0);

    // Re-login as the same user — the prompt must reappear (cancel is NOT persisted).
    const session2 = await createSessionFor(request, mobile);
    await mockAuth(page, session2);
    await page.goto("/dashboard");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });

  test("suppress persists and the prompt never reappears on re-login", async ({
    page,
    request,
  }) => {
    const mobile = freshMobile();
    const session = await createSessionFor(request, mobile);
    await mockAuth(page, session);
    await page.goto("/dashboard");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await dialog.getByRole("button", { name: "دیگر این پیام را به من نشان نده" }).click();
    await expect(dialog).toHaveCount(0);

    // Re-login as the same user — the suppress preference is persisted server-side.
    const session2 = await createSessionFor(request, mobile);
    await mockAuth(page, session2);
    await page.goto("/dashboard");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: APP_READY_TIMEOUT });
  });

  test("user isolation — one user's suppress never leaks to another", async ({
    page,
    request,
  }) => {
    // User A suppresses the prompt.
    const sessionA = await createSessionFor(request, freshMobile());
    await mockAuth(page, sessionA);
    await page.goto("/dashboard");
    const dialogA = page.getByRole("dialog");
    await expect(dialogA).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await dialogA.getByRole("button", { name: "دیگر این پیام را به من نشان نده" }).click();
    await expect(dialogA).toHaveCount(0);

    // User B (different account) must still see the prompt.
    const sessionB = await createSessionFor(request, freshMobile());
    await mockAuth(page, sessionB);
    await page.goto("/dashboard");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: APP_READY_TIMEOUT });
  });
});
