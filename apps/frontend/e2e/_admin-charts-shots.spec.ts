/**
 * ============================================================
 * LEGALIR — Admin chart surfaces screenshots (temp, not committed)
 * ============================================================
 * Evidence for the §4/§5 report: captures the new charts on real data at
 * desktop (1440) and mobile (390) so RTL geometry, axis legibility and the
 * absence of horizontal scroll can be checked by eye.
 *
 * Signs in as the dev SUPER_ADMIN (OTP 405405); writes PNGs under
 * e2e/__shots__/admin-charts/.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;
const SHOTS = "e2e/__shots__/admin-charts";
const DESKTOP = { width: 1440, height: 1100 };
const MOBILE = { width: 390, height: 940 };

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

/** Assert the page body does not overflow the viewport horizontally. */
async function assertNoHScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(1);
}

/** A chart card by its title, for a tight, reviewable crop. */
function chartCard(page: Page, title: string) {
  return page
    .locator("div.rounded-large")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .first();
}

test.describe.configure({ mode: "serial" });

const PAGES = [
  { path: "/admin", name: "overview", title: "نمای کلی" },
  { path: "/admin/reports", name: "reports", title: "گزارش‌ها و خروجی" },
  { path: "/admin/orders", name: "orders", title: "فروش، پرداخت و بازگشت" },
  { path: "/admin/plans", name: "plans", title: "پلن‌ها، اشتراک و سهمیه" },
];

/** Chart cards to crop on each page (title → file suffix). */
const CROPS: Record<string, { title: string; file: string }[]> = {
  reports: [
    { title: "روند مبلغ فروش روزانه", file: "reports-daily-line" },
    { title: "سهم پلن‌ها از مبلغ فروش", file: "reports-byplan-bar" },
  ],
  orders: [{ title: "ترکیب مبالغ فروش", file: "orders-money-bars" }],
  plans: [
    { title: "سفارش‌ها به تفکیک پلن در طول زمان", file: "plans-mix-stacked" },
  ],
};

for (const { path, name, title } of PAGES) {
  test(`${name} — desktop`, async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAdmin(page, sid);
    await page.setViewportSize(DESKTOP);
    await page.goto(path);
    await expect(page.locator("header h1").first()).toHaveText(title, { timeout: READY });
    await page.waitForTimeout(600); // let the charts settle after data arrives
    await assertNoHScroll(page);
    for (const crop of CROPS[name] ?? []) {
      await chartCard(page, crop.title).screenshot({ path: `${SHOTS}/${crop.file}.png` });
    }
  });

  test(`${name} — mobile 390`, async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAdmin(page, sid);
    await page.setViewportSize(MOBILE);
    await page.goto(path);
    await expect(page.locator("header h1").first()).toHaveText(title, { timeout: READY });
    await page.waitForTimeout(600);
    await assertNoHScroll(page);
    for (const crop of CROPS[name] ?? []) {
      await chartCard(page, crop.title).screenshot({ path: `${SHOTS}/${crop.file}-mobile390.png` });
    }
  });
}
