// ============================================================
// LEGALIR — Consultation create/respond idempotency (temp DB)
// ============================================================
// The brief (§3) requires that creating a consultation request be idempotent:
// a double-click, a retried fetch, or a refreshed tab must never mint a second
// request — and a retried lawyer decision must never create a second case.
//
// The server half is `runIdempotent` (lib/api/idempotency-store.ts): the first
// 2xx response is memoized under (scope, actorId, Idempotency-Key) and replayed
// verbatim on any repeat. This drives the REAL route handlers against an
// isolated temp DB and asserts:
//
//   create  · same key, same body → ONE request row; second call replays the
//             first response (same id) and returns 201 again;
//           · a different key → a genuinely new request;
//           · no key at all → unaffected (each POST is a new request);
//           · a failed validation is NOT memoized — the same key succeeds once
//             the body is corrected;
//           · the key is actor-scoped — the same key from a different user
//             mints their own request, never replays another's;
//   respond · same key, same decision → ONE case created, state ACCEPTED once;
//           · a repeated decision under a NEW key is refused 409 (the state
//             machine is the backstop behind idempotency).
//
// db.ts binds its store from cwd at import time, so every module is imported
// DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { LawyerProfile, LegalRequest } from "@legalir/types";
import type * as DbModule from "../db";
import type * as LegalRequestDbModule from "../legal-request-db";
import type * as LawyerDbModule from "../lawyer-db";

type Db = typeof DbModule;
type LegalRequestDb = typeof LegalRequestDbModule;
type LawyerDb = typeof LawyerDbModule;

let db: Db;
let legalRequestDb: LegalRequestDb;
let lawyerDb: LawyerDb;

let createRequestRoute: (req: NextRequest) => Promise<Response>;
let respondRoute: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const LAWYER_ID = "law-idem-1";

let clientSession: string;
let clientUserId: string;
let otherClientSession: string;
let lawyerSession: string;
let lawyerUserId: string;

let tmpDir: string;
let originalCwd: string;

function req(
  session: string,
  url: string,
  init?: { method?: string; body?: unknown; idemKey?: string }
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    cookie: `legalir-session=${session}`,
  };
  if (init?.idemKey) headers["Idempotency-Key"] = init.idemKey;
  return new Request(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  }) as unknown as NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function lawyerProfile(userId: string): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId,
    fullName: "مریم وکیلی",
    licenseNumber: "۵۵۵۵",
    licenseYear: 1398,
    bio: "وکیل پایه یک دادگستری.",
    avatarUrl: null,
    avatarType: "real",
    professionalTitle: "وکیل پایه یک",
    activityType: "INDEPENDENT",
    licenseAuthority: "کانون وکلای مرکز",
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    verificationNote: null,
    specializations: [{ category: "family", yearsExperience: 6, note: null }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 400_000,
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
  };
}

