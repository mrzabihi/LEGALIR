/**
 * ============================================================
 * LEGALIR — Document Upload Wizard E2E
 * ============================================================
 * Covers the new full-page add-document flow at `/documents/upload`:
 *   - Choose source step renders both options
 *   - "اسناد لیگالیر" lists existing documents and navigates on select
 *   - "بارگذاری از سیستم" shows the drag & drop / browse zone
 *   - Selecting a file runs the processing pipeline and lands on success
 *
 * Uses the seeded demo user (09120000003) who owns 6 documents.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
// Demo user owns the 6 seeded documents (used only by the library test).
const DEMO_MOBILE = "09120000003";

// Fresh mobiles for tests that don't need the demo user's documents, so the
// OTP endpoint's per-mobile rate limit isn't tripped by parallel workers.
let mobileCounter = 0;
function freshMobile(): string {
  mobileCounter += 1;
  const rand = Math.floor(10000000 + Math.random() * 90000000);
  return `091${rand}`;
}

// ---------------------------------------------------------------------------
// Auth helpers (mirror profile-completion-prompt.spec.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Document Upload Wizard", () => {
  test("choose-source step shows both options", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    await mockAuth(page, session);
    await page.goto("/documents/upload");

    await expect(page.getByRole("heading", { name: "افزودن سند" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("اسناد لیگالیر")).toBeVisible();
    await expect(page.getByText("بارگذاری از سیستم")).toBeVisible();
  });

  test("library source lists existing documents and navigates on select", async ({
    page,
    request,
  }) => {
    const session = await createSessionFor(request, DEMO_MOBILE);
    await mockAuth(page, session);
    await page.goto("/documents/upload");

    await expect(page.getByRole("heading", { name: "افزودن سند" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await page.getByText("اسناد لیگالیر").click();

    // Demo user owns 6 documents — at least one should render.
    await expect(page.getByText("قرارداد-کار-و-تعهدات-بیمه.pdf")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Selecting a document navigates to its detail page.
    await page.getByText("قرارداد-کار-و-تعهدات-بیمه.pdf").click();
    await expect(page).toHaveURL(/\/documents\/doc-emp-001/);
  });

  test("system upload shows the drag & drop zone", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    await mockAuth(page, session);
    await page.goto("/documents/upload");

    await expect(page.getByRole("heading", { name: "افزودن سند" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await page.getByText("بارگذاری از سیستم").click();

    await expect(page.getByText("فایل خود را اینجا رها کنید")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText(/فرمت‌های مجاز/)).toBeVisible();
  });

  test("selecting a file runs the pipeline and lands on success", async ({
    page,
    request,
  }) => {
    const session = await createSessionFor(request, freshMobile());
    await mockAuth(page, session);
    await page.goto("/documents/upload");

    await expect(page.getByRole("heading", { name: "افزودن سند" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await page.getByText("بارگذاری از سیستم").click();

    // Upload a small valid PDF via the hidden file input.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-contract.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test document"),
    });

    // Pipeline stepper appears.
    await expect(page.getByText("استخراج متن")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByText("تحلیل حقوقی")).toBeVisible();

    // Eventually lands on the success screen.
    await expect(page.getByText("سند با موفقیت بارگذاری شد")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByRole("button", { name: "مشاهده تحلیل" })).toBeVisible();
  });
});
