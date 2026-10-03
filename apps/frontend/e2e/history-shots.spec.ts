/**
 * ============================================================
 * LEGALIR — History page screenshot capture (Phase 11 §10)
 * ============================================================
 * Captures the three delivery screenshots: active history, the archive
 * view, and the permanent-delete confirmation modal.
 */

import { test, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const reqRes = await request.post("/api/auth/otp/request", {
    data: { mobile: DEMO_MOBILE },
  });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } })
    .data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sessionId = ((await verifyRes.json()) as { data?: { sessionId?: string } })
    .data?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP");
  cachedSessionId = sessionId;
  return sessionId;
}

async function mockAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  const sessionState = {
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
  };
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    sessionState,
  );
}

test("capture history, archive, and delete modal", async ({ page, request }) => {
  const sessionId = await getOrCreateSession(request);
  await mockAuth(page, sessionId);

  // 1) Active history
  await page.goto("/history");
  await page.getByText("تاریخچه").first().waitFor({ timeout: APP_READY_TIMEOUT });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/__shots__/history-active.png", fullPage: true });

  // 2) Archive view — archive one item first so the card actions are visible.
  //    `page.request` shares the browser context cookies (authenticated).
  const listRes = await page.request.get("/api/v1/history?pageSize=1");
  const firstId = ((await listRes.json()) as { data: { items: { id: string }[] } })
    .data.items[0]?.id;
  if (firstId) {
    await page.request.patch("/api/v1/history", { data: { id: firstId, archived: true } });
  }
  await page.goto("/history?archived=true");
  await page.getByText("بایگانی").first().waitFor({ timeout: APP_READY_TIMEOUT });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "e2e/__shots__/history-archive.png", fullPage: true });
  if (firstId) {
    await page.request.patch("/api/v1/history", { data: { id: firstId, archived: false } });
  }

  // 3) Delete confirmation modal (from the active view)
  await page.goto("/history");
  await page.getByText("تاریخچه").first().waitFor({ timeout: APP_READY_TIMEOUT });
  const del = page.getByLabel("حذف").first();
  await del.waitFor({ timeout: APP_READY_TIMEOUT });
  await del.click();
  await page.getByText("حذف دائمی این مورد؟").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/__shots__/history-delete-modal.png" });
});
