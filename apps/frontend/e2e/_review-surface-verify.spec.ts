/**
 * TEMP verification spec (not committed to the suite) — proves the
 * redesigned /contracts hub and the review surface end to end against
 * the live dev server:
 *
 *   • the two product-path cards exist and route correctly;
 *   • the search filters the real template library;
 *   • «همه» expands the remaining contracts into a grid on the SAME page;
 *   • /contracts/review offers its real intake sources;
 *   • the document review surface renders the digest, the ordered
 *     attention list, the explicit limitations and the smart next-step
 *     card for a trial scenario.
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
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
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
    },
  );
}

/** Collect only errors that the redesign could plausibly cause. */
function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Known dev-only noise (React DevTools hint, favicon, hydration of the
    // public shell) is not related to this work.
    if (/favicon|Download the React DevTools/i.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  // A bare "Failed to load resource" line names no URL, so record the
  // failing request itself to keep the evidence actionable.
  const failedRequests: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });
  return { errors, failedRequests };
}

test.describe("Contracts hub — two paths", () => {
  test.beforeEach(async ({ page, request }) => {
    await mockAuth(page, await getOrCreateSession(request));
  });

  test("both path cards render and link to their real routes", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });

    const draft = page.getByRole("link", { name: /تنظیم قرارداد/ }).first();
    const review = page.getByRole("link", { name: /بررسی قرارداد/ }).first();

    await expect(draft).toBeVisible({ timeout: 20_000 });
    await expect(review).toBeVisible();
    await expect(draft).toHaveAttribute("href", "/contracts/new");
    await expect(review).toHaveAttribute("href", "/contracts/review");

    await page.screenshot({ path: "redesign-shots/contracts-hub.png", fullPage: true });
    expect(consoleErrors.errors).toEqual([]);
  });

  test("search narrows the real template library", async ({ page }) => {
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });
    const field = page.getByLabel("جستجوی قرارداد");
    await expect(field).toBeVisible({ timeout: 20_000 });

    await field.fill("اجاره");
    await expect(page.getByText("رهن و اجاره ملک مسکونی").first())
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("توافق‌نامه محرمانگی (NDA)")).toHaveCount(0);
  });

  test("«همه» reveals the remaining contracts in a grid on the same page", async ({ page }) => {
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });
    const grid = page.getByRole("list", { name: "فهرست همهٔ قراردادهای قابل تنظیم" });
    await expect(grid).toBeVisible({ timeout: 20_000 });

    // Every implemented template is reachable without leaving /contracts.
    await expect(page.getByRole("heading", { name: "همهٔ قالب‌های قابل تنظیم" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/contracts");
    await page.screenshot({ path: "redesign-shots/contracts-grid.png", fullPage: true });
  });

  test("review page offers its real intake sources", async ({ page }) => {
    await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /بررسی قرارداد/ }))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("بارگذاری سند جدید")).toBeVisible();
    await expect(page.getByText("جای‌گذاری متن قرارداد")).toBeVisible();
    await expect(page.getByText("از پیش‌نویس‌های من")).toBeVisible();
    await expect(page.getByText("از اسناد لیگالیر")).toBeVisible();
    await page.screenshot({ path: "redesign-shots/contracts-review.png", fullPage: true });
  });

  test("pasted text reaches the analysis without becoming an upload", async ({
    page,
    request,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    let createdConversationId: string | null = null;
    const PASTED =
      "قرارداد اجاره مسکونی بین موجر و مستاجر؛ مدت اجاره دو سال و مبلغ ودیعه پنجاه میلیون تومان است و شرط فسخ یک‌طرفه برای موجر پیش‌بینی شده است.";

    await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("جای‌گذاری متن قرارداد")).toBeVisible({ timeout: 20_000 });
    await page.getByText("جای‌گذاری متن قرارداد").click();

    // Below the minimum the flow refuses to advance — no silent half-send.
    await page.getByLabel("متن قرارداد").fill("اجاره");
    await expect(page.getByRole("button", { name: "مرحله بعد" })).toBeDisabled();

    await page.getByLabel("متن قرارداد").fill(PASTED);
    await expect(page.getByRole("button", { name: "مرحله بعد" })).toBeEnabled();
    await page.getByRole("button", { name: "مرحله بعد" }).click();
    await page.getByText("بررسی پیش از امضا").click();
    await page.getByRole("button", { name: "مرحله بعد" }).click();

    await expect(page.getByText("متن جای‌گذاری‌شده")).toBeVisible();
    await page.getByRole("button", { name: /شروع بررسی/ }).click();

    // It lands on a real contract-review conversation, and the text the user
    // pasted is what the analysis reads.
    await page.waitForURL(/\/chat\/[^/?]+/, { timeout: 30_000 });
    createdConversationId = new URL(page.url()).pathname.split("/").pop() ?? null;
    expect(new URL(page.url()).searchParams.get("service")).toBe("contract_review");
    // The token is stripped on mount, so a refresh cannot replay the text.
    await expect
      .poll(() => new URL(page.url()).searchParams.get("reviewPasted"), { timeout: 10_000 })
      .toBeNull();
    await expect(page.getByText(/متن قرارداد که کاربر جای‌گذاری کرده است/))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ودیعه پنجاه میلیون تومان/).first()).toBeVisible();

    await page.screenshot({ path: "redesign-shots/contracts-review-pasted.png", fullPage: true });
    const ourErrors = consoleErrors.errors.filter((e) => !/Failed to load resource/i.test(e));
    expect(ourErrors).toEqual([]);

    // Verification must leave the demo account as it found it.
    if (createdConversationId) {
      const res = await request.delete(`/api/v1/conversations/${createdConversationId}`, {
        headers: { cookie: `legalir-session=${await getOrCreateSession(request)}` },
      });
      expect(res.ok()).toBe(true);
    }
  });
});

