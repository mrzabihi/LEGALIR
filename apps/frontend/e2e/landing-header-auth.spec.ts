/**
 * ============================================================
 * LEGALIR — Landing Header Auth & Post-Login Destination E2E
 * ============================================================
 * Covers the two contracts the public header must honour:
 *
 *   1. «شروع کنید» services land on the service the user picked —
 *      directly when signed in, via /auth/mobile?intent=… when a guest,
 *      and back to that same service after login OR signup.
 *   2. The auth control reflects the *server-confirmed* session. A stale
 *      localStorage entry (or an expired cookie) must never make the
 *      header show «داشبورد».
 *
 * The dev server runs with no NEXT_PUBLIC_API_BASE_URL, so the app talks
 * same-origin to the real Next route handlers (no MSW in the browser) and
 * the HttpOnly `legalir-session` cookie is the authoritative session.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

// The dev server keeps its OTP rate-limit (3 requests / 5 min per mobile,
// src/app/api/auth/otp/request/route.ts) and user DB in memory, so fixed
// mobiles would exhaust the limit / collide on a second run. Derive a fresh
// 11-digit mobile per run: `09` + 2-digit prefix + 7 digits of the clock.
const RUN = String(Date.now()).slice(-7);
const LOGIN_MOBILE = `0912${RUN}`;
const DEMO_MOBILE = `0913${RUN}`;
const SIGNUP_MOBILE = `0914${RUN}`;

const sessionCache = new Map<string, string>();

async function createSession(
  request: APIRequestContext,
  mobile: string,
): Promise<string> {
  const cached = sessionCache.get(mobile);
  if (cached) return cached;

  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`Failed to request OTP for ${mobile}`);

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error(`Failed to verify OTP for ${mobile}`);

  sessionCache.set(mobile, sessionId);
  return sessionId;
}

/** Seed a signed-in browser: real session cookie + the persisted store entry. */
async function seedSession(page: Page, sessionId: string, mobile: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId,
          userId: "demo-user-id",
          mobileE164: `+98${mobile.slice(1)}`,
          mobileDisplay: mobile,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

/** Open the «شروع کنید» dropdown and pick a service by its label. */
async function pickService(page: Page, label: string) {
  await page.getByRole("button", { name: "شروع کنید" }).click();
  await page.getByRole("button", { name: label }).click();
}

/**
 * The login page captures `?intent=` into the persisted store on mount. Wait
 * for that write before navigating away, otherwise a fast `page.goto` can
 * outrun the effect and the intent is lost.
 */
async function waitForIntent(page: Page, intent: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("legalir-auth");
          if (!raw) return null;
          try {
            return (JSON.parse(raw) as { state?: { intendedRoute?: string } }).state
              ?.intendedRoute ?? null;
          } catch {
            return null;
          }
        }),
      { timeout: APP_READY_TIMEOUT },
    )
    .toBe(intent);
}

/** Complete the OTP login form on /auth/mobile (OTP tab) + /auth/verify. */
async function completeOtpLogin(page: Page, mobile: string) {
  await page.getByRole("tab", { name: "ورود با کد یکبارمصرف" }).click();
  await page.getByLabel("شماره موبایل").fill(mobile);
  await page.getByRole("button", { name: "ارسال کد تأیید" }).click();

  await expect(page).toHaveURL(/\/auth\/verify/, { timeout: APP_READY_TIMEOUT });

  const otpInputs = page.locator("[data-otp-input] input");
  for (let i = 0; i < OTP_CODE.length; i++) {
    await otpInputs.nth(i).fill(OTP_CODE[i]!);
  }
}

// ============================================================
// Guest
// ============================================================

test.describe("Landing header — guest", () => {
  test("shows ورود / ثبت‌نام and no dashboard link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "ورود", exact: true })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: "ثبت‌نام", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "داشبورد" })).toHaveCount(0);
  });

  test("a service click routes through login with the intent preserved", async ({ page }) => {
    await page.goto("/");
    await pickService(page, "تحلیل سند");
    await expect(page).toHaveURL(/\/auth\/mobile\?intent=document/, {
      timeout: APP_READY_TIMEOUT,
    });
  });

  test("«مشاهده اشتراک‌ها» goes straight to pricing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "شروع کنید" }).click();
    await page.getByRole("link", { name: "مشاهده اشتراک‌ها" }).click();
    await expect(page).toHaveURL(/\/pricing$/, { timeout: APP_READY_TIMEOUT });
  });
});

