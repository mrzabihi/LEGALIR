/**
 * ============================================================
 * LEGALIR — Admin calculator RULES panel screenshots (temp, not committed)
 * ============================================================
 * Evidence for the report: captures the new /admin/calculators rule layer end
 * to end — the datasets table with rule badges, the structure-aware rule
 * editor, the validate/sample-test preview (before vs after), the published
 * version history, and the user-facing "rule version in force" block.
 *
 * Signs in as the dev SUPER_ADMIN (OTP 405405) and writes PNGs under
 * e2e/__shots__/admin-rules/.
 *
 * NOTE: this spec PUBLISHES a real (flagged-pending) rule override for
 * `court-fee-1405` in the dev `.data` store; `.data/calculator_rules.json` is
 * removed BEFORE the run (to start from the verified code seed) and again AFTER
 * (to restore the store as found).
 *
 * Screenshot method: the overview shots wait for BOTH admin tables to leave
 * their skeleton state (a blind timeout captured empty tables). The drawer
 * shots use a TALL viewport so the whole editor + preview + history fit inside
 * the fixed, overflow-auto drawer and are captured unclipped.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;
const SHOTS = "e2e/__shots__/admin-rules";
const DESKTOP = { width: 1440, height: 1000 };
/** Tall enough that the rule drawer renders editor + preview + history at once. */
const TALL = { width: 1440, height: 2600 };

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

/** The «مجموعه‌داده‌های نرخ» section (where the rule layer lives). */
function datasetsSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "مجموعه‌داده‌های نرخ", exact: true }) });
}

/** The «ماشین‌حساب‌ها» section (operational settings table). */
function calculatorsSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "ماشین‌حساب‌ها", exact: true }) });
}

/** Both admin tables render skeletons first; wait for their real action buttons. */
async function waitForTables(page: Page) {
  await expect(
    datasetsSection(page).getByRole("button", { name: "قواعد" }).first(),
  ).toBeVisible({ timeout: READY });
  await expect(
    calculatorsSection(page).getByRole("button", { name: "تنظیمات" }).first(),
  ).toBeVisible({ timeout: READY });
}

async function openRulesDrawer(page: Page, request: APIRequestContext) {
  const sid = await ensureSession(request);
  await seedAdmin(page, sid);
  await page.setViewportSize(TALL);
  await page.goto("/admin/calculators");
  await expect(page).toHaveURL(/\/admin\/calculators$/, { timeout: READY });
  await waitForTables(page);

  // The court-fee dataset row → its «قواعد» action (scoped to the datasets
  // table so the same-named CALCULATOR row upstream is never matched).
  const row = datasetsSection(page)
    .getByRole("row")
    .filter({ hasText: "هزینه دادرسی" })
    .first();
  await row.getByRole("button", { name: "قواعد" }).click();
  const drawer = page.getByRole("dialog", { name: "قواعد محاسبه — نسخه‌دار" });
  await expect(drawer).toBeVisible({ timeout: READY });
  return drawer;
}

test.describe.configure({ mode: "serial" });

test("1) calculators overview — datasets table with rule badges", async ({ page, request }) => {
  const sid = await ensureSession(request);
  await seedAdmin(page, sid);
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/calculators");
  await expect(
    page.getByRole("heading", { name: "مجموعه‌داده‌های نرخ", exact: true }),
  ).toBeVisible({ timeout: READY });
  await waitForTables(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/01-calculators-overview.png`, fullPage: true });

  // A tight crop of the datasets section (where the rule layer lives).
  await datasetsSection(page).screenshot({ path: `${SHOTS}/02-datasets-table.png` });
});

test("3) rule editor — structure-aware schema + actions", async ({ page, request }) => {
  const drawer = await openRulesDrawer(page, request);
  await expect(drawer.getByText("تعرفه هزینه دادرسی سال ۱۴۰۵")).toBeVisible();
  await page.waitForTimeout(300);
  await drawer.screenshot({ path: `${SHOTS}/03-rule-editor.png` });
});

test("4) rule editor — draft, sample test (before/after), publish, history", async ({
  page,
  request,
}) => {
  const drawer = await openRulesDrawer(page, request);

  // A change note (required to publish) + a plausible rate tweak on the first
  // bracket so the monetary sample input's headline moves (the default sample is
  // a monetary claim).
  await drawer.getByLabel(/توضیح تغییر/).fill("به‌روزرسانی تعرفهٔ ۱۴۰۵ طبق ابلاغیهٔ آزمون");
  const firstRate = drawer.getByLabel("نرخ", { exact: true }).first();
  await firstRate.fill("0.035");
  await page.waitForTimeout(200);

  // Validate + test with the sample inputs.
  await drawer.getByRole("button", { name: "آزمون با ورودی نمونه" }).click();
  await expect(drawer.getByText("نتیجهٔ اعتبارسنجی و آزمون")).toBeVisible({ timeout: READY });
  await page.waitForTimeout(300);
  await drawer.screenshot({ path: `${SHOTS}/04-preview-before-after.png` });

  // Save the draft, then publish it.
  await drawer.getByRole("button", { name: "ذخیرهٔ پیش‌نویس" }).click();
  await expect(drawer.getByRole("button", { name: "لغو پیش‌نویس" })).toBeVisible({
    timeout: READY,
  });
  await drawer.screenshot({ path: `${SHOTS}/05-draft-saved.png` });

  await drawer.getByRole("button", { name: "انتشار" }).click();
  await expect(drawer.getByText("تاریخچهٔ نسخه‌ها")).toBeVisible({ timeout: READY });
  await page.waitForTimeout(400);
  await drawer.screenshot({ path: `${SHOTS}/06-published-history.png` });
});

test("7) user-facing result — the rule version in force", async ({ page, request }) => {
  // The publish in test 4 is now active; the public page must label it.
  const sid = await ensureSession(request);
  await seedAdmin(page, sid);
  await page.setViewportSize(DESKTOP);
  await page.goto("/calculators/court-fee");
  await expect(page.getByText("نسخهٔ قاعدهٔ در جریان")).toBeVisible({ timeout: READY });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/07-user-result-rule-version.png`, fullPage: true });
});
