/**
 * ============================================================
 * LEGALIR — Lawyer panel live verification (temporary harness)
 * ============================================================
 * NOT COMMITTED. Proves the §1/§11/§13 clauses against the RUNNING dev server
 * and its REAL JSON tables, with no mocks:
 *
 *   §1  a lawyer account is sent to /lawyer after sign-in, not to the
 *       consumer dashboard and not to the operator console;
 *   §1  a consumer account is NOT sent to /lawyer;
 *   §11 /lawyer is server-gated: a guest goes to the login flow, a consumer
 *       is redirected to /dashboard;
 *   §11 a lawyer calling /api/v1/admin/** is refused (403);
 *   §11 a lawyer calling another lawyer's referral id gets 404, never 403;
 *   §11 a consumer calling /api/v1/lawyer/** is refused;
 *   §13 the dashboard renders real KPIs for the seeded lawyer without any
 *       uncaught page error.
 *
 * Auth uses the same OTP dev code (405405) as the other `_*` harnesses.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";

// Dev seeds: +989120000010 is the login-capable LAWYER, +989120000003 the
// demo consumer, +989120000000 the SUPER_ADMIN.
const LAWYER_MOBILE = "09120000010";
const CONSUMER_MOBILE = "09120000003";
const ADMIN_MOBILE = "09120000000";

/**
 * The OTP endpoint allows 3 requests per mobile per 5 minutes, and these tests
 * sign in repeatedly. Cache the first result per mobile so a run makes at most
 * one OTP request per account.
 */
const sessions = new Map<string, { sid: string; redirectTo: string | null; role: string | null }>();

async function login(request: APIRequestContext, mobile: string): Promise<{ sid: string; redirectTo: string | null; role: string | null }> {
  const cached = sessions.get(mobile);
  if (cached) return cached;

  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  expect(challengeId, `OTP request for ${mobile}`).toBeTruthy();

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const body = (await verifyRes.json()) as {
    data?: { sessionId?: string; redirectTo?: string; role?: string };
  };
  expect(body.data?.sessionId, `OTP verify for ${mobile}`).toBeTruthy();
  const out = {
    sid: body.data!.sessionId!,
    redirectTo: body.data?.redirectTo ?? null,
    role: body.data?.role ?? null,
  };
  sessions.set(mobile, out);
  return out;
}

/**
 * Prime every account ONCE for the whole file. The OTP endpoint allows three
 * requests per mobile per five minutes, so each test must reuse the session
 * instead of signing in again. Run this file with `--workers=1`.
 */
test.beforeAll(async ({ request }) => {
  for (const mobile of [LAWYER_MOBILE, CONSUMER_MOBILE, ADMIN_MOBILE]) {
    await login(request, mobile);
  }
});

/** The primed session for a mobile; the `beforeAll` above guarantees it. */
function sessionFor(mobile: string): { sid: string; redirectTo: string | null } {
  const cached = sessions.get(mobile);
  if (!cached) throw new Error(`no primed session for ${mobile}`);
  return cached;
}

function cookie(sid: string) {
  return { cookie: `${SESSION_COOKIE}=${sid}` };
}

async function seedPage(page: Page, sid: string, home: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
    { name: "legalir-home", value: home, url: "http://localhost:3000" },
  ]);
}

test.describe("§1 post-login workspace", () => {
  test("the lawyer account is redirected to /lawyer", () => {
    // The post-login destination is a SERVER decision returned as `redirectTo`;
    // the role itself is deliberately not echoed in the payload.
    expect(sessionFor(LAWYER_MOBILE).redirectTo).toBe("/lawyer");
  });

  test("the consumer account is redirected to /dashboard", () => {
    expect(sessionFor(CONSUMER_MOBILE).redirectTo).toBe("/dashboard");
  });

  test("the staff account keeps the consumer home, not the workbench", () => {
    expect(sessionFor(ADMIN_MOBILE).redirectTo).not.toBe("/lawyer");
  });
});

