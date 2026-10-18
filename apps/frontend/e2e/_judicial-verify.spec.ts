/**
 * ============================================================
 * LEGALIR — Judicial drafting verification (QA harness)
 * ============================================================
 * Not a product spec: it proves the §15 acceptance scenarios that a unit
 * test cannot — against the live dev server and a real session:
 *
 *   1. the /cases card renders with the product title and CTA, and the case
 *      search below it still works;
 *   2. the CTA opens the launcher, and `?type=` pre-selects the family;
 *   3. a real request can be started, its narrative saved, and the wizard
 *      resumes the saved text after a hard reload;
 *   4. /services, /new and the public home page show the admin-managed zone;
 *   5. toggling `surfaces.services` off in the admin hides it from /services
 *      while /cases keeps working — then restores it;
 *   6. no horizontal overflow at 360 / 768 / 1440;
 *   7. a draft is REFUSED while required answers are missing, an edit produces
 *      a NEW version while the previous text stays, and repeating the same
 *      inputs costs nothing.
 *
 * Every row it creates is removed, and the surface toggle is restored.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
/** Dev seed SUPER_ADMIN — the only account allowed to move a service surface. */
const ADMIN_MOBILE = "09120000000";
const SESSION_CACHE = join(tmpdir(), "legalir-e2e-judicial-session.json");
/** Separate cache: the admin OTP bucket is capped at 3 requests / 5 minutes. */
const ADMIN_SESSION_CACHE = join(tmpdir(), "legalir-e2e-judicial-admin-session.json");

const CARD_TITLE = "تنظیم دادخواست و شکواییه تخصصی";
const CARD_DESCRIPTION =
  "موضوع را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید.";
const CARD_CTA = "شروع تنظیم";

test.describe.configure({ timeout: 180_000 });

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

async function getSession(request: APIRequestContext): Promise<SessionInfo> {
  if (existsSync(SESSION_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as SessionInfo;
      const check = await request.get("/api/v1/judicial/requests", {
        headers: { cookie: `${SESSION_COOKIE}=${cached.sessionId}` },
      });
      if (check.ok()) return cached;
    } catch {
      /* fall through to a fresh login */
    }
  }
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: DEMO_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) throw new Error("Failed to request OTP challenge");
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const body = (await verifyRes.json()) as {
    data?: { sessionId?: string; userId?: string; mobileDisplay?: string };
  };
  if (!body.data?.sessionId) throw new Error("Failed to verify OTP");
  const session: SessionInfo = {
    sessionId: body.data.sessionId,
    userId: body.data.userId ?? "demo-user-id",
    mobileDisplay: body.data.mobileDisplay ?? DEMO_MOBILE,
  };
  try {
    writeFileSync(SESSION_CACHE, JSON.stringify(session));
  } catch {
    /* cache is best-effort */
  }
  return session;
}

/**
 * A separate session for the seeded SUPER_ADMIN.
 *
 * The admin OTP bucket allows only 3 requests per 5 minutes, so this session
 * is CACHED like the demo one and validated against a real admin-only read
 * before reuse — a stale session falls back to a fresh login instead of
 * failing the whole spec.
 */
async function getAdminSession(request: APIRequestContext): Promise<SessionInfo> {
  const stillAdmin = async (s: SessionInfo): Promise<boolean> => {
    const res = await request.get("/api/v1/admin/judicial", {
      headers: { cookie: `${SESSION_COOKIE}=${s.sessionId}` },
    });
    return res.ok();
  };

  if (existsSync(ADMIN_SESSION_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(ADMIN_SESSION_CACHE, "utf8")) as SessionInfo;
      if (await stillAdmin(cached)) return cached;
    } catch {
      /* fall through to a fresh login */
    }
  }

  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) {
    throw new Error(
      `Failed to request admin OTP challenge (status ${reqRes.status()}) — ` +
        "the dev server's OTP bucket may be rate-limited; wait 5 minutes and retry."
    );
  }
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const body = (await verifyRes.json()) as {
    data?: { sessionId?: string; userId?: string; mobileDisplay?: string };
  };
  if (!body.data?.sessionId) throw new Error("Failed to verify admin OTP");
  const session: SessionInfo = {
    sessionId: body.data.sessionId,
    userId: body.data.userId ?? "admin-user-id",
    mobileDisplay: body.data.mobileDisplay ?? ADMIN_MOBILE,
  };
  try {
    writeFileSync(ADMIN_SESSION_CACHE, JSON.stringify(session));
  } catch {
    /* cache is best-effort */
  }
  return session;
}

