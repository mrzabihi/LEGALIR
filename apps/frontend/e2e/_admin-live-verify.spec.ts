/**
 * ============================================================
 * LEGALIR — Admin live report E2E (temporary verification spec)
 * ============================================================
 * NOT COMMITTED — a throwaway harness proving the «گزارش زنده» block is wired
 * to a REAL, authenticated endpoint (never mock data):
 *
 *   1. the live endpoint is RBAC-gated (a guest gets 401/403);
 *   2. the dev SUPER_ADMIN gets 200 with a well-formed AdminLiveReport;
 *   3. /admin renders the live section without any uncaught page error.
 *
 * Reuses the OTP-session auth pattern from _admin-verify.spec.ts.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000"; // dev seed SUPER_ADMIN (+989120000000)
const ADMIN_MOBILE_E164 = "+989120000000";
const READY = 20_000;

let sessionId: string | null = null;

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
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

test.describe("Admin live report endpoint", () => {
  test("a guest is refused (RBAC gate)", async ({ request }) => {
    const res = await request.get("/api/v1/admin/live");
    expect([401, 403]).toContain(res.status());
  });

  test("the SUPER_ADMIN gets a well-formed AdminLiveReport", async ({ request }) => {
    const sid = await ensureSession(request);
    const res = await request.get("/api/v1/admin/live?rangeDays=30", {
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    });
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data?: {
        generatedAt?: string;
        rangeDays?: number;
        timezone?: string;
        currency?: string;
        sales?: Record<string, unknown>;
        dailyCollected?: unknown[];
        newUsers?: number;
        newRequests?: number;
        openRequests?: number;
        refundPending?: number;
      };
    };
    const r = body.data;
    expect(r, "live report envelope").toBeTruthy();
    expect(r!.rangeDays).toBe(30);
    expect(r!.timezone).toBe("Asia/Tehran");
    expect(r!.currency).toBe("IRT");
    expect(Number.isNaN(Date.parse(r!.generatedAt ?? ""))).toBe(false);

    const s = r!.sales!;
    for (const key of [
      "count",
      "baseAmount",
      "discountAmount",
      "taxAmount",
      "finalAmount",
      "collectedAmount",
      "refundedAmount",
      "netAmount",
      "paidCount",
      "freeCount",
      "unpaidCount",
    ]) {
      expect(typeof s[key], `sales.${key} is a number`).toBe("number");
    }
    // netAmount is derived, not fabricated: collected − refunded.
    expect(s["netAmount"]).toBe((s["collectedAmount"] as number) - (s["refundedAmount"] as number));

    expect(Array.isArray(r!.dailyCollected)).toBe(true);
    // The per-day buckets reconcile with the sales total — one source of truth.
    const sum = (r!.dailyCollected as { value: number }[]).reduce((a, p) => a + p.value, 0);
    expect(sum).toBe(s["collectedAmount"]);
  });
});

test.describe("Admin live report section", () => {
  test("/admin renders «گزارش زنده» with no page error", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAdmin(page, sid);

    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/admin");
    await expect(page.locator("header h1").first()).toHaveText("نمای کلی", { timeout: READY });

    // The live block is present, shows a freshness state, and names its money KPIs.
    await expect(page.getByText("گزارش زنده").first()).toBeVisible({ timeout: READY });
    await expect(page.getByText("مبلغ وصول‌شده").first()).toBeVisible({ timeout: READY });
    await expect(page.getByText("مبلغ بازگشتی").first()).toBeVisible({ timeout: READY });

    expect(pageErrors, "uncaught page errors on /admin").toEqual([]);
  });
});

// ============================================================
// Chart-type-per-page surfaces (§4) — every chart on real data
// ============================================================

test.describe("Admin chart surfaces (§4)", () => {
  const CASES: { path: string; title: string; heading: string }[] = [
    { path: "/admin/reports", title: "گزارش‌ها و خروجی", heading: "روند مبلغ فروش روزانه" },
    { path: "/admin/orders", title: "فروش، پرداخت و بازگشت", heading: "ترکیب مبالغ فروش" },
    { path: "/admin/plans", title: "پلن‌ها، اشتراک و سهمیه", heading: "ترکیب پلن‌ها در بازه" },
  ];

  for (const { path, title, heading } of CASES) {
    test(`${path} renders its chart with no page error`, async ({ page, request }) => {
      const sid = await ensureSession(request);
      await seedAdmin(page, sid);

      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await page.goto(path);
      await expect(page.locator("header h1").first()).toHaveText(title, { timeout: READY });
      // The chart frame (or its section heading) is on screen — the surface is
      // wired to real data, not left as a tables-only page.
      await expect(page.getByText(heading).first()).toBeVisible({ timeout: READY });

      expect(pageErrors, `uncaught page errors on ${path}`).toEqual([]);
    });
  }
});
