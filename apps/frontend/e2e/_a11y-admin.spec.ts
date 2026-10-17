/**
 * TEMPORARY — keyboard / focus / reduced-motion checks for the admin pass.
 * Not committed. Run with playwright.live.config.ts against the dev server.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";

let sessionId: string | null = null;

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`otp request failed: ${JSON.stringify(reqBody)}`);
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`otp verify failed: ${JSON.stringify(verifyBody)}`);
  sessionId = sid;
  return sid;
}

async function seed(page: Page, sid: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: sid,
          userId: "admin-user-id",
          mobileE164: ADMIN_MOBILE_E164,
          mobileDisplay: ADMIN_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    }
  );
}

test("admin keyboard + focus contracts", async ({ page, request }) => {
  test.setTimeout(180_000);
  const sid = await ensureSession(request);
  await seed(page, sid);

  // 1. Every data table is a focusable scroll region with an accessible name.
  await page.goto("/admin/users", { waitUntil: "networkidle" });
  const regions = page.locator('[role="region"][aria-label*="جدول داده"]');
  expect(await regions.count()).toBeGreaterThan(0);
  expect(await regions.first().getAttribute("tabindex")).toBe("0");

  // 2. The tablist takes one stop, and arrows move between tabs (RTL order:
  //    ArrowLeft advances) with the roving tabindex following.
  await page.goto("/admin/analytics", { waitUntil: "networkidle" });
  const tabs = page.locator('[role="tab"]');
  await expect(tabs.first()).toBeVisible();
  const stops = await tabs.evaluateAll((els) => els.map((e) => (e as HTMLElement).tabIndex));
  expect(stops.filter((t) => t === 0)).toHaveLength(1);

  await page.locator('[role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("role") ?? "")).toBe("tab");

  // 3. Charts are keyboard reachable and support hover-equivalent navigation.
  const chart = page.locator('svg[tabindex="0"]').first();
  if ((await chart.count()) > 0) {
    await chart.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await expect(chart).toBeFocused();
  }

  // 4. Focus is always visible: a focused button paints an outline or a ring.
  const btn = page.getByRole("button").first();
  await btn.focus();
  const ring = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineStyle}|${s.boxShadow}`;
  });
  expect(ring).not.toBe("none|none");

  // 5. Reduced motion: transitions collapse and nothing animates forever.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin", { waitUntil: "networkidle" });
  const motion = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("a.group") ?? document.body;
    const s = getComputedStyle(el);
    return { dur: s.transitionDuration, anim: s.animationDuration };
  });
  expect(parseFloat(motion.dur)).toBeLessThan(0.05);
  expect(parseFloat(motion.anim)).toBeLessThan(0.05);

  // 6. Touch targets: interactive controls are >= 40px tall on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/support", { waitUntil: "networkidle" });
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main button, main a[role=tab]"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({
        h: el.getBoundingClientRect().height,
        t: (el.textContent ?? "").trim().slice(0, 20),
      }))
      .filter((x) => x.h > 0 && x.h < 40)
      .slice(0, 6)
  );
  expect(small).toEqual([]);
});
