/**
 * TEMP verification spec (NOT COMMITTED) — MD3 + brand-palette treatment of the
 * subscription/checkout cluster and the lawyers cluster. Both clusters had
 * broken `/opacity`-on-`var()` Tailwind classes (silently dropped CSS) replaced
 * with solid MD3 container roles; this confirms the surfaces still render
 * cleanly in light AND dark with no crash, no console error and no overflow.
 *
 * Mirrors the harness in `_library-md3.spec.ts` (same demo login, same
 * light/dark capture, same "no crash / no console error" assertion).
 * Captures into e2e/__shots__/md3-subs-*.png for before/after comparison.
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
      // The app themes via `[data-theme]`, not `prefers-color-scheme`.
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

const SURFACES: { name: string; path: string; heading?: string }[] = [
  { name: "subscription", path: "/subscription", heading: "اشتراک" },
  { name: "lawyers", path: "/lawyers", heading: "وکلای LEGALIR" },
  { name: "lawyer-detail", path: "/lawyers/demo-lawyer-02" },
  { name: "case-detail", path: "/cases/case-demo-001" },
];

for (const s of SURFACES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${s.name} (${scheme}) renders clean`, async ({ page, request }) => {
      const sid = await getOrCreateSession(request);
      await mockAuth(page, sid, scheme);
      await page.setViewportSize({ width: 1440, height: 950 });

      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 400) console.log(`[HTTP ${r.status()}] ${r.request().method()} ${r.url()}`);
      });

      await page.goto(s.path, { waitUntil: "domcontentloaded" });
      if (s.heading) {
        await page.getByRole("heading", { name: s.heading }).first().waitFor({ timeout: 20_000 });
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(900);

      await page.screenshot({
        path: `e2e/__shots__/md3-subs-${s.name}-${scheme}.png`,
        fullPage: true,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      console.log(`[${s.name}/${scheme}] horizontal overflow = ${overflow}px`);

      await expect(page.getByText("خطای بحرانی")).toHaveCount(0);
      const real = errors.filter((e) => !/favicon|manifest|Download the React/i.test(e));
      expect(real, real.join("\n")).toEqual([]);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
