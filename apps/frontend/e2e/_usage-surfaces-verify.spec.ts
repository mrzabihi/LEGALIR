/**
 * TEMP verification spec — the «مصرف انرژی و توکن» surfaces against the LIVE
 * dev server, on desktop AND mobile:
 *
 *   1. number parity — the same ledger read three ways:
 *        GET /api/v1/usage/report            (owner)
 *        GET /api/v1/admin/users/:id/usage   (operator, admin:energy:read)
 *        GET /api/v1/subscription/usage/cards (banner)
 *      must agree on energy, tokens and operations for the same window, and
 *      the banner's per-subscription sums must equal the report's own rows.
 *   2. /settings/usage → tab «انرژی و توکن» renders the energy block and the
 *      token block SEPARATELY (two headings, two stat grids) with the real
 *      totals, at 1280px and at 390px, with no horizontal overflow.
 *   3. /subscription renders one banner per ACTIVE subscription, never a
 *      fabricated quota, and its «مشاهده جزئیات مصرف» link points at
 *      /settings/usage.
 *   4. /admin/users → the drawer's «مصرف انرژی و توکن» tab shows the SAME
 *      numbers as the user's own page.
 *
 * Read-only: no transaction, subscription or tariff is created or modified.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

const OTP_CODE = "405405";
/** The seeded dev user with real AI rows and an ACTIVE subscription. */
const USAGE_USER_MOBILE = process.env["LEGALIR_E2E_USAGE_MOBILE"] ?? "09382784666";

/** Playwright owns `test-results/` and wipes it — keep captures beside it. */
const SHOTS = "usage-shots";
function shotsDir(): string {
  fs.mkdirSync(SHOTS, { recursive: true });
  return SHOTS;
}

interface ReportItem {
  id: string;
  trackingId: string;
  subscriptionId: string | null;
  status: string;
  energyFinal: number;
  energyRefunded: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  serviceKey: string;
  settlementLabelFa: string;
}
interface Report {
  totals: {
    operations: number;
    energy: number;
    energyReserved: number;
    energyRefunded: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  items: ReportItem[];
  byService: { serviceKey: string; serviceNameFa: string; operations: number; energy: number }[];
  totalItems: number;
  page: number;
  pageSize: number;
}
interface Card {
  subscriptionId: string;
  planNameFa: string;
  energyUsed: number;
  energyRefunded: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  operations: number;
  energyQuota: number | null;
  energyRemaining: number | null;
}

/** The user session — OTP login for a mobile that already has real rows. */
let cachedUser: { sessionId: string; userId: string } | null = null;

async function userSession(request: APIRequestContext) {
  // The dev OTP bucket allows 3 requests / 5 min per mobile, shared with every
  // other process on this server — log in once per run and reuse the session.
  if (cachedUser) return cachedUser;
  const req = await request.post("/api/auth/otp/request", {
    data: { mobile: USAGE_USER_MOBILE },
  });
  const reqBody = (await req.json()) as { data?: { challengeId?: string }; code?: string };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) {
    throw new Error(
      `OTP request for ${USAGE_USER_MOBILE} failed (${reqBody.code ?? req.status()}); ` +
        "the dev bucket allows 3 requests / 5 min per mobile."
    );
  }
  const verify = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const body = (await verify.json()) as {
    data?: { sessionId?: string; user?: { id?: string } };
  };
  const sessionId = body.data?.sessionId;
  if (!sessionId) throw new Error(`OTP verify failed: ${JSON.stringify(body)}`);

