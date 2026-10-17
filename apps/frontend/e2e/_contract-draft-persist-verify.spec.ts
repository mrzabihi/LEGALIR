/**
 * TEMPORARY verification spec (deleted after the run).
 *
 * Proves the three wizard guarantees that cannot be asserted from the
 * renderer alone:
 *
 *   §3 «قابل‌اعتماد بودن ذخیره و ادامهٔ پیش‌نویس» — a typed answer is
 *      autosaved, survives a full page reload, and the wizard comes back
 *      on the step it was left on.
 *   §3 «هر فیلد کنار خودش اعتبارسنجی شود» — «مرحله بعد» on an incomplete
 *      step names the missing fields, marks each blank required control
 *      inline, and the banner clears itself the moment the last answer
 *      lands (no stale red alert over a complete step).
 *   §3 «افزودن، ویرایش و حذف ردیف‌های تکرارشونده» — a repeatable schedule
 *      row can be added, edited, persisted across a reload and deleted.
 *
 * Everything is driven through the real UI and the real API; nothing is
 * mocked except the profile-completion prompt.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const DEMO_MOBILE = "09120000003";
const DEMO_PASSWORD = "123456";
const SESSION_COOKIE = "legalir-session";

let cachedSessionId: string | null = null;

async function getSession(request: APIRequestContext): Promise<string> {
  if (cachedSessionId) return cachedSessionId;
  const res = await request.post("/api/auth/login", {
    data: { mobile: DEMO_MOBILE, password: DEMO_PASSWORD },
  });
  const id = ((await res.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!id) throw new Error("login failed");
  cachedSessionId = id;
  return id;
}

async function mockAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
      state: {
        session: {
          sessionId,
          userId: "demo-user-id",
          mobileE164: "+989120000003",
          mobileDisplay: DEMO_MOBILE,
          isNewUser: false,
          createdAt: Date.now(),
        },
      },
      version: 0,
    }
  );
}

async function suppressProfilePrompt(page: Page) {
  await page.route("**/api/v1/me/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { showProfileCompletionPrompt: false } }),
      });
      return;
    }
    await route.continue();
  });
}

/** Create a draft and drop the wizard on the requested step. */
async function seed(
  request: APIRequestContext,
  sessionId: string,
  type: string,
  currentStep: string
): Promise<string> {
  const cookie = `${SESSION_COOKIE}=${sessionId}`;
  const created = await request.post("/api/v1/property-contracts", {
    headers: { cookie },
    data: { type, title: `قرارداد آزمون ذخیره — ${type}` },
  });
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error(`create failed: ${await created.text()}`);

  const patched = await request.patch(`/api/v1/property-contracts/${id}`, {
    headers: { cookie },
    data: { currentStep },
  });
  if (!patched.ok()) throw new Error(`patch failed: ${await patched.text()}`);
  return id;
}

