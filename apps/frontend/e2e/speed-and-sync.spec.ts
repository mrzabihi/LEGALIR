/**
 * ============================================================
 * LEGALIR — speed and cross-surface sync
 * ============================================================
 * Two properties the product must keep on BOTH origins:
 *
 *   http://localhost:3000        the public + app surface
 *   http://admin.localhost:3000  the admin console (rewritten onto /admin)
 *
 * SPEED
 *   Server response (TTFB), DOM-ready, largest contentful paint, payload
 *   weight, request count per load, request count while idle, and client-side
 *   navigation. Budgets are calibrated for the Turbopack dev server, so every
 *   measurement is taken on a WARM second load — the number a developer
 *   actually experiences. They are regression ceilings, not targets: a change
 *   that makes a page an order of magnitude slower, adds a request waterfall,
 *   or turns a client navigation into a full reload fails here.
 *
 * SYNC
 *   The admin panel and the public site must read the same source of truth:
 *     • the public plan catalogue agrees with the admin plan editor,
 *     • every lawyer shown publicly exists in the admin roster,
 *     • both hostnames serve identical public data (no per-host cache),
 *     • authenticated admin HTML is never publicly cacheable,
 *     • an admin feature-flag write is reflected by the very next
 *       `/api/v1/capabilities` read, then restored.
 *
 * Auth follows the OTP-session harness used by the other admin specs
 * (dev SUPER_ADMIN 09120000000 / OTP 405405).
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";

const MAIN = "http://localhost:3000";
const ADMIN = "http://admin.localhost:3000";

/**
 * The same admin origin reachable from Node's `APIRequestContext`, which uses
 * the OS resolver — and Windows does not resolve `*.localhost` (browsers do
 * it themselves). Sending the Host header to the loopback address lands on
 * the identical middleware branch (`isAdminHost` reads the host header).
 */
const ADMIN_API = "http://127.0.0.1:3000";
const ADMIN_HOST_HEADER = { Host: "admin.localhost:3000" };

// --- Budgets ---------------------------------------------------------------
// Every ceiling is roughly 2x the warm measurement taken on this machine in
// dev (Turbopack serves unbundled modules and unminified CSS, so these are far
// larger than the production bundle — that is expected and not a defect).
//
//   route            measured (bytes / requests / LCP)
//   /                1.49 MB / 53 / 904 ms
//   /pricing         1.09 MB / 26 / 340 ms
//   /lawyers         1.46 MB / 63 /  710 ms
//   /dashboard       1.53 MB / 65 / 708 ms
//   /admin           1.34 MB / 40 / 1088 ms
//   /admin/plans     1.34 MB / 39 / 820 ms
//
// /lawyers measured 6.50 MB before its portraits went through next/image: three
// ~1.6 MB uploads were being served at full resolution to 64 px tiles. The
// route now sits with the rest, so its ceiling is the same order as theirs.
//
// Doubling headroom catches the regressions this gate exists for — an added
// request waterfall, an un-cached asset re-fetch, a page that starts polling —
// without failing on normal dev-mode jitter between route compilations.
const TTFB_BUDGET_MS = 2_500;
const DCL_BUDGET_MS = 3_000;
const LCP_BUDGET_MS = 3_000;
const CLIENT_NAV_BUDGET_MS = 5_000;
const CLS_BUDGET = 0.25; // Core Web Vitals "poor" boundary
/** An idle page must not keep polling; a background loop would blow past this. */
const IDLE_WINDOW_MS = 3_000;
const IDLE_REQUESTS_BUDGET = 12;

interface RouteBudget {
  label: string;
  bytes: number;
  requests: number;
}

const BUDGETS: Record<string, RouteBudget> = {
  [`${MAIN}/`]: { label: "/", bytes: 3_200_000, requests: 120 },
  [`${MAIN}/pricing`]: { label: "/pricing", bytes: 2_800_000, requests: 100 },
  [`${MAIN}/lawyers`]: { label: "/lawyers", bytes: 3_200_000, requests: 140 },
  [`${MAIN}/dashboard`]: { label: "/dashboard", bytes: 3_200_000, requests: 140 },
  [`${ADMIN}/admin`]: { label: "admin.localhost/admin", bytes: 2_800_000, requests: 100 },
  [`${ADMIN}/admin/plans`]: {
    label: "admin.localhost/admin/plans",
    bytes: 2_800_000,
    requests: 100,
  },
};