  const me = await request.get("/api/v1/me", {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
  const meBody = (await me.json()) as {
    data?: { user?: { id?: string; mobileDisplay?: string } };
  };
  const userId = body.data?.user?.id ?? meBody.data?.user?.id;
  if (!userId) throw new Error(`could not resolve the user id: ${JSON.stringify(meBody)}`);
  cachedUser = { sessionId, userId };
  return cachedUser;
}

/** Latin digits out of a Persian-formatted string, for numeric comparison. */
function digits(text: string): number {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ascii = text
    .replace(/[۰-۹]/g, (c) => String(fa.indexOf(c)))
    .replace(/[^\d]/g, "");
  return ascii ? Number(ascii) : 0;
}

/** Read a Stat value by its label (label <p>, then the value <p>). */
async function statValue(page: Page, label: string, nth = 0): Promise<number> {
  const labelEl = page.getByText(label, { exact: true }).nth(nth);
  await expect(labelEl).toBeVisible();
  const box = labelEl.locator("..");
  const value = await box.locator("p").nth(1).innerText();
  return digits(value);
}

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  // 1px tolerance for sub-pixel rounding.
  expect(overflow.scroll, `horizontal overflow: ${overflow.scroll}px > ${overflow.client}px`).toBeLessThanOrEqual(
    overflow.client + 1
  );
}

test.describe.configure({ mode: "serial" });

test.describe("usage surfaces — live parity and rendering", () => {
  test("owner report, admin tab and subscription banner agree on one ledger", async ({
    request,
    playwright,
  }) => {
    test.setTimeout(180_000);
    const user = await userSession(request);
    const userCookie = { cookie: `${SESSION_COOKIE}=${user.sessionId}` };
    const admin = await ensureAdminSession(request);
    const adminCookie = { cookie: `${SESSION_COOKIE}=${admin.sessionId}` };

    // One isolated context per identity: Playwright's shared `request`
    // fixture keeps a cookie jar, so mixing identities in it would silently
    // turn a "plain user" call into an admin call.
    const asUser = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: userCookie,
    });
    const asAdmin = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: adminCookie,
    });

    // --- 1. the owner's own report (default 30-day window) -----------------
    const userRes = await asUser.get("/api/v1/usage/report?pageSize=100");
    expect(userRes.ok(), "GET /api/v1/usage/report").toBeTruthy();
    const userReport = ((await userRes.json()) as { data: { report: Report; services: unknown[] } })
      .data.report;
    expect(userReport.totals.operations).toBeGreaterThan(0);

    // --- 2. the operator's view must be IDENTICAL --------------------------
    const adminRes = await asAdmin.get(
      `/api/v1/admin/users/${user.userId}/usage?pageSize=100`
    );
    expect(adminRes.ok(), "GET /api/v1/admin/users/:id/usage").toBeTruthy();
    const adminReport = ((await adminRes.json()) as { data: { report: Report } }).data.report;

    expect(adminReport.totals).toEqual(userReport.totals);
    expect(adminReport.items.map((i) => i.trackingId)).toEqual(
      userReport.items.map((i) => i.trackingId)
    );

    // --- 3. ownership is enforced, not just hidden -------------------------
    const anonCtx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const anon = await anonCtx.get(`/api/v1/admin/users/${user.userId}/usage`);
    expect(anon.status(), "unauthenticated admin read").toBe(401);
    await anonCtx.dispose();

    const asPlainUser = await asUser.get(
      `/api/v1/admin/users/${user.userId}/usage?pageSize=100`
    );
    expect(asPlainUser.status(), "a plain user must not read the admin report").toBe(403);

    // --- 4. the banner's per-subscription sums == the report's own rows ----
    const cardsRes = await asUser.get("/api/v1/subscription/usage/cards");
    expect(cardsRes.ok(), "GET /api/v1/subscription/usage/cards").toBeTruthy();
    const cards = ((await cardsRes.json()) as { data: { items: Card[] } }).data.items;
    expect(cards.length, "an active subscription must produce a banner").toBeGreaterThan(0);

    // All-time window so every row of the subscription is in the report.
    const allRes = await asUser.get(
      "/api/v1/usage/report?from=1970-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&pageSize=100"
    );
    const allReport = ((await allRes.json()) as { data: { report: Report } }).data.report;

