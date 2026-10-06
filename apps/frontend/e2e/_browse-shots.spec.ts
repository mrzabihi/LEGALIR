/**
 * TEMP browse spec — captures key public surfaces so the assistant can
 * visually inspect the running app. Delete after review.
 */
import { test, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = `0912${String(Date.now()).slice(-7)}`;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error("no challengeId");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error("no sessionId");
  cachedSessionId = sessionId;
  return sessionId;
}

async function mockAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId,
          userId: "demo-user-id",
          mobileE164: "+989120000003",
          mobileDisplay: DEMO_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

const PAGES: { name: string; path: string; heading?: string }[] = [
  // Public / discovery
  { name: "landing", path: "/" },
  { name: "lawyers", path: "/lawyers", heading: "وکلای LEGALIR" },
  { name: "calculators", path: "/calculators" },
  { name: "services", path: "/services" },
  // Detail routes
  { name: "lawyer-detail", path: "/lawyers/demo-lawyer-01" },
  { name: "calculator-detail", path: "/calculators/court-fee" },
  { name: "legal-library-detail", path: "/legal-library/article-230-civil-code" },
  // Authed app surfaces
  { name: "dashboard", path: "/dashboard" },
  { name: "cases", path: "/cases" },
  { name: "contracts", path: "/contracts" },
  { name: "documents", path: "/documents" },
  { name: "consultations", path: "/consultations" },
  { name: "points", path: "/points" },
  { name: "history", path: "/history" },
  { name: "profile", path: "/profile" },
  { name: "settings", path: "/settings" },
  { name: "subscription", path: "/subscription" },
  { name: "support", path: "/support" },
  { name: "notifications", path: "/notifications" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    test(`${pg.name} @ ${vp.name}`, async ({ page, request }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));

      const sessionId = await getOrCreateSession(request);
      await mockAuth(page, sessionId);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const resp = await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      if (pg.heading) {
        await page.getByRole("heading", { name: pg.heading }).first().waitFor({ timeout: 15_000 });
      }
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `test-results/browse/${pg.name}-${vp.name}.png`,
        fullPage: false,
      });

      const real = errors.filter((e) => !/favicon|Failed to load resource/i.test(e));
      const h1 = await page.locator("h1").first().textContent().catch(() => null);

      // Objective layout signal: horizontal page overflow.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      // Mobile-only: is a bottom nav present? (nav with ≥2 links near the bottom)
      let bottomNav = "n/a";
      if (vp.name === "mobile") {
        bottomNav = await page.evaluate(() => {
          const vh = window.innerHeight;
          const navs = Array.from(document.querySelectorAll("nav, [role='navigation']"));
          const hit = navs.find((n) => {
            const r = n.getBoundingClientRect();
            return r.bottom > vh - 120 && r.height > 0 && r.width > 0;
          });
          if (!hit) return "none";
          const links = hit.querySelectorAll("a, button").length;
          return `yes(links=${links})`;
        });
      }

      console.log(
        `[BROWSE] ${pg.name}@${vp.name} status=${resp?.status()} overflow=${overflow} `
          + `bottomNav=${bottomNav} h1=${JSON.stringify(h1?.trim())} consoleErrors=${real.length}`,
      );
      for (const e of real) console.log(`[BROWSE-ERR] ${pg.name}@${vp.name}: ${e}`);
    });
  }
}
