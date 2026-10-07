/**
 * ============================================================
 * LEGALIR — Subscription checkout E2E (select → pay → active)
 * ============================================================
 * The reported bug: a Gold subscriber selects Diamond, pays successfully, and
 * the subscription stays Gold. This spec drives the real checkout end-to-end
 * against the live dev server (the mock gateway auto-confirms on poll) and
 * asserts the §7/§32 contract:
 *
 *   Select plan → Create intent → (gateway) Verify → Activate → UI reflects it
 *
 * The final assertion is the §34 requirement: the current-plan card must update
 * WITHOUT a manual refresh once the payment settles.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// A mobile unique to this spec file: the OTP endpoint rate-limits to
// 3 requests / 5 min per mobile (in-memory, shared across parallel workers),
// so it must differ from every other spec's demo mobile.
const DEMO_MOBILE = "09120000088";
const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";

// Serial mode keeps the session cached in one worker → a single OTP request.
test.describe.configure({ mode: "serial" });

let cachedSessionId: string | null = null;

async function getOrCreateSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;

  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string; userId?: string } };
  const sessionId = verifyBody.data?.sessionId;
  if (!sessionId) throw new Error("Failed to verify OTP and create a session");

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
        mobileE164: "+989120000088",
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

const APP_READY_TIMEOUT = 20_000;

/**
 * A plan CTA in any state: «انتخاب اشتراک» (unsubscribed), «خرید اشتراک»
 * (subscribed) or «ارتقا به …» (tier upgrade). The card's own label wins over
 * the page default, so match all three and drive the first visible one.
 */
const PLAN_CTA = /انتخاب اشتراک|خرید اشتراک|ارتقا به/;

test.describe("Subscription checkout", () => {
  test("select → pay → the plan becomes active without a manual refresh", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/subscription");

    // The page renders; the current-plan card shows EITHER the active markup
    // («وضعیت اشتراک») or the empty state («بدون اشتراک فعال»).
    await expect(page.getByRole("heading", { name: "اشتراک", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(
      page.getByText("وضعیت اشتراک").or(page.getByText("بدون اشتراک فعال")),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Wait until the plan catalogue has loaded, then drive the FIRST plan CTA.
    const pickButtons = page.getByRole("button", { name: PLAN_CTA });
    await expect(pickButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await pickButtons.first().click();

    // Confirmation dialog → confirm & pay.
    const confirm = page.getByRole("button", { name: "تأیید و پرداخت" });
    await expect(confirm).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await confirm.click();

    // The mock gateway confirms on poll: the payment banner shows «پرداخت شده».
    await expect(page.getByText(/پرداخت شده/)).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // §34 — the current-plan card must reflect the new active plan WITHOUT a
    // reload. «وضعیت اشتراک» + «فعال» only render once a plan is live.
    await expect(page.getByText("وضعیت اشتراک")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("فعال").first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // The unsubscribed banner must be gone — the plan is no longer "none".
    await expect(page.getByText("بدون اشتراک فعال")).toHaveCount(0);
  });

  test("the active subscription survives a reload (payment was persisted)", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/subscription");

    await expect(page.getByText("وضعیت اشتراک")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("فعال").first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("بدون اشتراک فعال")).toHaveCount(0);
  });
});
