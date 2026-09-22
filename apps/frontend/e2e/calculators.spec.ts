/**
 * ============================================================
 * LEGALIR — Legal Calculators E2E
 * ============================================================
 * Verifies the two deterministic calculators render and compute
 * live in the browser:
 *  - /calculators/inheritance — heir census → result table
 *  - /calculators/regional-property-value — cascading location
 *    selects, conditional building fields, structured sections
 *
 * No LLM, no network: the numbers come from the local engines.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const reqRes = await request.post("/api/auth/otp/request", {
    data: { mobile: DEMO_MOBILE },
  });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sessionId = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data
    ?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP and create a session");

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

test.describe("Legal calculators", () => {
  test("catalog lists both new calculators", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/calculators");

    await expect(
      page.locator('a[href="/calculators/inheritance"]'),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(
      page.locator('a[href="/calculators/regional-property-value"]'),
    ).toBeVisible();
  });

  test("inheritance computes a share table from the heir census", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/calculators/inheritance");

    // Default census has no heirs → unsupported. Add a wife + two sons
    // so the engine has a supported combination to divide.
    await page.getByLabel("همسر متوفی").selectOption("wife");
    await page.getByLabel("تعداد پسران", { exact: true }).fill("2");

    const result = page.locator('section[aria-label="نتیجه محاسبه"]');
    await expect(result.getByText("نتیجه تقسیم ماترک")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // The result table carries one row per heir group.
    const table = result.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("thead")).toContainText("وارث");
    await expect(table.locator("tbody tr").first()).toBeVisible();

    // Reconciliation steps are always present.
    await expect(result.getByText("مجموع ماترک")).toBeVisible();
    await expect(result.getByText("مجموع تقسیم‌شده")).toBeVisible();
  });

  test("regional property cascades location and gates building fields", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/calculators/regional-property-value");

    const result = page.locator('section[aria-label="نتیجه محاسبه"]');
    const buildingArea = page.getByLabel(/مساحت اعیان/);

    // Building fields are visible by default (hasBuilding defaults true).
    await expect(buildingArea).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Cascading selects: choosing a province narrows the city options.
    await page.getByLabel("استان").selectOption("tehran");
    await page.getByLabel("شهر").selectOption("tehran");
    await page.getByLabel("منطقه").selectOption("district-1");
    await page.getByLabel("بلوک").selectOption("block-101");

    // A full valuation resolves to structured sections.
    await expect(result.getByText("عرصه (زمین)")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(result.getByText("اعیان (ساختمان)")).toBeVisible();
    await expect(result.getByText("جمع‌بندی ارزش")).toBeVisible();

    // Turning the building off hides the conditional fields. The input
    // is sr-only, so click its wrapping label (the real hit target).
    await page.locator("label:has(input#field-hasBuilding)").click();
    await expect(buildingArea).toHaveCount(0);
    await expect(result.getByText("اعیان (ساختمان)")).toHaveCount(0);
  });
});
