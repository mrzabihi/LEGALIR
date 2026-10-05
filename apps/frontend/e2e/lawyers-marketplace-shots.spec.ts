/**
 * ============================================================
 * LEGALIR — Lawyer marketplace responsive verification
 * ============================================================
 * Captures the redesigned /lawyers page at mobile / tablet / desktop
 * widths and asserts the core marketplace invariants:
 *   - exactly two compact tiles fit the mobile viewport
 *   - the category carousels are horizontally scrollable
 *   - the page itself does not overflow horizontally
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";

// A fresh mobile per run — the OTP endpoint rate-limits per mobile for 5
// minutes, so a fixed number would fail on the second run.
const DEMO_MOBILE = `0912${String(Date.now()).slice(-7)}`;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP");
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

const WIDTHS = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

test.describe("Lawyer marketplace responsive", () => {
  for (const vp of WIDTHS) {
    test(`renders at ${vp.name}px`, async ({ page, request }) => {
      const sessionId = await getOrCreateSession(request);
      await mockAuth(page, sessionId);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/lawyers");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "وکلای LEGALIR" })).toBeVisible({
        timeout: 15_000,
      });

      // No horizontal page overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: `test-results/lawyers-${vp.name}.png`,
        fullPage: false,
      });
    });
  }

  test("two compact tiles fit a 390px mobile viewport", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/lawyers");
    await page.waitForLoadState("networkidle");

    // The first carousel track.
    const track = page.getByRole("group", { name: "وکلای پیشنهادی" }).first();
    await expect(track).toBeVisible({ timeout: 15_000 });

    const tiles = track.locator(":scope > div");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(1);

    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // Two tiles plus the gap must fit inside the 390px viewport.
    const rightEdge = Math.max(first!.x + first!.width, second!.x + second!.width);
    expect(rightEdge).toBeLessThanOrEqual(390 + 1);

    // The track must actually overflow (more tiles than fit) so it scrolls.
    const scrollable = await track.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(scrollable).toBe(true);
  });

  test("renders with no console errors", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/lawyers");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "وکلای LEGALIR" })).toBeVisible({
      timeout: 15_000,
    });

    // Ignore benign network noise (e.g. favicon) — fail only on real errors.
    const real = errors.filter((e) => !/favicon|Failed to load resource/i.test(e));
    expect(real).toEqual([]);
  });

  test("view-all narrows to a filtered grid and the filter sheet opens", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/lawyers");
    await page.waitForLoadState("networkidle");

    // «مشاهده همه» on a category section switches to the flat result grid.
    const viewAll = page.getByRole("button", { name: "مشاهده همه" }).first();
    await expect(viewAll).toBeVisible({ timeout: 15_000 });
    await viewAll.click();
    await expect(page.getByText(/وکیل یافت شد/)).toBeVisible();

    // Clearing returns to the grouped marketplace.
    await page.getByRole("button", { name: "پاک کردن فیلترها" }).first().click();
    await expect(page.getByRole("heading", { name: "وکلای پیشنهادی" })).toBeVisible();

    // The mobile filter sheet opens and applies.
    await page.getByRole("button", { name: "فیلترها" }).click();
    const sheet = page.getByRole("dialog", { name: "فیلترهای وکلا" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "اعمال فیلترها" }).click();
    await expect(sheet).toBeHidden();
  });
});
