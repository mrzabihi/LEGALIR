/**
 * ============================================================
 * LEGALIR — Contextual tools / composer / tabs verification
 * ============================================================
 * A QA harness (not a product spec) that checks the §4, §7, §9 and §14
 * guarantees in a real browser against the live dev server:
 *
 *   • the send icon points UP and is labelled «ارسال پیام»
 *   • the three contextual tools render, and «آراء قضایی» is honestly
 *     unavailable when no precedent bank exists (never pretend-active)
 *   • selecting a tool persists across a refresh (server-persisted, not
 *     local state)
 *   • the four tabs keep their correct §9 meaning («مستندات» = own files)
 *   • no horizontal overflow at 360 / 390 / 768 / 1280 / 1440
 *
 * Creates one throwaway conversation and deletes it at the end.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OTP_CODE = "405405";
const SESSION_COOKIE = "legalir-session";
const DEMO_MOBILE = "09120000003";
const ADMIN_MOBILE = "09120000000"; // dev seed SUPER_ADMIN
const SESSION_CACHE = join(tmpdir(), "legalir-e2e-chat-session.json");
const SHOTS = "e2e/__shots__/chat-tools";

test.describe.configure({ timeout: 120_000 });

interface SessionInfo {
  sessionId: string;
  userId: string;
  mobileDisplay: string;
}

async function getOrCreateSession(request: APIRequestContext): Promise<SessionInfo> {
  if (existsSync(SESSION_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as SessionInfo;
      const check = await request.get("/api/v1/conversations", {
        headers: { cookie: `${SESSION_COOKIE}=${cached.sessionId}` },
      });
      if (check.ok()) return cached;
    } catch {
      /* fall through */
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
  const session = {
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

const ADMIN_SESSION_KEY = "legalir-e2e-admin-session";

/**
 * A reusable dev-seed SUPER_ADMIN session. The OTP endpoint is rate-limited,
 * so issuing a fresh challenge in every admin test flips the later ones to
 * skipped; the session id is cached like the demo user's.
 */
async function getOrCreateAdminSession(request: APIRequestContext): Promise<string | null> {
  if (existsSync(SESSION_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as Record<string, unknown>;
      const id = cached[ADMIN_SESSION_KEY];
      if (typeof id === "string") {
        const check = await request.get("/api/v1/admin/ai/tools", {
          headers: { cookie: `${SESSION_COOKIE}=${id}` },
        });
        if (check.ok()) return id;
      }
    } catch {
      /* fall through to a fresh challenge */
    }
  }

  const reqRes = await request.post("/api/auth/otp/request", { data: { mobile: ADMIN_MOBILE } });
  const challengeId = ((await reqRes.json()) as { data?: { challengeId?: string } }).data
    ?.challengeId;
  if (!challengeId) return null;
  const verifyRes = await request.post("/api/auth/otp/verify", {
    data: { challengeId, code: OTP_CODE },
  });
  const sessionId = ((await verifyRes.json()) as { data?: { sessionId?: string } }).data?.sessionId;
  if (!sessionId) return null;

  try {
    const prev = existsSync(SESSION_CACHE)
      ? (JSON.parse(readFileSync(SESSION_CACHE, "utf8")) as Record<string, unknown>)
      : {};
    writeFileSync(SESSION_CACHE, JSON.stringify({ ...prev, [ADMIN_SESSION_KEY]: sessionId }));
  } catch {
    /* cache is best-effort */
  }
  return sessionId;
}

async function mockAdminAuth(page: Page, sessionId: string) {
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: sessionId, url: "http://localhost:3000" },
  ]);
  await page.addInitScript(
    (sid) =>
      localStorage.setItem(
        "legalir-auth",
        JSON.stringify({
          state: {
            session: {
              sessionId: sid,
              userId: "admin-user-id",
              mobileE164: "+989120000000",
              mobileDisplay: ADMIN_MOBILE,
              isNewUser: false,
              createdAt: Date.now(),
            },
          },
          version: 0,
        })
      ),
    sessionId
  );
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
}

