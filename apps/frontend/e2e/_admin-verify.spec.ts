/**
 * ============================================================
 * LEGALIR — Admin panel surface E2E (temporary verification spec)
 * ============================================================
 * NOT COMMITTED — a throwaway verification harness that exercises the
 * `/admin` tree end-to-end, which had no e2e coverage. It signs in as the
 * dev SUPER_ADMIN (OTP 405405), then renders every admin section and asserts:
 *
 *   - the shell header shows that section's own title (adminSectionTitle),
 *   - the «دسترسی محدود» gate is NOT shown for a real super-admin,
 *   - the «خطای بحرانی» error boundary is NOT shown,
 *   - no uncaught page error surfaced.
 *
 * Plus a handful of real shell interactions (sidebar collapse, header nav
 * search, user menu). Reuses the same OTP-session auth pattern as
 * landing-header-auth.spec.ts.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000"; // dev seed SUPER_ADMIN (+989120000000)
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;

/** path → the shell header title the admin section must render. */
const ADMIN_ROUTES: { path: string; title: string }[] = [
  { path: "/admin", title: "نمای کلی" },
  { path: "/admin/users", title: "کاربران و سازمان‌ها" },
  { path: "/admin/requests", title: "درخواست‌ها و پرونده‌ها" },
  { path: "/admin/lawyers", title: "وکلا" },
  { path: "/admin/services", title: "خدمات و پرچم‌های ویژگی" },
  { path: "/admin/energy", title: "انرژی و هزینهٔ خدمات" },
  { path: "/admin/plans", title: "پلن‌ها، اشتراک و سهمیه" },
  { path: "/admin/orders", title: "فروش، پرداخت و بازگشت" },
  { path: "/admin/finance", title: "مالی و تسویه وکلا" },
  { path: "/admin/ai", title: "هوش مصنوعی و مدل‌ها" },
  { path: "/admin/rag", title: "منابع حقوقی و RAG" },
  { path: "/admin/calculators", title: "محاسبه‌گرها و داده حقوقی" },
  { path: "/admin/support", title: "پشتیبانی و گزارش مشکلات" },
  { path: "/admin/content", title: "محتوا و اطلاع‌رسانی" },
  { path: "/admin/analytics", title: "تحلیل و هوش تجاری" },
  { path: "/admin/reports", title: "گزارش‌ها و خروجی" },
  { path: "/admin/staff", title: "مدیران، نقش‌ها و رویدادهای امنیتی" },
  { path: "/admin/settings", title: "تنظیمات سازمان و اتصال‌ها" },
  // Hidden deep-link surfaces (not in ADMIN_NAV) — must still be titled.
  { path: "/admin/knowledge", title: "پایگاه دانش حقوقی" },
  { path: "/admin/health", title: "وضعیت سامانه" },
  { path: "/admin/profile", title: "پروفایل من" },
  { path: "/admin/staff/roles", title: "مدیران، نقش‌ها و رویدادهای امنیتی" },
  { path: "/admin/staff/permissions", title: "مدیران، نقش‌ها و رویدادهای امنیتی" },
];

let sessionId: string | null = null;

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`admin OTP request failed: ${JSON.stringify(reqBody)}`);

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`admin OTP verify failed: ${JSON.stringify(verifyBody)}`);
  sessionId = sid;
  return sid;
}

async function seedAdmin(page: Page, sid: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: sid,
          userId: "admin-user-id",
          mobileE164: ADMIN_MOBILE_E164,
          mobileDisplay: ADMIN_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

// ============================================================
// Gate
// ============================================================

test.describe("Admin gate", () => {
  test("a guest is bounced to the login with the intent preserved", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/auth\/mobile\?intent=%2Fadmin%2Forders/, { timeout: READY });
  });
});

// ============================================================
// Every admin section renders for the SUPER_ADMIN
// ============================================================

test.describe("Admin sections render", () => {
  for (const { path, title } of ADMIN_ROUTES) {
    test(`${path} → «${title}»`, async ({ page, request }) => {
      const sid = await ensureSession(request);
      await seedAdmin(page, sid);

      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/") + "$"), {
        timeout: READY,
      });

      // The shell header names the owning section — not «نمای کلی» or a generic label.
      const header = page.locator("header h1").first();
      await expect(header).toHaveText(title, { timeout: READY });

      // A real super-admin must never hit the staff gate.
      await expect(page.getByText("دسترسی محدود")).toHaveCount(0);
      // Nor the crash boundary.
      await expect(page.getByText("خطای بحرانی")).toHaveCount(0);

      expect(pageErrors, `uncaught page errors on ${path}`).toEqual([]);
    });
  }
});

// ============================================================
// Shell interactions
// ============================================================

test.describe("Admin shell interactions", () => {
  test.beforeEach(async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAdmin(page, sid);
  });

  test("the sidebar collapse toggle flips the rail", async ({ page }) => {
    await page.goto("/admin");
    const toggle = page.getByRole("button", { name: "جمع کردن نوار کناری" });
    await expect(toggle).toBeVisible({ timeout: READY });
    await toggle.click();
    await expect(page.getByRole("button", { name: "باز کردن نوار کناری" })).toBeVisible();
  });

  test("the header nav search finds a section and navigates", async ({ page }) => {
    await page.goto("/admin");
    const search = page.getByLabel("جست‌وجوی بخش‌های مدیریت");
    await search.click();
    await search.fill("وکلا");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: READY });
    await option.click();
    await expect(page).toHaveURL(/\/admin\/lawyers$/, { timeout: READY });
  });

  test("the user menu opens with the app-return and logout actions", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "منوی کاربری" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible({ timeout: READY });
    await expect(menu.getByText("بازگشت به اپلیکیشن")).toBeVisible();
    await expect(menu.getByText("خروج از حساب")).toBeVisible();
  });
});
