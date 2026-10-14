// ============================================================
// LEGALIR — Client reviews · END-TO-END (temp DB)
// ============================================================
// The review lifecycle the brief requires, driven through the REAL route
// handlers against an isolated temp DB:
//
//   eligibility (only after a COMPLETED engagement) → submit → PENDING
//   (NOT counted) → moderator PUBLISHES → counted → author EDITS within the
//   window → any viewer REPORTS → REPORTED (still visible) → moderator
//   HIDEs with a reason → removed + report RESOLVED + audit + event.
//
// The invariants under test:
//   · a review may only be filed against a genuinely finished engagement;
//   · the public average counts ONLY publicly-visible reviews (PENDING out,
//     REPORTED in until a moderator pulls it);
//   · reporting is idempotent (one open report per user) and never silently
//     removes a review;
//   · hiding requires a reason and is always recorded (event + audit).
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
import type * as LawyerDbModule from "../lawyer-db";

type Db = typeof DbModule;
type LawyerDb = typeof LawyerDbModule;

let db: Db;
let lawyerDb: LawyerDb;

let adminSession: string;
let clientSession: string;
let otherSession: string;
let clientUserId: string;
let otherUserId: string;

const LAWYER_ID = "law-rev-1";
const REQ_ID = "req-rev-1";

let tmpDir: string;
let originalCwd: string;

let getMine: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let submitReview: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let reportReview: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; reviewId: string }> }
) => Promise<Response>;
let moderateReview: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; reviewId: string }> }
) => Promise<Response>;
let getAdminDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let getPublic: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

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

function anonReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function params2(id: string, reviewId: string) {
  return { params: Promise.resolve({ id, reviewId }) };
}

/** A VERIFIED, publicly viewable lawyer profile. */
function lawyerProfile(): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId: "law-user-1",
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

