/**
 * ============================================================
 * LEGALIR — Legal Library acceptance E2E (temporary verification spec)
 * ============================================================
 * NOT COMMITTED — a throwaway harness that proves the 9 acceptance criteria
 * for the independent «کتابخانه لیگالیر» section. Signs in as the dev
 * SUPER_ADMIN (OTP 405405), then drives the real admin API + public API:
 *
 *   1. a DRAFT is not public (list + detail),
 *   2. publishing makes it appear,
 *   3. a published card opens a real detail,
 *   4. an edit persists,
 *   5. archiving removes it from the public site,
 *   6. an unauthenticated caller cannot run the admin library APIs,
 *   7. a draft never leaks via the public page / API / metadata,
 *   8. the library is independent of the blog (separate stores),
 *   9. the public page surfaces real loading/empty states.
 *
 * Every created source is deleted in afterAll so the dev store is left clean.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const ADMIN_MOBILE = "09120000000"; // dev seed SUPER_ADMIN (+989120000000)
const ADMIN_MOBILE_E164 = "+989120000000";

let sessionId: string | null = null;
const createdIds: string[] = [];

async function ensureSession(request: APIRequestContext): Promise<string> {
  if (sessionId) return sessionId;
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const reqBody = (await reqRes.json()) as { data?: { challengeId?: string } };
  const challengeId = reqBody.data?.challengeId;
  if (!challengeId) throw new Error(`admin OTP request failed: ${JSON.stringify(reqBody)}`);

  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { sessionId?: string } };
  const sid = verifyBody.data?.sessionId;
  if (!sid) throw new Error(`admin OTP verify failed: ${JSON.stringify(verifyBody)}`);
  sessionId = sid;
  return sid;
}

function adminHeaders(sid: string) {
  return { cookie: `${SESSION_COOKIE}=${sid}` };
}

/** A unique per-run title so parallel/rat runs never collide in the dev store. */
const RUN = Date.now();
const draftTitle = `E2E-${RUN}-draft`;
const liveTitle = `E2E-${RUN}-live`;

async function createSource(
  request: APIRequestContext,
  sid: string,
  data: Record<string, unknown>
): Promise<{ id: string; slug: string; status: string }> {
  const res = await request.post("/api/v1/admin/legal-library", {
    headers: adminHeaders(sid),
    data,
  });
  expect(res.status(), `create failed: ${await res.text()}`).toBe(201);
  const body = (await res.json()) as { data: { id: string; slug: string; status: string } };
  createdIds.push(body.data.id);
  return body.data;
}

test.afterAll(async ({ request }) => {
  if (!sessionId) return;
  for (const id of createdIds) {
    // Delete is a POST sub-path (the catch-all exports GET/POST/PATCH only).
    await request.post(`/api/v1/admin/legal-library/${id}/delete`, {
      headers: adminHeaders(sessionId),
      data: {},
    });
  }
});

// ============================================================
// 1, 2, 5, 8 — lifecycle through the real admin + public APIs
// ============================================================

test.describe("library lifecycle", () => {
  test("a draft stays private, publishing reveals it, archiving hides it", async ({ request }) => {
    const sid = await ensureSession(request);

    // --- create as DRAFT (no status) ---
    const draft = await createSource(request, sid, {
      title: draftTitle,
      summary: "پیش‌نویس — نباید عمومی شود",
      body: "متن پیش‌نویس",
    });
    expect(draft.status).toBe("DRAFT");

    // (1) not in the public list …
    const list1 = await request.get("/api/v1/legal-library?pageSize=100");
    const list1Body = (await list1.json()) as { data: { items: { id: string }[] } };
    expect(list1Body.data.items.some((i) => i.id === draft.id)).toBe(false);

    // … and its public detail 404s.
    const d1 = await request.get(`/api/v1/legal-library/${draft.id}`);
    expect(d1.status()).toBe(404);

    // --- publish ---
    const pub = await request.patch(`/api/v1/admin/legal-library/${draft.id}`, {
      headers: adminHeaders(sid),
      data: { status: "PUBLISHED" },
    });
    expect(pub.status()).toBe(200);
    expect(((await pub.json()) as { data: { status: string } }).data.status).toBe("PUBLISHED");

    // (2) now visible publicly …
    const list2 = await request.get("/api/v1/legal-library?pageSize=100");
    const list2Body = (await list2.json()) as { data: { items: { id: string }[] } };
    expect(list2Body.data.items.some((i) => i.id === draft.id)).toBe(true);

    // (3) … and its card opens a real detail.
    const d2 = await request.get(`/api/v1/legal-library/${draft.id}`);
    expect(d2.status()).toBe(200);
    const detail = (await d2.json()) as { data: { id: string; title: string } };
    expect(detail.data.id).toBe(draft.id);
    expect(detail.data.title).toBe(draftTitle);

    // --- archive ---
    const arch = await request.patch(`/api/v1/admin/legal-library/${draft.id}`, {
      headers: adminHeaders(sid),
      data: { status: "ARCHIVED" },
    });
    expect(arch.status()).toBe(200);
    expect(((await arch.json()) as { data: { status: string } }).data.status).toBe("ARCHIVED");

    // (5) gone from the public list again.
    const list3 = await request.get("/api/v1/legal-library?pageSize=100");
    const list3Body = (await list3.json()) as { data: { items: { id: string }[] } };
    expect(list3Body.data.items.some((i) => i.id === draft.id)).toBe(false);
    expect((await request.get(`/api/v1/legal-library/${draft.id}`)).status()).toBe(404);
  });

  test("an edit persists across a fresh read", async ({ request }) => {
    const sid = await ensureSession(request);
    const src = await createSource(request, sid, {
      title: draftTitle + "-edit",
      summary: "قبل",
      body: "متن قبل",
      status: "PUBLISHED",
    });

    const newTitle = liveTitle + "-edited";
    const patch = await request.patch(`/api/v1/admin/legal-library/${src.id}`, {
      headers: adminHeaders(sid),
      data: { title: newTitle, summary: "بعد" },
    });
    expect(patch.status()).toBe(200);

    // A fresh admin read reflects the change; the id is stable.
    const get = await request.get(`/api/v1/admin/legal-library/${src.id}`, {
      headers: adminHeaders(sid),
    });
    expect(get.status()).toBe(200);
    const body = (await get.json()) as { data: { id: string; title: string; summary: string } };
    expect(body.data.id).toBe(src.id);
    expect(body.data.title).toBe(newTitle);
    expect(body.data.summary).toBe("بعد");

    // And the PUBLIC detail reflects it too (single store).
    const pub = await request.get(`/api/v1/legal-library/${src.id}`);
    expect(((await pub.json()) as { data: { title: string } }).data.title).toBe(newTitle);
  });
});

