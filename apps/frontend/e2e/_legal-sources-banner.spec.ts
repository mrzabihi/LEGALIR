/**
 * TEMP verification spec (NOT COMMITTED) — photographic background for the
 * legal-sources section («پوشش حقوقی» → «از قانون مدنی تا آرای وحدت رویه»)
 * on /services.
 *
 * Reuses the demo-login harness from `_library-md3.spec.ts`. Captures the
 * section itself at mobile (390) and desktop (1440), light and dark, and
 * asserts no console error and no horizontal overflow.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const TITLE = "از قانون مدنی تا آرای وحدت رویه";

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

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 950 },
];

for (const vp of VIEWPORTS) {
  for (const scheme of ["light", "dark"] as const) {
    test(`legal-sources section ${vp.name} (${scheme})`, async ({ page, request }) => {
      const sid = await getOrCreateSession(request);
      await mockAuth(page, sid, scheme);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });

      await page.goto("/services", { waitUntil: "domcontentloaded" });
      const heading = page.getByRole("heading", { name: TITLE }).first();
      await heading.waitFor({ timeout: 20_000 });
      await heading.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(700);

      // The PromoPanel <section> that hosts this heading.
      const section = page.locator("section", { has: heading }).first();
      await section.screenshot({
        path: `e2e/__shots__/legal-sources-${vp.name}-${scheme}.png`,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      console.log(`[legal-sources/${vp.name}/${scheme}] overflow = ${overflow}px`);

      await expect(page.getByText("خطای بحرانی")).toHaveCount(0);
      const real = errors.filter(
        (e) => !/favicon|manifest|Download the React|404|Failed to load resource/i.test(e)
      );
      expect(real, real.join("\n")).toEqual([]);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
