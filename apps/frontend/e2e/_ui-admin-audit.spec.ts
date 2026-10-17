/**
 * TEMPORARY — admin UI audit screenshots. Not committed.
 * Seeds the dev SUPER_ADMIN session (OTP) and captures real pages at
 * desktop + mobile widths. Run with playwright.live.config.ts.
 */
import { test, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const ADMIN_MOBILE_E164 = "+989120000000";
const LABEL = process.env["AUDIT_LABEL"] ?? "before";

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
    }
  );
}

const PAGES = [
  ["admin", "/admin"],
  ["users", "/admin/users"],
  ["orders", "/admin/orders"],
  ["finance", "/admin/finance"],
  ["health", "/admin/health"],
  ["analytics", "/admin/analytics"],
  ["reports", "/admin/reports"],
  ["plans", "/admin/plans"],
  ["support", "/admin/support"],
  ["discovery", "/admin/discovery"],
  ["calculators", "/admin/calculators"],
  ["rag", "/admin/rag"],
  ["settings", "/admin/settings"],
  ["knowledge", "/admin/knowledge"],
  ["legal-library", "/admin/legal-library"],
  ["content", "/admin/content"],
  ["coupons", "/admin/coupons"],
  ["services", "/admin/services"],
  ["ai", "/admin/ai"],
  ["staff", "/admin/staff"],
  ["lawyers", "/admin/lawyers"],
  ["requests", "/admin/requests"],
  ["contracts", "/admin/contracts"],
  ["energy", "/admin/energy"],
] as const;

test("admin audit screenshots", async ({ page, request }) => {
  test.setTimeout(600_000);
  const sid = await ensureSession(request);
  await seedAdmin(page, sid);
  const consoleErrors: string[] = [];
  const overflows: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  for (const [name, route] of PAGES) {
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join("e2e", "__shots__", "ui-audit-admin", LABEL, `desktop-${name}.png`),
      fullPage: true,
    });

    // Tablet — the breakpoint where the admin shell switches to a persistent
    // rail on some pages, so it needs its own capture.
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(500);
    const tabletScroll = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (tabletScroll.sw > tabletScroll.cw + 1) {
      overflows.push(
        `tablet ${name}: scrollWidth ${tabletScroll.sw} > clientWidth ${tabletScroll.cw}`
      );
    }
    await page.screenshot({
      path: path.join("e2e", "__shots__", "ui-audit-admin", LABEL, `tablet-${name}.png`),
      fullPage: true,
    });

    // Mobile — also assert the page never scrolls sideways.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(500);
    const scroll = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (scroll.sw > scroll.cw + 1) {
      overflows.push(`${name}: scrollWidth ${scroll.sw} > clientWidth ${scroll.cw}`);
    }

    // Per-element overflow probe: any node wider than its own box is clipping or
    // spilling, even when the page-level scrollWidth looks fine.
    const spilling = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main *, [role=main] *"))
        .filter(
          (el) =>
            el.scrollWidth > el.clientWidth + 1 &&
            el.clientWidth > 0 &&
            // Intentional scroll containers, visually-hidden mirrors and
            // deliberately truncated cells are not layout defects.
            !el.closest(".sr-only") &&
            !el.className.includes("overflow-x-auto") &&
            !el.className.includes("truncate")
        )
        .slice(0, 8)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} ` +
            `[${el.clientWidth}<-${el.scrollWidth}] "${(el.textContent ?? "").trim().slice(0, 40)}"`
        )
    );
    if (spilling.length) {
      console.log(`SPILL ${name}:\n` + spilling.join("\n"));
    }

    // KPI figures: compare the value's own box against its card. A `nowrap`
    // figure can widen its parent instead of its own scroll box, so this is the
    // check that actually catches a money value spilling out of a stat card.
    const kpi = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("p.tabular-nums"))
        .map((el) => {
          const card = el.closest<HTMLElement>("div.rounded-large");
          if (!card) return null;
          const a = el.getBoundingClientRect();
          const b = card.getBoundingClientRect();
          const over = a.left < b.left - 1 || a.right > b.right + 1;
          return over
            ? `${(el.textContent ?? "").trim().slice(0, 24)} value=${Math.round(a.width)} card=${Math.round(b.width)}`
            : null;
        })
        .filter(Boolean)
    );
    if (kpi.length) console.log(`KPI OVERFLOW ${name}:\n` + kpi.join("\n"));
    await page.screenshot({
      path: path.join("e2e", "__shots__", "ui-audit-admin", LABEL, `mobile-${name}.png`),
      fullPage: false,
    });
  }

  if (overflows.length) {
    console.log("HORIZONTAL OVERFLOW:\n" + overflows.join("\n"));
  }
  if (consoleErrors.length) {
    console.log("CONSOLE ERRORS:\n" + consoleErrors.slice(0, 20).join("\n"));
  }
});
