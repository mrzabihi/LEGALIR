// ============================================================
// LEGALIR — Review eligibility gate (temp DB)
// ============================================================
// The single most abuse-prone rule in the review feature: a review may only be
// filed against a GENUINELY finished engagement. `CLOSED` is not enough on its
// own — LEGAL_REQUEST_TRANSITIONS lets the CLIENT drive CANCELLED → CLOSED and
// DECLINED → CLOSED (neither is a lawyer-only move), so a bare CLOSED row can
// be manufactured by a client to forge a "verified" review.
//
// This drives the REAL submit route for each distinct (user, lawyer) pair so a
// forged path in one case cannot leak into another:
//
//   · no engagement                       → 403
//   · WAITING_FOR_ACCEPTANCE              → 403
//   · CANCELLED (never completed)         → 403
//   · CLOSED driven from CANCELLED        → 403   ← the bypass this guards
//   · CLOSED driven from DECLINED         → 403   ← the bypass this guards
//   · COMPLETED                           → 200   (allowed, starts PENDING)
//   · CLOSED after a real COMPLETED       → 200   (the genuine close case)
//
// db.ts binds its store from cwd at import time, so every module is imported
// DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { LawyerProfile, LegalRequest, LegalRequestState } from "@legalir/types";
import type * as DbModule from "../db";
import type * as LegalRequestDbModule from "../legal-request-db";
import type * as LawyerDbModule from "../lawyer-db";

type Db = typeof DbModule;
type LegalRequestDb = typeof LegalRequestDbModule;
type LawyerDb = typeof LawyerDbModule;

let db: Db;
let legalRequestDb: LegalRequestDb;
let lawyerDb: LawyerDb;

let submitReview: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const LAWYER_ID = "law-elig-1";

let tmpDir: string;
let originalCwd: string;

function authReq(session: string, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function lawyerProfile(): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId: "law-user-elig-1",
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

let mobileSeq = 0;
/** A fresh client session, so each case is isolated per (user, lawyer). */
function newClient(): { userId: string; session: string } {
  mobileSeq += 1;
  const user = db.createUser({
    mobile: `0912000${String(mobileSeq).padStart(4, "0")}`,
    passwordHash: "x",
  });
  return { userId: user.id, session: db.createSession(user.id).id };
}

/** Seed a request for `userId` already at `state` (its creation event carries it). */
function seedRequest(userId: string, state: LegalRequestState, reqId: string): void {
  const now = new Date().toISOString();
  const row: LegalRequest = {
    id: reqId,
    userId,
    caseId: null,
    conversationId: null,
    title: "مشاورهٔ خانواده",
    category: "family",
    state,
    intakeAnswers: {},
    analysisId: null,
    selectedLawyerId: LAWYER_ID,
    orgId: null,
    createdAt: now,
    updatedAt: now,
  };
  legalRequestDb.createRequest(row);
}

/** Drive a request through the real state machine (appends an event per hop). */
function drive(reqId: string, to: LegalRequestState): void {
  const res = legalRequestDb.transitionRequest({
    requestId: reqId,
    to,
    actorId: "system",
    actorRole: "system",
  });
  if (!res.ok) throw new Error(`illegal transition to ${to}: ${res.reason}`);
}

async function review(session: string): Promise<Response> {
  return submitReview(
    authReq(session, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating: 5, comment: "مشاورهٔ خوبی بود." }),
    }),
    { params: Promise.resolve({ id: LAWYER_ID }) }
  );
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-review-elig-"));
  process.chdir(tmpDir);

  db = await import("../db");
  legalRequestDb = await import("../legal-request-db");
  lawyerDb = await import("../lawyer-db");

  const mod = await import("@/app/api/v1/lawyers/[id]/reviews/route");
  submitReview = mod.POST as typeof submitReview;

  lawyerDb.upsertLawyerProfile(lawyerProfile());
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("review eligibility — only a genuinely completed engagement qualifies", () => {
  it("no engagement at all → 403", async () => {
    const { session } = newClient();
    expect((await review(session)).status).toBe(403);
  });

  it("an in-flight request (WAITING_FOR_ACCEPTANCE) → 403", async () => {
    const { userId, session } = newClient();
    seedRequest(userId, "WAITING_FOR_ACCEPTANCE", `req-wait-${userId}`);
    expect((await review(session)).status).toBe(403);
  });

  it("a CANCELLED request → 403", async () => {
    const { userId, session } = newClient();
    seedRequest(userId, "CANCELLED", `req-cancel-${userId}`);
    expect((await review(session)).status).toBe(403);
  });

  it("a CLOSED request driven from CANCELLED (never completed) → 403  [forgery guard]", async () => {
    const { userId, session } = newClient();
    const reqId = `req-cancel-close-${userId}`;
    seedRequest(userId, "WAITING_FOR_ACCEPTANCE", reqId);
    drive(reqId, "CANCELLED");
    drive(reqId, "CLOSED");
    // The row reads CLOSED, but its history never reached COMPLETED.
    expect(legalRequestDb.getRequestById(reqId)!.state).toBe("CLOSED");
    expect(
      legalRequestDb.listRequestEvents(reqId).some((e) => e.toState === "COMPLETED")
    ).toBe(false);
    expect((await review(session)).status).toBe(403);
  });

  it("a CLOSED request driven from DECLINED (never completed) → 403  [forgery guard]", async () => {
    const { userId, session } = newClient();
    const reqId = `req-declined-close-${userId}`;
    seedRequest(userId, "WAITING_FOR_ACCEPTANCE", reqId);
    drive(reqId, "DECLINED");
    drive(reqId, "CLOSED");
    expect(legalRequestDb.getRequestById(reqId)!.state).toBe("CLOSED");
    expect((await review(session)).status).toBe(403);
  });

  it("a COMPLETED engagement → 200, and the review starts PENDING", async () => {
    const { userId, session } = newClient();
    seedRequest(userId, "COMPLETED", `req-completed-${userId}`);
    const res = await review(session);
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { status: string; created: boolean } };
    expect(data.created).toBe(true);
    expect(data.status).toBe("PENDING");
  });

  it("a request CLOSED after a real COMPLETED → 200 (the genuine close case)", async () => {
    const { userId, session } = newClient();
    const reqId = `req-completed-close-${userId}`;
    seedRequest(userId, "COMPLETED", reqId);
    drive(reqId, "CLOSED");
    expect(
      legalRequestDb.listRequestEvents(reqId).some((e) => e.toState === "COMPLETED")
    ).toBe(true);
    expect((await review(session)).status).toBe(200);
  });
});