    for (const card of cards) {
      const rows = allReport.items.filter((i) => i.subscriptionId === card.subscriptionId);
      let energy = 0;
      let input = 0;
      let output = 0;
      let total = 0;
      let ops = 0;
      for (const row of rows) {
        if (row.status === "FAILED" || row.status === "REVERSED") continue;
        energy += row.energyFinal;
        input += row.inputTokens;
        output += row.outputTokens;
        total += row.totalTokens;
        ops += 1;
      }
      expect(card.energyUsed, `card ${card.subscriptionId} energy`).toBe(energy);
      expect(card.inputTokens, `card ${card.subscriptionId} input tokens`).toBe(input);
      expect(card.outputTokens, `card ${card.subscriptionId} output tokens`).toBe(output);
      expect(card.totalTokens, `card ${card.subscriptionId} total tokens`).toBe(total);
      expect(card.operations, `card ${card.subscriptionId} operations`).toBe(ops);
      // The plan defines no per-subscription energy cap — never invented.
      expect(card.energyQuota).toBeNull();
      expect(card.energyRemaining).toBeNull();
    }

    // --- 5. the bare user report is refused without a session --------------
    const noAuthCtx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const noAuth = await noAuthCtx.get("/api/v1/usage/report");
    expect(noAuth.status()).toBe(401);
    await noAuthCtx.dispose();

    await asUser.dispose();
    await asAdmin.dispose();

