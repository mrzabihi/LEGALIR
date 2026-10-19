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

import {
  test,
  expect,
  type Locator,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

const SESSION_COOKIE = "legalir-session";
// Demo user owns the 6 seeded documents (used only by the library test).
const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

/**
 * Sign in as the demo user over the password endpoint.
 *
 * Two reasons this replaced the OTP flow:
 *   1. OTP is rate-limited per mobile (3 requests / 5 min), so repeated
 *      runs failed at session creation.
 *   2. A brand-new OTP user lands on a plan whose document-analysis
 *      quota is 0, so the upload pipeline answered
 *      `429 DOCUMENT_ANALYSIS_LIMIT_EXCEEDED` — the wizard error state,
 *      never the success screen this spec is about. The demo user has an
 *      active plan with quota, which is what the flow needs.
 */
async function createDemoSession(request: APIRequestContext): Promise<SessionInfo> {
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const body = (await res.json()) as {
    data?: {
      sessionId?: string;
      user?: { id?: string; mobileDisplay?: string };
    };
  };
  const sessionId = body.data?.sessionId;
  if (!sessionId) throw new Error("Failed to create a demo session");

  return {
    sessionId,
    userId: body.data?.user?.id ?? "demo-user-id",
    mobileDisplay: body.data?.user?.mobileDisplay ?? DEMO_MOBILE,
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

/**
 * Wait until React has hydrated this element. Server-rendered markup appears
 * before the client attaches handlers, so a click that lands too early is a
 * silent no-op — the library row never navigates and the URL assertion times
 * out. React marks a hydrated host node with an internal `__reactFiber$` key.
 */
async function waitForHydration(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))),
    )
    .toBe(true);
}

const APP_READY_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Document Upload Wizard", () => {
  test("choose-source step shows both options", async ({ page, request }) => {
    const session = await createDemoSession(request);
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
    const session = await createDemoSession(request);
    await mockAuth(page, session);
    await page.goto("/documents/upload");

    await expect(page.getByRole("heading", { name: "افزودن سند" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await page.getByText("اسناد لیگالیر").click();

    // Demo user owns 6 documents — at least one should render.
    const row = page.getByText("قرارداد-کار-و-تعهدات-بیمه.pdf");
    await expect(row).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Selecting a document navigates to its detail page. Wait for the row to
    // be interactive first, or the click silently no-ops.
    await waitForHydration(row);
    await row.click();
    await expect(page).toHaveURL(/\/documents\/doc-emp-001/, {
      timeout: APP_READY_TIMEOUT,
    });
  });

  test("system upload shows the drag & drop zone", async ({ page, request }) => {
    const session = await createDemoSession(request);
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
    const session = await createDemoSession(request);
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
