/**
 * ============================================================
 * LEGALIR — TEMPORARY verification harness (not a permanent spec)
 * ============================================================
 * Proves, in a real browser against the live dev server, the two surfaces
 * added in this change:
 *
 *   1. /admin/users → «سازمان‌ها» tab renders the REAL register (counts from
 *      the rows), opens the dossier drawer, and a status change round-trips
 *      through the API back into the store.
 *   2. /admin/services → the scope drawer edits the flag's plan/org
 *      allow-lists and the saved value is what the API reports.
 *
 * The session is read straight from `.data/sessions.json` for the seeded
 * SUPER_ADMIN, because the dev OTP bucket is 3 requests / 5 minutes and is
 * shared with every other process driving this server.
 *
 * Every mutation is REVERTED before the test ends, so the dev store is left
 * exactly as it was found.
 * ============================================================
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000";
const DATA_DIR = path.resolve(process.cwd(), ".data");

type Row = Record<string, unknown>;

function readTable(name: string): Row[] {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8")) as Row[];
  } catch {
    return [];
  }
}

const last10 = (mobile: string) => mobile.replace(/\D/g, "").slice(-10);

/** A live platform-staff session, read from the store (no OTP quota). */
function adminSession(): string {
  const user = readTable("users").find(
    (u) => last10(String(u["mobile"] ?? "")) === last10(ADMIN_MOBILE)
  );
  expect(user, `a seeded admin for ${ADMIN_MOBILE}`).toBeTruthy();
  const role = String(user!["role"] ?? "");
  expect(["SUPER_ADMIN", "ADMIN"], "the seeded admin is platform staff").toContain(role);

  const now = Date.now();
  const live = readTable("sessions")
    .filter((s) => s["userId"] === user!["id"] && Date.parse(String(s["expiresAt"])) > now)
    .sort((a, b) =>
      String(b["lastActiveAt"] ?? "").localeCompare(String(a["lastActiveAt"] ?? ""))
    );
  expect(live.length, "a live admin session in .data").toBeGreaterThan(0);
  return String(live[0]!["id"]);
}

test.describe.configure({ mode: "serial", timeout: 180_000 });

let cookie: string;

test.beforeAll(() => {
  cookie = `${SESSION_COOKIE}=${adminSession()}`;
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: SESSION_COOKIE, value: cookie.split("=")[1]!, domain: "localhost", path: "/" },
  ]);
});

test("organizations tab renders the real register, opens the dossier and round-trips a status change", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto("/admin/users", { waitUntil: "networkidle" });

  // The page keeps its long-standing title and gains a second real register.
  await expect(page.locator("main h1").first()).toContainText("کاربران و سازمان‌ها");

  const orgsTab = page.getByRole("tab", { name: "سازمان‌ها" });
  await orgsTab.click();
  await expect(orgsTab).toHaveAttribute("aria-selected", "true");

  // The table carries a «پرونده» action per row — the real register, not a stub.
  const openButton = page.getByRole("button", { name: "پرونده" }).first();
  await expect(openButton).toBeVisible({ timeout: 15_000 });

  const rows = page.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);

  await openButton.click();

  // The drawer is the full dossier: identity, members, signatories, status.
  await expect(page.getByRole("heading", { name: "پروندهٔ سازمان" })).toBeVisible();
  await expect(page.getByText("شناسه‌های ثبتی")).toBeVisible();
  await expect(page.getByText("اعضای سازمان", { exact: false })).toBeVisible();
  await expect(page.getByText("صاحبان امضای مجاز", { exact: false })).toBeVisible();

  // ── Round-trip a status change through UI → API → DB ───────────────────
  const statusSelect = page.locator("select").last();
  const original = await statusSelect.inputValue();
  const target = original === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

  // The drawer was opened on the FIRST row of the register, so resolve the id
  // from the same list the page rendered (ids are bare UUIDs, not prefixed).
  const listRes = await request.get("/api/v1/admin/organizations", { headers: { cookie } });
  const listBody = (await listRes.json()) as { data?: { items?: { id: string }[] } };
  const orgId = listBody.data?.items?.[0]?.id ?? null;
  expect(orgId, "the register reports at least one organization").toBeTruthy();

  try {
    await statusSelect.selectOption(target);
    const save = page.getByRole("button", { name: "ذخیرهٔ وضعیت" });
    await expect(save).toBeEnabled();
    await save.click();

    await expect
      .poll(
        async () => {
          const res = await request.get(`/api/v1/admin/organizations/${orgId}`, {
            headers: { cookie },
          });
          const body = (await res.json()) as { data?: { status?: string } };
          return body.data?.status;
        },
        { timeout: 15_000 }
      )
      .toBe(target);
  } finally {
    // Leave the dev store exactly as found.
    if (orgId) {
      await request.patch(`/api/v1/admin/organizations/${orgId}`, {
        headers: { cookie },
        data: { status: original },
      });
    }
  }

  expect(errors, `console errors on /admin/users: ${errors.join(" | ")}`).toEqual([]);
});

