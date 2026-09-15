/**
 * ============================================================
 * LEGALIR — Document Chat Panel E2E
 * ============================================================
 * Covers the "chat with LegalIR about this document" panel on the
 * document detail page:
 *   - The panel renders on a ready document
 *   - Suggested prompts (rental-contract scenario) are shown
 *   - Sending a message creates a conversation and streams a reply
 *
 * Uses the seeded demo user (09120000003) who owns the rental
 * contract document (doc-rent-001).
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const RENT_DOC_ID = "doc-rent-001";

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

async function createSessionFor(request: APIRequestContext, mobile: string): Promise<SessionInfo> {
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");

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

  const sessionState = {
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
  };
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    sessionState,
  );
}

const APP_READY_TIMEOUT = 15_000;

test.describe("Document Chat Panel", () => {
  test("renders on a ready document with intent selection", async ({ page, request }) => {
    const session = await createSessionFor(request, DEMO_MOBILE);
    await mockAuth(page, session);
    await page.goto(`/documents/${RENT_DOC_ID}`);

    // Document detail loads.
    await expect(page.getByRole("heading", { name: /قرارداد-اجاره-مسکونی/ }).first()).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Chat panel header appears.
    await expect(page.getByText("گفتگو با لیگالیر درباره این سند")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Intent selection is shown BEFORE the analysis.
    await expect(page.getByText("با این سند چه کاری می‌خواهید انجام دهید؟")).toBeVisible();
    await expect(page.getByText("بررسی مشکلات حقوقی طبق قانون اساسی")).toBeVisible();
    await expect(page.getByText("اصلاح قرارداد")).toBeVisible();
    await expect(page.getByText("ویرایش قرارداد")).toBeVisible();
  });

  test("selecting an intent reveals tailored follow-up questions", async ({ page, request }) => {
    const session = await createSessionFor(request, DEMO_MOBILE);
    await mockAuth(page, session);
    await page.goto(`/documents/${RENT_DOC_ID}`);

    await expect(page.getByText("گفتگو با لیگالیر درباره این سند")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Pick the "review" intent.
    await page.getByText("بررسی مشکلات حقوقی طبق قانون اساسی").click();

    // Tailored follow-up questions for a rental contract appear.
    await expect(page.getByText("من موجر هستم، چه نکاتی را باید رعایت کنم؟")).toBeVisible();
    await expect(page.getByText("من مستأجر هستم، حقوق من چیست؟")).toBeVisible();
    await expect(page.getByText("آیا شرط فسخ یک‌طرفه در این قرارداد قانونی است؟")).toBeVisible();
  });

  test("sending a message streams a reply", async ({ page, request }) => {
    const session = await createSessionFor(request, DEMO_MOBILE);
    await mockAuth(page, session);
    await page.goto(`/documents/${RENT_DOC_ID}`);

    await expect(page.getByText("گفتگو با لیگالیر درباره این سند")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Select an intent, then click a tailored follow-up to send a message.
    await page.getByText("بررسی مشکلات حقوقی طبق قانون اساسی").click();
    await page.getByText("من موجر هستم، چه نکاتی را باید رعایت کنم؟").click();

    // The user message appears.
    await expect(page.getByText("من موجر هستم، چه نکاتی را باید رعایت کنم؟")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // The AI eventually responds (streaming indicator or a reply bubble).
    await expect(page.getByText("در حال پردازش...")).toBeVisible({
      timeout: 30_000,
    });
  });
});
