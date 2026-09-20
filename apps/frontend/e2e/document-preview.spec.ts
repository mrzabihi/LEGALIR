/**
 * ============================================================
 * LEGALIR — Document Preview E2E
 * ============================================================
 * Exercises the real preview system end-to-end against the seeded
 * demo user (09120000003):
 *   - the preview card renders a real first PDF page on /documents/[id]
 *   - clicking it opens the dedicated viewer at /documents/[id]/preview
 *   - the viewer paginates and zooms
 *   - unsupported types fall back to the Persian unsupported state
 *   - a supported type with missing bytes shows the missing-file state
 *   - another user's document id is never previewable
 *   - no raw storage URL leaks to the client
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const OTHER_MOBILE = "09120000009";

const PDF_DOC = "doc-emp-001"; // real multi-page PDF fixture
const UNSUPPORTED_DOC = "doc-board-001"; // DOCX, no preview
const MISSING_DOC = "doc-rent-001"; // PDF metadata, bytes absent

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

// The OTP endpoint rate-limits to 3 requests / 5 min per mobile, so the
// sessions are created once and reused across the tests.
let demoSession: SessionInfo;
let otherSession: SessionInfo;

test.beforeAll(async ({ request }) => {
  demoSession = await createSessionFor(request, DEMO_MOBILE);
  otherSession = await createSessionFor(request, OTHER_MOBILE);
});

test.describe("Document preview", () => {
  test("card renders a real first PDF page and links to the viewer", async ({ page }) => {
    await mockAuth(page, demoSession);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`/documents/${PDF_DOC}`);

    // The preview section renders with the file name + type label.
    await expect(page.getByText("پیش‌نمایش سند")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const link = page.getByRole("link", { name: /مشاهده کامل/ });
    await expect(link).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(link).toHaveAttribute("href", `/documents/${PDF_DOC}/preview`);

    // A real canvas (rasterised page 1) is present — not a placeholder.
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // No raw storage URL should ever reach the DOM.
    const html = await page.content();
    expect(html).not.toContain("/demo-documents/");

    // No preview-related console errors. (The pre-existing /status endpoint
    // 404s on this page and is out of scope for this change.)
    const previewErrors = consoleErrors.filter((e) => !/status/.test(e));
    expect(previewErrors).toEqual([]);
  });

  test("viewer opens with pagination and zoom controls", async ({ page }) => {
    await mockAuth(page, demoSession);

    await page.goto(`/documents/${PDF_DOC}/preview`);

    const toolbar = page.getByRole("toolbar", { name: "ابزارهای نمایش PDF" });
    await expect(toolbar).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await expect(page.getByRole("button", { name: "صفحه بعد" })).toBeVisible();
    await expect(page.getByRole("button", { name: "صفحه قبل" })).toBeVisible();
    await expect(page.getByRole("button", { name: "بزرگ‌نمایی" })).toBeVisible();
    await expect(page.getByRole("button", { name: "کوچک‌نمایی" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تناسب با عرض" })).toBeVisible();

    // Page indicator starts at page ۱ of N (exposed via the region label).
    await expect(page.getByLabel(/صفحه ۱ از/)).toBeVisible({ timeout: APP_READY_TIMEOUT });

    // Advance a page.
    await page.getByRole("button", { name: "صفحه بعد" }).click();
    await expect(page.getByLabel(/صفحه ۲ از/)).toBeVisible();

    // Zoom in changes the indicator (percentage).
    await page.getByRole("button", { name: "بزرگ‌نمایی" }).click();
    await expect(page.getByText("۱۲۵٪")).toBeVisible();
  });

  test("unsupported type shows the Persian fallback, not a viewer link", async ({ page }) => {
    await mockAuth(page, demoSession);

    await page.goto(`/documents/${UNSUPPORTED_DOC}`);

    await expect(
      page.getByText("پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.")
    ).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(page.getByRole("link", { name: /مشاهده کامل/ })).toHaveCount(0);
  });

  test("supported type with missing bytes shows the missing-file state", async ({ page }) => {
    await mockAuth(page, demoSession);

    await page.goto(`/documents/${MISSING_DOC}`);

    await expect(page.getByText("فایل این سند در دسترس نیست.")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    // Must not be confused with the unsupported-type message.
    await expect(
      page.getByText("پیش‌نمایش این نوع فایل در حال حاضر پشتیبانی نمی‌شود.")
    ).toHaveCount(0);
  });

  test("another user's document id is not previewable", async ({ page }) => {
    await mockAuth(page, otherSession);

    await page.goto(`/documents/${PDF_DOC}/preview`);

    await expect(page.getByText("سند یافت نشد")).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await expect(
      page.getByText("این سند وجود ندارد یا به حساب شما تعلق ندارد.")
    ).toBeVisible();
  });

  test("mobile viewport renders the card and viewer without overflow", async ({ page }) => {
    await mockAuth(page, demoSession);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/documents/${PDF_DOC}`);
    await expect(page.getByRole("link", { name: /مشاهده کامل/ })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    await page.goto(`/documents/${PDF_DOC}/preview`);
    await expect(page.getByRole("toolbar", { name: "ابزارهای نمایش PDF" })).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // No horizontal overflow.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
