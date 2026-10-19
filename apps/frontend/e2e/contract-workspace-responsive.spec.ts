/**
 * ============================================================
 * LEGALIR — Contract review workspace · responsive (§10)
 * ============================================================
 * The review workspace (/contracts/[id], step "review") is the surface
 * that carries the §127/§128 lifecycle: the five-stage stepper, the
 * three primary choices and the signature panel. It is client-rendered,
 * so its LAYOUT cannot be verified by curling the page.
 *
 * This spec seeds its OWN throwaway rent contract through the live API
 * (so it never depends on the demo dataset), points the wizard at the
 * review step, and opens the workspace at a phone width and a desktop
 * width. On each it asserts:
 *
 *   • the five-stage stepper («مراحل قرارداد») is present and reachable
 *   • the three primary choices render
 *   • the page never scrolls sideways
 *
 * It uses the password login endpoint so it is not subject to the OTP
 * per-mobile rate limit (same convention as contracts-hub.spec.ts).
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

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

/** Suppress the "complete your profile" modal so it never covers the workspace. */
async function suppressProfilePrompt(page: Page) {
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

/** Create a rent contract via the API and point the wizard at "review". */
async function seedReviewContract(
  request: APIRequestContext,
  sessionId: string,
): Promise<string> {
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    data: { type: "property_rent", propertyKind: "apartment", title: "آزمون چیدمان بازبینی" },
  });
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error("Failed to create a rent contract");

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    data: { currentStep: "review" },
  });
  if (!patched.ok()) throw new Error("Failed to move the contract to the review step");
  return id;
}

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

test.describe("Contract review workspace — responsive (§10)", () => {
  let contractId: string;

  test.beforeAll(async ({ request }) => {
    const sessionId = await getOrCreateSession(request);
    contractId = await seedReviewContract(request, sessionId);
  });

  // Remove the throwaway contract so repeated runs never litter the
  // demo dataset.
  test.afterAll(async ({ request }) => {
    const sessionId = await getOrCreateSession(request);
    await request.delete(`/api/v1/property-contracts/${contractId}`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`the lifecycle workspace renders without overflow at ${viewport.name}`, async ({
      page,
      request,
    }) => {
      const sessionId = await getOrCreateSession(request);
      await mockAuth(page, sessionId);
      await suppressProfilePrompt(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto(`/contracts/${contractId}`);

      // The five-stage stepper is the §127 lifecycle rail.
      const stepper = page.getByRole("list", { name: "مراحل قرارداد" });
      await expect(stepper).toBeVisible({ timeout: APP_READY_TIMEOUT });
      // textContent (not innerText) so the index number and the label,
      // which the rail lays out as separate blocks, join without a break.
      const labels = await stepper
        .getByRole("button")
        .evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim().replace(/^\d+/, "")));
      expect(labels).toEqual(["اطلاعات", "پیش‌نمایش", "بررسی", "امضا", "تکمیل"]);

      // The review stage owns ONE card: two OPTIONAL support paths and
      // exactly one committing action (§128). Two competing primary
      // buttons were the "which one do I press?" doubt this stage removed.
      const reviewCard = page
        .getByText("در صورت نیاز از این دو مسیر کمکی استفاده کنید؛ اجباری نیستند")
        .locator("xpath=ancestor::section[1]");
      await expect(reviewCard).toBeVisible();
      await expect(reviewCard.getByRole("button")).toHaveCount(3);
      await expect(reviewCard.getByText("پرسش از دستیار هوشمند")).toBeVisible();
      await expect(reviewCard.getByText("بررسی توسط وکیل")).toBeVisible();

      // Never a sideways scroll on a phone or a desktop.
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
    });
  }
});
