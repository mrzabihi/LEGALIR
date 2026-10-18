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

const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const OTHER_MOBILE = "09120000009";

const PDF_DOC = "doc-emp-001"; // real multi-page PDF fixture
const UNSUPPORTED_DOC = "doc-board-001"; // DOCX, no preview
// JPEG (a previewable kind) whose row has neither a storageKey nor a
// previewUrl, so its bytes are genuinely absent. `doc-rent-001` used to
// serve this role, but its PDF is now committed under
// public/demo-documents/, so it renders a real first page instead.
const MISSING_DOC = "doc-check-001"; // previewable kind, bytes absent

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

/**
 * Log in (or register, for an unseeded mobile) and return the session.
 * Never the OTP flow — `/api/auth/otp/request` is rate-limited to 3
 * requests / 5 min per mobile, so running this spec after any other
 * OTP-based spec failed at session creation.
 */
async function createSessionFor(
  request: APIRequestContext,
  mobile: string,
): Promise<SessionInfo> {
  const attempt = async (m: string) => {
    const credentials = { mobile: m, password: DEMO_PASSWORD };
    const login = await request.post("/api/auth/login", { data: credentials });
    if (login.ok()) return login;
    return request.post("/api/auth/register", { data: credentials });
  };

  let res = await attempt(mobile);
  if (!res.ok() && res.status() === 409) {
    // The mobile already exists from an earlier OTP run, which assigned it a
    // random password nobody knows. Any *other* account serves this spec's
    // cross-user isolation check, so fall back to a fresh identity.
    res = await attempt(`0912${Math.floor(1000000 + Math.random() * 8999999)}`);
  }
  if (!res.ok()) {
    throw new Error(`Failed to create a session for ${mobile} (${res.status()})`);
  }

  const body = (await res.json()) as {
    data?: { sessionId?: string; user?: { id?: string; mobileDisplay?: string } };
  };
  const sessionId = body.data?.sessionId;
  if (!sessionId) throw new Error("Failed to create a session");

  return {
    sessionId,
    userId: body.data?.user?.id ?? "unknown-user",
    mobileDisplay: body.data?.user?.mobileDisplay ?? mobile,
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

// Sessions are created once and reused across the tests.
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
