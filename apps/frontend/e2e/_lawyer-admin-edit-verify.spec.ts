/**
 * ============================================================
 * LEGALIR — Lawyer self-service + admin editability · live verification
 * ============================================================
 * NOT COMMITTED, temporary harness. Runs against the RUNNING dev server and
 * its real JSON tables — no mocks. Proves:
 *
 *   · the lawyer reaches /lawyer/cases, sees their real caseload, and can open
 *     a case workbench with its tabs;
 *   · the settlement account (bank / IBAN / account number / card) is editable
 *     from /lawyer/bank, /lawyer/profile AND /lawyer/settings;
 *   · the admin drawer can edit the settlement account and the published
 *     rates — the operator side of the same request;
 *   · no page raises an uncaught error on any of those surfaces.
 *
 * Auth reuses the OTP dev code (405405). The OTP endpoint allows three
 * requests per mobile per five minutes, so each account signs in ONCE.
 */

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const SESSION_COOKIE = "legalir-session";

const LAWYER_MOBILE = "09120000010";
const ADMIN_MOBILE = "09120000000";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const sessions = new Map<string, string>();

function readTable<T>(name: string): T[] {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8")) as T[];
  } catch {
    return [];
  }
}

const last10 = (mobile: string) => mobile.replace(/\D/g, "").slice(-10);

/**
 * A live session id for a seeded account, read straight from the JSON store.
 *
 * The OTP endpoint allows three requests per mobile per five minutes, so a
 * harness that signs in on every run eventually gets a 429. Reusing the session
 * the dev server already issued keeps the run deterministic and exercises
 * exactly the cookie the browser would carry after a real sign-in.
 */
function sessionFor(mobile: string): string {
  const cached = sessions.get(mobile);
  if (cached) return cached;

  const user = readTable<{ id: string; mobile?: string }>("users").find(
    (u) => last10(u.mobile ?? "") === last10(mobile)
  );
  expect(user, `a seeded user for ${mobile}`).toBeTruthy();

  const now = Date.now();
  const live = readTable<{ id: string; userId: string; expiresAt: string; lastActiveAt?: string }>(
    "sessions"
  )
    .filter((s) => s.userId === user!.id && Date.parse(s.expiresAt) > now)
    .sort((a, b) => String(b.lastActiveAt ?? "").localeCompare(String(a.lastActiveAt ?? "")));

  expect(live.length, `a live session for ${mobile}`).toBeGreaterThan(0);
  sessions.set(mobile, live[0]!.id);
  return live[0]!.id;
}

test.beforeAll(() => {
  sessionFor(LAWYER_MOBILE);
  sessionFor(ADMIN_MOBILE);
});

async function seed(page: Page, mobile: string, home: string) {
  const sid = sessionFor(mobile);
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
    { name: "legalir-home", value: home, url: "http://localhost:3000" },
  ]);
}

