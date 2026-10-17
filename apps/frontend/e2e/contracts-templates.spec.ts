/**
 * ============================================================
 * LEGALIR — Configurable-contract listing E2E (/contracts/templates)
 * ============================================================
 * The listing is the destination of the hub's «مشاهده همه قراردادها»
 * link. This spec proves it is a REAL listing, not an in-place
 * expansion of the hub rail:
 *
 *   - at most 20 cards are mounted at once (never the whole catalogue);
 *   - `?page=`, `?q=` and `?category=` all live in the URL, so a
 *     filtered/paged view survives refresh and deep-linking;
 *   - a search resets the page and an out-of-range page is clamped;
 *   - a query with no matches shows an explicit empty state;
 *   - the preview dialog reads the definition and keeps «start»
 *     separate in its footer;
 *   - the catalogue precedes «قراردادهای من» and the promotions;
 *   - the whole surface never scrolls sideways.
 *
 * Uses the password login endpoint (not the OTP flow) so the spec is
 * not subject to the OTP per-mobile rate limit.
 */

import {
  test,
  expect,
  type Page,
  type Locator,
  type APIRequestContext,
} from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;
// The listing's own cap — asserted here as a ceiling, not an exact
// count: the catalogue may legitimately hold fewer than 20 types.
const MAX_PAGE_SIZE = 20;

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const faNumber = (n: number) =>
  String(n)
    .split("")
    .map((d) => FA_DIGITS[Number(d)] ?? d)
    .join("");

/** The catalog grid only — `ul li` alone also matches the compact
 *  «قراردادهای من» cards further down the page. */
const catalogCards = (page: Page) =>
  page.getByRole("list", { name: "فهرست قراردادهای قابل تنظیم" }).locator("> li");

/**
 * Wait until React has hydrated this element. The server-rendered DOM
 * appears before the client attaches its event handlers, so a `fill()`
 * that lands too early never reaches `onChange` and never commits the
 * query. React marks a hydrated host node with an internal `__reactFiber$`
 * key — the only reliable "interactive now" signal in this app.
 */
async function waitForHydration(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))),
    )
    .toBe(true);
}

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