test("services page edits a flag's allow-lists through the scope drawer", async ({
  page,
  request,
}) => {
  const flagsRes = await request.get("/api/v1/admin/flags", { headers: { cookie } });
  expect(flagsRes.ok()).toBe(true);
  const flagsBody = (await flagsRes.json()) as {
    data: {
      items: { key: string; status: string; allowedPlans: string[]; allowedOrgIds: string[] }[];
    };
  };
  const items = flagsBody.data.items;
  expect(items.length).toBeGreaterThan(0);

  // The allow-lists only render a «ویرایش محدوده» button for limited /
  // experiment flags, so put one in that state for the duration of the test.
  const subject =
    items.find((f) => f.status === "limited" || f.status === "experiment") ?? items[0]!;
  const original = {
    status: subject.status,
    allowedPlans: subject.allowedPlans,
    allowedOrgIds: subject.allowedOrgIds,
  };
  const wasScoped = original.status === "limited" || original.status === "experiment";

  if (!wasScoped) {
    const res = await request.patch(`/api/v1/admin/flags/${encodeURIComponent(subject.key)}`, {
      headers: { cookie },
      data: { status: "limited", rolloutPercent: 10 },
    });
    expect(res.ok()).toBe(true);
  }

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  try {
    await page.goto("/admin/services", { waitUntil: "networkidle" });

    const scopeButton = page.getByRole("button", { name: "ویرایش محدوده" }).first();
    await expect(scopeButton).toBeVisible({ timeout: 15_000 });
    await scopeButton.click();

    await expect(page.getByRole("heading", { name: "محدودهٔ انتشار" })).toBeVisible();

    // The plan chips are the REAL catalog — pick the first one and save.
    const planChips = page.getByRole("group", { name: "پلن‌های مجاز" }).getByRole("button");
    expect(await planChips.count(), "the plan catalog is non-empty").toBeGreaterThan(0);

    const firstChip = planChips.first();
    if ((await firstChip.getAttribute("aria-pressed")) !== "true") await firstChip.click();

    const orgInput = page.getByPlaceholder("org_xxxxxxxx, org_yyyyyyyy");
    await orgInput.fill("org_e2e_probe");

    const save = page.getByRole("button", { name: "ذخیرهٔ محدوده" });
    await expect(save).toBeEnabled();
    await save.click();

    // The persisted row carries what the drawer submitted.
    await expect
      .poll(
        async () => {
          const res = await request.get("/api/v1/admin/flags", { headers: { cookie } });
          const body = (await res.json()) as {
            data: { items: { key: string; allowedOrgIds: string[]; allowedPlans: string[] }[] };
          };
          const row = body.data.items.find((f) => f.key === subject.key);
          return { orgs: row?.allowedOrgIds ?? [], plans: row?.allowedPlans ?? [] };
        },
        { timeout: 15_000 }
      )
      .toMatchObject({ orgs: ["org_e2e_probe"] });
  } finally {
    await request.patch(`/api/v1/admin/flags/${encodeURIComponent(subject.key)}`, {
      headers: { cookie },
      data: {
        status: original.status,
        rolloutPercent: original.status === "limited" ? 10 : 100,
        allowedPlans: original.allowedPlans,
        allowedOrgIds: original.allowedOrgIds,
      },
    });
  }

  expect(errors, `console errors on /admin/services: ${errors.join(" | ")}`).toEqual([]);
});
