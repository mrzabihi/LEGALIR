/**
 * ============================================================
 * LEGALIR — Chat stream flow E2E (redesign §10)
 * ============================================================
 * Exercises the REAL end-to-end chat path in a browser:
 *   • direct-URL entry with ?service=legal_consultation
 *   • an optimistic user bubble that appears the instant the message is sent
 *   • the in-conversation processing timeline driven by real SSE stage events
 *   • an assistant reply that streams in from real chunks (never hidden)
 *   • refresh recovery — the turn is persisted and restored
 *   • responsive widths (mobile → desktop) with no horizontal scroll
 *
 * Uses the seeded demo user (09120000003). It creates a fresh conversation
 * and deletes it at the end, so it never mutates existing data.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
// The SEEDED demo user — it is the one that carries an AI message allowance.
// A brand-new mobile gets a fresh user with no quota, so it cannot send.
const DEMO_MOBILE = "09120000003";
const APP_READY_TIMEOUT = 15_000;
const STREAM_TIMEOUT = 45_000;

// The OTP request endpoint enforces a 60s per-mobile resend cooldown, which
// would make a re-run within a minute flaky. So the demo session is created
// ONCE and cached to a temp file, then reused across runs (validated before
// use, and re-created only if it has expired).
const SESSION_CACHE = join(tmpdir(), "legalir-e2e-chat-session.json");

// The full send → stream → refresh journey needs more than the 30s default.
test.describe.configure({ timeout: 90_000 });

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

async function createSessionFor(
  request: APIRequestContext,
  mobile: string
): Promise<SessionInfo> {
  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile } });
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
  return {
    sessionId: body.data.sessionId,
    userId: body.data.userId ?? "demo-user-id",
    mobileDisplay: body.data.mobileDisplay ?? mobile,
  };
}

/** Create a session for the seeded demo user, reusing a cached one if valid. */
async function getOrCreateSession(request: APIRequestContext): Promise<SessionInfo> {
  if (existsSync(SESSION_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as SessionInfo;
      const check = await request.get("/api/v1/conversations", {
        headers: { cookie: `${SESSION_COOKIE}=${cached.sessionId}` },
      });
      if (check.ok()) return cached;
    } catch {
      /* fall through to re-create */
    }
    rmSync(SESSION_CACHE, { force: true });
  }
  const session = await createSessionFor(request, DEMO_MOBILE);
  try {
    writeFileSync(SESSION_CACHE, JSON.stringify(session));
  } catch {
    /* a non-writable temp dir is fine — we just lose the cache */
  }
  return session;
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
    sessionState
  );
}

/** No element may push the document wider than its viewport (§2). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Chat stream flow", () => {
  test("send → real stream → refresh recovery, at multiple widths", async ({
    page,
    request,
  }) => {
    const session = await getOrCreateSession(request);
    await mockAuth(page, session);

    // A fresh conversation, so the test never touches existing data.
    const createRes = await page.request.post("/api/v1/conversations", {
      data: { title: "E2E — جریان گفتگو", category: "real_estate" },
    });
    const convId = ((await createRes.json()) as { data: { id: string } }).data.id;

    try {
      // ---- Direct-URL entry with the service param (§10) -----------------
      await page.goto(`/chat/${convId}?service=legal_consultation`);
      const textarea = page.getByPlaceholder(
        "مسئله حقوقی خود را با جزئیات لازم توضیح دهید..."
      );
      await expect(textarea).toBeVisible({ timeout: APP_READY_TIMEOUT });

      // ---- Send, and assert the user bubble appears immediately (§3) -----
      const question = "آیا صاحبخانه می‌تواند بدون اجازه وارد ملک استیجاری شود؟";
      await textarea.fill(question);
      await textarea.press("Enter");

      // The user's own words are on screen right away — never gated on the
      // server response. `.first()` because the question also appears inside
      // the assistant's grounded answer once it streams in.
      await expect(page.getByText(question).first()).toBeVisible({ timeout: 5000 });

      // ---- The real processing timeline appears under that message (§5) --
      await expect(page.getByText(/لیگالیر\s*—/)).toBeVisible({ timeout: 10_000 });

      // ---- The assistant reply streams in from real chunks (§4) ----------
      // The run finishes and the line collapses to its completed summary.
      await expect(page.getByText(/بررسی درخواست تکمیل شد/)).toBeVisible({
        timeout: STREAM_TIMEOUT,
      });
      // A real grounded answer section reached the screen.
      await expect(page.getByText("خلاصه").first()).toBeVisible({ timeout: STREAM_TIMEOUT });

      // ---- Refresh recovery (§10) ---------------------------------------
      await page.reload();
      await expect(page.getByText(question).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });
      await expect(page.getByText("خلاصه").first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

      // ---- Real connection status bound to a real health check (§6) -----
      // At desktop width the label is visible; the live dev gateway answers
      // the health probe, so the indicator reports a real, connected state.
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.getByText("اینترنت متصل").first()).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      // ---- Responsive widths — no horizontal scroll (§2) ----------------
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(textarea).toBeVisible({ timeout: APP_READY_TIMEOUT });
        await expectNoHorizontalScroll(page);
      }
    } finally {
      // Clean up the conversation the test created.
      await page.request.delete(`/api/v1/conversations/${convId}`).catch(() => undefined);
    }
  });

  // ---- Real network disconnect vs. a reachable service (§6, §10) --------
  // The indicator must reflect a REAL browser network loss, not a guess —
  // so we toggle the context offline and back, the same way a device would.
  test("connection indicator reflects a real device-offline, then recovery", async ({
    page,
    request,
  }) => {
    const session = await getOrCreateSession(request);
    await mockAuth(page, session);

    const createRes = await page.request.post("/api/v1/conversations", {
      data: { title: "E2E — وضعیت اتصال", category: "real_estate" },
    });
    const convId = ((await createRes.json()) as { data: { id: string } }).data.id;

    try {
      // Desktop width shows the text label (it is dot-only on mobile).
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/chat/${convId}?service=legal_consultation`);
      await expect(
        page.getByPlaceholder("مسئله حقوقی خود را با جزئیات لازم توضیح دهید...")
      ).toBeVisible({ timeout: APP_READY_TIMEOUT });

      // Device is online and the real health endpoint answers → connected.
      await expect(page.getByText("اینترنت متصل").first()).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      // A real device-side loss fires the browser `offline` event.
      await page.context().setOffline(true);
      await expect(page.getByText("اینترنت قطع است").first()).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });

      // The network returns: the indicator re-probes for real and recovers.
      await page.context().setOffline(false);
      await expect(page.getByText("اینترنت متصل").first()).toBeVisible({
        timeout: APP_READY_TIMEOUT,
      });
    } finally {
      // Never leave the shared context offline for later specs.
      await page.context().setOffline(false);
      await page.request.delete(`/api/v1/conversations/${convId}`).catch(() => undefined);
    }
  });
});