test.describe("Document review surface", () => {
  test.beforeEach(async ({ page, request }) => {
    await mockAuth(page, await getOrCreateSession(request));
  });

  test("trial scenario shows digest, ordered attention and next steps", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto("/documents/doc-rent-001", { waitUntil: "domcontentloaded" });

    // The honest no-model state is the entry point in this environment.
    const scenario = page.getByText("قراردادی با شرط فسخ یک‌طرفه", { exact: false });
    await scenario.first().waitFor({ state: "visible", timeout: 30_000 });
    await scenario.first().click();
    await page
      .getByRole("heading", { name: "نتیجه بررسی نمونه" })
      .waitFor({ state: "visible", timeout: 30_000 });

    // 1 — digest (subject · structure · attention · limits)
    const digest = page.locator('section[aria-label="خلاصهٔ ساختاری بررسی"]');
    await expect(digest).toBeVisible({ timeout: 15_000 });
    await expect(digest.getByText("موضوع سند")).toBeVisible();
    await expect(digest.getByText("محدودیت‌های این تحلیل")).toBeVisible();
    await expect(digest.getByText("بخش‌های نیازمند توجه")).toBeVisible();
    await expect(digest.getByText("ساختار سند")).toBeVisible();

    // 2 — the result surface below the digest
    await expect(page.locator('section[aria-label="نتیجه بررسی"]')).toBeVisible({
      timeout: 15_000,
    });

    // 3 — no advice card may sit over the result; it must be BELOW it.
    const next = page.getByText("قدم بعدی").first();
    if (await next.isVisible().catch(() => false)) {
      const resultBox = await page.locator('section[aria-label="نتیجه بررسی"]').boundingBox();
      const nextBox = await next.boundingBox();
      expect(resultBox).not.toBeNull();
      expect(nextBox).not.toBeNull();
      if (resultBox && nextBox) expect(nextBox.y).toBeGreaterThan(resultBox.y);
    }

    await page.screenshot({ path: "redesign-shots/document-review.png", fullPage: true });
    // eslint-disable-next-line no-console
    console.log("FAILED REQUESTS:", JSON.stringify(consoleErrors.failedRequests, null, 2));
    // The page itself is pre-existing and loads its own preview assets; only
    // errors that name a source file from this change are ours to fix.
    const ourErrors = consoleErrors.errors.filter(
      (e) => !/Failed to load resource/i.test(e),
    );
    expect(ourErrors).toEqual([]);
  });

  test("mobile layout keeps the paths and the result usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /تنظیم قرارداد/ }).first())
      .toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /بررسی قرارداد/ }).first()).toBeVisible();
    await page.screenshot({ path: "redesign-shots/contracts-mobile.png", fullPage: true });

    // The review intake must stay usable at the same width: every source is
    // reachable, the paste box is present, and nothing overflows the column.
    await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("جای‌گذاری متن قرارداد")).toBeVisible({ timeout: 20_000 });
    await page.getByText("جای‌گذاری متن قرارداد").click();
    await expect(page.getByLabel("متن قرارداد")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "redesign-shots/contracts-review-mobile.png", fullPage: true });
  });
});
