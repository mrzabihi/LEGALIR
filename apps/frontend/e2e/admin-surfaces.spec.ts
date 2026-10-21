/**
 * ============================================================
 * LEGALIR — every admin surface renders a real page
 * ============================================================
 * The operational-hardening rule for /admin is that no screen may be a demo
 * page or a dead end. This spec is the regression guard for that rule: it
 * visits every routed admin surface as a real staff session and fails if any
 * of them
 *   · does not resolve (non-2xx document response),
 *   · renders without a page heading, or
 *   · throws a console error / fails an admin API call while doing so.
 *
 * It asserts nothing about CONTENT — each surface's own spec covers its
 * behaviour. The one thing proven here is that the panel has no broken room.
 * ============================================================
 */

import { expect, test, type ConsoleMessage, type Response } from "@playwright/test";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

test.describe.configure({ mode: "serial", timeout: 240_000 });

// Every page under app/(admin)/admin/**, plus the nested staff and settings
// routes. `/admin/review` is deliberately absent: it is a documented redirect
// alias, not a surface of its own.
const SURFACES = [
  "/admin",
  "/admin/users",
  "/admin/requests",
  "/admin/discovery",
  "/admin/lawyers",
  "/admin/contracts",
  "/admin/legal-review",
  "/admin/services",
  "/admin/judicial",
  "/admin/energy",
  "/admin/plans",
  "/admin/orders",
  "/admin/coupons",
  "/admin/finance",
  "/admin/ai",
  "/admin/rag",
  "/admin/calculators",
  "/admin/support",
  "/admin/content",
  "/admin/legal-library",
  "/admin/analytics",
  "/admin/reports",
  "/admin/staff",
  "/admin/staff/roles",
  "/admin/staff/permissions",
  "/admin/settings",
  "/admin/settings/sla",
  "/admin/knowledge",
  "/admin/health",
  "/admin/profile",
] as const;

let cookie: string;

test.beforeAll(async ({ request }) => {
  const session = await ensureAdminSession(request);
  cookie = `${SESSION_COOKIE}=${session.sessionId}`;
});

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: cookie.split("=")[1]!, domain: "localhost", path: "/" },
  ]);
});

test("every admin surface resolves, heads and stays error-free", async ({ page }) => {
  const problems: string[] = [];

  for (const surface of SURFACES) {
    const consoleErrors: string[] = [];
    const failedCalls: string[] = [];

    const onConsole = (m: ConsoleMessage) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 180));
    };
    const onResponse = (r: Response) => {
      const url = r.url();
      if (!url.includes("/api/v1/admin")) return;
      // A 403 is a legitimate answer for a surface the caller may not read;
      // it still must not be a 500/404, which is what this guard is for.
      if (r.status() >= 500 || r.status() === 404) {
        failedCalls.push(`${r.status()} ${url.replace(/^https?:\/\/[^/]+/, "")}`);
      }
    };
    const onPageError = (e: Error) => consoleErrors.push(`pageerror: ${e.message.slice(0, 180)}`);

    page.on("console", onConsole);
    page.on("response", onResponse);
    page.on("pageerror", onPageError);

    const response = await page.goto(surface, { waitUntil: "networkidle", timeout: 45_000 });
    expect(response?.status(), `${surface} did not resolve`).toBeLessThan(400);

    const heading = (await page.locator("main h1").first().textContent({ timeout: 10_000 }))?.trim();
    expect(heading, `${surface} rendered without a page heading`).toBeTruthy();

    page.off("console", onConsole);
    page.off("response", onResponse);
    page.off("pageerror", onPageError);

    if (consoleErrors.length > 0) {
      problems.push(`${surface} console: ${[...new Set(consoleErrors)].join(" | ")}`);
    }
    if (failedCalls.length > 0) {
      problems.push(`${surface} api: ${[...new Set(failedCalls)].join(" | ")}`);
    }
  }

  expect(problems, `admin surfaces with runtime problems:\n${problems.join("\n")}`).toEqual([]);
});