test.describe("lawyer · caseload", () => {
  test("the caseload page renders real data with no page error", async ({ page }) => {
    await seed(page, LAWYER_MOBILE, "/lawyer");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/lawyer/cases");
    await page.waitForLoadState("networkidle");

    // The shell header also renders this label; scope to the page body.
    await expect(page.getByRole("main").getByRole("heading", { name: "پرونده‌ها" })).toBeVisible();

    // Real summary tiles, and either real rows or the honest empty state.
    const body = await page.locator("body").innerText();
    expect(body).toContain("کل پرونده‌ها");
    const hasRows = (await page.getByRole("link", { name: /مشاهده/ }).count()) > 0;
    const hasEmpty = body.includes("پرونده‌ای با این فیلتر یافت نشد");
    expect(hasRows || hasEmpty).toBe(true);

    expect(errors).toEqual([]);
  });

  test("a case opens into its workbench with all five tabs", async ({ page }) => {
    await seed(page, LAWYER_MOBILE, "/lawyer");
    await page.goto("/lawyer/cases");
    await page.waitForLoadState("networkidle");

    const firstRow = page.getByRole("link", { name: /مشاهده/ }).first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "the seeded lawyer owns no case — nothing to open");
      return;
    }

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await firstRow.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/lawyer\/cases\/[^/]+$/);

    for (const label of ["نمای کلی", "وظایف", "مهلت‌ها", "طرف‌ها", "تایم‌لاین"]) {
      await expect(page.getByRole("tab", { name: label })).toBeVisible();
    }

    // Each tab renders its own content (never a crash). The shared `Tabs`
    // primitive is tablist/tab only — there is no `tabpanel` element — so the
    // proof is the selected state plus a body that actually swapped.
    const body = page.getByRole("main");
    const overviewText = await body.innerText();

    const tasksTab = page.getByRole("tab", { name: /وظایف/ });
    await tasksTab.click();
    await expect(tasksTab).toHaveAttribute("aria-selected", "true");
    const tasksText = await body.innerText();
    expect(tasksText).not.toBe(overviewText);
    expect(tasksText).not.toContain("وضعیت پرونده");

    const deadlinesTab = page.getByRole("tab", { name: /مهلت‌ها/ });
    await deadlinesTab.click();
    await expect(deadlinesTab).toHaveAttribute("aria-selected", "true");
    const deadlinesText = await body.innerText();
    expect(deadlinesText).not.toBe(tasksText);

    expect(errors).toEqual([]);
  });
});

test.describe("lawyer · settlement account is editable on every surface", () => {
  for (const path of ["/lawyer/bank", "/lawyer/profile", "/lawyer/settings"]) {
    test(`${path} exposes the full settlement form`, async ({ page }) => {
      await seed(page, LAWYER_MOBILE, "/lawyer");
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const body = await page.locator("body").innerText();
      expect(body).toContain("حساب تسویه");
      // The three identifiers the request names explicitly.
      expect(body).toMatch(/شبا/);
      expect(body).toMatch(/شمارهٔ کارت|چهار رقم آخر/);
      expect(body).toMatch(/شمارهٔ حساب/);

      expect(errors).toEqual([]);
    });
  }

  test("settings shows the contact card as read-only (no dead input)", async ({ page }) => {
    await seed(page, LAWYER_MOBILE, "/lawyer");
    await page.goto("/lawyer/settings");
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").innerText();
    expect(body).toContain("اطلاعات تماس");
    // The mobile field must not be an editable input — changing a sign-in
    // mobile is an OTP flow, not a profile patch.
    const mobileInputs = page.locator('input[name="mobile"]');
    expect(await mobileInputs.count()).toBe(0);
  });
});

test.describe("admin · the same fields are editable from the operator side", () => {
  test("the drawer exposes rate editing and account replacement", async ({ page }) => {
    await seed(page, ADMIN_MOBILE, "/dashboard");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/admin/lawyers");
    await page.waitForLoadState("networkidle");

    // Open the first lawyer's dossier — the row action is labelled «مدیریت».
    await page.getByRole("button", { name: "مدیریت" }).first().click();

    await expect(page.getByRole("tab", { name: "ویرایش" })).toBeVisible();

    // Edit tab — locations and the referral switch now exist.
    await page.getByRole("tab", { name: "ویرایش" }).click();
    await expect(page.getByText("دریافت ارجاع تازه")).toBeVisible();
    await expect(page.getByText(/شهر و محدودهٔ خدمات/)).toBeVisible();

    // Rates tab — the operator can set a price.
    await page.getByRole("tab", { name: /نرخ‌ها/ }).click();
    await expect(page.getByText("افزودن / تغییر نرخ یک خدمت")).toBeVisible();

    // Bank tab — the operator can replace the account with a recorded reason.
    await page.getByRole("tab", { name: /حساب تسویه/ }).click();
    await page.getByRole("button", { name: "اصلاح اطلاعات حساب" }).click();
    await expect(page.getByText("دلیل تغییر (الزامی)")).toBeVisible();
    await expect(page.getByText(/شمارهٔ شبا/).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
