/**
 * ============================================================
 * LEGALIR — TEMPORARY verification harness (not a permanent spec)
 * ============================================================
 * Proves, against the live dev server and the real `.data` store, that the
 * security-event filters the two dossiers promise actually exist and work:
 *
 *   1. /admin/staff exposes resource-kind, resource-id, action, actor, free-text
 *      and result filters; the dropdowns are built from the values the log
 *      really contains (not a static catalog).
 *   2. A deep link `?resourceType=…&resourceId=…` lands on a pre-filtered trail
 *      whose row count equals what the API reports for the same filter.
 *   3. The organization dossier links into its own trail, and the link resolves.
 *
 * Read-only: this spec never mutates the store.
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

function adminSession(): string {
  const user = readTable("users").find(
    (u) => last10(String(u["mobile"] ?? "")) === last10(ADMIN_MOBILE)
  );
  expect(user, `a seeded admin for ${ADMIN_MOBILE}`).toBeTruthy();
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

test("security-event filters are real and built from the recorded values", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  // What the API says exists is the contract the dropdown must match.
  const apiRes = await request.get("/api/v1/admin/audit?pageSize=1", { headers: { cookie } });
  expect(apiRes.ok()).toBe(true);
  const apiBody = (await apiRes.json()) as {
    data: { total: number; facets: { resourceTypes: string[]; actions: string[] } };
  };
  expect(apiBody.data.facets, "the trail reports its own facets").toBeTruthy();
  expect(apiBody.data.facets.resourceTypes.length).toBeGreaterThan(3);
  expect(apiBody.data.facets.actions.length).toBeGreaterThan(3);

  await page.goto("/admin/staff", { waitUntil: "networkidle" });

  const section = page.locator("section", { hasText: "رویدادهای امنیتی (ممیزی)" }).last();
  await expect(section).toBeVisible();

  // Every promised filter is present and operable.
  const typeSelect = section.getByLabel("نوع منبع");
  const actionSelect = section.getByLabel("کلید عمل");
  const resultSelect = section.getByLabel("نتیجه");
  const resourceIdInput = section.getByLabel("شناسهٔ منبع");
  const actorInput = section.getByLabel("شناسهٔ کنشگر");
  const search = section.getByPlaceholder("جست‌وجو در کلید عمل و شناسهٔ منبع…");

  for (const el of [typeSelect, actionSelect, resultSelect, resourceIdInput, actorInput, search]) {
    await expect(el).toBeVisible();
  }

  // The kind dropdown offers the real distinct values, in sorted order.
  const typeOptions = await typeSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean)
  );
  expect(typeOptions).toEqual(apiBody.data.facets.resourceTypes);

  // The action dropdown likewise.
  const actionOptions = await actionSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean)
  );
  expect(actionOptions).toEqual(apiBody.data.facets.actions);

  expect(errors, `console errors on /admin/staff: ${errors.join(" | ")}`).toEqual([]);
});

test("a resource deep link lands on exactly that entity's trail", async ({ page, request }) => {
  // Pick a resource that really has more than one recorded event.
  const all = await request.get("/api/v1/admin/audit?pageSize=200", { headers: { cookie } });
  const body = (await all.json()) as {
    data: { items: { resourceType: string; resourceId: string }[] };
  };
  const counts = new Map<string, number>();
  for (const i of body.data.items) {
    const k = `${i.resourceType}::${i.resourceId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const target = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  expect(target, "a resource with at least two events").toBeTruthy();
  const [resourceType, resourceId] = target![0].split("::") as [string, string];
  const expected = target![1];

  const expectedRes = await request.get(
    `/api/v1/admin/audit?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}&pageSize=1`,
    { headers: { cookie } }
  );
  const expectedBody = (await expectedRes.json()) as { data: { total: number } };
  expect(expectedBody.data.total).toBe(expected);

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto(
    `/admin/staff?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`,
    { waitUntil: "networkidle" }
  );

  // The URL survives the render (the page does not strip the deep link).
  expect(page.url()).toContain(`resourceType=${resourceType}`);
  expect(page.url()).toContain(`resourceId=${resourceId}`);

  const section = page.locator("section", { hasText: "رویدادهای امنیتی (ممیزی)" }).last();
  await expect(section.getByLabel("نوع منبع")).toHaveValue(resourceType);
  await expect(section.getByLabel("شناسهٔ منبع")).toHaveValue(resourceId);

  // The banner names the scope and the count matches the API (the footer
  // renders Persian numerals, so the assertion converts).
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  const toFa = (n: number) => String(n).replace(/\d/g, (d) => faDigits[Number(d)]!);

  await expect(
    section.getByText(`${resourceType}:${resourceId}`, { exact: false }).first()
  ).toBeVisible();
  await expect(section.getByText(`${toFa(expected)} رویداد`, { exact: false })).toBeVisible();

  // Every rendered row is that entity's.
  const sourceCells = section.locator("tbody tr td:nth-child(4)");
  const count = await sourceCells.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(sourceCells.nth(i)).toHaveText(`${resourceType}:${resourceId}`);
  }

  expect(errors, `console errors on the deep link: ${errors.join(" | ")}`).toEqual([]);
});

test("filtering the trail does not reset the staff directory beside it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto("/admin/staff", { waitUntil: "networkidle" });

  // Type into BOTH sections — the staff directory's own filter, and the trail's.
  const staffSearch = page.getByPlaceholder("جست‌وجوی نام یا ایمیل…");
  await staffSearch.fill("مدیر");

  const section = page.locator("section", { hasText: "رویدادهای امنیتی (ممیزی)" }).last();
  const auditSearch = section.getByPlaceholder("جست‌وجو در کلید عمل و شناسهٔ منبع…");
  await auditSearch.fill("lawyer");

  // The trail's filter reaches the address bar…
  await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("q=lawyer");
  // …and the staff directory still holds what was typed: the trail writes the
  // address with history.replaceState, so it must not remount the page.
  await expect(staffSearch).toHaveValue("مدیر");
  await expect(auditSearch).toHaveValue("lawyer");

  expect(errors, `page errors on /admin/staff: ${errors.join(" | ")}`).toEqual([]);
});

test("the organization dossier links into its own trail", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

  await page.goto("/admin/users", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "سازمان‌ها" }).click();

  const openButton = page.getByRole("button", { name: "پرونده" }).first();
  await expect(openButton).toBeVisible({ timeout: 15_000 });
  await openButton.click();

  await expect(page.getByRole("heading", { name: "پروندهٔ سازمان" })).toBeVisible();

  const trailLink = page.getByRole("link", { name: /مشاهدهٔ رویدادهای این سازمان/ });
  await expect(trailLink).toBeVisible();
  const href = await trailLink.getAttribute("href");
  expect(href).toContain("resourceType=organization");
  expect(href).toContain("resourceId=");

  await trailLink.click();
  await page.waitForURL(/\/admin\/staff\?/, { timeout: 15_000 });

  const section = page.locator("section", { hasText: "رویدادهای امنیتی (ممیزی)" }).last();
  await expect(section.getByLabel("نوع منبع")).toHaveValue("organization", { timeout: 15_000 });
  const scopedId = new URL(page.url()).searchParams.get("resourceId");
  expect(scopedId).toBeTruthy();
  await expect(section.getByLabel("شناسهٔ منبع")).toHaveValue(scopedId!);

  expect(errors, `console errors while following the trail link: ${errors.join(" | ")}`).toEqual([]);
});