test.describe("Configurable-contract listing", () => {
  test.beforeEach(async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
  });

  test("mounts at most one page of cards", async ({ page }) => {
    await page.goto("/contracts/templates");

    await expect(
      page.getByRole("heading", { level: 1, name: "همه قراردادهای قابل تنظیم" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Only the current page is mounted — never the whole catalogue, and
    // never more than the 20-per-page cap.
    const count = await catalogCards(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(MAX_PAGE_SIZE);

    if (count === MAX_PAGE_SIZE) {
      // A full page guarantees a pager; the first page must be current
      // and the bar must state both the range and the page position.
      await expect(page.getByRole("navigation", { name: "صفحه‌بندی" })).toBeVisible();
      await expect(page.getByRole("button", { name: `صفحه ${faNumber(1)}` })).toHaveAttribute(
        "aria-current",
        "page",
      );
    } else {
      // Fewer than a page means there is nothing to paginate — the bar
      // collapses to an honest count instead of a dead pager.
      await expect(page.getByRole("navigation", { name: "صفحه‌بندی" })).toHaveCount(0);
      await expect(page.getByText(new RegExp(`${faNumber(count)} قالب قرارداد`))).toBeVisible();
    }
  });

  test("a stale page parameter never blanks the listing", async ({ page }) => {
    await page.goto("/contracts/templates?category=all&page=99");

    // Out-of-range pages are clamped to the last real page, so the
    // listing still renders its cards rather than an empty grid.
    await expect(catalogCards(page).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const count = await catalogCards(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  test("search resets the page and preserves the category", async ({ page }) => {
    await page.goto("/contracts/templates?category=property&page=2");

    const box = page.getByRole("searchbox", { name: "جستجوی قرارداد" });
    await waitForHydration(box);
    await box.fill("ملک");
    // The write is a settled-debounce effect, so it lands ~350ms after the
    // last keystroke; the budget only has to absorb a dev-server compile.
    await expect(page).toHaveURL(/q=/, { timeout: APP_READY_TIMEOUT });

    const url = new URL(page.url());
    expect(url.searchParams.get("q")).toBe("ملک");
    expect(url.searchParams.get("category")).toBe("property");
    expect(url.searchParams.has("page")).toBe(false);
  });

  test("no match shows an explicit empty state with a reset action", async ({ page }) => {
    await page.goto("/contracts/templates?q=%D9%86%D8%A7%D9%85%D9%88%D8%AC%D9%88%D8%AF");

    await expect(page.getByText("قراردادی با این شرایط پیدا نشد")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await page.getByRole("button", { name: "نمایش همه قراردادها" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(catalogCards(page).first()).toBeVisible();
  });

  test("clearing the search restores the full catalogue", async ({ page }) => {
    await page.goto("/contracts/templates");
    await expect(catalogCards(page).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const all = await catalogCards(page).count();

    const box = page.getByRole("searchbox", { name: "جستجوی قرارداد" });
    await waitForHydration(box);
    await box.fill("محرمانگی");
    await expect(page).toHaveURL(/q=/, { timeout: APP_READY_TIMEOUT });
    // The search must NARROW the real catalogue, not merely decorate it.
    await expect.poll(async () => catalogCards(page).count()).toBeLessThan(all);

    // The active-filter line offers a one-click way back.
    await page.getByRole("button", { name: "پاک کردن جست‌وجو و فیلترها" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(catalogCards(page)).toHaveCount(all);
  });

  test("preview reads the definition and keeps start separate", async ({ page }) => {
    await page.goto("/contracts/templates");
    await expect(catalogCards(page).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page
      .getByRole("button", { name: "پیش‌نمایش توافقنامه محرمانگی (NDA)" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The structure comes from the real registry, not invented copy.
    await expect(dialog.getByRole("heading", { name: "ساختار قرارداد" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "مدارک موردنیاز" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "ثبت رسمی" })).toBeVisible();
    // The only committing action is the footer's start button.
    await expect(
      dialog.getByRole("button", { name: "تنظیم توافقنامه محرمانگی" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "بستن" })).toBeVisible();

    // Opening a preview must never leave a draft behind in the URL.
    expect(new URL(page.url()).pathname).toBe("/contracts/templates");

    await dialog.getByRole("button", { name: "بستن" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("the catalogue comes first, then my contracts, then promotions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/contracts/templates");
    await expect(catalogCards(page).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Document order — a promotion can never be rendered above the
    // catalogue, however the viewport is scrolled.
    const order = await page.evaluate(() => {
      const index = (el: Element | null) =>
        el ? Array.prototype.indexOf.call(document.querySelectorAll("*"), el) : -1;
      return {
        catalog: index(document.getElementById("templates-heading")),
        mine: index(document.getElementById("my-compact-heading")),
        promos: index(document.querySelector('[aria-label="خدمات دیگر لیگالیر"]')),
      };
    });
    expect(order.catalog).toBeGreaterThanOrEqual(0);
    expect(order.mine).toBeGreaterThan(order.catalog);
    expect(order.promos).toBeGreaterThan(order.mine);
  });

  test("the hub's view-all link opens it, and Back returns to the hub", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/contracts");
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.getByRole("link", { name: /مشاهده همه قراردادها/ }).click();
    await expect(page).toHaveURL(/\/contracts\/templates/);
    await expect(
      page.getByRole("heading", { level: 1, name: "همه قراردادهای قابل تنظیم" }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await page.goBack();
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible();
  });

  test("the rail rests at its inline start, aligned to the page gutter", async ({ page }) => {
    // Regression guard for scroll-snap vs. padding: without
    // `scroll-padding-inline-start` the first card snapped flush to the
    // screen edge (its corner clipped) and the rail rested at -16px.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contracts");
    await expect(page.getByRole("searchbox", { name: "جستجوی قرارداد" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    const rail = await page.evaluate(() => {
      const track = document.querySelector("div.snap-x") as HTMLElement | null;
      if (!track) return null;
      const first = track.firstElementChild as HTMLElement | null;
      return {
        scrollLeft: track.scrollLeft,
        firstCardLeft: first ? Math.round(first.getBoundingClientRect().left) : -1,
      };
    });
    expect(rail).not.toBeNull();
    expect(rail!.scrollLeft).toBe(0);
    // A 16px gutter means the first card cannot start at the screen edge.
    expect(rail!.firstCardLeft).toBeGreaterThanOrEqual(8);
  });

  for (const viewport of [
    { name: "390", width: 390, height: 844 },
    { name: "834", width: 834, height: 1112 },
    { name: "1440", width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/contracts/templates");
      await expect(
        page.getByRole("heading", { level: 1, name: "همه قراردادهای قابل تنظیم" }),
      ).toBeVisible({ timeout: APP_READY_TIMEOUT });

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