// --- Auth ------------------------------------------------------------------

const SESSION_CACHE = path.join(__dirname, "..", ".tmp-e2e", "admin-session.json");

let sessionId: string | null = null;

/** A session another worker (or an earlier run) already minted, if still fresh. */
function readCachedSession(): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSION_CACHE, "utf8")) as {
      sessionId?: string;
      at?: number;
    };
    // The dev OTP rate limit is 3 requests / 5 min per mobile, so a cached
    // session is the difference between "the suite runs" and "the suite
    // starves". Sessions outlive this window; the cache only needs to.
    if (raw.sessionId && raw.at && Date.now() - raw.at < 10 * 60_000) return raw.sessionId;
  } catch {
    // No cache yet, or unreadable — fall through and mint one.
  }
  return null;
}

function writeCachedSession(sid: string) {
  fs.mkdirSync(path.dirname(SESSION_CACHE), { recursive: true });
  fs.writeFileSync(SESSION_CACHE, JSON.stringify({ sessionId: sid, at: Date.now() }));
}

/**
 * One dev session per run, shared across workers.
 *
 * `playwright.config.ts` runs files in parallel, so several workers reach this
 * at once and the second and third OTP requests are served fine — the fourth
 * is rate limited. A worker that is refused waits for whichever worker did
 * get through to publish its session, instead of failing the test.
 */
async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;

  const cached = readCachedSession();
  if (cached) {
    sessionId = cached;
    return cached;
  }

  const reqRes = await request.post(`${MAIN}/api/auth/otp/request`, {
    data: { mobile: ADMIN_MOBILE },
  });
  const reqBody = (await reqRes.json()) as {
    code?: string;
    data?: { challengeId?: string };
  };

  if (!reqBody.data?.challengeId) {
    if (reqBody.code === "RATE_LIMITED") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const fromPeer = readCachedSession();
        if (fromPeer) {
          sessionId = fromPeer;
          return fromPeer;
        }
      }
    }
    throw new Error(`OTP request failed: ${JSON.stringify(reqBody)}`);
  }

  const verifyRes = await request.post(`${MAIN}/api/auth/otp/verify`, {
    data: { challengeId: reqBody.data.challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`OTP verify failed: ${JSON.stringify(verifyBody)}`);

  writeCachedSession(sid);
  sessionId = sid;
  return sid;
}

/**
 * Sign a page in on BOTH origins. Cookies are host-only on purpose (see
 * middleware.ts): one set on `localhost` is never sent to `admin.localhost`,
 * so each origin needs its own copy — exactly what an operator with a tab on
 * each gets.
 */
async function seedAuth(page: Page, sid: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: MAIN },
    { name: SESSION_COOKIE, value: sid, url: ADMIN },
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

/** API read with the dev session attached (request contexts bring no cookies). */
async function authedGet(request: APIRequestContext, url: string, sid: string) {
  const res = await request.get(url, { headers: { Cookie: `${SESSION_COOKIE}=${sid}` } });
  expect(res.status(), `GET ${url} → ${res.status()}`).toBe(200);
  return res;
}

// --- Measurement -----------------------------------------------------------

/** Collect LCP/CLS from the first paint, before any app script can run. */
async function installVitals(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        })[]) {
          if (!entry.hadRecentInput) w.__cls += entry.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Older engines: the LCP assertion is skipped rather than failing on
      // browser support, which is not a product regression.
    }
  });
}

interface LoadMetrics {
  /** Milliseconds from request start to first response byte. */
  ttfb: number;
  /** Milliseconds to DOMContentLoaded, from navigation start. */
  dcl: number;
  /** Document + every subresource actually transferred. */
  bytes: number;
  /** Requests issued during the measured load. */
  requests: number;
  /** Requests issued during an idle window afterwards (polling detector). */
  idleRequests: number;
  lcp: number;
  cls: number;
}

/**
 * Load `url` twice and report what the browser did on the second (warm) load.
 * The first load lets Turbopack compile the route, so a cold compile is not
 * charged to the budget.
 */
