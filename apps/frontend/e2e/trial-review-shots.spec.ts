/**
 * ============================================================
 * LEGALIR — Document Review: no-model + trial-mode shots
 * ============================================================
 * Visual evidence that the «بررسی اسناد» detail page:
 *   1. shows the honest NO-MODEL state for a real document when the
 *      analysis service is not connected (no fabricated result), and
 *   2. renders the trial («نمونهٔ آزمایشی») result + chat + lawyer
 *      sections after the user picks a sample scenario.
 *
 * Uses the seeded demo user (09120000003) who owns doc-emp-001.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const DOC_PATH = "/documents/doc-emp-001";
const SHOTS = "e2e/__shots__/trial";

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

async function createSessionFor(request: APIRequestContext, mobile: string): Promise<SessionInfo> {
  // The OTP endpoint rate-limits to 3 requests / 5 min per mobile, and the
  // demo mobile is shared by several specs. Back off and retry instead of
  // failing outright.
  let challengeId: string | undefined;
  for (let attempt = 0; attempt < 20 && !challengeId; attempt += 1) {
    const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
    if (reqRes.status() === 429) {
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
    challengeId = reqBody.data?.challengeId;
  }
  if (!challengeId) throw new Error("Failed to request OTP challenge (rate-limited)");

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as {
    data?: { sessionId?: string; userId?: string; mobileDisplay?: string };
  };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP and create a session");

  return {
    sessionId,
    userId: verifyBody.data?.userId ?? "unknown-user",
    mobileDisplay: verifyBody.data?.mobileDisplay ?? mobile,
  };
}

async function mockAuth(page: Page, session: SessionInfo) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: session.sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: session.sessionId,
          userId: session.userId,
          mobileE164: `+98${session.mobileDisplay.replace(/^0/, "")}`,
          mobileDisplay: session.mobileDisplay,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    },
  );
}

test.describe("Document review — no-model & trial shots", () => {
  test("captures the no-model and trial states", async ({ page, request }) => {
    test.setTimeout(180_000);
    const session = await createSessionFor(request, DEMO_MOBILE);
    await mockAuth(page, session);

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(DOC_PATH);

    // The app scrolls inside an inner container, so `fullPage` captures only
    // the viewport — take ELEMENT screenshots for reliable evidence instead.
    const chatPanel = page
      .locator('[role="log"]')
      .locator("xpath=ancestor::div[1]"); // role=log's parent is the chat panel root
    const lawyers = page.locator('section[aria-label="وکلای مرتبط"]');
    const trialResult = page.locator('section[aria-label="نتیجه بررسی"]');

    // (1) Honest no-model state — the analysis service is not connected, so the
    // page must NOT show a result for the user's own document.
    const noModel = page.getByRole("heading", { name: "تحلیل هوشمند در دسترس نیست" });
    await noModel.waitFor({ state: "visible", timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/no-model-1440.png` });

    await expect(page.getByText("گفتگو با مدل ممکن نیست")).toBeVisible();
    await chatPanel.screenshot({ path: `${SHOTS}/no-model-chat.png` });

    await lawyers.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await lawyers.screenshot({ path: `${SHOTS}/no-model-lawyers.png` });

    // (2) Pick a trial scenario → full trial result + chat + lawyers.
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByText("قراردادی با شرط فسخ یک‌طرفه").click();

    await page.getByRole("heading", { name: "نتیجه بررسی نمونه" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await page.waitForTimeout(1200);

    await trialResult.screenshot({ path: `${SHOTS}/trial-result.png` });
    await chatPanel.screenshot({ path: `${SHOTS}/trial-chat.png` });

    await lawyers.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await lawyers.screenshot({ path: `${SHOTS}/trial-lawyers.png` });

    // Mobile width, trial chat + questions.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await chatPanel.screenshot({ path: `${SHOTS}/trial-chat-390.png` });
  });
});