test.describe("Admin tool settings", () => {
  test("the panel separates «فعال» from «در دسترس» and shows the real reason", async ({
    page,
    request,
  }) => {
    // An admin session (the demo-user cache is a different account).
    const adminSessionId = await getOrCreateAdminSession(request);
    if (!adminSessionId) {
      test.skip(true, "Admin session unavailable");
      return;
    }
    await mockAdminAuth(page, adminSessionId);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/ai");

    // The tool section is present with both layers named.
    await expect(page.getByText("ابزارهای زمینه‌ای چت").first()).toBeVisible({ timeout: 30_000 });
    const toolSection = page
      .locator("section")
      .filter({ hasText: "ابزارهای زمینه‌ای چت" })
      .first();
    const scope = (await toolSection.count()) > 0 ? toolSection : page;
    await expect(
      scope.getByRole("columnheader", { name: "فعال", exact: true })
    ).toBeVisible();
    await expect(scope.getByRole("columnheader", { name: "در دسترس" })).toBeVisible();

    // The capability verdict the panel shows equals the server's own verdict.
    const server = await page.request.get("/api/v1/admin/ai/tools");
    if (server.ok()) {
      const { data } = (await server.json()) as {
        data: { items: { labelFa: string; available: boolean; unavailableReasonFa: string | null }[] };
      };
      for (const item of data.items) {
        const row = page.getByRole("row", { name: new RegExp(item.labelFa) }).first();
        await expect(row).toBeVisible();
        if (!item.available && item.unavailableReasonFa) {
          await expect(row.getByText(item.unavailableReasonFa)).toBeVisible();
        }
      }
    }

    await page.screenshot({ path: `${SHOTS}-admin.png`, fullPage: false });
  });

  test("a toggle really reaches the server, the audit trail and the chat composer", async ({
    page,
    request,
  }) => {
    const adminSessionId = await getOrCreateAdminSession(request);
    if (!adminSessionId) {
      test.skip(true, "Admin session unavailable");
      return;
    }
    await mockAdminAuth(page, adminSessionId);

    const TOOL = "legal_research";
    const toolsUrl = "/api/v1/admin/ai/tools";
    const enabledNow = async () => {
      const res = await page.request.get(toolsUrl);
      const { data } = (await res.json()) as {
        data: { items: { toolId: string; enabled: boolean; available: boolean }[] };
      };
      return data.items.find((t) => t.toolId === TOOL)!.enabled;
    };

    // Start from a known state.
    if (!(await enabledNow())) {
      await page.request.post(`${toolsUrl}/${TOOL}`, { data: { enabled: true } });
    }

    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/admin/ai");

      const row = page.getByRole("row", { name: /پژوهش حقوقی/ }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      const toggle = row.getByRole("switch");

      // Each row's switch is named after its tool — three «فعال» labels would
      // be indistinguishable to a screen reader.
      await expect(toggle).toHaveAttribute("aria-label", "ابزار پژوهش حقوقی");
      await expect(toggle).toHaveAttribute("aria-checked", "true");

      const write = page.waitForResponse(
        (r) => r.url().includes(`${toolsUrl}/${TOOL}`) && r.request().method() === "POST"
      );
      // The `<input>` is `sr-only`; a user clicks its label, so the test does
      // the same rather than forcing a click on an invisible box.
      await row.locator('label:has(input[role="switch"])').click();
      const res = await write;
      expect(res.status(), await res.text()).toBe(200);

      // The server really persisted it — not just a local flip.
      await expect.poll(enabledNow, { timeout: 10_000 }).toBe(false);

      // And the change is in the append-only audit trail.
      const audit = await page.request.get(
        `/api/v1/admin/audit?action=ai.tool.update&resourceType=chat_tool&search=${TOOL}`
      );
      if (audit.ok()) {
        const { data } = (await audit.json()) as {
          data: { items: { action: string; resourceId: string; after: Record<string, unknown> }[] };
        };
        const entry = data.items.find((i) => i.resourceId === TOOL);
        expect(entry, "the toggle must be audited").toBeTruthy();
        expect(entry!.after["enabled"]).toBe(false);
      }
    } finally {
      await page.request.post(`${toolsUrl}/${TOOL}`, { data: { enabled: true } }).catch(() => undefined);
    }

    // The disabled tool is honestly withdrawn from the composer, with a
    // stated reason — proven on a real conversation page.
    await page.request.post(`${toolsUrl}/${TOOL}`, { data: { enabled: false } }).catch(() => undefined);
    try {
      const demo = await getOrCreateSession(request);
      await page.context().addCookies([
        { name: SESSION_COOKIE, value: demo.sessionId, url: "http://localhost:3000" },
      ]);
      await page.addInitScript(
        (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
        {
          state: {
            session: {
              sessionId: demo.sessionId,
              userId: demo.userId,
              mobileE164: `+98${demo.mobileDisplay.replace(/^0/, "")}`,
              mobileDisplay: demo.mobileDisplay,
              isNewUser: false,
              createdAt: Date.now(),
            },
          },
          version: 0,
        }
      );

      const createRes = await page.request.post("/api/v1/conversations", {
        data: { title: "E2E — ابزار غیرفعال", category: "real_estate" },
      });
      const convId = ((await createRes.json()) as { data: { id: string } }).data.id;
      try {
        await page.goto(`/chat/${convId}?service=legal_consultation`);
        const chip = page
          .getByRole("group", { name: "ابزارهای زمینه‌ای" })
          .getByRole("button", { name: /پژوهش حقوقی/ });
        await expect(chip).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
        const describedBy = await chip.getAttribute("aria-describedby");
        const described = (await page.locator(`#${describedBy}`).textContent()) ?? "";
        expect(described.length).toBeGreaterThan(0);
        expect(described).not.toBe("پژوهش حقوقی — ");
      } finally {
        await page.request.delete(`/api/v1/conversations/${convId}`).catch(() => undefined);
      }
    } finally {
      await page.request.post(`${toolsUrl}/${TOOL}`, { data: { enabled: true } }).catch(() => undefined);
    }
  });
});

test.describe("Contextual tools & composer", () => {
  test("tools, up-arrow, tabs and widths", async ({ page, request }) => {
    const session = await getOrCreateSession(request);
    await mockAuth(page, session);

    const createRes = await page.request.post("/api/v1/conversations", {
      data: { title: "E2E — ابزارها", category: "real_estate" },
    });
    const convId = ((await createRes.json()) as { data: { id: string } }).data.id;

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/chat/${convId}?service=legal_consultation`);

      // ---- §4: the send control is an UP arrow, labelled in Persian ------
      const send = page.getByRole("button", { name: "ارسال پیام" });
      await expect(send).toBeVisible({ timeout: 20_000 });

      // Geometric proof the arrow points up: the icon's apex is a centered
      // point and the glyph widens below it. A down arrow (or a mirrored /
      // rotated one) cannot satisfy both.
      const arrow = await send.evaluate((el) => {
        const path = el.querySelector("svg path")!;
        const box = (path as SVGPathElement).getBBox();
        const total = (path as SVGPathElement).getTotalLength();
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 200; i++) {
          const p = (path as SVGPathElement).getPointAtLength((total * i) / 200);
          pts.push({ x: p.x, y: p.y });
        }
        const height = box.height || 1;
        // A 6% top band: at a true up-arrow apex only the tip lives there.
        const topCut = box.y + height * 0.06;
        const midLow = box.y + height * 0.55;
        const midHigh = box.y + height * 0.75;
        const spread = (from: number, to: number) => {
          const xs = pts.filter((p) => p.y >= from && p.y <= to).map((p) => p.x);
          return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
        };
        const boxCenter = box.x + box.width / 2;
        const topPoints = pts.filter((p) => p.y <= topCut);
        const topCentered =
          topPoints.length > 0 &&
          topPoints.every((p) => Math.abs(p.x - boxCenter) < box.width * 0.1);
        const svg = el.querySelector("svg")!;
        return {
          topSpread: spread(box.y, topCut),
          wideSpread: Math.max(spread(midLow, midHigh), spread(box.y + height * 0.6, box.y + height * 0.8)),
          // A down arrow would have its WIDE end at the top instead.
          widestNearTop: spread(box.y, box.y + height * 0.3) >= spread(box.y + height * 0.7, box.y + height),
          topCentered,
          mirrored: getComputedStyle(svg).transform !== "none",
        };
      });
      expect(arrow.topCentered, "arrow apex must be a centered point").toBe(true);
      expect(arrow.wideSpread, "arrow must widen below the apex").toBeGreaterThan(
        arrow.topSpread
      );
      // A down arrow would have a WIDE flat top and its apex at the bottom,
      // so it cannot satisfy "narrow centered top + widening below".
      expect(arrow.topSpread, "the top of the glyph must be narrow").toBeLessThan(
        arrow.wideSpread
      );
      expect(arrow.mirrored, "send icon must not be mirrored/rotated").toBe(false);

      // ---- §7: the three tools are present, server-projected ------------
      const group = page.getByRole("group", { name: "ابزارهای زمینه‌ای" });
      await expect(group).toBeVisible({ timeout: 20_000 });
      for (const label of ["تحلیل عمیق", "پژوهش حقوقی", "آراء قضایی"]) {
        await expect(group.getByRole("button", { name: new RegExp(label) })).toBeVisible();
      }

      // The precedent tool must MIRROR the server's real verdict: enabled and
      // usable when the library genuinely holds a published precedent, and
      // aria-disabled with a stated reason when it does not. Never a silent
      // dead chip and never a pretend-active one.
      const serverVerdict = await page.request.get(
        `/api/v1/chat/tools?service=legal_consultation&conversationId=${convId}`
      );
      const serverTools = (
        (await serverVerdict.json()) as {
          data: { tools: { id: string; available: boolean; unavailableReasonFa: string | null }[] };
        }
      ).data.tools;
      const serverJudicial = serverTools.find((t) => t.id === "judicial_opinions")!;
      const judicial = group.getByRole("button", { name: /آراء قضایی/ });
      const descriptorId = await judicial.getAttribute("aria-describedby");
      expect(descriptorId).toBeTruthy();
      const described = (await page.locator(`#${descriptorId}`).textContent()) ?? "";
      if (serverJudicial.available) {
        await expect(judicial).toHaveAttribute("aria-disabled", "false");
        expect(described).not.toContain("در دسترس نیست");
      } else {
        await expect(judicial).toHaveAttribute("aria-disabled", "true");
        expect(serverJudicial.unavailableReasonFa).toBeTruthy();
        expect(described).toContain(serverJudicial.unavailableReasonFa!);
      }

      // ---- §7: selecting is real and survives a refresh ------------------
      const deep = group.getByRole("button", { name: /تحلیل عمیق/ });
      await expect(deep).toHaveAttribute("aria-pressed", "false");

      // The chip must persist through the REAL API — the test asserts the
      // request the UI issued was accepted, not just that the chip flipped.
      const patchResponse = page.waitForResponse(
        (r) =>
          r.url().includes(`/api/v1/conversations/${convId}`) &&
          r.request().method() === "PATCH"
      );
      await deep.click();
      await expect(deep).toHaveAttribute("aria-pressed", "true");
      const patch = await patchResponse;
      expect(patch.status(), await patch.text()).toBe(200);

      const afterPatch = await page.request.get(
        `/api/v1/chat/tools?service=legal_consultation&conversationId=${convId}`
      );
      const afterPatchBody = (await afterPatch.json()) as { data: { selected: string[] } };
      expect(afterPatchBody.data.selected, "the server must persist the selection").toContain(
        "deep_analysis"
      );

      await page.reload();
      const deepAfter = page
        .getByRole("group", { name: "ابزارهای زمینه‌ای" })
        .getByRole("button", { name: /تحلیل عمیق/ });
      await expect(deepAfter).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

      // ---- §9: the four tabs keep their correct meaning ------------------
      for (const label of ["گفتگو", "منابع", "مستندات", "ارجاعات"]) {
        await expect(page.getByRole("tab", { name: new RegExp(label) })).toBeVisible();
      }
      await page.getByRole("tab", { name: /مستندات/ }).click();
      await expect(
        page.getByText("در این گفتگو سندی پیوست نشده است")
      ).toBeVisible({ timeout: 10_000 });

      await page.getByRole("tab", { name: /گفتگو/ }).click();

      // ---- §14: no horizontal overflow at the required widths -----------
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(
          page.getByRole("group", { name: "ابزارهای زمینه‌ای" })
        ).toBeVisible({ timeout: 15_000 });
        await expectNoHorizontalScroll(page, `${width}px`);
      }

      // ---- Visual evidence ---------------------------------------------
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${SHOTS}-390.png`, fullPage: false });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: `${SHOTS}-1440.png`, fullPage: false });
    } finally {
      await page.request.delete(`/api/v1/conversations/${convId}`).catch(() => undefined);
    }
  });
});