async function measureLoad(page: Page, url: string): Promise<LoadMetrics> {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  let requests = 0;
  const count = () => {
    requests += 1;
  };
  page.on("request", count);

  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response?.status(), `GET ${url}`).toBe(200);
  await page.waitForTimeout(400);

  // Idle window: a page that keeps polling shows up here.
  const beforeIdle = requests;
  await page.waitForTimeout(IDLE_WINDOW_MS);
  const idleRequests = requests - beforeIdle;

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const w = window as unknown as { __lcp: number; __cls: number };
    let resourceBytes = 0;
    for (const r of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
      resourceBytes += r.encodedBodySize || 0;
    }
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      dcl: nav ? nav.domContentLoadedEventEnd : 0,
      bytes: (nav?.encodedBodySize || 0) + resourceBytes,
      lcp: w.__lcp ?? 0,
      cls: w.__cls ?? 0,
    };
  });

  page.off("request", count);
  // `requests` counted the second load and the idle window together.
  return { ...timing, requests: beforeIdle, idleRequests };
}

function expectFast(url: string, m: LoadMetrics) {
  const budget = BUDGETS[url];
  expect(budget, `no budget declared for ${url}`).toBeTruthy();
  const label = budget!.label;

  expect(m.ttfb, `${label}: server response`).toBeLessThan(TTFB_BUDGET_MS);
  expect(m.dcl, `${label}: DOM ready`).toBeLessThan(DCL_BUDGET_MS);
  expect(m.bytes, `${label}: transferred bytes (${m.bytes})`).toBeLessThan(budget!.bytes);
  expect(m.requests, `${label}: requests per load`).toBeLessThan(budget!.requests);
  // Any real layout shift is the defect users describe as "the page jumps".
  expect(m.cls, `${label}: cumulative layout shift`).toBeLessThan(CLS_BUDGET);
  if (m.lcp > 0) expect(m.lcp, `${label}: LCP`).toBeLessThan(LCP_BUDGET_MS);
}

// ============================================================
// SPEED — public surface
// ============================================================

test.describe("Speed — public surface", () => {
  for (const url of [`${MAIN}/`, `${MAIN}/pricing`, `${MAIN}/lawyers`]) {
    test(`${url} renders within budget`, async ({ page }) => {
      await installVitals(page);
      const m = await measureLoad(page, url);
      expectFast(url, m);
      // A public page that keeps fetching while the user reads it is either
      // polling on purpose (none of these do) or leaking an effect.
      expect(m.idleRequests, `${BUDGETS[url]!.label}: requests while idle`).toBeLessThanOrEqual(
        IDLE_REQUESTS_BUDGET,
      );
    });
  }
});

// ============================================================
// SPEED — signed-in app
// ============================================================

test.describe("Speed — signed-in app", () => {
  test("the dashboard renders within budget", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAuth(page, sid);
    await installVitals(page);

    const m = await measureLoad(page, `${MAIN}/dashboard`);
    expectFast(`${MAIN}/dashboard`, m);
  });

  /**
   * The dashboard's widgets each own a loading branch, and the hero/progress
   * skeletons must reserve the SAME height as the loaded content at every
   * breakpoint. They did not: the stat row's placeholder was 80 px against
   * 179–207 px of real cards, so the whole page jumped when data arrived
   * (CLS 0.42 — Google's "poor" band starts at 0.25). Because the size of the
   * jump depends on the column width, this must hold at a phone width AND a
   * laptop width, not just the desktop default.
   */
  test("the dashboard does not jump while its widgets load", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAuth(page, sid);

    for (const [width, height] of [
      [390, 844],
      [1024, 800],
    ] as const) {
      await page.setViewportSize({ width, height });
      await installVitals(page);
      await page.goto(`${MAIN}/dashboard`, { waitUntil: "networkidle" });
      // Widgets fetch independently; give the last one time to land.
      await page.waitForTimeout(2_500);
      const cls = await page.evaluate(
        () => (window as unknown as { __cls: number }).__cls ?? 0,
      );
      expect(cls, `dashboard CLS at ${width}px`).toBeLessThan(0.1);
    }
  });
});

