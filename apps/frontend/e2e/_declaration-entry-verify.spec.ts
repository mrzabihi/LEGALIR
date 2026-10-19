/**
 * «تولید اظهارنامه» — one destination everywhere.
 *
 * The acceptance criteria this spec pins:
 *   • home (/dashboard + public /), /services and «ساخت جدید» (/new and the
 *     create sheet) must all reach `/judicial` when the declaration is chosen;
 *   • `/judicial` must show the /cases identity — eyebrow, title, status and
 *     description — with the declaration's own wording;
 *   • the /cases family card keeps opening the petition family explicitly.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

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
  await page.addInitScript(
    (sid) =>
      localStorage.setItem(
        "legalir-auth",
        JSON.stringify({
          state: {
            session: {
              sessionId: sid,
              userId: "demo-user-id",
              mobileE164: "+989120000003",
              mobileDisplay: "09120000003",
              isNewUser: false,
              createdAt: Date.now(),
            },
          },
          version: 0,
        })
      ),
    sessionId
  );
  await page.route("**/api/v1/me/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { showProfileCompletionPrompt: false } }),
      });
      return;
    }
    await route.continue();
  });
}

const EYEBROW = "دادخواست و شکواییه";
const FAMILY_TITLE = "تنظیم دادخواست و شکواییه تخصصی";
const FAMILY_DESCRIPTION =
  "موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید.";
// The declaration's own words — never the دادخواست copy.
const DECLARATION_TITLE = "تنظیم اظهارنامه تخصصی";
const DECLARATION_DESCRIPTION =
  "موضوع اظهارنامه را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید.";
const READY = "در دسترس";

const READY_TIMEOUT = 20_000;

/**
 * The /judicial identity every declaration entry point must land on: the
 * family eyebrow, the declaration's own title and description, and the
 * server-projected availability.
 */
async function expectJudicialIdentity(page: Page, landedFrom: string) {
  await expect(page).toHaveURL(/\/judicial(\?|$)/, { timeout: READY_TIMEOUT });
  await expect(
    page.getByRole("heading", { level: 1, name: DECLARATION_TITLE }),
    `H1 on /judicial (arrived from ${landedFrom})`
  ).toBeVisible({ timeout: READY_TIMEOUT });
  await expect(page.getByText(EYEBROW).first()).toBeVisible();
  await expect(page.getByText(READY).first()).toBeVisible();
  await expect(page.getByText(DECLARATION_DESCRIPTION).first()).toBeVisible();
}

test.describe("«تولید اظهارنامه» — one destination everywhere", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, request }) => {
    const sid = await getOrCreateSession(request);
    await mockAuth(page, sid);
    await page.setViewportSize({ width: 1440, height: 950 });
  });

  test("home: dashboard Quick Access card → /judicial", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "دسترسی سریع" })).toBeVisible({
      timeout: READY_TIMEOUT,
    });

    const card = page.getByRole("link", { name: /تولید اظهارنامه/ }).first();
    await expect(card).toHaveAttribute("href", "/judicial");
    await card.click();
    await expectJudicialIdentity(page, "/dashboard");

    // The selected family is the declaration; its own description is shown.
    await expect(
      page.getByRole("button", { name: /اظهارنامه قضایی/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(DECLARATION_DESCRIPTION).first()).toBeVisible();
  });

  test("home: the judicial zone card is already titled for the declaration", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const card = page.locator("article").filter({ hasText: "تنظیم اظهارنامه تخصصی" }).first();
    await expect(card).toBeVisible({ timeout: READY_TIMEOUT });
    await expect(card.getByText("در دسترس").first()).toBeVisible();
    await expect(card.getByText(DECLARATION_DESCRIPTION.slice(0, 40)).first()).toBeVisible();
    await card.getByRole("link").first().click();
    await expectJudicialIdentity(page, "/dashboard judicial zone");
  });

  test("services: the AI card, the banner and the zone card all → /judicial", async ({ page }) => {
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: READY_TIMEOUT,
    });

    // Every declaration-flavoured link on this page points at /judicial:
    // the AI service card, the promotional banner, and the judicial zone card.
    // The zone is query-backed, so assert the count with a retry.
    await expect(page.locator('a[href="/judicial"]')).toHaveCount(3, {
      timeout: READY_TIMEOUT,
    });
    // …and none of them still points at the declaration's old chat context.
    await expect(page.locator('a[href="/chat?service=legal_notice"]')).toHaveCount(0);

    // The AI service card («تولید اظهارنامه»).
    await page.getByRole("link", { name: /تولید اظهارنامه/ }).first().click();
    await expectJudicialIdentity(page, "/services AI card");

    // The banner CTA («تنظیم اظهارنامه»).
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /^تنظیم اظهارنامه$/ }).first().click();
    await expectJudicialIdentity(page, "/services banner");

    // The judicial zone card.
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    const zoneCard = page.locator("article").filter({ hasText: "تنظیم اظهارنامه تخصصی" }).first();
    await zoneCard.getByRole("link").first().click();
    await expectJudicialIdentity(page, "/services zone card");
  });

  test("«ساخت جدید»: the quick tile → /judicial", async ({ page }) => {
    await page.goto("/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "ساخت جدید" })).toBeVisible({
      timeout: READY_TIMEOUT,
    });

    const tile = page.getByRole("link", { name: /تولید اظهارنامه/ }).first();
    await expect(tile).toHaveAttribute("href", "/judicial");
    await tile.click();
    await expectJudicialIdentity(page, "/new tile");
  });

  test("«ساخت جدید»: the create sheet card → /judicial", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "ساخت جدید" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: READY_TIMEOUT });
    await expect(dialog.locator('a[href="/chat?service=legal_notice"]')).toHaveCount(0);

    const card = dialog.getByRole("link", { name: /تولید اظهارنامه/ }).first();
    await expect(card).toHaveAttribute("href", "/judicial");
    await card.click();
    await expectJudicialIdentity(page, "create sheet");
  });

  test("public home: the zone card routes an anonymous visitor through login", async ({
    browser,
  }) => {
    const anon = await browser.newContext();
    const page = await anon.newPage();
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const card = page.locator("article").filter({ hasText: "تنظیم اظهارنامه تخصصی" }).first();
    await expect(card).toBeVisible({ timeout: READY_TIMEOUT });
    await expect(card.getByRole("link").first()).toHaveAttribute(
      "href",
      /^\/auth\/mobile\?intent=%2Fjudicial$/
    );
    await anon.close();
  });

  test("the family card on /cases still opens the petition family", async ({ page }) => {
    await page.goto("/cases", { waitUntil: "domcontentloaded" });
    const card = page.getByRole("heading", { name: FAMILY_TITLE, level: 2 });
    await expect(card).toBeVisible({ timeout: READY_TIMEOUT });
    // The /cases card still speaks the دادخواست و شکواییه shell.
    await expect(page.getByText(FAMILY_DESCRIPTION).first()).toBeVisible();
    const link = page.locator('a[href="/judicial?type=petition"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/judicial\?type=petition$/, { timeout: READY_TIMEOUT });
    await expect(
      page.getByRole("button", { name: /دادخواست حقوقی/ })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