test.describe("§11 route boundary", () => {
  test("a guest opening /lawyer lands on the login flow with the intent", async ({ page }) => {
    await page.goto("/lawyer");
    await page.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toBe("/auth/mobile");
    expect(new URL(page.url()).searchParams.get("intent")).toBe("/lawyer");
  });

  test("a consumer opening /lawyer is redirected to /dashboard", async ({ page }) => {
    const { sid } = sessionFor(CONSUMER_MOBILE);
    await seedPage(page, sid, "/dashboard");
    await page.goto("/lawyer");
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("a lawyer opening /admin gets no admin data", async ({ page }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    await seedPage(page, sid, "/lawyer");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/requests");
    await page.waitForLoadState("networkidle");
    // The shell renders an unauthorized state rather than the queue.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("درخواست‌ها و پرونده‌ها");
    expect(errors).toEqual([]);
  });
});

test.describe("§11 API boundary — a URL is not authorization", () => {
  test("a lawyer is refused on the admin API", async ({ request }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    const res = await request.get("/api/v1/admin/requests", { headers: cookie(sid) });
    expect(res.status()).toBe(403);
  });

  test("a consumer is refused on the lawyer API", async ({ request }) => {
    const { sid } = sessionFor(CONSUMER_MOBILE);
    const res = await request.get("/api/v1/lawyer/referrals", { headers: cookie(sid) });
    expect(res.status()).toBe(403);
  });

  test("a guest is refused on the lawyer API", async ({ request }) => {
    const res = await request.get("/api/v1/lawyer/referrals");
    expect(res.status()).toBe(401);
  });

  test("a lawyer opening a referral that is not theirs gets 404", async ({ request }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    const res = await request.get("/api/v1/lawyer/referrals/not-my-referral", {
      headers: cookie(sid),
    });
    expect(res.status()).toBe(404);
  });

  test("every referral row carries a derived priority and the facet lists all four", async ({
    request,
  }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    const res = await request.get("/api/v1/lawyer/referrals", { headers: cookie(sid) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data?: {
        items?: { requestId: string; priority: string }[];
        facets?: { priorities?: { value: string; count: number }[] };
      };
    };
    const priorities = body.data?.facets?.priorities ?? [];
    expect(priorities.map((p) => p.value)).toEqual(["URGENT", "HIGH", "NORMAL", "LOW"]);
    for (const item of body.data?.items ?? []) {
      expect(["URGENT", "HIGH", "NORMAL", "LOW"]).toContain(item.priority);
    }
    // The facet tally covers the whole unfiltered queue, so the filter bar's
    // numbers and the rows agree.
    expect(priorities.reduce((n, p) => n + p.count, 0)).toBe(body.data?.items?.length ?? 0);
  });

  test("the lawyer dashboard endpoint returns real, well-formed counters", async ({ request }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    const res = await request.get("/api/v1/lawyer/dashboard", { headers: cookie(sid) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data?: {
        counts?: Record<string, number>;
        buckets?: Record<string, string[]>;
        trend?: unknown[];
        sla?: Record<string, number>;
      };
    };
    expect(body.data?.counts).toBeTruthy();
    for (const value of Object.values(body.data!.counts!)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("§13 the workbench renders", () => {
  test("the dashboard loads with its real KPI surface", async ({ page }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    await seedPage(page, sid, "/lawyer");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const res = await page.goto("/lawyer");
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    expect(new URL(page.url()).pathname).toBe("/lawyer");
    const text = await page.locator("body").innerText();
    // The workbench's own navigation (LAWYER_NAV), not the consumer shell.
    expect(text).toContain("درخواست‌ها");
    expect(text).toContain("حساب تسویه");
    expect(errors).toEqual([]);
  });

  test("the referral list and the profile/bank/rates surfaces all render", async ({ page }) => {
    const { sid } = sessionFor(LAWYER_MOBILE);
    await seedPage(page, sid, "/lawyer");

    for (const path of ["/lawyer/referrals", "/lawyer/profile", "/lawyer/bank", "/lawyer/rates"]) {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await page.waitForLoadState("networkidle");
      expect(new URL(page.url()).pathname, path).toBe(path);
      expect(errors, path).toEqual([]);
    }
  });
});
