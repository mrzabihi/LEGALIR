// ============================================================
// LEGALIR — Usage report routes (ownership + permission enforcement)
// ============================================================
// The three consumption surfaces read ONE projection (`buildUsageReport`), so
// these tests also prove number parity:
//
//   GET /api/v1/usage/report                → the caller's OWN rows only
//   GET /api/v1/subscription/usage/cards    → the caller's active subscriptions
//   GET /api/v1/admin/users/:id/usage       → gated by `admin:energy:read`
//
// A user can never read another user's consumption, and hiding the admin tab
// is not the control — the dispatcher re-checks the permission server-side.
//
// `lib/db` resolves `.data` from `process.cwd()` at load, so every module is
// imported dynamically AFTER chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import type * as dbModule from "@/lib/db";
import type * as userReportRoute from "@/app/api/v1/usage/report/route";
import type * as cardsRoute from "@/app/api/v1/subscription/usage/cards/route";
import type * as adminRoute from "@/app/api/v1/admin/[[...segments]]/route";
import type { UsageTransaction } from "@legalir/types";

type Db = typeof dbModule;

let db: Db;
let GET_REPORT: typeof userReportRoute.GET;
let GET_CARDS: typeof cardsRoute.GET;
let ADMIN_GET: typeof adminRoute.GET;

let tmpDir: string;
let originalCwd: string;

// `createUser` mints its own id, so the real ids are captured in `beforeAll`.
let OWNER: string;
let OTHER: string;
let ANALYST: string;
let AUDITOR: string;

let ownerSession: string;
let analystSession: string;
let auditorSession: string;

const NOW = new Date().toISOString();
const SUB_ACTIVE = "sub-active";
const SUB_EXPIRED = "sub-expired";

