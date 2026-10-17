/**
 * TEMP verification spec (not committed) — the dashboard «مسئله حقوقی» search box.
 * Captures resting / focused / typed states at several widths and asserts the
 * field never overflows its own box or the viewport, and that the floated label
 * carries a background patch (the real MD3 notch) rather than sitting under the
 * border.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// Unique mobile per run — the OTP route rate-limits 3 requests / 5 min per
// mobile, so a fixed demo number is exhausted after a couple of runs.
const RUN_MOBILE = `0912${String(Date.now()).slice(-7)}`;
const OTP_CODE = "405405";
const LONG_TEXT =
  "می‌خواهم بدانم اگر مستأجر بدون اجازهٔ مالک ملک را به شخص سومی واگذار کند و مالک بعد از دو سال متوجه شود، چه حق قانونی برای فسخ قرارداد و مطالبه اجاره‌بها دارد؟";

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

async function seed(page: Page, sid: string, theme: "light" | "dark" = "light") {
  await page.context().addCookies([
    { name: "legalir-session", value: sid, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => {
      localStorage.setItem("legalir-auth", JSON.stringify(data.auth));
      // The mounted ThemeProvider (lib/theme.tsx) persists the theme as a RAW
      // string under this key and owns `data-theme` — not the zustand store's
      // JSON shape, which would be rejected and fall back to light.
      localStorage.setItem("legalir-theme", data.theme);
      document.documentElement.setAttribute("data-theme", data.theme);
    },
    {
      theme,
      auth: {
        state: {
          session: {
            sessionId: sid,
            userId: "search-verify-user",
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

test.describe("dashboard search box", () => {
  const cases: Array<[number, "light" | "dark"]> = [
    [360, "light"],
    [390, "light"],
    [768, "light"],
    [1440, "light"],
    [390, "dark"],
  ];
  for (const [width, theme] of cases) {
    test(`${theme} width ${width} — no overflow, label notch present`, async ({
      page,
      request,
    }) => {
      const sid = await getSession(request);
      await seed(page, sid, theme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard");

      const input = page.getByLabel("مسئله حقوقی خود را توضیح دهید").first();
      await input.waitFor({ state: "visible", timeout: 20_000 });

      const field = input.locator("xpath=ancestor::div[contains(@class,'brand-search-field')]");

      // 1) Focus → floated label + example placeholder both visible.
      // The MD3 floating label overlays the input and forwards focus, so a
      // synthetic click is intercepted by design; focus the field directly.
      await input.focus();
      await expect(input).toBeFocused();
      await page.waitForTimeout(400);
      const clipShot = async (tag: string) => {
        const b = await field.boundingBox();
        if (!b) return;
        await page.screenshot({
          path: `e2e/__shots__/search-${theme}-${width}-${tag}.png`,
          clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 16), width: b.width + 16, height: b.height + 32 },
        });
      };
      await clipShot("focus");

      // 2) Type a long Persian problem → single line, no wrap/no overflow.
      await input.fill(LONG_TEXT);
      await page.waitForTimeout(300);

      const metrics = await input.evaluate((el: HTMLInputElement) => {
        const field = el.closest(".brand-search-field") as HTMLElement;
        const fr = field.getBoundingClientRect();
        const track = el.parentElement as HTMLElement;
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          // A single-line input never grows taller for long text — the value
          // scrolls inside a fixed-height box instead of wrapping to line 2.
          singleLine: el.getBoundingClientRect().height === track.getBoundingClientRect().height,
          fieldLeft: Math.round(fr.left),
          fieldRight: Math.round(fr.right),
        };
      });
      // Long text is clipped/scrollable inside the box (scrollWidth exceeds the
      // visible width) rather than expanding the layout or wrapping.
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
      expect(metrics.singleLine).toBe(true);
      // The whole field stays inside the viewport (no negative/overflowing edge).
      expect(metrics.fieldLeft).toBeGreaterThanOrEqual(-1);
      expect(metrics.fieldRight).toBeLessThanOrEqual(width + 1);

      // The floated label must now carry a background patch (the notch).
      const labelBg = await field
        .locator("label[for]")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(labelBg).not.toBe("rgba(0, 0, 0, 0)");
      expect(labelBg).not.toBe("transparent");

      // 3) The whole document must not scroll horizontally.
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll).toBeLessThanOrEqual(doc.client + 1);

      await clipShot("typed");
    });
  }
});
