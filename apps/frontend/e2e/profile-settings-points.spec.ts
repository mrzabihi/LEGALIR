/**
 * ============================================================
 * LEGALIR — Profile, Settings & Points E2E
 * ============================================================
 * Covers the redesigned Profile (Summary + Details + account identity),
 * the Settings hub and its dedicated sub-routes, the Points page
 * aggregates, and the navigation between them.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// A mobile unique to this spec file: the OTP endpoint rate-limits to 3
// requests / 5 min per mobile (in-memory, shared across parallel workers),
// so reusing the demo mobile here would collide with the other specs.
const DEMO_MOBILE = "09120000077";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";

// Serial mode keeps the session cached in one worker → a single OTP request.
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Auth helpers (shared pattern with rewards-profile.spec.ts)
// ---------------------------------------------------------------------------

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

/** The splash gate delays app content; wait on the target content directly. */
const APP_READY_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Profile — Summary + Details + account identity
// ---------------------------------------------------------------------------

test.describe("Profile page", () => {
  test("shows the merged summary, immutable mobile and account type", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "پروفایل", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // The intro + account-identity cards are now ONE summary. The mobile is
    // read-only, labelled «تأییدشده» and explained.
    await expect(page.getByText("شماره موبایل")).toBeVisible();
    await expect(page.getByText("تأییدشده")).toBeVisible();
    await expect(
      page.getByText("این شماره هنگام ثبت‌نام حساب ثبت شده و قابل تغییر نیست."),
    ).toBeVisible();
    await expect(page.getByText("نوع حساب")).toBeVisible();
  });

  test("profile details show a completion checklist with an edit button", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    // The details are no longer a collapsed accordion — the checklist is
    // always visible, headed by a single «ویرایش پروفایل» action.
    await expect(page.getByText("جزئیات پروفایل")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("اطلاعات پایه")).toBeVisible();
    await expect(page.getByText("پروفایل حقوقی من")).toBeVisible();
    await expect(page.getByRole("button", { name: "ویرایش پروفایل" })).toBeVisible();
  });

  test("opens the single edit dialog with the display-name field", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    await page.getByRole("button", { name: "ویرایش پروفایل" }).click({ timeout: APP_READY_TIMEOUT });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The display-name input is present (access via its associated label —
    // the floating-label shell also renders a decorative ghost span).
    await expect(dialog.getByRole("textbox", { name: "نام نمایشی" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ذخیره تغییرات" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "انصراف" })).toBeVisible();
  });

  test("opens the avatar picker with presets and an upload option", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    await page.getByRole("button", { name: "تغییر تصویر پروفایل" }).click({
      timeout: APP_READY_TIMEOUT,
    });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("تصاویر آماده")).toBeVisible();
    await expect(dialog.getByText("بارگذاری تصویر")).toBeVisible();
    // Five brand presets, each pressable.
    await expect(dialog.getByRole("button", { name: /^تصویر / })).toHaveCount(5);
  });

  test("has a breadcrumb back to the dashboard", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    const crumb = page.getByRole("navigation", { name: "مسیر صفحه" });
    await expect(crumb).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(crumb.getByRole("link", { name: "داشبورد" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings hub + sub-routes
// ---------------------------------------------------------------------------

const SETTINGS_SUBROUTES: Array<{ path: string; heading: string }> = [
  { path: "/settings/notifications", heading: "اعلان‌ها" },
  { path: "/settings/privacy", heading: "حریم خصوصی" },
  { path: "/settings/security", heading: "نشست‌ها و امنیت" },
  { path: "/settings/usage", heading: "تاریخچه و مصرف" },
  { path: "/settings/memory", heading: "حافظه و دانش" },
  { path: "/settings/data", heading: "مدیریت داده‌ها" },
  { path: "/settings/account", heading: "حذف حساب کاربری" },
];

test.describe("Settings hub", () => {
  test("hub lists every dedicated sub-route", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "تنظیمات", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    for (const { path } of SETTINGS_SUBROUTES) {
      await expect(page.locator(`a[href="${path}"]`)).toBeAttached();
    }
  });

  for (const { path, heading } of SETTINGS_SUBROUTES) {
    test(`${path} renders its own page (not the hub)`, async ({ page, request }) => {
      const sessionId = await getOrCreateSession(request);
      await mockAuth(page, sessionId);
      await page.goto(path);

      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      // Every sub-page carries a breadcrumb back to the settings hub.
      const crumb = page.getByRole("navigation", { name: "مسیر صفحه" });
      await expect(crumb.getByRole("link", { name: "تنظیمات" })).toBeVisible();
    });
  }

  test("notifications page does NOT show usage history", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/settings/notifications");

    await expect(page.getByRole("heading", { name: "اعلان‌ها", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // The old bug: the notifications card opened the usage-history page.
    await expect(page.getByText("تاریخچه اشتراک")).toHaveCount(0);
  });

  test("privacy page does NOT show usage history", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/settings/privacy");

    await expect(page.getByRole("heading", { name: "حریم خصوصی", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("تاریخچه اشتراک")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Points page
// ---------------------------------------------------------------------------

test.describe("Points page", () => {
  test("shows balance, lifetime aggregates and the ledger history", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/points");

    await expect(page.getByRole("heading", { name: "امتیازهای من", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await expect(page.getByText("موجودی فعلی")).toBeVisible();
    await expect(page.getByText("مجموع کسب‌شده")).toBeVisible();
    await expect(page.getByText("مجموع خرج‌شده")).toBeVisible();
    await expect(page.getByText("تاریخچه امتیازها")).toBeVisible();
  });

  test("has a breadcrumb back to the dashboard", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/points");

    const crumb = page.getByRole("navigation", { name: "مسیر صفحه" });
    await expect(crumb).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(crumb.getByRole("link", { name: "داشبورد" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe("Navigation", () => {
  test("profile settings cards route to the dedicated sub-pages", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    await expect(page.locator('a[href="/settings/notifications"]')).toBeAttached({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.locator('a[href="/settings/privacy"]')).toBeAttached();
    await expect(page.locator('a[href="/settings/security"]')).toBeAttached();
  });

  test("terms link points to /terms, not /support", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/profile");

    const terms = page.locator('a[href="/terms"]');
    await expect(terms.first()).toBeAttached({ timeout: APP_READY_TIMEOUT });
  });

  test("public legal pages are reachable without a session", async ({ page }) => {
    for (const path of ["/terms", "/privacy-policy"]) {
      await page.goto(path);
      // Middleware must not redirect a public page to the login screen.
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });
});
