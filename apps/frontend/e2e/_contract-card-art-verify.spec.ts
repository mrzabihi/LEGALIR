/**
 * TEMPORARY verification spec (deleted after the run).
 *
 * Proves the new card artwork is actually painted on both contract
 * surfaces, and captures the visual evidence:
 *   · /contracts/templates (registry cards)
 *   · /contracts?view=coming-soon (service catalog cards)
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

async function getSession(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const id = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!id) throw new Error("login failed");
  return id;
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
    }
  );
}

test("template cards paint the new artwork", async ({ page, request }) => {
  const sessionId = await getSession(request);
  await mockAuth(page, sessionId);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/contracts/templates");

  await expect(
    page.getByRole("heading", { name: "همه قراردادهای قابل تنظیم" })
  ).toBeVisible({ timeout: 30_000 });

  // Give next/image time to decode and the CDN path to settle.
  await page.waitForTimeout(1500);
  await expect(
    page.locator('ul[aria-label="فهرست قراردادهای قابل تنظیم"] li img').first()
  ).toBeVisible();

  // Every card's image must have actually decoded (naturalWidth > 0) and
  // point at /assets/contracts/. next/image proxies through `/_next/image`
  // with the source URL-encoded, so the path is matched after decoding.
  const report = await page.evaluate(() => {
    const imgs = Array.from(
      document.querySelectorAll('ul[aria-label="فهرست قراردادهای قابل تنظیم"] li img')
    ) as HTMLImageElement[];
    return imgs.map((img) => ({
      src: decodeURIComponent(img.currentSrc || img.src),
      w: img.naturalWidth,
      h: img.naturalHeight,
    }));
  });
  console.log("TEMPLATE CARDS", JSON.stringify(report, null, 2));
  expect(report.length).toBeGreaterThan(5);
  for (const img of report) {
    expect(img.w, `undecoded image ${img.src}`).toBeGreaterThan(0);
    expect(img.src).toContain("/assets/contracts/");
  }

  await page.screenshot({ path: "e2e/__shots__/contract-templates-art.png", fullPage: false });
});

test("coming-soon service cards paint the new artwork", async ({ page, request }) => {
  const sessionId = await getSession(request);
  await mockAuth(page, sessionId);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/contracts?view=coming-soon");

  await expect(
    page.getByRole("heading", { name: "قراردادهای در دست توسعه" })
  ).toBeVisible({ timeout: 30_000 });

  // The service cards are lazy-loaded, so drive the page down to force
  // every image to decode before reading naturalWidth.
  for (let y = 0; y < 6000; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));

  const report = await page.evaluate(() => {
    const imgs = Array.from(
      document.querySelectorAll('a[aria-label*="مشاهده خدمت"] img')
    ) as HTMLImageElement[];
    return imgs.map((img) => ({
      src: decodeURIComponent(img.currentSrc || img.src),
      w: img.naturalWidth,
      h: img.naturalHeight,
      card: img.closest("a")?.getAttribute("aria-label") ?? "",
    }));
  });
  console.log("SERVICE CARDS", JSON.stringify(report, null, 2));
  expect(report.length).toBeGreaterThan(0);
  for (const img of report) {
    expect(img.w, `undecoded image ${img.src}`).toBeGreaterThan(0);
    expect(img.src).toContain("/assets/contracts/");
  }

  await page.screenshot({ path: "e2e/__shots__/contract-catalog-art.png", fullPage: false });
});
