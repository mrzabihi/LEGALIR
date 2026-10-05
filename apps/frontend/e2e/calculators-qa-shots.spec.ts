/**
 * ============================================================
 * LEGALIR — Calculators QA screenshots
 * ============================================================
 * Captures the calculator catalog + a detail page (simple form and
 * stepper form) at desktop and mobile widths, to verify layout, RTL
 * direction and the responsive form/result split.
 *
 * Evidence only — writes PNGs under e2e/__shots__/calculators/.
 */

import { test, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";

async function mockAuth(page: Page, request: APIRequestContext) {
  // Password login avoids the OTP endpoint's per-mobile rate limit.
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data
    ?.sessionId;
  if (!sessionId) throw new Error("Failed to create a demo session");

  await page.context().addCookies([
    { name: "legalir-session", value: sessionId, url: "http://localhost:3000" },
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

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

test.describe.configure({ mode: "serial" });

test("catalog — desktop + mobile", async ({ page, request }) => {
  await mockAuth(page, request);

  await page.setViewportSize(DESKTOP);
  await page.goto("/calculators");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "e2e/__shots__/calculators/catalog-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "e2e/__shots__/calculators/catalog-mobile.png",
    fullPage: true,
  });
});

test("simple detail (overtime) — desktop + mobile", async ({ page, request }) => {
  await mockAuth(page, request);

  await page.setViewportSize(DESKTOP);
  await page.goto("/calculators/overtime");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "e2e/__shots__/calculators/overtime-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "e2e/__shots__/calculators/overtime-mobile.png",
    fullPage: true,
  });
});

test("stepper detail (inheritance) — desktop + mobile", async ({ page, request }) => {
  await mockAuth(page, request);

  await page.setViewportSize(DESKTOP);
  await page.goto("/calculators/inheritance");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "e2e/__shots__/calculators/inheritance-stepper-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "e2e/__shots__/calculators/inheritance-stepper-mobile.png",
    fullPage: true,
  });
});