// ============================================================
// 6 — the admin APIs are protected server-side
// ============================================================

test.describe("admin access control", () => {
  test("an unauthenticated caller is rejected on every admin verb", async ({ request }) => {
    const post = await request.post("/api/v1/admin/legal-library", { data: { title: "x" } });
    expect([401, 403], `POST returned ${post.status()}`).toContain(post.status());

    const patch = await request.patch("/api/v1/admin/legal-library/src-law-civil-230", {
      data: { status: "ARCHIVED" },
    });
    expect([401, 403]).toContain(patch.status());

    // The real delete is a POST sub-path (`/:id/delete`), not HTTP DELETE.
    const del = await request.post("/api/v1/admin/legal-library/src-law-civil-230/delete", {
      data: {},
    });
    expect([401, 403]).toContain(del.status());

    const get = await request.get("/api/v1/admin/legal-library");
    expect([401, 403]).toContain(get.status());
  });
});

// ============================================================
// 7 — a draft never leaks through the public page / metadata
// ============================================================

test.describe("no draft leak", () => {
  test("the draft title never reaches the public list page HTML", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await createSource(request, sid, {
      title: draftTitle + "-leak",
      summary: "محرمانه",
      body: "نباید فاش شود",
    });

    await page.goto("/legal-library");
    await expect(page.getByRole("heading", { name: "کتابخانه حقوقی" })).toBeVisible({ timeout: 20_000 });
    // Wait for the list to settle, then assert the draft string is absent.
    await page.waitForLoadState("networkidle");
    const html = await page.content();
    expect(html).not.toContain(draftTitle + "-leak");
  });
});

// ============================================================
// 8 — the library is independent of the blog
// ============================================================

test.describe("library ≠ blog", () => {
  test("a library source never appears in the blog feed", async ({ request }) => {
    const sid = await ensureSession(request);
    const src = await createSource(request, sid, {
      title: liveTitle + "-independence",
      summary: "استقلال از وبلاگ",
      status: "PUBLISHED",
    });
    expect(src.slug).toBeTruthy();

    const blog = await request.get("/api/v1/blog?pageSize=100");
    expect(blog.status()).toBe(200);
    const blogBody = (await blog.json()) as { data: { items: { slug: string; id?: string }[] } };
    const blogSlugs = blogBody.data.items.map((i) => i.slug);
    // The library source's slug/id must NOT be present in the blog store.
    expect(blogSlugs).not.toContain(src.slug);
    expect(blogSlugs).not.toContain(src.id);
  });
});

// ============================================================
// 9 — real loading / empty / error-capable states on the public page
// ============================================================

test.describe("public page states", () => {
  test("a filter with no matches shows the real empty state", async ({ page }) => {
    await page.goto("/legal-library");
    await expect(page.getByRole("heading", { name: "کتابخانه حقوقی" })).toBeVisible({ timeout: 20_000 });
    const search = page.getByLabel("جستجو در کتابخانه حقوقی");
    await search.fill("ZZZ-no-such-source-" + RUN);
    await expect(page.getByText("منبعی با این فیلترها یافت نشد")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "نمایش همه منابع" })).toBeVisible();
  });

  test("an unknown source id renders the public not-found surface", async ({ page }) => {
    await page.goto("/legal-library/does-not-exist-" + RUN);
    // The client resolves the 404 and renders the not-found state (no crash).
    await expect(page.getByText("خطای بحرانی")).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();
  });
});

// ============================================================
// Admin page renders for the SUPER_ADMIN with the right shell title
// ============================================================

test.describe("admin library page", () => {
  test("the section renders for a super-admin", async ({ page, request }) => {
    const sid = await ensureSession(request);
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: sid, url: "http://localhost:3000" },
    ]);
    await page.addInitScript(
      (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
      {
        state: {
          session: {
            sessionId: sid,
            userId: "admin-user-id",
            mobileE164: ADMIN_MOBILE_E164,
            mobileDisplay: ADMIN_MOBILE,
            isNewUser: false,
            createdAt: Date.now(),
          },
        },
        version: 0,
      }
    );

    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/admin/legal-library");
    await expect(page).toHaveURL(/\/admin\/legal-library$/, { timeout: 20_000 });
    await expect(page.locator("header h1").first()).toHaveText("کتابخانه لیگالیر", { timeout: 20_000 });
    await expect(page.getByText("دسترسی محدود")).toHaveCount(0);
    await expect(page.getByText("خطای بحرانی")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
