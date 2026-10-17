/**
 * TEMP redesign width sweep (not committed) — captures the four redesigned
 * list surfaces (/history, /cases, /contracts, /documents) at every required
 * breakpoint and asserts there is no horizontal document scroll at any width.
 *
 * Uses the seeded DEMO account so every list actually renders rows.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const OTP_CODE = "405405";

let cachedSessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("otp request failed");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sid = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sid) throw new Error("otp verify failed");
  cachedSessionId = sid;
  return sid;
}

async function seed(page: Page, sid: string) {
  await page.context().addCookies([
    { name: "legalir-session", value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => {
      localStorage.setItem("legalir-auth", JSON.stringify(data.auth));
      localStorage.setItem("legalir-theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
    },
    {
      auth: {
        state: {
          session: {
            sessionId: sid,
            userId: "demo-user-id",
            mobileE164: "+989120000003",
            mobileDisplay: DEMO_MOBILE,
            isNewUser: false,
            createdAt: Date.now(),
          },
        },
        version: 0,
      },
    },
  );
}

const WIDTHS = [360, 390, 768, 1024, 1440];
const PAGES: { path: string; slug: string }[] = [
  { path: "/history", slug: "history" },
  { path: "/cases", slug: "cases" },
  { path: "/contracts", slug: "contracts" },
  { path: "/documents", slug: "documents" },
];

test.describe.configure({ mode: "serial" });

test.describe("redesign width sweep", () => {
  for (const { path, slug } of PAGES) {
    for (const width of WIDTHS) {
      test(`${slug} @ ${width}`, async ({ page, request }) => {
        const sid = await getSession(request);
        await seed(page, sid);
        // Suppress the profile-completion modal so it never covers the rows.
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
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(path);
        await page.waitForTimeout(2200);

        const doc = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(doc.scroll, `horizontal overflow at ${width}px on ${path}`).toBeLessThanOrEqual(
          doc.client + 1,
        );

        await page.screenshot({
          path: `e2e/__shots__/redesign-${slug}-${width}.png`,
          fullPage: width <= 768,
        });
      });
    }
  }
});