function requestRow(state: LegalRequest["state"], userId: string): LegalRequest {
  const now = new Date().toISOString();
  return {
    id: REQ_ID,
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
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-reviews-"));
  process.chdir(tmpDir);

  db = await import("../db");
  lawyerDb = await import("../lawyer-db");

  const mine = await import("@/app/api/v1/lawyers/[id]/reviews/mine/route");
  getMine = mine.GET as typeof getMine;
  const submit = await import("@/app/api/v1/lawyers/[id]/reviews/route");
  submitReview = submit.POST as typeof submitReview;
  const report = await import("@/app/api/v1/lawyers/[id]/reviews/[reviewId]/report/route");
  reportReview = report.POST as typeof reportReview;
  const moderate = await import("@/app/api/v1/admin/lawyers/[id]/reviews/[reviewId]/route");
  moderateReview = moderate.POST as typeof moderateReview;
  const detail = await import("@/app/api/v1/admin/lawyers/[id]/route");
  getAdminDetail = detail.GET as typeof getAdminDetail;
  const pub = await import("@/app/api/v1/lawyers/[id]/route");
  getPublic = pub.GET as typeof getPublic;

  // Staff operator.
  const admin = db.createUser({ mobile: "09120000001", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  // The client who had an engagement.
  const client = db.createUser({ mobile: "09120000002", passwordHash: "x" });
  clientUserId = client.id;
  clientSession = db.createSession(clientUserId).id;

  // Another signed-in viewer (files the report).
  const other = db.createUser({ mobile: "09120000003", passwordHash: "x" });
  otherUserId = other.id;
  otherSession = db.createSession(otherUserId).id;

  lawyerDb.upsertLawyerProfile(lawyerProfile());

  // A COMPLETED engagement so the client becomes eligible.
  const { createRequest } = await import("../legal-request-db");
  createRequest(requestRow("COMPLETED", clientUserId));
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("client reviews — eligibility, publication, moderation", () => {
  let reviewId: string;

  it("a viewer with NO completed engagement cannot review and is told why", async () => {
    const res = await getMine(
      authReq(otherSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews/mine`),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { canReview: boolean; reason: string | null; existing: unknown };
    };
    expect(data.canReview).toBe(false);
    expect(data.reason).toBeTruthy();
    expect(data.existing).toBeNull();

    // The submit route refuses the same attempt — the UI is never the gate.
    const post = await submitReview(
      authReq(otherSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: 5, comment: "بسیار خوب بود" }),
      }),
      params(LAWYER_ID)
    );
    expect(post.status).toBe(403);
  });

  it("the client with a completed engagement may review; a new review starts PENDING and is NOT counted", async () => {
    const res = await submitReview(
      authReq(clientSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: 5, comment: "مشاورهٔ دقیق و مفید بود." }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { id: string; status: string; created: boolean };
    };
    reviewId = data.id;
    expect(data.created).toBe(true);
    expect(data.status).toBe("PENDING");

    // PENDING is invisible publicly and excluded from the derived average.
    const perf = lawyerDb.computePerformance(LAWYER_ID);
    expect(perf.reviewCount).toBe(0);
    expect(perf.averageRating).toBeNull();

    const pub = await getPublic(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    const pubBody = (await pub.json()) as { data: { reviews: unknown[] } };
    expect(pubBody.data.reviews).toHaveLength(0);
  });

  it("publishing the review makes it public AND counted", async () => {
    const res = await moderateReview(
      authReq(adminSession, `http://localhost/api/v1/admin/lawyers/${LAWYER_ID}/reviews/${reviewId}`, {
        method: "POST",
        body: JSON.stringify({ action: "publish" }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(200);

    const perf = lawyerDb.computePerformance(LAWYER_ID);
    expect(perf.reviewCount).toBe(1);
    expect(perf.averageRating).toBe(5);

    const pub = await getPublic(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    const pubBody = (await pub.json()) as { data: { reviews: unknown[] } };
    expect(pubBody.data.reviews).toHaveLength(1);
  });

  it("a second submit from the author EDITS their own review (one review per user)", async () => {
    const res = await submitReview(
      authReq(clientSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: 4, comment: "پس از پیگیری، راضی هستم." }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { id: string; created: boolean; rating: number } };
    expect(data.created).toBe(false);
    expect(data.id).toBe(reviewId);
    expect(data.rating).toBe(4);

    expect(lawyerDb.listLawyerReviewRows(LAWYER_ID)).toHaveLength(1);
    expect(lawyerDb.computePerformance(LAWYER_ID).averageRating).toBe(4);
  });

  it("reporting an inappropriate review marks it REPORTED — still visible and counted", async () => {
    const res = await reportReview(
      authReq(otherSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews/${reviewId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: "این نظر توهین‌آمیز است." }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { status: string } };
    expect(data.status).toBe("REPORTED");

    // Still public and still counted — a report is a flag, not a removal.
    expect(lawyerDb.listLawyerReviews(LAWYER_ID)).toHaveLength(1);
    expect(lawyerDb.computePerformance(LAWYER_ID).reviewCount).toBe(1);

    // The transition is logged so it is never silent.
    const events = lawyerDb.listReviewEvents(reviewId);
    expect(events.some((e) => e.fromStatus === "PUBLISHED" && e.toStatus === "REPORTED")).toBe(true);
  });

  it("reporting again is idempotent — one open report per user", async () => {
    await reportReview(
      authReq(otherSession, `http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews/${reviewId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: "دوباره گزارش می‌کنم." }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    const open = lawyerDb
      .listReviewReports(reviewId)
      .filter((r) => r.reporterUserId === otherUserId && r.status === "OPEN");
    expect(open).toHaveLength(1);
  });

  it("hiding without a reason is refused — 400, status unchanged", async () => {
    const res = await moderateReview(
      authReq(adminSession, `http://localhost/api/v1/admin/lawyers/${LAWYER_ID}/reviews/${reviewId}`, {
        method: "POST",
        body: JSON.stringify({ action: "hide" }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("REASON_REQUIRED");
    expect(lawyerDb.reviewStatus(lawyerDb.listLawyerReviewRows(LAWYER_ID)[0]!)).toBe("REPORTED");
  });

  it("hiding with a reason removes it publicly, excludes it from the average, resolves reports and audits", async () => {
    const res = await moderateReview(
      authReq(adminSession, `http://localhost/api/v1/admin/lawyers/${LAWYER_ID}/reviews/${reviewId}`, {
        method: "POST",
        body: JSON.stringify({ action: "hide", reason: "نقض قواعد انجمن." }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(200);

    // Gone from the public list and the derived average …
    expect(lawyerDb.listLawyerReviews(LAWYER_ID)).toHaveLength(0);
    expect(lawyerDb.computePerformance(LAWYER_ID).reviewCount).toBe(0);
    expect(lawyerDb.computePerformance(LAWYER_ID).averageRating).toBeNull();

    // … the open report is resolved …
    expect(lawyerDb.listReviewReports(reviewId).every((r) => r.status !== "OPEN")).toBe(true);

    // … and the moderation is recorded in BOTH the review history and the audit log.
    const events = lawyerDb.listReviewEvents(reviewId);
    expect(events.some((e) => e.toStatus === "HIDDEN" && e.reason === "نقض قواعد انجمن.")).toBe(true);
    const audit = db.readTable<{ action: string; resourceId: string; reason: string }>("admin_audit_log");
    expect(
      audit.some((a) => a.action === "LAWYER_REVIEW_HIDE" && a.resourceId === reviewId)
    ).toBe(true);
  });

  it("the admin dossier exposes per-review moderation history + reports", async () => {
    const res = await getAdminDetail(
      authReq(adminSession, `http://localhost/api/v1/admin/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: {
        reviews: { id: string; status: string; openReports: number; hidden: boolean }[];
        moderation: Record<string, { events: unknown[]; reports: unknown[] }>;
        stats: { openReports: number };
      };
    };
    const row = data.reviews.find((r) => r.id === reviewId)!;
    expect(row.status).toBe("HIDDEN");
    expect(row.hidden).toBe(true);
    expect(data.moderation[reviewId]!.events.length).toBeGreaterThanOrEqual(2);
    expect(data.moderation[reviewId]!.reports.length).toBeGreaterThanOrEqual(1);
  });

  it("restoring the review makes it public and counted again", async () => {
    const res = await moderateReview(
      authReq(adminSession, `http://localhost/api/v1/admin/lawyers/${LAWYER_ID}/reviews/${reviewId}`, {
        method: "POST",
        body: JSON.stringify({ action: "restore" }),
      }),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(200);
    expect(lawyerDb.listLawyerReviews(LAWYER_ID)).toHaveLength(1);
    expect(lawyerDb.computePerformance(LAWYER_ID).reviewCount).toBe(1);
  });

  it("an unauthenticated report is refused — 401", async () => {
    const res = await reportReview(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}/reviews/${reviewId}/report`),
      params2(LAWYER_ID, reviewId)
    );
    expect(res.status).toBe(401);
  });
});