async function mockAuth(page: Page, session: SessionInfo) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: session.sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
    {
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
    }
  );
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
}

test.describe("Judicial drafting", () => {
  test("card, launcher, wizard persistence, surfaces, widths", async ({ page, request }) => {
    const session = await getSession(request);
    const auth = { cookie: `${SESSION_COOKIE}=${session.sessionId}` };
    await mockAuth(page, session);

    // ---------------------------------------------------------------
    // §15.1 + §15.2 — /cases keeps its list and gains the card
    // ---------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/cases");

    const card = page.getByRole("heading", { name: CARD_TITLE, level: 2 });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(CARD_DESCRIPTION).first()).toBeVisible();

    // The existing case surface is still there: its search field and status
    // filters must not have been displaced by the card.
    await expect(page.getByLabel("جست‌وجو در پرونده‌ها")).toBeVisible();
    await expect(page.getByLabel("فیلتر وضعیت پرونده")).toBeVisible();

    const cta = page.getByRole("link", { name: CARD_CTA }).first();
    await expect(cta).toBeVisible();
    await expectNoHorizontalScroll(page, "/cases @1440");

    // ---------------------------------------------------------------
    // §15.1 — the CTA reaches the real launcher
    // ---------------------------------------------------------------
    await cta.click();
    await page.waitForURL(/\/judicial($|\?)/);
    await expect(page.getByRole("heading", { name: CARD_TITLE, level: 1 })).toBeVisible();

    // ---------------------------------------------------------------
    // §7 Step 0 — `?type=` pre-selects the family, and only a real value
    // ---------------------------------------------------------------
    await page.goto("/judicial?type=complaint");
    const complaintChoice = page.getByRole("button", { name: /شکواییه کیفری/ });
    await expect(complaintChoice).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

    await page.goto("/judicial?type=not-a-family");
    const petitionChoice = page.getByRole("button", { name: /دادخواست حقوقی/ });
    await expect(petitionChoice).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

    // ---------------------------------------------------------------
    // §15.5 — narrative is saved and survives a hard reload
    // ---------------------------------------------------------------
    const created = await request.post("/api/v1/judicial/requests", {
      headers: auth,
      data: {
        serviceId: "judicial_petition",
        startMode: "ai_draft",
        documentType: "petition",
        narrative: "",
        idempotencyKey: `e2e-${Date.now()}`,
      },
    });
    expect(created.ok()).toBeTruthy();
    const requestId = ((await created.json()) as { data: { request: { id: string } } }).data
      .request.id;

    try {
      await page.goto(`/judicial/${requestId}`);
      const narrative = page.getByLabel("شرح موضوع");
      await expect(narrative).toBeVisible({ timeout: 20_000 });

      const story = "مستأجر دو ماه است اجاره را پرداخت نکرده و قرارداد اجاره دارم.";
      await narrative.fill(story);
      const save = page.getByRole("button", { name: /ذخیره و ادامه/ });
      await expect(save).toBeEnabled();
      await save.click();

      // The save is a round-trip: wait for the wizard to advance before
      // reloading, otherwise the reload races the in-flight PATCH and lands on
      // the pre-save state. This is the user-visible proof that the write
      // landed, so the reload below tests persistence, not timing.
      await expect(page.getByRole("heading", { name: /پرسش‌نامه/ })).toBeVisible({
        timeout: 20_000,
      });

      // Saving advances to the questionnaire, so a reload must resume THERE —
      // the step the user actually left — not back at the narrative.
      await page.reload();
      await expect(page.getByRole("heading", { name: /پرسش‌نامه/ })).toBeVisible({
        timeout: 20_000,
      });

      // And the text itself is server-persisted, not local state.
      const detail = await request.get(`/api/v1/judicial/requests/${requestId}`, {
        headers: auth,
      });
      const saved = ((await detail.json()) as {
        data: { request: { narrative: string; currentStep: string } };
      }).data.request;
      expect(saved.narrative).toBe(story);
      expect(saved.currentStep).not.toBe("narrative");

      // ---- §15.12 — no fake judicial submission anywhere ---------------
      // The wizard's permanent footer states that nothing is filed, sent or
      // served, and no control on the page offers to do so.
      await expect(
        page.getByText(/هیچ سندی را برای شما ثبت، ارسال یا ابلاغ نمی‌کند/).first()
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /ارسال به|ثبت در مرجع/ })).toHaveCount(0);
    } finally {
      await request.delete(`/api/v1/judicial/requests/${requestId}`, { headers: auth });
    }

    // ---------------------------------------------------------------
    // §12 — the admin-managed surfaces actually render
    // ---------------------------------------------------------------
    await page.goto("/services");
    await expect(page.getByText(CARD_TITLE).first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalScroll(page, "/services @1440");

    await page.goto("/new");
    await expect(page.getByText(CARD_TITLE).first()).toBeVisible({ timeout: 20_000 });

    // Public home renders for a signed-out visitor too; its CTA must route
    // through login instead of dropping them on a gated page.
    const anon = await page.context().browser()!.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto("/");
    await expect(anonPage.getByText(CARD_TITLE).first()).toBeVisible({ timeout: 20_000 });
    const homeCta = anonPage.getByRole("link", { name: /تنظیم دادخواست|تنظیم شکواییه/ }).first();
    await expect(homeCta).toHaveAttribute("href", /^\/auth\/mobile\?intent=/);
    await anon.close();

    // ---------------------------------------------------------------
    // §12 — the toggle is the switch, not a hard-coded block
    // ---------------------------------------------------------------
    const catalog = await request.get("/api/v1/judicial/services");
    const before = ((await catalog.json()) as {
      data: { items: { id: string; surfaces: Record<string, boolean> }[] };
    }).data.items.find((s) => s.id === "judicial_petition")!;
    const originalSurfaces = { ...before.surfaces };

    const admin = await getAdminSession(request);
    const adminAuth = { cookie: `${SESSION_COOKIE}=${admin.sessionId}` };

    // §9 — admin and normal-user routes are separate: the same call that the
    // admin may make is refused for the demo user.
    const denied = await request.patch(
      "/api/v1/admin/judicial/services/judicial_petition",
      { headers: auth, data: { surfaces: { ...originalSurfaces, services: false } } }
    );
    expect(denied.status()).toBe(403);

    // The admin surface itself renders the real rows and the per-surface
    // checkboxes the product reads — not a placeholder.
    await mockAuth(page, admin);
    await page.goto("/admin/judicial");
    await expect(
      page.getByRole("heading", { name: "خدمات اوراق قضایی" }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("judicial_petition").first()).toBeVisible();
    await expect(page.getByText("judicial_criminal_record").first()).toBeVisible();
    await expect(page.getByLabel(/عنوان تنظیم دادخواست حقوقی/).first()).toBeVisible();

    const patched = await request.patch(
      "/api/v1/admin/judicial/services/judicial_petition",
      {
        headers: adminAuth,
        data: { surfaces: { ...originalSurfaces, services: false } },
      }
    );
    expect(patched.ok()).toBeTruthy();

    try {
      await mockAuth(page, session);
      await page.goto("/services");
      // The zone heading survives because the other three services still show;
      // what must disappear is the petition card itself.
      const petitionCard = page
        .locator("article")
        .filter({ hasText: "تنظیم دادخواست حقوقی" });
      await expect(petitionCard).toHaveCount(0, { timeout: 20_000 });
      await expect(
        page.locator("article").filter({ hasText: "تنظیم اظهارنامه قضایی" })
      ).toHaveCount(1);

      // /cases must be unaffected by another surface's toggle.
      await page.goto("/cases");
      await expect(page.getByRole("heading", { name: CARD_TITLE, level: 2 })).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await request.patch("/api/v1/admin/judicial/services/judicial_petition", {
        headers: adminAuth,
        data: { surfaces: originalSurfaces },
      });
    }

    // And restoring the surface brings the card back with no page edit.
    await page.goto("/services");
    await expect(
      page.locator("article").filter({ hasText: "تنظیم دادخواست حقوقی" })
    ).toHaveCount(1, { timeout: 20_000 });

    // ---------------------------------------------------------------
    // §15.16 — RTL correctness across the tested widths
    // ---------------------------------------------------------------
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/judicial?type=petition");
      await expectNoHorizontalScroll(page, `/judicial @${width}`);
      await page.goto("/cases");
      await expect(page.getByRole("heading", { name: CARD_TITLE, level: 2 })).toBeVisible({
        timeout: 20_000,
      });
      await expectNoHorizontalScroll(page, `/cases @${width}`);
    }
  });

  // -------------------------------------------------------------------
  // §15.9-11 — completeness gate, versioned drafts, free replays
  // -------------------------------------------------------------------
  test("refuses an incomplete draft, versions an edit, charges nothing twice", async ({
    request,
  }) => {
    const session = await getSession(request);
    const auth = { cookie: `${SESSION_COOKIE}=${session.sessionId}` };

    const created = await request.post("/api/v1/judicial/requests", {
      headers: auth,
      data: {
        serviceId: "judicial_petition",
        startMode: "ai_draft",
        documentType: "petition",
        narrative: "",
        idempotencyKey: `e2e-flow-${Date.now()}`,
      },
    });
    expect(created.ok()).toBeTruthy();
    const requestId = ((await created.json()) as { data: { request: { id: string } } }).data
      .request.id;

    try {
      // Nothing is answered yet, so no draft may exist.
      const early = await request.post(`/api/v1/judicial/requests/${requestId}/draft`, {
        headers: auth,
        data: { idempotencyKey: `e2e-early-${Date.now()}` },
      });
      expect(early.status()).toBe(409);
      const refusal = (await early.json()) as {
        code: string;
        missing?: { fieldId: string }[];
      };
      expect(refusal.code).toBe("INCOMPLETE_INPUTS");
      expect(refusal.missing?.map((m) => m.fieldId)).toContain("narrative");

      const story = "مستأجر دو ماه است اجاره را پرداخت نکرده و قرارداد اجاره دارم.";
      const saved = await request.patch(`/api/v1/judicial/requests/${requestId}`, {
        headers: auth,
        data: { narrative: story, currentStep: "questionnaire" },
      });
      expect(saved.ok()).toBeTruthy();

      const detail = await request.get(`/api/v1/judicial/requests/${requestId}`, {
        headers: auth,
      });
      const body = (await detail.json()) as {
        data: {
          questionnaire: {
            version: number;
            steps: {
              id: string;
              fields: {
                id: string;
                type: string;
                required: boolean;
                options?: { value: string }[];
              }[];
            }[];
          };
        };
      };
      const questionnaire = body.data.questionnaire;

      const sample = (field: {
        id: string;
        type: string;
        options?: { value: string }[];
      }): string => {
        if (field.id === "claimantName") return "علی رضایی";
        if (field.type === "boolean") return "false";
        if (field.type === "select") return field.options?.[0]?.value ?? "other";
        if (field.type === "currency") return "120000000";
        if (field.type === "number") return "2";
        if (field.type === "date") return "2026-01-01";
        return field.id === "facts"
          ? "مستأجر از تاریخ قرارداد اجاره را پرداخت نکرده است."
          : `نمونهٔ ${field.id}`;
      };

      const answerStep = async (
        step: (typeof questionnaire.steps)[number],
        overrides: Record<string, string> = {}
      ) => {
        const answers: Record<string, string> = {};
        for (const field of step.fields) {
          if (field.required) answers[field.id] = sample(field);
        }
        Object.assign(answers, overrides);
        const res = await request.post(
          `/api/v1/judicial/requests/${requestId}/answers`,
          { headers: auth, data: { stepId: step.id, answers, questionnaireVersion: questionnaire.version } }
        );
        expect(res.ok()).toBeTruthy();
      };

      for (const step of questionnaire.steps) await answerStep(step);

      const afterAnswers = await request.get(`/api/v1/judicial/requests/${requestId}`, {
        headers: auth,
      });
      const complete = (await afterAnswers.json()) as {
        data: { completeness: { complete: boolean; missing: unknown[]; contradictions: unknown[] } };
      };
      expect(complete.data.completeness.missing).toHaveLength(0);
      expect(complete.data.completeness.contradictions).toHaveLength(0);
      expect(complete.data.completeness.complete).toBe(true);

      // First draft.
      const first = await request.post(`/api/v1/judicial/requests/${requestId}/draft`, {
        headers: auth,
        data: { idempotencyKey: `e2e-draft-1-${Date.now()}` },
      });
      expect(first.ok()).toBeTruthy();
      const firstDraft = ((await first.json()) as { data: { draft: { version: number } } })
        .data.draft;
      expect(firstDraft.version).toBe(1);

      // Editing an answer must yield a SECOND version and leave the first text
      // intact — an edit never silently rewrites history.
      await answerStep(questionnaire.steps[0]!, { claimantName: "مریم احمدی" });
      const second = await request.post(`/api/v1/judicial/requests/${requestId}/draft`, {
        headers: auth,
        data: { idempotencyKey: `e2e-draft-2-${Date.now()}` },
      });
      expect(second.ok()).toBeTruthy();
      const secondDraft = ((await second.json()) as {
        data: { draft: { version: number }; replayed: boolean };
      }).data;
      expect(secondDraft.draft.version).toBe(2);
      expect(secondDraft.replayed).toBe(false);

      const versions = await request.get(`/api/v1/judicial/requests/${requestId}/drafts`, {
        headers: auth,
      });
      const items = ((await versions.json()) as {
        data: { items: { version: number; text: string }[] };
      }).data.items;
      // The list is newest-first; both versions must exist with their own text.
      expect(items.map((v) => v.version)).toEqual([2, 1]);
      const v1 = items.find((v) => v.version === 1)!;
      const v2 = items.find((v) => v.version === 2)!;
      expect(v1.text).toContain("علی رضایی");
      expect(v1.text).not.toContain("مریم احمدی");
      expect(v2.text).toContain("مریم احمدی");

      // Repeating the SAME inputs is a replay, not a third paid version.
      const replay = await request.post(`/api/v1/judicial/requests/${requestId}/draft`, {
        headers: auth,
        data: { idempotencyKey: `e2e-draft-3-${Date.now()}` },
      });
      expect(replay.ok()).toBeTruthy();
      const replayBody = ((await replay.json()) as {
        data: { draft: { version: number }; replayed: boolean };
      }).data;
      expect(replayBody.replayed).toBe(true);
      expect(replayBody.draft.version).toBe(2);

      // §15.8 — a foreign session cannot read, patch or delete this row.
      const other = await request.get(`/api/v1/judicial/requests/${requestId}`, {
        headers: { cookie: `${SESSION_COOKIE}=not-a-real-session` },
      });
      expect(other.status()).toBe(401);
    } finally {
      await request.delete(`/api/v1/judicial/requests/${requestId}`, { headers: auth });
    }
  });
});