// ============================================================
// SPEED — admin console on admin.localhost
// ============================================================

test.describe("Speed — admin console", () => {
  test("the overview renders within budget", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAuth(page, sid);
    await installVitals(page);

    const m = await measureLoad(page, `${ADMIN}/admin`);
    expectFast(`${ADMIN}/admin`, m);
  });

  test("the plans editor renders within budget", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAuth(page, sid);
    await installVitals(page);

    const m = await measureLoad(page, `${ADMIN}/admin/plans`);
    expectFast(`${ADMIN}/admin/plans`, m);
  });

  test("a sidebar navigation is a client transition, not a reload", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await seedAuth(page, sid);

    await page.goto(`${ADMIN}/admin`, { waitUntil: "networkidle" });
    const navEntriesBefore = await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    );

    const started = Date.now();
    await page.getByRole("link", { name: /پلن‌ها، اشتراک و سهمیه/ }).first().click();
    await expect(page.locator("header h1").first()).toHaveText("پلن‌ها، اشتراک و سهمیه", {
      timeout: CLIENT_NAV_BUDGET_MS,
    });
    const elapsed = Date.now() - started;

    // A full reload would reset the document: a second navigation-timing entry
    // would appear. Client transitions keep exactly one.
    const navEntriesAfter = await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    );
    expect(navEntriesAfter, "document was reloaded instead of client-navigated").toBe(
      navEntriesBefore,
    );
    expect(elapsed, "client navigation").toBeLessThan(CLIENT_NAV_BUDGET_MS);
  });
});

// ============================================================
// SYNC — public catalogue vs admin editor
// ============================================================

test.describe("Sync — the public catalogue matches the admin editor", () => {
  test("every public plan is the same plan the admin panel manages", async ({ request }) => {
    const sid = await ensureSession(request);

    const publicRes = await request.get(`${MAIN}/api/v1/plans`);
    expect(publicRes.status()).toBe(200);
    const publicPlans = ((await publicRes.json()) as {
      data: {
        code: string;
        nameFa: string;
        listPrice: number;
        salePrice: number;
        durationDays: number;
      }[];
    }).data;

    const adminRes = await authedGet(request, `${MAIN}/api/v1/admin/plans`, sid);
    const adminPlans = ((await adminRes.json()) as {
      data: {
        items: {
          code: string;
          nameFa: string;
          listPrice: number;
          salePrice: number;
          durationDays: number;
        }[];
      };
    }).data.items;

    expect(publicPlans.length).toBeGreaterThan(0);
    expect(adminPlans.length).toBeGreaterThan(0);

    const adminByCode = new Map(adminPlans.map((p) => [p.code, p]));
    for (const plan of publicPlans) {
      const admin = adminByCode.get(plan.code);
      expect(admin, `public plan ${plan.code} is missing from the admin editor`).toBeTruthy();
      // The price a visitor sees is the price the admin set — one source.
      expect(admin!.nameFa, `${plan.code}: name`).toBe(plan.nameFa);
      expect(admin!.listPrice, `${plan.code}: list price`).toBe(plan.listPrice);
      expect(admin!.salePrice, `${plan.code}: sale price`).toBe(plan.salePrice);
      expect(admin!.durationDays, `${plan.code}: duration`).toBe(plan.durationDays);
    }
  });

  test("every publicly listed lawyer exists in the admin roster", async ({ request }) => {
    const sid = await ensureSession(request);

    const publicRes = await request.get(`${MAIN}/api/v1/lawyers`);
    expect(publicRes.status()).toBe(200);
    const publicLawyers = ((await publicRes.json()) as {
      data: { items: { id: string; fullName: string }[] };
    }).data.items;

    // The admin list is paginated (default 20, max 100 — see
    // lib/admin/pagination.ts), so walk every page. A single capped page would
    // report every public lawyer past row 20 as "missing".
    const adminIds = new Set<string>();
    for (let pageNo = 1; pageNo <= 20; pageNo += 1) {
      const res = await authedGet(
        request,
        `${MAIN}/api/v1/admin/lawyers?page=${pageNo}&pageSize=100`,
        sid,
      );
      const body = (await res.json()) as {
        data: { items: { id: string }[]; total?: number };
      };
      const items = body.data.items;
      for (const item of items) adminIds.add(item.id);
      if (items.length === 0) break;
      if (body.data.total !== undefined && adminIds.size >= body.data.total) break;
    }

    expect(publicLawyers.length).toBeGreaterThan(0);
    expect(adminIds.size, "admin roster was empty").toBeGreaterThan(0);

    // A public profile with no admin row would be unmoderatable.
    const missing = publicLawyers.filter((l) => !adminIds.has(l.id));
    expect(missing.map((l) => `${l.id} (${l.fullName})`)).toEqual([]);
  });
});

