/**
 * ============================================================
 * LEGALIR — Draft & Document delete E2E
 * ============================================================
 * Verifies the shared "manage draft / document" pattern end-to-end:
 *   - a draft contract card shows Continue/Edit + Delete Draft
 *   - Delete Draft opens a confirmation; cancel changes nothing
 *   - confirming removes the draft from the list without a refresh
 *   - a document card exposes Delete with the same confirmation flow
 *
 * Uses the seeded demo user (09120000003).
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const APP_READY_TIMEOUT = 15_000;

// Fresh mobiles for tests that create their own draft, so the OTP
// endpoint's per-mobile rate limit isn't tripped by parallel workers.
let mobileCounter = 0;
function freshMobile(): string {
  mobileCounter += 1;
  const rand = Math.floor(10000000 + Math.random() * 90000000);
  return `091${rand}`;
}

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

/** Create a fresh draft contract for the session user via the API. */
async function createDraft(
  request: APIRequestContext,
  session: SessionInfo
): Promise<{ id: string; title: string }> {
  const res = await request.post("/api/v1/property-contracts", {
    headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    data: { type: "property_rent", propertyKind: "apartment", initiatorRole: "landlord" },
  });
  const body = (await res.json()) as { data?: { id?: string; title?: string } };
  const id = body.data?.id;
  if (!id) throw new Error("Failed to create draft contract");
  return { id, title: body.data?.title ?? "" };
}

test.describe("Draft contract delete", () => {
  test("draft card shows Continue/Edit and Delete Draft", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    await createDraft(request, session);
    await mockAuth(page, session);
    await page.goto("/contracts");

    await expect(page.getByText("ادامه / ویرایش").first()).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("حذف پیش‌نویس").first()).toBeVisible();
  });

  test("cancel leaves the draft untouched", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    const draft = await createDraft(request, session);
    await mockAuth(page, session);
    await page.goto("/contracts");

    const deleteButtons = page.getByText("حذف پیش‌نویس");
    await expect(deleteButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const before = await deleteButtons.count();

    await deleteButtons.first().click();
    await expect(page.getByText("حذف پیش‌نویس قرارداد؟")).toBeVisible();
    await page.getByRole("button", { name: "انصراف" }).click();

    // Dialog closed, nothing removed.
    await expect(page.getByText("حذف پیش‌نویس قرارداد؟")).toBeHidden();
    await expect(deleteButtons).toHaveCount(before);

    // The draft still exists server-side.
    const res = await request.get(`/api/v1/property-contracts/${draft.id}`, {
      headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    });
    expect(res.status()).toBe(200);
  });

  test("confirm deletes the draft without a manual refresh", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    const draft = await createDraft(request, session);
    await mockAuth(page, session);
    await page.goto("/contracts");

    const deleteButtons = page.getByText("حذف پیش‌نویس");
    await expect(deleteButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
    const before = await deleteButtons.count();

    await deleteButtons.first().click();
    await page.getByRole("button", { name: "حذف پیش‌نویس" }).last().click();

    // Success feedback + the card disappears with no reload.
    await expect(page.getByText("پیش‌نویس قرارداد با موفقیت حذف شد.")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
    await expect(deleteButtons).toHaveCount(before - 1);

    // Gone server-side too.
    const res = await request.get(`/api/v1/property-contracts/${draft.id}`, {
      headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    });
    expect(res.status()).toBe(404);
  });
});

/** Create a document row for the session user via the upload API. */
async function createDocument(
  request: APIRequestContext,
  session: SessionInfo
): Promise<string> {
  const res = await request.post("/api/v1/documents/uploads", {
    headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    data: { name: "سند-آزمایشی.pdf", mime: "application/pdf", sizeBytes: 120_000 },
  });
  const body = (await res.json()) as { data?: { id?: string } };
  const id = body.data?.id;
  if (!id) throw new Error("Failed to create document");
  return id;
}

test.describe("Document delete", () => {
  test("document card exposes Delete with a confirmation", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    await createDocument(request, session);
    await mockAuth(page, session);
    await page.goto("/documents");

    const deleteButtons = page.getByRole("button", { name: /حذف سند/ });
    await expect(deleteButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await deleteButtons.first().click();
    await expect(page.getByText("حذف سند؟")).toBeVisible();
    await page.getByRole("button", { name: "انصراف" }).click();
    await expect(page.getByText("حذف سند؟")).toBeHidden();
  });

  test("confirm deletes the document without a manual refresh", async ({ page, request }) => {
    const session = await createSessionFor(request, freshMobile());
    const docId = await createDocument(request, session);
    await mockAuth(page, session);
    await page.goto("/documents");

    const deleteButtons = page.getByRole("button", { name: /حذف سند/ });
    await expect(deleteButtons.first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

    await deleteButtons.first().click();
    await page.getByRole("button", { name: "حذف سند" }).last().click();

    await expect(page.getByText("سند با موفقیت حذف شد.")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });

    // Gone server-side too.
    const res = await request.get(`/api/v1/documents/${docId}`, {
      headers: { cookie: `${SESSION_COOKIE}=${session.sessionId}` },
    });
    expect(res.status()).toBe(404);
  });
});
