/**
 * TEMP (not committed) — PromoModule CTA contrast probe.
 * Captures the module's CTA in light + dark and logs the computed text colour
 * so the small-text AA question is answered from real pixels, not guesses.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const RUN_MOBILE = `0913${String(Date.now()).slice(-7)}`;
const OTP_CODE = "405405";
let sessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: RUN_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data?.challengeId;
  if (!challengeId) throw new Error("otp request failed");
  const verifyRes = await request.post("/api/auth/otp/verify", { data: { challengeId, code: OTP_CODE } });
  const sid = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sid) throw new Error("otp verify failed");
  sessionId = sid;
  return sid;
}

async function seed(page: Page, sid: string, theme: "light" | "dark") {
  await page.context().addCookies([{ name: "legalir-session", value: sid, url: "http://localhost:3000" }]);
  await page.addInitScript(
    (data) => {
      localStorage.setItem("legalir-auth", JSON.stringify(data.auth));
      localStorage.setItem("legalir-theme", data.theme);
      document.documentElement.setAttribute("data-theme", data.theme);
    },
    {
      theme,
      auth: {
        state: {
          session: {
            sessionId: sid,
            userId: "promo-probe-user",
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

for (const theme of ["light", "dark"] as const) {
  test(`promo CTA — ${theme}`, async ({ page, request }) => {
    const sid = await getSession(request);
    await seed(page, sid, theme);
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

    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const cta = page.getByRole("link", { name: /مرور خدمات/ });
    await cta.scrollIntoViewIfNeeded();
    const box = (await cta.boundingBox())!;

    const metrics = await page.evaluate(() => {
      const el = [...document.querySelectorAll("a")].find((a) => /مرور خدمات/.test(a.textContent || ""))!;
      const cs = getComputedStyle(el);
      let node: HTMLElement | null = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (node) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
          bg = c;
          break;
        }
        node = node.parentElement;
      }
      return { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, bg, theme: document.documentElement.getAttribute("data-theme") };
    });
    console.log(`[${theme}] base`, JSON.stringify(metrics));

    await cta.hover();
    await page.waitForTimeout(400);
    const hover = await page.evaluate(() => {
      const el = [...document.querySelectorAll("a")].find((a) => /مرور خدمات/.test(a.textContent || ""))!;
      return getComputedStyle(el).color;
    });
    console.log(`[${theme}] hover color`, hover);

    const pad = 16;
    await page.screenshot({
      path: `e2e/__shots__/promo-${theme}.png`,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - 120),
        width: Math.min(1280, box.width + pad * 2),
        height: Math.min(500, box.height + 180),
      },
    });
    expect(box.width).toBeGreaterThan(0);
  });
}

// Affected card surfaces — the dashboard subscription/usage card (brand text +
// warm-gold coin tile) and the settings/usage reward-points tile.
for (const theme of ["light", "dark"] as const) {
  test(`affected cards — ${theme}`, async ({ page, request }) => {
    const sid = await getSession(request);
    await seed(page, sid, theme);
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

    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.goto("/dashboard");
    await page.waitForTimeout(2500);

    const usageCard = page.getByText("اعتبار امروز اشتراک", { exact: true });
    await usageCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // Nudge up so the card header is inside the frame, then viewport-capture.
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `e2e/__shots__/usage-card-${theme}.png` });

    await page.goto("/settings/usage");
    await page.waitForTimeout(2000);
    const coin = page.getByText("امتیازهای شما", { exact: true });
    await coin.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const c2 = (await coin.boundingBox())!;
    await page.screenshot({
      path: `e2e/__shots__/settings-usage-coin-${theme}.png`,
      clip: { x: Math.max(0, c2.x - 40), y: Math.max(0, c2.y - 60), width: 420, height: 260 },
    });

    expect(c2.width).toBeGreaterThan(0);
  });
}
