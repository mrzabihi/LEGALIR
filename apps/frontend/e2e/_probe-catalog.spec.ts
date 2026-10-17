import { test } from "@playwright/test";
const M = "09120000003";
test("templates full", async ({ page, request }) => {
  const res = await request.post("/api/auth/login", { data: { mobile: M, password: "123456" } });
  const sessionId = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId!;
  await page.context().addCookies([{ name: "legalir-session", value: sessionId, url: "http://localhost:3000" }]);
  await page.addInitScript((d) => localStorage.setItem("legalir-auth", JSON.stringify(d)), {
    state: { session: { sessionId, userId: "demo-user-id", mobileE164: "+989120000003", mobileDisplay: M, isNewUser: false, createdAt: Date.now() } },
    version: 0,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/contracts/templates");
  await page.waitForTimeout(2500);
  for (let y = 0; y < 4000; y += 700) { await page.mouse.wheel(0, 700); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 250));
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/__shots__/templates-grid-desktop.png" });
});
