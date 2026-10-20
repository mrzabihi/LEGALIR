// ============================================================
// LEGALIR — Lawyer portal · access, workflow and masking (temp DB)
// ============================================================
// The brief's §11 security clause: «دسترسی بر اساس نقش … در UI و API اعمال
// شود؛ وکیل فقط ارجاعات خودش را ببیند؛ شناسهٔ خام درخواست هرگز مجوز نباشد».
//
// This drives the REAL route handlers against an isolated temp DB and pins:
//
//   1. NO PROFILE   — a plain USER calling /api/v1/lawyer/* gets 403 (role
//                     boundary), never data.
//   2. OWNER-ONLY   — lawyer A sees their referral; lawyer B gets 404 on the
//                     same id — never 403, so existence is not disclosed.
//   3. NO VERBS     — every mutation on another lawyer's request is 404.
//   4. WORKFLOW     — accept → case; decline without a reason is 400; an
//                     internal note never reaches the client thread; a public
//                     note does; completion delivers the result.
//   5. BANK MASK    — the owner reads the full IBAN; the admin dossier only
//                     ever sees the masked form.
//   6. ADMIN SCOPE  — the requests queue and the per-user request history are
//                     gated by their own admin permissions.
//
// `db.ts` binds its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import type { LawyerProfile, LegalRequest } from "@legalir/types";
import type * as DbModule from "../db";
import type * as LegalRequestDbModule from "../legal-request-db";
import type * as LawyerDbModule from "../lawyer-db";
import type * as StoreModule from "../lawyer-portal/store";
import type * as ThreadsModule from "../consultation-message-db";
import type * as ProjectionsModule from "../lawyer-portal/projections";

type Db = typeof DbModule;
type LegalRequestDb = typeof LegalRequestDbModule;
type LawyerDb = typeof LawyerDbModule;
type Store = typeof StoreModule;
type Threads = typeof ThreadsModule;

let db: Db;
let legalRequestDb: LegalRequestDb;
let lawyerDb: LawyerDb;
let store: Store;
let threads: Threads;
let projections: typeof ProjectionsModule;

let lawyerA: { id: string; userId: string; session: string };
let lawyerB: { id: string; userId: string; session: string };
let adminSession: string;
let clientUserId: string;
let clientSession: string;
let requestId: string;

let tmpDir: string;
let originalCwd: string;