    // Hand the numbers to the browser tests via a fixture file.
    fs.writeFileSync(
      path.join(shotsDir(), "parity.json"),
      JSON.stringify({ totals: userReport.totals, cards, userId: user.userId }, null, 2)
    );
  });

  test("desktop: /settings/usage renders energy and tokens as separate blocks", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    const parity = JSON.parse(
      fs.readFileSync(path.join(shotsDir(), "parity.json"), "utf8")
    ) as { totals: Report["totals"] };
    const user = await userSession(request);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "fa-IR",
    });
    await context.addCookies([
      { name: SESSION_COOKIE, value: user.sessionId, url: "http://localhost:3000" },
    ]);
    const page = await context.newPage();
    await page.goto("/settings/usage", { waitUntil: "networkidle" });

    // The page itself.
    await expect(page.getByRole("heading", { name: "تاریخچه و مصرف" }).first()).toBeVisible();

    // Switch to the detailed report tab.
    await page.getByRole("tab", { name: "انرژی و توکن" }).click();
    await expect(page.getByText("انرژی مصرف‌شده", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("مصرف توکن مدل", { exact: true })).toBeVisible();

    // Numbers are the API's numbers, in Persian digits.
    expect(await statValue(page, "انرژی نهایی")).toBe(parity.totals.energy);
    expect(await statValue(page, "مجموع توکن")).toBe(parity.totals.totalTokens);
    expect(await statValue(page, "توکن ورودی")).toBe(parity.totals.inputTokens);
    expect(await statValue(page, "توکن خروجی")).toBe(parity.totals.outputTokens);
    expect(await statValue(page, "عملیات", 0)).toBe(parity.totals.operations);

    // The energy-vs-token explanation is present, not implied.
    await expect(
      page.getByText("واحد مصرف واقعی مدل — با انرژی جمع نمی‌شود")
    ).toBeVisible();
    await expect(page.getByText("تفکیک بر اساس سرویس")).toBeVisible();

    // Every stat renders in Persian digits. (Tracking ids stay latin by
    // design — they are copyable references, so the check is per-stat.)
    for (const label of ["انرژی نهایی", "رزرو اولیه", "توکن ورودی", "توکن خروجی", "مجموع توکن"]) {
      const value = await page.getByText(label, { exact: true }).first().locator("..").innerText();
      expect(value, `${label} must use Persian digits`).not.toMatch(/[0-9]/);
    }

    // No horizontal overflow at desktop width.
    await noHorizontalOverflow(page);

    await page.screenshot({ path: path.join(shotsDir(), "usage-desktop.png"), fullPage: true });
    await context.close();
  });

  test("mobile 390px: the report reflows to cards with no overflow", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    const parity = JSON.parse(
      fs.readFileSync(path.join(shotsDir(), "parity.json"), "utf8")
    ) as { totals: Report["totals"] };
    const user = await userSession(request);

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "fa-IR",
    });
    await context.addCookies([
      { name: SESSION_COOKIE, value: user.sessionId, url: "http://localhost:3000" },
    ]);
    const page = await context.newPage();
    await page.goto("/settings/usage", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "انرژی و توکن" }).click();

    await expect(page.getByText("انرژی مصرف‌شده", { exact: true })).toBeVisible({ timeout: 20_000 });
    expect(await statValue(page, "انرژی نهایی")).toBe(parity.totals.energy);
    expect(await statValue(page, "مجموع توکن")).toBe(parity.totals.totalTokens);

    await noHorizontalOverflow(page);

    // The mobile ledger is card-shaped: the desktop table must be hidden.
    const tables = page.locator("div.hidden.overflow-x-auto");
    if ((await tables.count()) > 0) {
      await expect(tables.first()).toBeHidden();
    }

    await page.screenshot({ path: path.join(shotsDir(), "usage-mobile.png"), fullPage: true });
    await context.close();
  });

  test("/subscription shows the real banner and links to the usage page", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    const parity = JSON.parse(
      fs.readFileSync(path.join(shotsDir(), "parity.json"), "utf8")
    ) as { cards: Card[] };
    const user = await userSession(request);

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "fa-IR",
    });
    await context.addCookies([
      { name: SESSION_COOKIE, value: user.sessionId, url: "http://localhost:3000" },
    ]);
    const page = await context.newPage();
    await page.goto("/subscription", { waitUntil: "networkidle" });

    await expect(page.getByText("مصرف هر اشتراک", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const first = parity.cards[0]!;
    // Scope to the banner itself — the shell's subscription chip also carries
    // the plan name, and it is a hidden duplicate at this width.
    const banner = page
      .locator("article", { has: page.getByText("انرژی مصرف‌شده", { exact: true }) })
      .first();
    await expect(banner).toBeVisible();
    await expect(banner.getByText(first.planNameFa, { exact: true })).toBeVisible();
    await expect(banner.getByRole("link", { name: /مشاهده جزئیات مصرف/ })).toBeVisible();
    const bannerText = await banner.innerText();
    expect(digits(bannerText), "banner energy must equal the cards API").toBeGreaterThan(0);
    expect(bannerText).toContain(new Intl.NumberFormat("fa-IR").format(first.energyUsed));

    // No invented quota: the honest paragraph, no progress bar.
    await expect(
      banner.getByText(/پلن فعلی سقف انرژی مخصوص اشتراک تعریف نکرده است/)
    ).toBeVisible();
    expect(await banner.locator('[role="progressbar"]').count()).toBe(0);

    // The detail action goes to the user's own usage page.
    const link = banner.getByRole("link", { name: /مشاهده جزئیات مصرف/ });
    await expect(link).toHaveAttribute("href", "/settings/usage");

    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(shotsDir(), "subscription-banner-mobile.png"), fullPage: true });
    await context.close();
  });

  test("/admin/users drawer usage tab mirrors the user's own numbers", async ({
    browser,
    request,
  }) => {
    test.setTimeout(240_000);
    const parity = JSON.parse(
      fs.readFileSync(path.join(shotsDir(), "parity.json"), "utf8")
    ) as { totals: Report["totals"]; userId: string };
    const admin = await ensureAdminSession(request);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "fa-IR",
    });
    await context.addCookies([
      { name: SESSION_COOKIE, value: admin.sessionId, url: "http://localhost:3000" },
    ]);
    const page = await context.newPage();
    await page.goto("/admin/users", { waitUntil: "networkidle" });

    // The list masks mobiles by default; the search box matches the real one.
    const search = page.getByPlaceholder("جستجو در نام، شماره تماس یا شناسه");
    await search.fill(USAGE_USER_MOBILE);
    await expect(page.getByRole("button", { name: "اشتراک و انرژی" })).toHaveCount(1, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "اشتراک و انرژی" }).click();

    // The drawer's usage tab.
    const tab = page.getByRole("tab", { name: "مصرف انرژی و توکن" });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();

    await expect(page.getByText("انرژی مصرف‌شده", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    expect(await statValue(page, "انرژی نهایی")).toBe(parity.totals.energy);
    expect(await statValue(page, "مجموع توکن")).toBe(parity.totals.totalTokens);

    await page.screenshot({ path: path.join(shotsDir(), "admin-usage-tab.png"), fullPage: false });
    await context.close();
  });
});