function requestCount(): number {
  return db.readTable<LegalRequest>("legal_requests").length;
}
function caseCount(): number {
  return db.readTable<{ id: string }>("cases").length;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-idem-"));
  process.chdir(tmpDir);

  db = await import("../db");
  legalRequestDb = await import("../legal-request-db");
  lawyerDb = await import("../lawyer-db");

  const createMod = await import("@/app/api/v1/legal-requests/route");
  createRequestRoute = createMod.POST as typeof createRequestRoute;
  const respondMod = await import("@/app/api/v1/legal-requests/[id]/respond/route");
  respondRoute = respondMod.POST as typeof respondRoute;

  const client = db.createUser({ mobile: "09120000021", passwordHash: "x" });
  clientUserId = client.id;
  clientSession = db.createSession(clientUserId).id;

  const other = db.createUser({ mobile: "09120000022", passwordHash: "x" });
  otherClientSession = db.createSession(other.id).id;

  const lawyerUser = db.createUser({ mobile: "09120000023", passwordHash: "x" });
  lawyerUserId = lawyerUser.id;
  db.setUserRole(lawyerUserId, "LAWYER");
  lawyerSession = db.createSession(lawyerUserId).id;

  lawyerDb.upsertLawyerProfile(lawyerProfile(lawyerUserId));
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("consultation create — Idempotency-Key", () => {
  const URL = "http://localhost/api/v1/legal-requests";
  const BODY = { title: "مشاورهٔ خانواده", category: "family" };

  it("the same key replays the first response instead of creating a second request", async () => {
    const before = requestCount();
    const key = "idem-create-A";

    const res1 = await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: key }));
    expect(res1.status).toBe(201);
    const first = (await res1.json()) as { data: LegalRequest };
    expect(requestCount()).toBe(before + 1);

    const res2 = await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: key }));
    expect(res2.status).toBe(201);
    const second = (await res2.json()) as { data: LegalRequest };

    // Same request id, and NO second row.
    expect(second.data.id).toBe(first.data.id);
    expect(requestCount()).toBe(before + 1);
  });

  it("two CONCURRENT requests with the same key still create exactly ONE request", async () => {
    const before = requestCount();
    const key = "idem-create-concurrent";

    // Fire both before awaiting either — the exact double-click / racing-retry
    // the store exists to absorb. Without the in-process lock both would miss
    // the (empty) key table and both would run the handler.
    const [a, b] = await Promise.all([
      createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: key })),
      createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: key })),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const aBody = (await a.json()) as { data: LegalRequest };
    const bBody = (await b.json()) as { data: LegalRequest };
    // Same request id in both responses, and exactly one row on disk.
    expect(bBody.data.id).toBe(aBody.data.id);
    expect(requestCount()).toBe(before + 1);
  });

  it("a different key creates a genuinely new request", async () => {
    const before = requestCount();
    await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: "idem-create-B" }));
    await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: "idem-create-C" }));
    expect(requestCount()).toBe(before + 2);
  });

  it("without a key each POST is a new request (older clients unaffected)", async () => {
    const before = requestCount();
    await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY }));
    await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY }));
    expect(requestCount()).toBe(before + 2);
  });

  it("a failed validation is NOT memoized — the same key succeeds once corrected", async () => {
    const key = "idem-create-D";
    const bad = await createRequestRoute(
      req(clientSession, URL, { method: "POST", body: { title: "", category: "family" }, idemKey: key })
    );
    expect(bad.status).toBe(400);

    const before = requestCount();
    const good = await createRequestRoute(
      req(clientSession, URL, { method: "POST", body: BODY, idemKey: key })
    );
    expect(good.status).toBe(201);
    expect(requestCount()).toBe(before + 1);
  });

  it("the key is actor-scoped — another user with the same key gets their OWN request", async () => {
    const key = "idem-create-shared";
    const mine = await createRequestRoute(req(clientSession, URL, { method: "POST", body: BODY, idemKey: key }));
    const mineBody = (await mine.json()) as { data: LegalRequest };

    const before = requestCount();
    const theirs = await createRequestRoute(req(otherClientSession, URL, { method: "POST", body: BODY, idemKey: key }));
    const theirsBody = (await theirs.json()) as { data: LegalRequest };

    expect(theirs.status).toBe(201);
    expect(theirsBody.data.id).not.toBe(mineBody.data.id);
    expect(theirsBody.data.userId).not.toBe(mineBody.data.userId);
    expect(requestCount()).toBe(before + 1);
  });
});

describe("consultation respond — Idempotency-Key", () => {
  let reqId: string;

  beforeAll(() => {
    // A request already routed to the lawyer, awaiting their decision.
    reqId = "req-idem-respond-1";
    const now = new Date().toISOString();
    legalRequestDb.createRequest({
      id: reqId,
      userId: clientUserId,
      caseId: null,
      conversationId: null,
      title: "مشاورهٔ ارجاع‌شده",
      category: "family",
      state: "WAITING_FOR_ACCEPTANCE",
      intakeAnswers: {},
      analysisId: null,
      selectedLawyerId: LAWYER_ID,
      orgId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  const RESPOND_URL = () => `http://localhost/api/v1/legal-requests/${reqId}/respond`;

  it("accepting twice under the same key creates ONE case and transitions once", async () => {
    const beforeCases = caseCount();
    const key = "idem-respond-accept";

    const res1 = await respondRoute(
      req(lawyerSession, RESPOND_URL(), { method: "POST", body: { action: "accept" }, idemKey: key }),
      params(reqId)
    );
    expect(res1.status).toBe(200);
    expect(caseCount()).toBe(beforeCases + 1);

    const res2 = await respondRoute(
      req(lawyerSession, RESPOND_URL(), { method: "POST", body: { action: "accept" }, idemKey: key }),
      params(reqId)
    );
    expect(res2.status).toBe(200);
    // Still exactly one case — the replay did not create a second.
    expect(caseCount()).toBe(beforeCases + 1);

    const stored = legalRequestDb.getRequestById(reqId)!;
    expect(stored.state).toBe("ACCEPTED");
  });

  it("a repeated decision under a NEW key is refused 409 — the state machine is the backstop", async () => {
    const beforeCases = caseCount();
    const res = await respondRoute(
      req(lawyerSession, RESPOND_URL(), { method: "POST", body: { action: "decline" }, idemKey: "idem-respond-other" }),
      params(reqId)
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("ILLEGAL_TRANSITION");
    expect(caseCount()).toBe(beforeCases); // no side effects on a refused decision
    expect(legalRequestDb.getRequestById(reqId)!.state).toBe("ACCEPTED");
  });
});