let referralsList: (req: NextRequest) => Promise<Response>;
let referralDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let referralAction: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let bankRoute: {
  GET: (req: NextRequest) => Promise<Response>;
  PUT: (req: NextRequest) => Promise<Response>;
};
let adminGet: (
  req: NextRequest,
  ctx: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;
let adminPatch: (
  req: NextRequest,
  ctx: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;
let adminLawyerGet: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

function req(
  session: string | null,
  url: string,
  init?: { method?: string; body?: unknown }
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers["cookie"] = `legalir-session=${session}`;
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function adminCtx(...segments: string[]) {
  return { params: Promise.resolve({ segments }) };
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeProfile(id: string, userId: string, name: string): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id,
    userId,
    fullName: name,
    licenseNumber: "۱۲۳۴۵",
    licenseYear: 1397,
    bio: "وکیل نمونه برای آزمون دسترسی.",
    avatarUrl: null,
    avatarType: "demo",
    professionalTitle: "وکیل پایه یک",
    activityType: "INDEPENDENT",
    licenseAuthority: "کانون وکلای مرکز",
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    verificationNote: null,
    specializations: [{ category: "family", yearsExperience: 5, note: null }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 300_000,
      consultationDurationMinutes: 30,
      hourlyRateToman: null,
      contractReviewFeeToman: null,
      freeFirstConsultation: false,
    },
    availability: [{ weekday: 0, startTime: "09:00", endTime: "13:00" }],
    performance: {
      acceptedRequests: 0,
      completedCases: 0,
      medianResponseMinutes: null,
      averageRating: null,
      reviewCount: 0,
    },
    availabilityStatus: "ACTIVE",
    consultationCapacity: 5,
    isDemo: false,
    acceptingRequests: true,
    createdAt: now,
    updatedAt: now,
  } as LawyerProfile;
}

function createReferral(targetLawyerId: string): string {
  const now = new Date().toISOString();
  const request: LegalRequest = {
    id: `lreq-access-${crypto.randomUUID()}`,
    userId: clientUserId,
    caseId: null,
    conversationId: null,
    title: "مشاورهٔ ارث",
    category: "family",
    state: "WAITING_FOR_ACCEPTANCE",
    intakeAnswers: {},
    analysisId: null,
    selectedLawyerId: targetLawyerId,
    orgId: null,
    serviceKey: "family-consultation",
    createdAt: now,
    updatedAt: now,
  };
  legalRequestDb.createRequest(request);
  store.startReferralClock({ requestId: request.id, assignedAt: now });
  return request.id;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-portal-"));
  process.chdir(tmpDir);

  db = await import("../db");
  legalRequestDb = await import("../legal-request-db");
  lawyerDb = await import("../lawyer-db");
  store = await import("../lawyer-portal/store");
  threads = await import("../consultation-message-db");
  projections = await import("../lawyer-portal/projections");

  referralsList = (await import("@/app/api/v1/lawyer/referrals/route"))
    .GET as typeof referralsList;
  referralDetail = (await import("@/app/api/v1/lawyer/referrals/[id]/route"))
    .GET as typeof referralDetail;
  referralAction = (await import("@/app/api/v1/lawyer/referrals/[id]/actions/route"))
    .POST as typeof referralAction;
  const bankModule = await import("@/app/api/v1/lawyer/bank/route");
  bankRoute = {
    GET: bankModule.GET as typeof bankRoute.GET,
    PUT: bankModule.PUT as typeof bankRoute.PUT,
  };
  const adminRoute = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = adminRoute.GET as typeof adminGet;
  adminPatch = adminRoute.PATCH as typeof adminPatch;
  // `/admin/lawyers/:id` is a REAL route file, so Next serves it ahead of the
  // catch-all dispatcher — import it directly for the dossier assertion.
  adminLawyerGet = (
    await import("@/app/api/v1/admin/lawyers/[id]/route")
  ).GET as typeof adminLawyerGet;

  const client = db.createUser({ mobile: "09121110001", passwordHash: "x" });
  clientUserId = client.id;
  clientSession = db.createSession(clientUserId).id;
  db.createUser({ mobile: "09121110002", passwordHash: "x" });

  const userA = db.createUser({ mobile: "09121110003", passwordHash: "x" });
  db.setUserRole(userA.id, "LAWYER");
  lawyerA = { id: "law-access-A", userId: userA.id, session: db.createSession(userA.id).id };
  lawyerDb.upsertLawyerProfile(makeProfile(lawyerA.id, userA.id, "وکیل الف"));

  const userB = db.createUser({ mobile: "09121110004", passwordHash: "x" });
  db.setUserRole(userB.id, "LAWYER");
  lawyerB = { id: "law-access-B", userId: userB.id, session: db.createSession(userB.id).id };
  lawyerDb.upsertLawyerProfile(makeProfile(lawyerB.id, userB.id, "وکیل ب"));

  const adminUser = db.createUser({ mobile: "09121110005", passwordHash: "x" });
  db.setUserRole(adminUser.id, "SUPER_ADMIN");
  adminSession = db.createSession(adminUser.id).id;

  requestId = createReferral(lawyerA.id);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Role boundary
// ---------------------------------------------------------------------------

describe("role boundary — no lawyer profile", () => {
  it("refuses a plain user on the referral list with 403", async () => {
    const res = await referralsList(req(clientSession, "http://localhost/api/v1/lawyer/referrals"));
    expect(res.status).toBe(403);
  });

  it("refuses a plain user on the bank route (GET and PUT)", async () => {
    const get = await bankRoute.GET(req(clientSession, "http://localhost/api/v1/lawyer/bank"));
    expect(get.status).toBe(403);
    const put = await bankRoute.PUT(
      req(clientSession, "http://localhost/api/v1/lawyer/bank", {
        method: "PUT",
        body: { holderName: "x", bankName: "y", iban: "IR000000000000000000000000" },
      })
    );
    expect(put.status).toBe(403);
  });

  it("refuses an anonymous caller", async () => {
    const res = await referralsList(req(null, "http://localhost/api/v1/lawyer/referrals"));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. Ownership scoping
// ---------------------------------------------------------------------------

describe("ownership — a bare request id is not authorization", () => {
  it("lets the assigned lawyer list and read the referral", async () => {
    const list = await referralsList(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/referrals")
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { items: { requestId: string }[] } };
    expect(body.data.items.map((i) => i.requestId)).toContain(requestId);

    const detail = await referralDetail(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}`),
      idCtx(requestId)
    );
    expect(detail.status).toBe(200);
  });

  it("excludes the referral from another lawyer's list", async () => {
    const list = await referralsList(
      req(lawyerB.session, "http://localhost/api/v1/lawyer/referrals")
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { items: { requestId: string }[] } };
    expect(body.data.items.map((i) => i.requestId)).not.toContain(requestId);
  });

  it("returns 404 (never 403) when another lawyer opens the referral", async () => {
    const res = await referralDetail(
      req(lawyerB.session, `http://localhost/api/v1/lawyer/referrals/${requestId}`),
      idCtx(requestId)
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2b. Derived priority (§3) — never stored, always agrees with the clock
// ---------------------------------------------------------------------------

describe("derived priority", () => {
  const snap = (health: string) => ({ health }) as never;

  it("ranks a breached deadline above everything still open", () => {
    expect(projections.priorityOf(snap("BREACHED"), "NEEDS_ACTION")).toBe("URGENT");
    expect(projections.priorityOf(snap("BREACHED"), "WAITING_ON_CLIENT")).toBe("URGENT");
    expect(projections.priorityOf(snap("AT_RISK"), "NEEDS_ACTION")).toBe("HIGH");
    expect(projections.priorityOf(snap("ON_TRACK"), "ACTIVE")).toBe("NORMAL");
    expect(projections.priorityOf(snap("ON_TRACK"), "WAITING_ON_CLIENT")).toBe("LOW");
    expect(projections.priorityOf(snap("ON_TRACK"), "DONE")).toBe("LOW");
  });

  it("puts a priority on every row and offers one facet per priority", async () => {
    const res = await referralsList(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/referrals")
    );
    const body = (await res.json()) as {
      data: {
        items: { requestId: string; priority: string }[];
        facets: { priorities: { value: string; count: number }[] };
      };
    };
    const row = body.data.items.find((i) => i.requestId === requestId);
    expect(row?.priority).toBe("NORMAL");
    expect(body.data.facets.priorities.map((f) => f.value)).toEqual([
      "URGENT",
      "HIGH",
      "NORMAL",
      "LOW",
    ]);
    const total = body.data.facets.priorities.reduce((sum, f) => sum + f.count, 0);
    expect(total).toBe(body.data.items.length);
  });

  it("filters by priority without touching another lawyer's queue", async () => {
    const normal = await referralsList(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/referrals?priority=NORMAL")
    );
    const normalBody = (await normal.json()) as {
      data: { items: { requestId: string }[]; total: number };
    };
    expect(normalBody.data.items.map((i) => i.requestId)).toContain(requestId);

    const urgent = await referralsList(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/referrals?priority=URGENT")
    );
    const urgentBody = (await urgent.json()) as { data: { items: { requestId: string }[] } };
    expect(urgentBody.data.items.map((i) => i.requestId)).not.toContain(requestId);
  });

  it("ignores an unknown priority instead of returning an empty page", async () => {
    const res = await referralsList(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/referrals?priority=BOGUS")
    );
    const body = (await res.json()) as { data: { items: { requestId: string }[] } };
    expect(body.data.items.map((i) => i.requestId)).toContain(requestId);
  });
});

// ---------------------------------------------------------------------------
// 2c. Filter wire contract — the client's names must match the route's
// ---------------------------------------------------------------------------
// A filter whose query key differs from what the handler reads is silently
// dropped: the UI shows an active filter and the server returns everything.
// This pins the serialized names against the handler's own param names.

describe("filter wire contract", () => {
  it("serializes every filter under the name the route reads", async () => {
    const { fetchLawyerReferrals } = await import("@/lib/api/lawyer-portal");
    const seen: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      await fetchLawyerReferrals({
        serviceKey: "family-consultation",
        state: "ACCEPTED",
        perspective: "ACTIVE",
        slaHealth: "AT_RISK",
        priority: "HIGH",
        fromIso: "2026-01-01T00:00:00.000Z",
        toIso: "2026-02-01T00:00:00.000Z",
        search: "ارث",
        bucket: "inProgress",
        page: 2,
        pageSize: 25,
        sort: "due",
      });
    } finally {
      globalThis.fetch = original;
    }

    expect(seen).toHaveLength(1);
    const url = new URL(seen[0]!);
    const expected: Record<string, string> = {
      serviceKey: "family-consultation",
      state: "ACCEPTED",
      perspective: "ACTIVE",
      slaHealth: "AT_RISK",
      priority: "HIGH",
      fromIso: "2026-01-01T00:00:00.000Z",
      toIso: "2026-02-01T00:00:00.000Z",
      search: "ارث",
      bucket: "inProgress",
      page: "2",
      pageSize: "25",
      sort: "due",
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(url.searchParams.get(key), `?${key}=`).toBe(value);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Workflow verbs
// ---------------------------------------------------------------------------

describe("workflow verbs", () => {
  it("refuses every mutation from the wrong lawyer with 404", async () => {
    const res = await referralAction(
      req(lawyerB.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "ACCEPT" },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(404);
  });

  it("refuses a decline without a reason (400), leaving the state untouched", async () => {
    const res = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "DECLINE", reason: "" },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(400);
    expect(legalRequestDb.getRequestById(requestId)?.state).toBe("WAITING_FOR_ACCEPTANCE");
  });

  it("accepts as the assigned lawyer and creates the case", async () => {
    const res = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "ACCEPT" },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { state: string } };
    expect(body.data.state).toBe("ACCEPTED");

    const row = legalRequestDb.getRequestById(requestId);
    expect(row?.sla?.acceptedAt).toBeTruthy();
    expect(row?.caseId).toBeTruthy();
  });

  it("keeps an internal note off the client's thread, and mirrors a public note", async () => {
    const internal = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "ADD_NOTE", note: "یادداشت داخلی تیم", internal: true },
      }),
      idCtx(requestId)
    );
    expect(internal.status).toBe(200);

    const threadAfterInternal = threads.getThreadByRequestId(requestId);
    const internalMessages = threadAfterInternal
      ? threads.listMessages(threadAfterInternal.id)
      : [];
    expect(internalMessages.some((m) => m.body === "یادداشت داخلی تیم")).toBe(false);

    const publicNote = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "ADD_NOTE", note: "پیگیری با موکل انجام شد." },
      }),
      idCtx(requestId)
    );
    expect(publicNote.status).toBe(200);

    const thread = threads.getThreadByRequestId(requestId);
    const messages = thread ? threads.listMessages(thread.id) : [];
    expect(messages.some((m) => m.body === "پیگیری با موکل انجام شد.")).toBe(true);
  });

  it("starts the accepted request before it can be completed", async () => {
    const res = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "START" },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { state: string } };
    expect(body.data.state).toBe("IN_PROGRESS");
    expect(legalRequestDb.getRequestById(requestId)?.sla?.startedAt).toBeTruthy();
  });

  it("completes with a result that lands on the request", async () => {
    const res = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: {
          action: "COMPLETE",
          summary: "نتیجهٔ کار: لایحهٔ دفاعیه تنظیم و تحویل شد.",
        },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(200);
    const row = legalRequestDb.getRequestById(requestId);
    expect(row?.state).toBe("COMPLETED");
    expect(row?.result?.summary).toContain("لایحهٔ دفاعیه");
    expect(row?.sla?.completedAt).toBeTruthy();
  });

  it("refuses to complete an already-completed request (409, never a silent rewrite)", async () => {
    const res = await referralAction(
      req(lawyerA.session, `http://localhost/api/v1/lawyer/referrals/${requestId}/actions`, {
        method: "POST",
        body: { action: "COMPLETE", summary: "تلاش دوباره برای بازنویسی نتیجه" },
      }),
      idCtx(requestId)
    );
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// 4. Bank masking
// ---------------------------------------------------------------------------

describe("settlement account — owner vs. everyone else", () => {
  const IBAN = "IR123456789012345678901234";

  it("returns the owner's full IBAN and marks the account pending review", async () => {
    const res = await bankRoute.PUT(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/bank", {
        method: "PUT",
        body: { holderName: "وکیل الف", bankName: "بانک ملی", iban: IBAN },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("PENDING_REVIEW");

    const own = await bankRoute.GET(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/bank")
    );
    expect(own.status).toBe(200);
    const ownBody = (await own.json()) as { data: { account: { iban: string } | null } };
    expect(ownBody.data.account?.iban).toBe(IBAN);
  });

  it("masks the IBAN in the admin dossier", async () => {
    const res = await adminLawyerGet(
      req(adminSession, `http://localhost/api/v1/admin/lawyers/${lawyerA.id}`),
      idCtx(lawyerA.id)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { bank: { account: { iban: string } | null; status: string } };
    };
    expect(body.data.bank.status).toBe("PENDING_REVIEW");
    expect(body.data.bank.account?.iban).not.toBe(IBAN);
    expect(body.data.bank.account?.iban).toContain("•");
  });

  it("refuses a malformed IBAN", async () => {
    const res = await bankRoute.PUT(
      req(lawyerA.session, "http://localhost/api/v1/lawyer/bank", {
        method: "PUT",
        body: { holderName: "وکیل الف", bankName: "بانک ملی", iban: "IR12" },
      })
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5. Admin oversight
// ---------------------------------------------------------------------------

describe("admin oversight", () => {
  it("denies the requests queue to a non-staff user", async () => {
    const res = await adminGet(
      req(clientSession, "http://localhost/api/v1/admin/requests"),
      adminCtx("requests")
    );
    expect(res.status).toBe(403);
  });

  it("returns per-row SLA + facets to an admin", async () => {
    const res = await adminGet(
      req(adminSession, "http://localhost/api/v1/admin/requests"),
      adminCtx("requests")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        items: { id: string; serviceKey: string | null; sla: { health: string } }[];
        facets: { lawyers: { id: string }[]; services: string[] };
      };
    };
    const row = body.data.items.find((i) => i.id === requestId);
    expect(row).toBeTruthy();
    expect(row?.serviceKey).toBe("family-consultation");
    expect(row?.sla.health).toBeTruthy();
    expect(body.data.facets.services).toContain("family-consultation");
  });

  it("filters the queue by the assigned lawyer", async () => {
    const res = await adminGet(
      req(
        adminSession,
        `http://localhost/api/v1/admin/requests?lawyerId=${encodeURIComponent(lawyerB.id)}`
      ),
      adminCtx("requests")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: { id: string }[] } };
    expect(body.data.items.map((i) => i.id)).not.toContain(requestId);
  });

  it("exposes a user's own request history", async () => {
    const res = await adminGet(
      req(adminSession, `http://localhost/api/v1/admin/users/${clientUserId}/requests`),
      adminCtx("users", clientUserId, "requests")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        items: { id: string; selectedLawyerName: string | null; sla: { healthFa: string } }[];
      };
    };
    const row = body.data.items.find((i) => i.id === requestId);
    expect(row).toBeTruthy();
    expect(row?.selectedLawyerName).toBe("وکیل الف");
    expect(row?.sla.healthFa.length).toBeGreaterThan(0);
  });

  it("refuses the per-user request history to a user without the permission", async () => {
    const res = await adminGet(
      req(clientSession, `http://localhost/api/v1/admin/users/${clientUserId}/requests`),
      adminCtx("users", clientUserId, "requests")
    );
    expect(res.status).toBe(403);
  });

  it("rejects a deadline override without a reason", async () => {
    const res = await adminPatch(
      req(adminSession, `http://localhost/api/v1/admin/requests/${requestId}`, {
        method: "PATCH",
        body: { slaOverride: { phase: "RESPONSE", nextDueAt: null, reason: "" } },
      }),
      adminCtx("requests", requestId)
    );
    expect(res.status).toBe(400);
  });
});
