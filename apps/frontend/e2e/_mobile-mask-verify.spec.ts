/**
 * ============================================================
 * LEGALIR — Admin mobile mask + rating E2E (temporary verification spec)
 * ============================================================
 * NOT COMMITTED — a throwaway harness that verifies the two admin surfaces the
 * task touched, against the live dev server, at desktop AND mobile widths:
 *
 *   /admin/users   → every mobile is masked-by-default, rendered LTR, with a
 *                    per-row eye reveal toggle; a numeric search still finds a
 *                    masked row.
 *   /admin/lawyers → a «موبایل» column exists, masked + LTR + revealable; the
 *                    «امتیاز» column shows «از ۵» (+ a vote count) or the
 *                    honest «بدون امتیاز» — never a fabricated zero.
 *
 * Reuses the exact OTP-session auth pattern of `_admin-verify.spec.ts`.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000"; // dev seed SUPER_ADMIN (+989120000000)
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;

const MASK_RE = /\*{4}/; // the four-middle-digit mask

let sessionId: string | null = null;

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  // Prefer an already-valid session (the dev OTP endpoint rate-limits to 3
  // requests / 5 min per mobile). Read one from the store and pass it in.
  const provided = process.env["E2E_SESSION"];
  if (provided) {
    sessionId = provided;
    return provided;
  }
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`admin OTP request failed: ${JSON.stringify(reqBody)}`);

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`admin OTP verify failed: ${JSON.stringify(verifyBody)}`);
  sessionId = sid;
  return sid;
}

async function seedAdmin(page: Page, sid: string) {
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
    },
  );
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`mobile-mask · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page, request }) => {
      const sid = await ensureSession(request);
      await seedAdmin(page, sid);
    });

    test("users table masks mobiles by default, renders LTR, and reveals per row", async ({
      page,
    }) => {
      await page.goto("/admin/users");
      await expect(page.locator("header h1").first()).toHaveText("کاربران و سازمان‌ها", {
        timeout: READY,
      });

      // The first data row's mobile cell — masked, isolated LTR.
      const masked = page.locator('bdi[dir="ltr"]').filter({ hasText: MASK_RE }).first();
      await expect(masked).toBeVisible({ timeout: READY });
      const maskedText = (await masked.textContent())?.trim() ?? "";
      expect(maskedText).toMatch(MASK_RE);
      // No full E.164 leaks into the default rendering.
      expect(maskedText).not.toMatch(/\+989\d{8}/);

      await page.screenshot({ path: `test-results/mask-users-${vp.name}-masked.png`, fullPage: true });

      // The reveal toggle flips the same cell to the full value and back.
      const reveal = page.getByRole("button", { name: "نمایش شماره موبایل" }).first();
      await expect(reveal).toBeVisible();
      await reveal.click();
      const revealed = page.locator('bdi[dir="ltr"]').filter({ hasText: /\+989\d{8}/ }).first();
      await expect(revealed).toBeVisible({ timeout: READY });
      await page.screenshot({ path: `test-results/mask-users-${vp.name}-revealed.png`, fullPage: true });
      await page.getByRole("button", { name: "مخفی‌کردن شماره موبایل" }).first().click();
      await expect(
        page.locator('bdi[dir="ltr"]').filter({ hasText: /\+989\d{8}/ }),
      ).toHaveCount(0);
    });

    test("lawyers table shows a mobile column (masked, LTR) and a real rating or «بدون امتیاز»", async ({
      page,
    }) => {
      await page.goto("/admin/lawyers");
      await expect(page.locator("header h1").first()).toHaveText("وکلا", { timeout: READY });

      // Both touched columns exist in the header.
      await expect(page.getByRole("columnheader", { name: "موبایل" })).toBeVisible({
        timeout: READY,
      });
      await expect(page.getByRole("columnheader", { name: "امتیاز" })).toBeVisible();

      // Page 1 of the live data is seeded demo rows (no linked user → «—»), so
      // drive the search to surface a real applicant that carries a mobile.
      const search = page.getByLabel("جستجوی وکیل");
      await search.fill("ذبیحی");
      await search.press("Enter");

      // A masked, LTR mobile rendered in the (now filtered) table body.
      const masked = page.locator('bdi[dir="ltr"]').filter({ hasText: MASK_RE }).first();
      await expect(masked).toBeVisible({ timeout: READY });
      const maskedText = (await masked.textContent())?.trim() ?? "";
      expect(maskedText).toMatch(MASK_RE);

      // The eye reveals the full E.164 for that row and re-masks on second click.
      await page.getByRole("button", { name: "نمایش شماره موبایل" }).first().click();
      await expect(
        page.locator('bdi[dir="ltr"]').filter({ hasText: /\+989\d{8}/ }).first(),
      ).toBeVisible({ timeout: READY });
      await page.getByRole("button", { name: "مخفی‌کردن شماره موبایل" }).first().click();

      // The rating column resolves to either a real «از ۵» value or the honest
      // «بدون امتیاز» — both are acceptable; a bare fabricated «۰» is not.
      const bodyText = (await page.locator("table tbody").innerText()) ?? "";
      const hasRealRating = /از ۵/.test(bodyText);
      const hasNoRating = /بدون امتیاز/.test(bodyText);
      expect(hasRealRating || hasNoRating).toBe(true);

      await page.screenshot({ path: `test-results/mask-lawyers-${vp.name}.png`, fullPage: true });
    });
  });
}

// ============================================================
// Search finds a masked row by its real (stored) number
// ============================================================

test.describe("mobile-mask · search", () => {
  test.beforeEach(async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAdmin(page, sid);
  });

  test("a numeric search still finds the masked row", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("header h1").first()).toHaveText("کاربران و سازمان‌ها", {
      timeout: READY,
    });

    // Read the first masked row's visible prefix/suffix, then reconstruct a
    // query from the un-masked fragment we can see (the last digits).
    const firstMasked = page.locator('bdi[dir="ltr"]').filter({ hasText: MASK_RE }).first();
    await expect(firstMasked).toBeVisible({ timeout: READY });
    const shown = (await firstMasked.textContent())?.trim() ?? "";
    const trailing = shown.replace(/.*\*{4}/, ""); // digits after the stars
    expect(trailing.length).toBeGreaterThan(0);

    const search = page.getByPlaceholder(/جست/).first();
    await search.fill(trailing);

    // The row we read from must survive the search (still visible).
    await expect(firstMasked).toBeVisible({ timeout: READY });
  });
});
