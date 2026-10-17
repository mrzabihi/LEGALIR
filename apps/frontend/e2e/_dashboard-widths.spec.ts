/**
 * TEMP dashboard width sweep (not committed) — captures the whole dashboard
 * at every required breakpoint so card/hero overflow, clipping, horizontal
 * scroll and label clipping can be eyeballed. Also asserts no horizontal
 * document scroll at any width.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const RUN_MOBILE = `0912${String(Date.now()).slice(-7)}`;
const OTP_CODE = "405405";

let sessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: RUN_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("otp request failed");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sid = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sid) throw new Error("otp verify failed");
  sessionId = sid;
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
            userId: "width-sweep-user",
            mobileE164: `+98${RUN_MOBILE.slice(1)}`,
            mobileDisplay: RUN_MOBILE,
            isNewUser: false,
            createdAt: Date.now(),
          },
        },
        version: 0,
      },
    },
  );
}

test.describe.configure({ mode: "serial" });

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];

test.describe("dashboard width sweep", () => {
  for (const width of WIDTHS) {
    test(`width ${width} — no horizontal scroll`, async ({ page, request }) => {
      const sid = await getSession(request);
      await seed(page, sid);
      // Suppress the "complete your profile" modal so it never covers the
      // cards we are auditing.
      await page.route("**/api/v1/me/preferences", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: { showProfileCompletionPrompt: false },
            }),
          });
          return;
        }
        await route.continue();
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/dashboard");
      await page.waitForTimeout(2500);

      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(doc.client + 1);

      // Report any element wider than the viewport (diagnostic).
      const offenders = await page.evaluate((w) => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > w + 2 && r.height > 0 && r.width < 6000) {
            out.push(`${el.tagName}.${(el.className || "").toString().slice(0, 60)} → ${Math.round(r.width)}px`);
          }
        });
        return out.slice(0, 8);
      }, width);
      if (offenders.length) console.log(`[${width}] wider-than-viewport:`, offenders);

      await page.screenshot({
        path: `e2e/__shots__/dash-${width}.png`,
        fullPage: width <= 430,
      });
      if (width > 430) {
        await page.screenshot({ path: `e2e/__shots__/dash-${width}-full.png`, fullPage: true });
      }
    });
  }
});

// Other card-bearing pages — verify the shared card language + the recolored
// case-category chips read as one brand family (no neon).
const OTHER_PAGES = ["/cases", "/services", "/calculators", "/subscription"];

test.describe("other card pages", () => {
  for (const path of OTHER_PAGES) {
    test(`${path} — desktop + mobile`, async ({ page, request }) => {
      const sid = await getSession(request);
      await seed(page, sid);
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
      const slug = path.replace(/\//g, "");
      await page.setViewportSize({ width: 1440, height: 1200 });
      await page.goto(path);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `e2e/__shots__/page-${slug}-1440.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 1200 });
      await page.goto(path);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `e2e/__shots__/page-${slug}-390.png`, fullPage: true });
    });
  }
});
