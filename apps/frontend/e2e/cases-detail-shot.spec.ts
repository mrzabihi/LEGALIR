/**
 * ============================================================
 * LEGALIR — Case detail screenshot capture (temporary verification)
 * ============================================================
 * Seeds one case with a civil proceeding, a defendant party and two
 * deadlines, then captures the overview and each tab so the v2 detail
 * page can be eyeballed. Temporary artifact — remove after verification.
 */

import { test, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const APP_READY_TIMEOUT = 15_000;

async function getSession(request: APIRequestContext): Promise<string> {
  const mobile = `0912${String(Date.now()).slice(-7)}`;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } })
    .data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sessionId = ((await verifyRes.json()) as { data?: { sessionId?: string } })
    .data?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP");
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
        mobileDisplay: "09120000003",
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

test("capture case detail overview and tabs", async ({ page, request }) => {
  const sessionId = await getSession(request);
  await mockAuth(page, sessionId);

  // Seed a case via the API (page.request shares the browser cookies).
  const createRes = await page.request.post("/api/v1/cases", {
    data: {
      title: "پرونده ملکی — تخلیه ید",
      description: "دعوای تخلیه ملک تجاری",
      category: "property",
      priority: "high",
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const caseId = ((await createRes.json()) as { data?: { id?: string } }).data?.id;
  if (!caseId) throw new Error("Failed to create case");

  // A civil proceeding, a defendant party, and two deadlines.
  await page.request.post(`/api/v1/cases/${caseId}/proceedings`, {
    data: { path: "civil", stage: "civil_filing", authority: "دادگاه عمومی تهران" },
  });
  await page.request.post(`/api/v1/cases/${caseId}/parties`, {
    data: { legalRole: "defendant", name: "آقای خوانده", kind: "person" },
  });
  await page.request.post(`/api/v1/cases/${caseId}/deadlines`, {
    data: { title: "مهلت تقدیم لایحه", dueAt: "2026-11-01", kind: "legal", source: "user" },
  });
  await page.request.post(`/api/v1/cases/${caseId}/deadlines`, {
    data: { title: "جلسه رسیدگی", dueAt: "2026-11-15", kind: "hearing", source: "user" },
  });

  await page.goto(`/cases/${caseId}`);
  await page.getByText("شناسه لیگالیر").first().waitFor({ timeout: APP_READY_TIMEOUT });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/__shots__/case-detail-overview.png", fullPage: true });

  for (const [tab, file] of [
    ["تایم‌لاین", "case-detail-timeline"],
    ["وظایف", "case-detail-tasks"],
    ["اسناد", "case-detail-documents"],
    ["مهلت‌ها", "case-detail-deadlines"],
    ["قراردادها", "case-detail-contracts"],
  ] as const) {
    const tabBtn = page.getByRole("button", { name: tab }).first();
    if (await tabBtn.count()) {
      await tabBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `e2e/__shots__/${file}.png`, fullPage: true });
    }
  }
});
