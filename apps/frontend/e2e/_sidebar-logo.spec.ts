/**
 * TEMP verification spec (NOT COMMITTED) — sidebar logo swap.
 *
 * Captures the desktop sidebar (and a tight crop of its logo) so the new
 * "sidebar legalir stroke" artwork can be compared against the old asset,
 * on the real green sidebar gradient, in light and dark.
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

async function mockAuth(page: Page, sessionId: string, theme: "light" | "dark") {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => {
      localStorage.setItem("legalir-auth", JSON.stringify(data.auth));
      localStorage.setItem("legalir-theme", data.theme);
      const apply = () => {
        const el = document.documentElement;
        if (el) el.setAttribute("data-theme", data.theme);
      };
      apply();
      document.addEventListener("DOMContentLoaded", apply);
    },
    {
      theme,
      auth: {
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
    }
  );
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

for (const scheme of ["light", "dark"] as const) {
  test(`sidebar logo (${scheme})`, async ({ page, request }) => {
    const sid = await getOrCreateSession(request);
    await mockAuth(page, sid, scheme);
    await page.setViewportSize({ width: 1440, height: 950 });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const logo = page.getByAltText("LEGALIR").first();
    await logo.waitFor({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    // Full desktop sidebar.
    await page.locator("aside").first().screenshot({
      path: `e2e/__shots__/sidebar-logo-${scheme}.png`,
    });
    // Tight crop of the logo lockup (its padded container).
    await page
      .locator("div", { has: logo })
      .first()
      .screenshot({ path: `e2e/__shots__/sidebar-logo-crop-${scheme}.png` });

    // Report the rendered logo box so we can compare framing/size.
    const box = await logo.boundingBox();
    console.log(`[sidebar/${scheme}] logo box = ${JSON.stringify(box)}`);

    const real = errors.filter(
      (e) => !/favicon|manifest|Download the React|404|Failed to load resource/i.test(e)
    );
    expect(real, real.join("\n")).toEqual([]);
  });
}