/** A completed row with real tokens. */
function tx(over: Partial<UsageTransaction> & { id: string; userId: string }): UsageTransaction {
  return {
    subscriptionId: SUB_ACTIVE,
    activityType: "AI_MESSAGE",
    pointsCost: 100,
    requestCost: 1,
    tokenCost: 0,
    serviceQuotaType: "AI_MESSAGES",
    serviceQuotaCost: 1,
    creditSource: "SUBSCRIPTION",
    source: "chat",
    relatedEntityId: null,
    status: "COMPLETED",
    idempotencyKey: `k-${over.id}`,
    serviceKey: null,
    model: "gpt-4o",
    inputTokens: 0,
    outputTokens: 0,
    contextTokens: 0,
    toolCalls: 0,
    ragCalls: 0,
    additionalCost: 0,
    energyFinal: 100,
    energyRefunded: 0,
    tokenUsageStatus: "UNAVAILABLE",
    tokenUsageNoteFa: null,
    provider: null,
    trackingId: `UT-${over.id}`,
    messageIndex: 1,
    tariffVersion: null,
    tariffSnapshot: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as UsageTransaction;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-usage-report-"));
  process.chdir(tmpDir);

  db = await import("@/lib/db");
  GET_REPORT = (await import("@/app/api/v1/usage/report/route")).GET;
  GET_CARDS = (await import("@/app/api/v1/subscription/usage/cards/route")).GET;
  ADMIN_GET = (await import("@/app/api/v1/admin/[[...segments]]/route")).GET;

  let seq = 0;
  function createWithRole(role: "USER" | "ANALYST" | "AUDITOR"): {
    userId: string;
    sessionId: string;
  } {
    seq += 1;
    const user = db.createUser({
      mobile: `0912000${String(1000 + seq).padStart(4, "0")}`,
      passwordHash: "x",
      displayName: `usage-${seq}`,
    });
    // `createUser` always starts at USER; the role is set afterwards.
    db.setUserRole(user.id, role);
    return { userId: user.id, sessionId: db.createSession(user.id).id };
  }

  ({ userId: OWNER, sessionId: ownerSession } = createWithRole("USER"));
  ({ userId: OTHER } = createWithRole("USER"));
  ({ userId: ANALYST, sessionId: analystSession } = createWithRole("ANALYST"));
  ({ userId: AUDITOR, sessionId: auditorSession } = createWithRole("AUDITOR"));

  // --- Real rows: the owner has an AI message (tokens) + a token-free action.
  db.writeTable<UsageTransaction>("usage_transactions", [
    tx({
      id: "row-1",
      userId: OWNER,
      inputTokens: 1_200,
      outputTokens: 300,
      tokenCost: 1_500,
      tokenUsageStatus: "ACTUAL",
      provider: "openai-compatible",
      energyFinal: 150,
    }),
    tx({
      id: "row-2",
      userId: OWNER,
      activityType: "DOCUMENT_ANALYSIS",
      serviceQuotaType: "DOCUMENT_ANALYSIS",
      pointsCost: 1_000,
      energyFinal: 1_000,
    }),
    // Another user's row — must never leak into the owner's report, and it
    // belongs to a different subscription so the card totals stay clean.
    tx({
      id: "row-other",
      userId: OTHER,
      subscriptionId: "sub-other",
      pointsCost: 700,
      energyFinal: 700,
    }),
  ]);

  // --- Subscriptions: one active, one expired.
  db.writeTable("subscriptions", [
    {
      id: SUB_ACTIVE,
      user_id: OWNER,
      plan_code: "gold",
      plan_name_fa: "طلایی",
      amount: 0,
      currency: "IRT",
      status: "active",
      status_fa: "فعال",
      start_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      end_at: new Date(Date.now() + 27 * 86_400_000).toISOString(),
      purchased_at: NOW,
      auto_renew: 0,
      plan_snapshot: {},
    },
    {
      id: SUB_EXPIRED,
      user_id: OWNER,
      plan_code: "silver",
      plan_name_fa: "نقره‌ای",
      amount: 0,
      currency: "IRT",
      status: "active",
      status_fa: "فعال",
      start_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      end_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      purchased_at: NOW,
      auto_renew: 0,
      plan_snapshot: {},
    },
  ]);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function cookie(sessionId: string): string {
  return `legalir-session=${sessionId}`;
}

function adminRequest(userId: string, sessionId: string | null, qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/v1/admin/users/${userId}/usage${qs}`, {
    headers: sessionId ? { cookie: cookie(sessionId) } : {},
  });
}

function adminParams(userId: string): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: ["users", userId, "usage"] }) };
}

// ===========================================================================
// GET /api/v1/usage/report — ownership
// ===========================================================================

describe("GET /api/v1/usage/report", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await GET_REPORT(new Request("http://localhost/api/v1/usage/report"));
    expect(res.status).toBe(401);
  });

  it("returns only the caller's own rows, with energy and tokens separated", async () => {
    const res = await GET_REPORT(
      new Request("http://localhost/api/v1/usage/report?pageSize=50", {
        headers: { cookie: cookie(ownerSession) },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    const report = body.data.report;
    expect(report.totals.operations).toBe(2); // row-other is NOT included
    expect(
      report.items.every(
        (i: { trackingId: string }) => i.trackingId !== "UT-row-other"
      )
    ).toBe(true);
    expect(report.totals.energy).toBe(1_150);
    expect(report.totals.inputTokens).toBe(1_200);
    expect(report.totals.outputTokens).toBe(300);
    expect(report.totals.totalTokens).toBe(1_500);

    // The service filter menu is derived from the caller's real rows.
    const keys = (body.data.services as { serviceKey: string }[]).map(
      (s) => s.serviceKey
    );
    expect(keys.sort()).toEqual(["ai-legal-assistant", "document-analysis"]);
  });

  it("honours the status and service filters", async () => {
    const docs = await (
      await GET_REPORT(
        new Request("http://localhost/api/v1/usage/report?serviceKey=document-analysis", {
          headers: { cookie: cookie(ownerSession) },
        })
      )
    ).json();
    expect(docs.data.report.totals.operations).toBe(1);
    expect(docs.data.report.items[0].serviceNameFa).toBe("تحلیل سند");

    const failed = await (
      await GET_REPORT(
        new Request("http://localhost/api/v1/usage/report?status=FAILED", {
          headers: { cookie: cookie(ownerSession) },
        })
      )
    ).json();
    expect(failed.data.report.totals.operations).toBe(0);
  });

  it("ignores an invalid status instead of trusting the raw query string", async () => {
    const res = await (
      await GET_REPORT(
        new Request(
          "http://localhost/api/v1/usage/report?status=NOT_A_STATUS&activityType=NOPE",
          { headers: { cookie: cookie(ownerSession) } }
        )
      )
    ).json();
    expect(res.data.report.totals.operations).toBe(2);
  });
});

// ===========================================================================
// GET /api/v1/subscription/usage/cards — active only, same numbers
// ===========================================================================

describe("GET /api/v1/subscription/usage/cards", () => {
  it("returns one card per ACTIVE, unexpired subscription and matches the report", async () => {
    const res = await GET_CARDS(
      new Request("http://localhost/api/v1/subscription/usage/cards", {
        headers: { cookie: cookie(ownerSession) },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const items = body.data.items as {
      subscriptionId: string;
      energyUsed: number;
      totalTokens: number;
      energyQuota: number | null;
      energyRemaining: number | null;
    }[];

    // The expired row is excluded.
    expect(items.map((i) => i.subscriptionId)).toEqual([SUB_ACTIVE]);
    expect(items[0]!.energyUsed).toBe(1_150);
    expect(items[0]!.totalTokens).toBe(1_500);
    // No advertised quota exists, so none is invented.
    expect(items[0]!.energyQuota).toBeNull();
    expect(items[0]!.energyRemaining).toBeNull();
  });

  it("refuses an unauthenticated caller", async () => {
    const res = await GET_CARDS(
      new Request("http://localhost/api/v1/subscription/usage/cards")
    );
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/v1/admin/users/:id/usage — permission-gated
// ===========================================================================

describe("GET /api/v1/admin/users/:id/usage", () => {
  it("refuses an unauthenticated caller", async () => {
    const res = await ADMIN_GET(adminRequest(OWNER, null), adminParams(OWNER));
    expect(res.status).toBe(401);
  });

  it("refuses a plain user (hiding the tab is not the control)", async () => {
    const res = await ADMIN_GET(adminRequest(OWNER, ownerSession), adminParams(OWNER));
    expect(res.status).toBe(403);
  });

  it("refuses a role without admin:energy:read", async () => {
    // AUDITOR holds audit/finance/report permissions but NOT admin:energy:read.
    const res = await ADMIN_GET(adminRequest(OWNER, auditorSession), adminParams(OWNER));
    expect(res.status).toBe(403);
  });

  it("lets an ANALYST read the SAME numbers as the user's own page", async () => {
    const res = await ADMIN_GET(adminRequest(OWNER, analystSession), adminParams(OWNER));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.report.totals.energy).toBe(1_150);
    expect(body.data.report.totals.totalTokens).toBe(1_500);
    expect(body.data.report.totals.operations).toBe(2);
    expect(body.data.services).toHaveLength(2);
  });

  it("scopes the admin report to the requested user, never the caller", async () => {
    const res = await ADMIN_GET(adminRequest(OTHER, analystSession), adminParams(OTHER));
    const body = await res.json();
    expect(body.data.report.totals.operations).toBe(1);
    expect(body.data.report.items[0].trackingId).toBe("UT-row-other");
  });
});
