/**
 * ============================================================
 * LEGALIR — Services discovery page E2E (/services)
 * ============================================================
 * Covers the discovery contract the redesign is built on:
 *   • the complete catalog is present, grouped by category
 *   • category shortcuts are anchors into those sections
 *   • the human-lawyer campaign is visible on desktop AND mobile
 *   • search normalizes Persian input and has a working empty state
 *   • every banner CTA points at a real destination
 *   • no horizontal overflow at any supported viewport
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 20_000;

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

/** The six catalog categories, in page order. */
const CATEGORIES = [
  { anchor: "cat-consultation", title: "مشاوره و وکالت" },
  { anchor: "cat-contracts", title: "قراردادها و تنظیم اسناد" },
  { anchor: "cat-documents", title: "بررسی و تحلیل اسناد" },
  // The calculators shortcut navigates to the calculators index rather
  // than scrolling to its catalog section.
  { anchor: "cat-calculators", title: "محاسبه‌گرهای حقوقی", href: "/calculators" },
  { anchor: "cat-cases", title: "پرونده‌ها و پیگیری" },
  { anchor: "cat-library", title: "منابع و آموزش حقوقی" },
] as const;

/** Viewports the brief requires the page to survive. */
const VIEWPORTS = [
  { name: "320", width: 320, height: 640 },
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const;

test.describe("Services discovery page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("renders the intro, search and every category section", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1, name: "خدمات لیگالیر" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Search is present and labelled.
    await expect(page.getByRole("search")).toBeVisible();

    // Every category section exists with its heading.
    for (const category of CATEGORIES) {
      await expect(page.locator(`#${category.anchor}`)).toBeAttached();
      await expect(
        page.getByRole("heading", { name: category.title, exact: true }),
      ).toBeVisible();
    }
  });

  test("category shortcuts link to their catalog section or route", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const nav = page.getByRole("navigation", { name: "دسترسی سریع به دسته‌بندی خدمات" });
    await expect(nav).toBeVisible();

    for (const category of CATEGORIES) {
      const href = "href" in category ? category.href : `#${category.anchor}`;
      await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
  });

  test("the human-lawyer campaign is visible on desktop and mobile", async ({ page }) => {
    // Scope to the campaign banner itself — the app shell also renders a
    // sidebar link to /lawyers that is legitimately hidden on mobile, so a
    // bare `a[href="/lawyers"]` would match the wrong element.
    const campaign = page.locator('section[aria-labelledby="campaign-lawyer-title"]');
    const campaignCta = campaign.locator('a[href="/lawyers"]');

    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/services");
    await expect(campaignCta).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(campaign.getByText("وکیل انسانی", { exact: true })).toBeVisible();

    // Mobile — the defect the brief calls out: this must NOT be hidden.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(campaignCta).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(campaign.getByText("وکیل انسانی", { exact: true })).toBeVisible();
  });

  test("every banner CTA points at a real destination", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const expected = [
      "/calculators",
      "/documents?service=document_analysis",
      "/chat?service=legal_notice",
      "/contracts?service=contract_drafting",
      "/documents?service=contract_review",
      "/chat?service=legal_consultation",
      "/lawyers",
      "/legal-library",
      "/contracts/new?type=nda",
    ];

    for (const href of expected) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
    }
  });

  test("search normalizes Persian input and finds services", async ({ page }) => {
    await page.goto("/services");
    const input = page.getByRole("search").getByRole("searchbox");
    await expect(input).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Arabic yeh (U+064A) input must match the Persian spelling.
    await input.fill("مشاور\u0647");
    await expect(page.getByText(/نتیجه برای/)).toBeVisible();

    // Latin term, lower case.
    await input.fill("nda");
    await expect(page.getByText(/نتیجه برای/)).toBeVisible();
    await expect(page.locator('a[href="/contracts/new?type=nda"]').first()).toBeVisible();
  });

  test("search has a clear action and a useful empty state", async ({ page }) => {
    await page.goto("/services");
    const input = page.getByRole("search").getByRole("searchbox");
    await expect(input).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Empty state.
    await input.fill("zzzz-بدون-نتیجه");
    await expect(page.getByText("خدمتی با این مشخصات پیدا نشد")).toBeVisible();

    // Clear via the labelled button restores the discovery layout.
    await page.getByRole("button", { name: "پاک کردن جستجو" }).click();
    await expect(page.getByRole("heading", { name: "دسته‌بندی خدمات" })).toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("Escape clears the search", async ({ page }) => {
    await page.goto("/services");
    const input = page.getByRole("search").getByRole("searchbox");
    await expect(input).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await input.fill("مهریه");
    await expect(page.getByText(/نتیجه برای/)).toBeVisible();
    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(page.getByRole("heading", { name: "دسته‌بندی خدمات" })).toBeVisible();
  });

  test("the six featured cards are one coherent system with a CTA each", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const section = page.locator('section[aria-labelledby="service-banners-title"]');
    const cards = section.locator("a");

    // Exactly the six services, no more and no fewer.
    await expect(cards).toHaveCount(6);

    // Every card is a single link (no nested second anchor) carrying a
    // heading, a description and a visible action label.
    for (let i = 0; i < 6; i += 1) {
      const card = cards.nth(i);
      await expect(card.locator("h3")).toHaveCount(1);
      await expect(card.locator("p")).toHaveCount(1);
      await expect(card.locator("a")).toHaveCount(0);
      await expect(card.locator("span.mt-auto")).toBeVisible();
    }

    // The six verified destinations, one per card.
    const hrefs = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(new Set(hrefs).size).toBe(6);
  });

  test("the new-services section features NDA once, with balanced secondary cards", async ({
    page,
  }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const section = page.locator('section[aria-labelledby="new-services-title"]');
    await expect(section).toBeVisible();

    // The NDA promotion is the wide feature banner — exactly one link to
    // the NDA contract, never shown twice as both banner and card.
    await expect(section.locator('a[href="/contracts/new?type=nda"]')).toHaveCount(1);

    // The two genuinely-new secondary services are present and linked.
    await expect(section.locator('a[href="/calculators/inheritance"]')).toHaveCount(1);
    await expect(
      section.locator('a[href="/calculators/regional-property-value"]'),
    ).toHaveCount(1);

    // The feature banner is a full-width band, not a narrow side column:
    // it must be at least as wide as the secondary card row beneath it.
    const featureWidth = await section
      .locator('section[aria-labelledby="campaign-nda-title"]')
      .evaluate((el) => el.getBoundingClientRect().width);
    const rowWidth = await section.locator("ul").evaluate((el) => el.getBoundingClientRect().width);
    expect(featureWidth).toBeGreaterThanOrEqual(rowWidth - 1);
  });

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/services");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      // Allow a 1px rounding tolerance.
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
