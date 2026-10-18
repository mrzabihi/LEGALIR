/**
 * ============================================================
 * LEGALIR — Subscription checkout E2E
 * ============================================================
 * Covers the shipped checkout contract:
 *
 *   Select plan → server-quoted review dialog → commit attempt
 *
 * The online gateway is intentionally inactive, so a positive-amount order
 * cannot be paid. The correct behaviour — which this spec pins — is that the
 * commit surfaces an honest «درگاه پرداخت به‌زودی فعال می‌شود» notice and
 * activates nothing. The second test pins that the status panel re-resolves
 * to the same persisted state across a reload.
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
 * A plan CTA in any state:
 *   - «انتخاب و خرید»    — the PlanSummaryCard on the default Status tab
 *   - «انتخاب اشتراک»    — the Plans-tab carousel, unsubscribed
 *   - «خرید اشتراک»      — the Plans-tab carousel, subscribed
 *   - «ارتقا به …»       — the Plans-tab carousel, tier upgrade
 * Match all four and drive the first visible one.
 */
const PLAN_CTA = /انتخاب و خرید|انتخاب اشتراک|خرید اشتراک|ارتقا به/;

test.describe("Subscription checkout", () => {
  test("select → review dialog → the inactive gateway never fabricates activation", async ({
    page,
    request,
  }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/subscription");

    // The page renders and its status Panel is mounted.
    await expect(page.getByRole("heading", { name: "اشتراک", level: 1 })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // Match the Panel's own <h2>. A bare `getByText("وضعیت اشتراک")` is
    // ambiguous now that the page subtitle and the first tab both contain
    // that phrase (strict-mode violation).
    await expect(
      page.getByRole("heading", { name: "وضعیت اشتراک", level: 2 }),
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Buy on the «پلن‌ها» tab: it always renders the full plan catalogue,
    // whereas the Status tab only surfaces plans while nothing is active.
    await page.getByRole("tab", { name: "پلن‌ها" }).click();

    // Wait until the plan catalogue has loaded, then drive the FIRST plan CTA.
    const pickButtons = page.getByRole("button", { name: PLAN_CTA });
    await expect(pickButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await pickButtons.first().click();

    // The review dialog opens with the SERVER's quote — never local pricing.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(dialog.getByText("بازبینی و تأیید سفارش")).toBeVisible();
    await expect(dialog.getByText("مبلغ نهایی")).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // The online gateway is intentionally NOT active, so the commit button
    // says «پرداخت و فعال‌سازی» and clicking it must surface the honest notice
    // rather than fabricate a paid subscription.
    const pay = dialog.getByRole("button", { name: "پرداخت و فعال‌سازی" });
    await expect(pay).toBeVisible();
    await pay.click();

    await expect(page.getByText(/درگاه پرداخت به‌زودی فعال می‌شود/)).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // Nothing was activated — no success panel, no fabricated order.
    await expect(page.getByText("اشتراک فعال شد")).toHaveCount(0);
    await expect(page.getByText("سفارش در انتظار پرداخت")).toHaveCount(0);
  });

  test("the status panel survives a reload unchanged", async ({ page, request }) => {
    const sessionId = await getOrCreateSession(request);
    await mockAuth(page, sessionId);
    await page.goto("/subscription");

    const panel = page.getByRole("heading", { name: "وضعیت اشتراک", level: 2 });
    await expect(panel).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Snapshot whichever state the account is in (active plan or empty),
    // then prove a reload resolves to the same one from the persisted data.
    const card = page.locator("section", { has: panel });
    const before = (await card.innerText()).trim();
    expect(before.length).toBeGreaterThan(0);

    await page.reload();
    await expect(panel).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const after = (await page.locator("section", { has: panel }).innerText()).trim();

    expect(after).toBe(before);
  });
});
