/**
 * Capture the bottom-nav centre action to confirm the new navbar logo renders.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";

async function mockAuth(page: Page, request: APIRequestContext) {
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
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

test("centre action shows the new navbar logo", async ({ page, request }) => {
  await mockAuth(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const img = page.locator('img[src="/legalir-navbar-center-logo.png"]');
  await expect(img).toBeVisible({ timeout: 15_000 });

  const box = await img.boundingBox();
  expect(box?.height).toBeGreaterThan(30);

  await page.locator("[data-center-action]").screenshot({ path: "e2e/__shots__/navbar-center-logo.png" });
});