async function openBuilder(page: Page, id: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/contracts/${id}`);
  // The workspace header publishes the server-computed progress; its presence
  // means the detail query resolved and the wizard mounted.
  await expect(
    page.getByRole("progressbar", { name: "پیشرفت تکمیل قرارداد" })
  ).toBeVisible({ timeout: 30_000 });
}

/** Wait until the debounced autosave round-trip has really landed. */
async function waitForSaved(page: Page) {
  await expect(page.getByText("همه تغییرات ذخیره شده‌اند")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Resolve when the next autosave PATCH for this contract succeeds.
 *
 * `waitForSaved` alone is not enough before a reload: the label still reads
 * «همه تغییرات ذخیره شده‌اند» from the PREVIOUS save, so it would pass while
 * the new 700 ms debounce is still pending — and a reload cancels it. Awaiting
 * the actual PATCH response is the only way to prove persistence.
 */
function nextSave(page: Page, id: string) {
  return page.waitForResponse(
    (res) =>
      res.url().includes(`/api/v1/property-contracts/${id}`) &&
      res.request().method() === "PATCH" &&
      res.ok(),
    { timeout: 20_000 }
  );
}

test("draft autosave survives a reload and the step gate is truthful", async ({
  page,
  request,
}) => {
  const sessionId = await getSession(request);
  // `employment` step 2 is `job`: three plain required text fields and no
  // party/document dependency, so the gate can be exercised in isolation.
  const id = await seed(request, sessionId, "employment", "job");

  await mockAuth(page, sessionId);
  await suppressProfilePrompt(page);
  await openBuilder(page, id);

  await expect(page.getByRole("heading", { name: "شغل و وظایف", level: 2 })).toBeVisible();

  // ---------------------------------------------------------------
  // 1. Advancing an untouched required step is refused, and each blank
  //    required control gets an inline error beside itself (§3).
  // ---------------------------------------------------------------
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  const blocked = page.getByRole("alert").filter({ hasText: "برای رفتن به مرحله بعد" });
  await expect(blocked).toBeVisible();
  await expect(blocked).toContainText("عنوان شغل");
  await expect(page.getByText("تکمیل این فیلد الزامی است.")).toHaveCount(3);

  // ---------------------------------------------------------------
  // 2. Fill the three answers. The banner must clear itself — a step that
  //    is complete must not keep showing the rejection (§3).
  // ---------------------------------------------------------------
  const answersSave = nextSave(page, id);
  await page.getByLabel(/عنوان شغل/).fill("کارشناس حسابداری");
  await page.getByLabel(/شرح وظایف/).fill("ثبت اسناد مالی و تهیهٔ گزارش‌های دوره‌ای.");
  await page.getByLabel(/محل انجام کار/).fill("تهران، خیابان ولیعصر");

  await expect(blocked).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("تکمیل این فیلد الزامی است.")).toHaveCount(0);

  // The FIRST autosave carries all three answers once the debounce fires.
  await answersSave;
  await waitForSaved(page);

  // ---------------------------------------------------------------
  // 3. Advance, then reload: the answers and the current step are both
  //    restored from the server (§3 / §7). The step click itself is an
  //    autosave (it persists `currentStep`), so wait for THAT request.
  // ---------------------------------------------------------------
  const stepSave = nextSave(page, id);
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(
    page.getByRole("heading", { name: "مدت و دورهٔ آزمایشی", level: 2 })
  ).toBeVisible();
  await stepSave;

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "مدت و دورهٔ آزمایشی", level: 2 })
  ).toBeVisible({ timeout: 20_000 });

  // Go back one step — backward navigation is never blocked — and prove the
  // typed values re-hydrated rather than being re-seeded blank.
  await page.getByRole("button", { name: "مرحله قبل" }).click();
  await expect(page.getByRole("heading", { name: "شغل و وظایف", level: 2 })).toBeVisible();
  await expect(page.getByLabel(/عنوان شغل/)).toHaveValue("کارشناس حسابداری");
  await expect(page.getByLabel(/شرح وظایف/)).toHaveValue(
    "ثبت اسناد مالی و تهیهٔ گزارش‌های دوره‌ای."
  );
  await expect(page.getByLabel(/محل انجام کار/)).toHaveValue("تهران، خیابان ولیعصر");

  // A completed step now advances without any rejection.
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(
    page.getByRole("heading", { name: "مدت و دورهٔ آزمایشی", level: 2 })
  ).toBeVisible();
  // Scope to the wizard's own banner: the Next.js dev overlay also mounts an
  // empty `role="alert"` announcer, which is not a form error.
  await expect(blocked).toHaveCount(0);

  await request.delete(`/api/v1/property-contracts/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
});

test("repeatable rows can be added, edited, persisted and deleted", async ({
  page,
  request,
}) => {
  const sessionId = await getSession(request);
  // `commercial_sale` step `financial` owns `instalmentTerms`, a repeatable
  // field with date / money / text columns.
  const id = await seed(request, sessionId, "commercial_sale", "financial");

  await mockAuth(page, sessionId);
  await suppressProfilePrompt(page);
  await openBuilder(page, id);

  await expect(page.getByText("هنوز ردیفی ثبت نشده است.")).toBeVisible();

  // ---------------------------------------------------------------
  // Add a row, type into its text cell.
  // ---------------------------------------------------------------
  await page.getByRole("button", { name: "افزودن قسط" }).click();
  // The row counter renders the LATIN digit (`index + 1`), not ۱.
  await expect(page.getByText(/^ردیف 1$/)).toBeVisible();
  const rowSave = nextSave(page, id);
  await page.getByLabel("توضیح").fill("قسط اول — پس از تنظیم سند");
  await rowSave;
  await waitForSaved(page);

  // Reload: the row and its value come back from the server.
  await page.reload();
  await expect(page.getByText(/^ردیف 1$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("توضیح")).toHaveValue("قسط اول — پس از تنظیم سند");

  // ---------------------------------------------------------------
  // Edit the row, autosave, reload again.
  // ---------------------------------------------------------------
  const editSave = nextSave(page, id);
  await page.getByLabel("توضیح").fill("قسط اول — اصلاح‌شده");
  await editSave;
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByLabel("توضیح")).toHaveValue("قسط اول — اصلاح‌شده", {
    timeout: 20_000,
  });

  // ---------------------------------------------------------------
  // Delete the row; the empty-state copy returns and the deletion
  // survives a reload (no ghost row on the next visit).
  // ---------------------------------------------------------------
  const deleteSave = nextSave(page, id);
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(/^ردیف 1$/)).toBeHidden();
  await deleteSave;
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByText("هنوز ردیفی ثبت نشده است.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/^ردیف 1$/)).toHaveCount(0);

  await request.delete(`/api/v1/property-contracts/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
  });
});