// ============================================================
// SYNC — the two hostnames
// ============================================================

test.describe("Sync — both hostnames serve the same data", () => {
  test("public API responses are identical on localhost and admin.localhost", async ({
    request,
  }) => {
    for (const path of ["/api/v1/plans", "/api/v1/legal-library/topics"]) {
      const mainRes = await request.get(`${MAIN}${path}`);
      const adminRes = await request.get(`${ADMIN_API}${path}`, {
        headers: ADMIN_HOST_HEADER,
      });
      expect(mainRes.status(), `${MAIN}${path}`).toBe(200);
      expect(adminRes.status(), `${ADMIN}${path}`).toBe(200);

      // Same store, same payload — a per-host cache or a host-gated branch
      // would silently split the two surfaces. `meta.requestId` is minted per
      // request by design (it is the support/audit handle), so it is the one
      // field that MUST differ; compare everything else.
      const strip = (body: unknown) => {
        const clone = JSON.parse(JSON.stringify(body)) as { meta?: { requestId?: string } };
        if (clone.meta) delete clone.meta.requestId;
        return clone;
      };
      expect(strip(await adminRes.json()), `${path} differs between hosts`).toEqual(
        strip(await mainRes.json()),
      );
    }
  });

  test("authenticated admin HTML is never publicly cacheable", async ({ request }) => {
    const sid = await ensureSession(request);

    for (const path of ["/admin", "/admin/plans", "/admin/lawyers"]) {
      const res = await request.get(`${ADMIN_API}${path}`, {
        headers: { ...ADMIN_HOST_HEADER, Cookie: `${SESSION_COOKIE}=${sid}` },
      });
      expect(res.status(), `${ADMIN}${path}`).toBe(200);

      const cacheControl = (res.headers()["cache-control"] ?? "").toLowerCase();
      // A shared cache holding this HTML would serve one operator's console to
      // the next visitor — the worst possible sync failure.
      expect(cacheControl, `${path}: cache-control`).toContain("no-store");
      expect(cacheControl, `${path}: must not be public`).not.toContain("public");
    }
  });
});

// ============================================================
// SYNC — an admin write is visible to the next read
// ============================================================

test.describe("Sync — an admin write is visible to the next read", () => {
  const FLAG = "calculators";

  test("a flag toggled through the admin API is reflected in capabilities, then restored", async ({
    request,
  }) => {
    const sid = await ensureSession(request);
    const headers = { Cookie: `${SESSION_COOKIE}=${sid}` };

    const read = async () => {
      const res = await request.get(`${MAIN}/api/v1/capabilities`, { headers });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        data: { capabilities: { key: string; status: string; enabled: boolean }[] };
      };
      const cap = body.data.capabilities.find((c) => c.key === FLAG);
      expect(cap, `${FLAG} missing from capabilities`).toBeTruthy();
      return cap!;
    };

    const original = await read();

    try {
      const offRes = await request.patch(`${MAIN}/api/v1/admin/flags/${FLAG}`, {
        headers,
        data: { status: "off" },
      });
      expect(offRes.status()).toBe(200);

      const afterOff = await read();
      expect(afterOff.enabled, "capability after the admin write").toBe(false);
    } finally {
      const restoreRes = await request.patch(`${MAIN}/api/v1/admin/flags/${FLAG}`, {
        headers,
        data: { status: original.status },
      });
      expect(restoreRes.status(), "restoring the flag").toBe(200);
    }

    const restored = await read();
    expect(restored.enabled, "capability after restore").toBe(original.enabled);
  });
});
