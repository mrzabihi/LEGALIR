// ============================================================
// LEGALIR — Consultation timeline privacy (temp DB)
// ============================================================
// The case room shows the client (and the assigned lawyer) the request's
// transition history. That history may contain INTERNAL notes an operator
// wrote for other staff — those must never reach the case room, and the raw
// actor user id must never be returned either.
//
// The brief (§3) is explicit: internal notes must never leak, and the timeline
// must still show THAT the status moved.
//
// This drives the real route handler (GET /api/v1/legal-requests/[id]) as the
// client against an isolated temp DB and asserts:
//   · a `public` event keeps its note verbatim;
//   · an `internal` event keeps its state change but its note is replaced with
//     the neutral label «تغییر وضعیت توسط پشتیبانی» — the secret text is absent;
//   · no event carries a raw `actorId`;
//   · the SOURCE row (read directly) still holds the internal note, proving the
//     projection — not the write — is what strips it.
//
// db.ts binds its store from cwd at import time, so every module is imported
// DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { LawyerProfile, LegalRequest, LegalRequestEvent } from "@legalir/types";
import type * as DbModule from "../db";
import type * as LegalRequestDbModule from "../legal-request-db";
import type * as LawyerDbModule from "../lawyer-db";

type Db = typeof DbModule;
type LegalRequestDb = typeof LegalRequestDbModule;
type LawyerDb = typeof LawyerDbModule;

let db: Db;
let legalRequestDb: LegalRequestDb;
let lawyerDb: LawyerDb;

let getDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const LAWYER_ID = "law-tl-1";
const REQ_ID = "req-tl-1";
const SECRET_NOTE = "یادداشت داخلی محرمانه: مشتری قبلاً شکایت کرده است.";
const PUBLIC_NOTE = "درخواست برای بررسی به وکیل ارجاع شد.";

let clientSession: string;
let clientUserId: string;
let adminUserId: string;

let tmpDir: string;
let originalCwd: string;

function authReq(session: string, url: string): NextRequest {
  return new Request(url, {
    headers: { cookie: `legalir-session=${session}` },
  }) as unknown as NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function lawyerProfile(): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId: "law-user-tl-1",
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

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-timeline-"));
  process.chdir(tmpDir);

  db = await import("../db");
  legalRequestDb = await import("../legal-request-db");
  lawyerDb = await import("../lawyer-db");

  const mod = await import("@/app/api/v1/legal-requests/[id]/route");
  getDetail = mod.GET as typeof getDetail;

  // The client who owns the request.
  const client = db.createUser({ mobile: "09120000011", passwordHash: "x" });
  clientUserId = client.id;
  clientSession = db.createSession(clientUserId).id;

  // A staff operator who writes the internal note.
  const admin = db.createUser({ mobile: "09120000012", passwordHash: "x" });
  adminUserId = admin.id;

  lawyerDb.upsertLawyerProfile(lawyerProfile());

  const now = new Date().toISOString();
  const request: LegalRequest = {
    id: REQ_ID,
    userId: clientUserId,
    caseId: null,
    conversationId: null,
    title: "مشاورهٔ خانواده",
    category: "family",
    state: "COMPLETED",
    intakeAnswers: {},
    analysisId: null,
    selectedLawyerId: LAWYER_ID,
    orgId: null,
    createdAt: now,
    updatedAt: now,
  };
  legalRequestDb.createRequest(request);

  // A PUBLIC note (visible verbatim) …
  legalRequestDb.appendRequestEvent({
    id: "lre-public-1",
    requestId: REQ_ID,
    fromState: "IN_PROGRESS",
    toState: "COMPLETED",
    actorId: adminUserId,
    actorRole: "SUPER_ADMIN",
    note: PUBLIC_NOTE,
    noteVisibility: "public",
    createdAt: new Date(Date.now() + 1000).toISOString(),
  });

  // … and an INTERNAL note that must never appear in the case room.
  legalRequestDb.appendRequestEvent({
    id: "lre-internal-1",
    requestId: REQ_ID,
    fromState: null,
    toState: "COMPLETED",
    actorId: adminUserId,
    actorRole: "SUPER_ADMIN",
    note: SECRET_NOTE,
    noteVisibility: "internal",
    createdAt: new Date(Date.now() + 2000).toISOString(),
  });
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("consultation timeline — internal notes never leak", () => {
  it("the case room keeps a public note but neutralises an internal one and drops actor ids", async () => {
    const res = await getDetail(
      authReq(clientSession, `http://localhost/api/v1/legal-requests/${REQ_ID}`),
      params(REQ_ID)
    );
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: { events: LegalRequestEvent[] };
    };
    const events = data.events;

    // The public note survives verbatim.
    const pub = events.find((e) => e.id === "lre-public-1")!;
    expect(pub).toBeTruthy();
    expect(pub.note).toBe(PUBLIC_NOTE);

    // The internal note is neutralised — the transition is still shown, the
    // secret text is not, anywhere in the payload.
    const internal = events.find((e) => e.id === "lre-internal-1")!;
    expect(internal).toBeTruthy();
    expect(internal.note).toBe("تغییر وضعیت توسط پشتیبانی");
    expect(internal.note).not.toBe(SECRET_NOTE);
    expect(internal.toState).toBe("COMPLETED");

    // Nothing in the serialized payload carries the secret or a raw actor id.
    const raw = JSON.stringify(data);
    expect(raw).not.toContain(SECRET_NOTE);
    expect(raw).not.toContain(adminUserId);
    for (const e of events) {
      expect(e.actorId).toBeUndefined();
    }
  });

  it("the source row still holds the internal note — the projection, not the write, strips it", () => {
    const stored = legalRequestDb.listRequestEvents(REQ_ID);
    const internalRow = stored.find((e) => e.id === "lre-internal-1")!;
    expect(internalRow.note).toBe(SECRET_NOTE);
    expect(internalRow.noteVisibility).toBe("internal");
    expect(internalRow.actorId).toBe(adminUserId);
  });
});
