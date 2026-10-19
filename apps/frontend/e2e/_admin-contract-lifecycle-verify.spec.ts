/**
 * TEMP verification spec — the admin contract lifecycle surface, against the
 * live dev server. Reads only; no contract is modified and no stamp is
 * requested or applied.
 *
 * It proves the three render surfaces this change added:
 *   1. «مراحل و گردش کار قرارداد» renders the contract's own rows, marks
 *      exactly one current stage and opens a per-stage detail dialog;
 *   2. the stamp panel never shows a disabled button without the server's
 *      own reason;
 *   3. the current-version PDF route streams a real PDF, not HTML renamed.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ensureAdminSession, SESSION_COOKIE } from "./support/admin-session";

const READY = 20_000;
const SHOTS = path.join("e2e", "__shots__", "admin-contract-lifecycle");

let session: { sessionId: string; mobile: string } | null = null;

async function seed(page: Page, request: APIRequestContext) {
  if (!session) {
    const s = await ensureAdminSession(request);
    session = { sessionId: s.sessionId, mobile: s.mobile };
  }
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: session.sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId: session.sessionId,
          userId: "admin-user-id",
          mobileE164: "+989120000000",
          mobileDisplay: session.mobile,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    }
  );
}

async function openFirstContractDrawer(page: Page) {
  await page.goto("/admin/contracts");
  const reviewButton = page.getByRole("button", { name: /^(بررسی|مشاهده)$/ }).first();
  await expect(reviewButton).toBeVisible({ timeout: READY });
  await reviewButton.click();
  await expect(page.getByText("مراحل و گردش کار قرارداد")).toBeVisible({ timeout: READY });
}

test.describe("admin contract lifecycle", () => {
  test.beforeEach(async ({ page, request }) => {
    await seed(page, request);
  });

  test("the stage table shows the real walk and a stage detail explains its actions", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await openFirstContractDrawer(page);

    const table = page.getByRole("table", {
      name: "مراحل و گردش کار این قرارداد، به ترتیب انجام",
    });
    await expect(table).toBeVisible({ timeout: READY });

    // The seven required columns, in order.
    const headers = table.getByRole("columnheader");
    await expect(headers).toHaveCount(7);
    await expect(headers).toHaveText([
      "مرحله",
      "عنوان مرحله",
      "وضعیت",
      "مسئول مرحله",
      "آخرین تغییر",
      "آخرین توضیح",
      "عملیات",
    ]);

    // Exactly one row is the current stage, and it is visually marked.
    await expect(table.locator('tr[aria-current="step"]')).toHaveCount(1);
    await expect(page.getByText("مرحلهٔ جاری", { exact: true })).toBeVisible();

    fs.mkdirSync(SHOTS, { recursive: true });
    const stageSection = page.locator("section").filter({ hasText: "مراحل و گردش کار قرارداد" });
    await stageSection.scrollIntoViewIfNeeded();
    await stageSection.screenshot({ path: path.join(SHOTS, "stage-table-1440.png") });

    // The row opens its own detail dialog.
    await table.getByRole("button", { name: "جزئیات" }).first().click();
    // The drawer itself is also a dialog, so name the stage dialog explicitly.
    // Its title is rendered with PERSIAN digits («مرحلهٔ ۱ از ۱۲ — …»).
    const dialog = page.getByRole("dialog", { name: /^مرحلهٔ [۰-۹]+ از [۰-۹]+ — / });
    await expect(dialog).toBeVisible({ timeout: READY });
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText("مرحلهٔ");

    // The action block is always honest: either the permitted actions (each
    // disabled one carrying the server's reason) or an explicit "none".
    const hasActions = await dialog
      .getByText("اقدام‌های مجاز این مرحله")
      .isVisible()
      .catch(() => false);
    const hasNone = await dialog
      .getByText("این مرحله اقدام مستقیمی برای ادمین ندارد.")
      .isVisible()
      .catch(() => false);
    expect(hasActions || hasNone).toBe(true);

    // The dialog must be anchored to the VIEWPORT, not to the drawer's own
    // scrolled panel — it is portalled to <body> for exactly that reason.
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({ path: path.join(SHOTS, "stage-detail-1440.png") });

    expect(pageErrors, "uncaught page errors on the drawer").toEqual([]);
  });

  test("the stamp panel never disables an action without stating why", async ({ page }) => {
    await openFirstContractDrawer(page);

    const stampHeading = page.getByRole("heading", { name: "اقدام مهر" });
    await stampHeading.scrollIntoViewIfNeeded();
    await expect(stampHeading).toBeVisible({ timeout: READY });

    const requestButton = page.getByRole("button", { name: "ثبت درخواست مهر" });
    const applyButton = page.getByRole("button", { name: "تأیید و اعمال مهر رسمی" });
    const hasRequest = (await requestButton.count()) > 0;
    const hasApply = (await applyButton.count()) > 0;
    expect(hasRequest || hasApply).toBe(true);

    // Whichever step is offered: a disabled button must come with a real,
    // visible reason (the panel's server-authored verdict list).
    const offered = hasRequest ? requestButton : applyButton;
    if (await offered.isDisabled()) {
      await expect(
        page.getByText(/برای (ثبت درخواست مهر|تصمیم روی این درخواست):/)
      ).toBeVisible({ timeout: READY });
      const title = await offered.getAttribute("title");
      expect(title && title.trim().length > 0).toBe(true);
    }

    // The printable preview of the exact version is always one click away.
    await expect(
      page.getByRole("button", { name: "مشاهده و چاپ نسخهٔ فعلی (PDF)" }).first()
    ).toBeVisible();

    const panel = stampHeading.locator(
      "xpath=ancestor::div[contains(@class,'rounded-large')][1]"
    );
    await panel.screenshot({ path: path.join(SHOTS, "stamp-panel-1440.png") });
  });

  test("the admin PDF route streams a real PDF", async ({ request }) => {
    if (!session) throw new Error("no session");
    const headers = { cookie: `${SESSION_COOKIE}=${session.sessionId}` };

    const listRes = await request.get("/api/v1/admin/contracts?page=1&pageSize=10", { headers });
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as {
      data?: { items?: { id: string; currentVersionNumber: number }[] };
    };
    const target = list.data?.items?.find((c) => c.currentVersionNumber > 0);
    expect(target, "a seeded contract with a frozen version").toBeTruthy();

    const pdfRes = await request.get(`/api/v1/admin/contracts/${target!.id}/pdf`, { headers });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    expect(pdfRes.headers()["cache-control"]).toContain("no-store");
    const body = await pdfRes.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(1000);
  });
});
