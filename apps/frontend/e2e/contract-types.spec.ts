/**
 * ============================================================
 * LEGALIR — Contract Operating System: schema-driven types E2E
 * ============================================================
 * Verifies that every registered contract type shows a card on
 * /contracts and that starting a non-property type opens a working
 * wizard whose steps are rendered from the registry field schema.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

let cachedSessionId: string | null = null;

/**
 * Create a real session through the password login endpoint. Unlike the
 * OTP flow this is not rate-limited, so the spec is not order-dependent.
 */
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

/** Every implemented contract type's Persian label. */
const TYPE_LABELS = [
  "رهن و اجاره ملک مسکونی",
  "خرید و فروش ملک مسکونی",
  "خرید و فروش خودرو",
  "قرارداد قرض",
  "قرارداد فریلنسری",
  "توافقنامه محرمانگی (NDA)",
  "قرارداد نرم‌افزار به‌عنوان سرویس (SaaS)",
  "قرارداد مشارکت استارتاپ",
];

test.describe("Contract types", () => {
  test("every registered type shows a start card", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/contracts");

    for (const label of TYPE_LABELS) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });
    }
  });

  test("starting a vehicle contract opens a schema-driven wizard", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/contracts");

    await page.getByText("خرید و فروش خودرو", { exact: false }).first().click();
    await page.waitForURL(/\/contracts\/cnt-/, { timeout: APP_READY_TIMEOUT });

    // The wizard shell renders the registry's first step.
    await expect(page.getByText("طرفین معامله", { exact: false }).first()).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // The reference code carries the type-specific segment.
    await expect(page.getByText(/LGL-VEHICLE-/, { exact: false }).first()).toBeVisible();

    // Advancing to the vehicle step renders the schema-driven fields.
    await page.getByRole("button", { name: "مرحله بعد" }).click();
    await expect(page.getByText("مشخصات خودرو", { exact: false }).first()).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("شماره شاسی", { exact: false }).first()).toBeVisible();
  });
});