// ============================================================
// Authenticated
// ============================================================

test.describe("Landing header — authenticated", () => {
  test("shows داشبورد instead of the login control", async ({ page, request }) => {
    const sessionId = await createSession(request, DEMO_MOBILE);
    await seedSession(page, sessionId, DEMO_MOBILE);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "داشبورد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: "ورود", exact: true })).toHaveCount(0);
  });

  test("a service click goes straight to the destination", async ({ page, request }) => {
    const sessionId = await createSession(request, DEMO_MOBILE);
    await seedSession(page, sessionId, DEMO_MOBILE);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "داشبورد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await pickService(page, "تولید قرارداد");
    await expect(page).toHaveURL(/\/contracts/, { timeout: APP_READY_TIMEOUT });
  });

  test("«مشاهده اشتراک‌ها» still goes to pricing", async ({ page, request }) => {
    const sessionId = await createSession(request, DEMO_MOBILE);
    await seedSession(page, sessionId, DEMO_MOBILE);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "داشبورد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("button", { name: "شروع کنید" }).click();
    await page.getByRole("link", { name: "مشاهده اشتراک‌ها" }).click();
    await expect(page).toHaveURL(/\/pricing$/, { timeout: APP_READY_TIMEOUT });
  });
});

// ============================================================
// Post-login / post-signup return to the chosen service
// ============================================================

test.describe("Return to the chosen service", () => {
  test("login returns the user to the service they picked", async ({ page }) => {
    await page.goto("/");
    await pickService(page, "تحلیل سند");
    await expect(page).toHaveURL(/\/auth\/mobile\?intent=document/, {
      timeout: APP_READY_TIMEOUT,
    });
    await waitForIntent(page, "document");

    await completeOtpLogin(page, LOGIN_MOBILE);

    // Not the generic dashboard — the service the user actually chose.
    await expect(page).toHaveURL(/\/documents/, { timeout: APP_READY_TIMEOUT });
  });

  test("signup returns the user to the service they picked", async ({ page }) => {
    await page.goto("/");
    await pickService(page, "مشاوره حقوقی");
    await expect(page).toHaveURL(/\/auth\/mobile\?intent=chat/, {
      timeout: APP_READY_TIMEOUT,
    });
    await waitForIntent(page, "chat");

    // Detour through the signup flow — the intent must survive it.
    await page.goto("/auth/register");
    // The track cards carry an explicit role="listitem" (not "button").
    await page.getByRole("listitem", { name: /ایجاد حساب شخصی/ }).click();
    await expect(page).toHaveURL(/\/auth\/register\/account\?type=PERSONAL/, {
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByLabel("شماره موبایل").fill(SIGNUP_MOBILE);
    await page.getByLabel("رمز عبور", { exact: true }).fill("Secret123!");
    await page.getByLabel("تکرار رمز عبور").fill("Secret123!");
    // The checkbox is a custom control whose visual span intercepts pointer
    // events; clicking its text <label> toggles it (label activation).
    await page.getByText("را می‌پذیرم").click();
    await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();

    await expect(page).toHaveURL(/\/new/, { timeout: APP_READY_TIMEOUT });
  });
});

// ============================================================
// Session expiry / stale localStorage
// ============================================================

test.describe("Session expiry", () => {
  test("an expired cookie falls back to the login control", async ({ page }) => {
    // A cookie that the server does not recognise → /api/v1/me returns 401.
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: "expired-session-id", url: "http://localhost:3000" },
    ]);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "ورود", exact: true })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: "داشبورد" })).toHaveCount(0);
  });

  test("a stale localStorage session without a cookie is not authenticated", async ({ page }) => {
    // Persisted store entry, but no session cookie at all.
    await page.addInitScript(() => {
      localStorage.setItem(
        "legalir-auth",
        JSON.stringify({
          state: {
            session: {
              sessionId: "stale",
              userId: "u-1",
              mobileE164: "+989120000003",
              mobileDisplay: "09120000003",
              isNewUser: false,
              createdAt: Date.now(),
            },
          },
          version: 0,
        }),
      );
    });

    await page.goto("/");
    await expect(page.getByRole("link", { name: "ورود", exact: true })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: "داشبورد" })).toHaveCount(0);
  });
});
