/**
 * ============================================================
 * LEGALIR — Dashboard Points Card E2E
 * ============================================================
 * Verifies the 5th dashboard stat card:
 *  - it is the first card from the right (RTL DOM order),
 *  - its balance equals the header badge (shared source of truth),
 *  - it links to /points,
 *  - it survives a refresh without resetting,
 *  - it renders correctly on desktop and mobile, light and dark.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  // Password login, not OTP: the OTP endpoint rate-limits per mobile
  // (3 requests / 5 min), which made this spec fail on repeat runs.
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data
    ?.sessionId;
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

// Serial: the OTP endpoint rate-limits per mobile (3 requests / 5 min).
test.describe.configure({ mode: "serial" });

test.describe("Dashboard points card", () => {
  test("is the first stat card from the right and links to /points", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    // Target the hero stat card by its own aria-label. A bare
    // `a[href="/points"]` matches the header badge AND the later
    // «امتیازهای شما» row inside SubscriptionUsageCard, so `.last()`
    // used to resolve to the wrong card.
    const card = page.getByRole("link", { name: /مشاهده جزئیات امتیازها/ });
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(card).toContainText("امتیاز من");

    // RTL: the first DOM child of the stat grid renders right-most.
    const isFirstInGrid = await card.evaluate((el) => {
      const grid = el.parentElement;
      return grid?.firstElementChild === el;
    });
    expect(isFirstInGrid).toBe(true);
  });

  test("shows the same balance as the header badge", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const headerBadge = page.getByRole("link", { name: /امتیاز من:/ });
    const card = page.getByRole("link", { name: /مشاهده جزئیات امتیازها/ });
    await expect(headerBadge).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Wait for the card's balance to leave the loading skeleton.
    //
    // The value lives on the inner `<span class="tabular-nums">`, not on the
    // wrapping `<p>`: `15a4bea` unified every stat card onto `HeroStatCard`,
    // whose slot 2 is `<p><span>{value}</span><span>{unit}</span></p>` so the
    // unit sits on the same baseline as a flex sibling. `p.tabular-nums`
    // described the pre-unification markup.
    const cardBalance = card.locator("span.tabular-nums").first();
    await expect(cardBalance).toBeVisible({ timeout: APP_READY_TIMEOUT });

    const digits = (s: string) => s.replace(/[^\u06F0-\u06F9\u0660-\u0669,٬]/g, "");

    // Poll, don't sample. Both surfaces read ONE `useRewardsSummary()` query,
    // but the header renders `balance ?? 0`, so between first paint and the
    // response it legitimately shows «۰» while the card is still a skeleton.
    // A single read of both raced that window and reported a mismatch that
    // never existed. The card's value span exists from the first frame but is
    // empty until the query lands, so the poll requires BOTH to be non-empty
    // and equal — a real divergence never converges and still fails.
    await expect
      .poll(
        async () => {
          const header = digits(await headerBadge.innerText());
          const cardText = digits(await cardBalance.innerText());
          return cardText && cardText === header ? cardText : null;
        },
        { timeout: APP_READY_TIMEOUT },
      )
      .not.toBeNull();

    expect(digits(await headerBadge.innerText())).toBe(digits(await cardBalance.innerText()));
  });

  test("keeps the balance after a refresh (no reset to zero)", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/dashboard");

    const card = page.getByRole("link", { name: /مشاهده جزئیات امتیازها/ });
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Wait past the loading skeleton — the balance is a Persian numeral.
    //
    // Same slot as the sibling test: the value is the inner
    // `<span class="tabular-nums">` of `HeroStatCard`, not the `<p>`. The old
    // `p.tabular-nums` matched nothing at all here, so the "before" snapshot
    // was always the empty string.
    const balance = card.locator("span.tabular-nums").first();
    await expect(balance).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(balance).toHaveText(/[\u06F0-\u06F9]/);
    const before = (await balance.innerText()).trim();

    await page.reload();
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(balance).toHaveText(/[\u06F0-\u06F9]/, { timeout: APP_READY_TIMEOUT });
    const after = (await balance.innerText()).trim();

    expect(after).toBe(before);
  });

  test("renders on mobile without horizontal overflow", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const card = page.getByRole("link", { name: /مشاهده جزئیات امتیازها/ });
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("renders in dark theme", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.addInitScript(() => localStorage.setItem("legalir-theme", "dark"));
    await page.goto("/dashboard");

    const card = page.getByRole("link", { name: /مشاهده جزئیات امتیازها/ });
    await expect(card).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(card).toContainText("امتیاز من");
  });
});
