// ============================================================
// LEGALIR — Admin lawyer verification · END-TO-END (temp DB)
// ============================================================
// Drives the real route handlers against an isolated temp DB, covering the
// full lifecycle the brief requires:
//
//   register → PENDING (REVIEW) → admin decides (reason MANDATORY) →
//   actor + reason + timestamp recorded (history + audit) → public site
//   reflects the decision → reject hides the lawyer → suspend shows the
//   alert state → admin message lands in the lawyer's notification feed.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory. A static
// import would bind the real dev DB — see the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { LawyerProfile } from "@legalir/types";
import type * as DbModule from "../db";
import type * as LawyerDbModule from "../lawyer-db";

type Db = typeof DbModule;
type LawyerDb = typeof LawyerDbModule;

let db: Db;
let lawyerDb: LawyerDb;
let adminId: string;
let adminSession: string;
let lawyerUserId: string;

const LAWYER_ID = "law-integration-1";
const STATUS_URL = "http://localhost/api/v1/admin/lawyers";

let tmpDir: string;
let originalCwd: string;

// Route handlers, imported dynamically so they resolve to the temp DB.
let getQueue: (req: NextRequest) => Promise<Response>;
let getDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let decideVerification: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let sendMessage: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let getPublicLawyer: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** A request authenticated as the seeded admin. */
function adminReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${adminSession}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function anonReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

/** A complete, pending (submitted-but-unreviewed) lawyer profile. */
function pendingLawyerProfile(): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId: lawyerUserId,
    fullName: "سارا احمدی",
    licenseNumber: "۱۲۳۴۵",
    licenseYear: 1400,
    bio: "وکیل پایه یک دادگستری با تمرکز بر حقوق خانواده.",
    avatarUrl: null,
    avatarType: "real",
    professionalTitle: "وکیل پایه یک دادگستری",
    activityType: "INDEPENDENT",
    licenseAuthority: "کانون وکلای مرکز",
    verificationStatus: "UNDER_REVIEW",
    verifiedAt: null,
    verificationNote: null,
    specializations: [{ category: "family", yearsExperience: 8, note: null }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 500_000,
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  lawyerDb = await import("../lawyer-db");

  getQueue = (await import("@/app/api/v1/admin/lawyers/route")).GET as typeof getQueue;
  const detail = await import("@/app/api/v1/admin/lawyers/[id]/route");
  getDetail = detail.GET as typeof getDetail;
  const verification = await import("@/app/api/v1/admin/lawyers/[id]/verification/route");
  decideVerification = verification.POST as typeof decideVerification;
  const messages = await import("@/app/api/v1/admin/lawyers/[id]/messages/route");
  sendMessage = messages.POST as typeof sendMessage;
  const publicRoute = await import("@/app/api/v1/lawyers/[id]/route");
  getPublicLawyer = publicRoute.GET as typeof getPublicLawyer;

  // Admin operator (staff) + a session cookie.
  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
  adminSession = db.createSession(adminId).id;

  // The applicant: a real user row + a pending lawyer profile.
  const applicant = db.createUser({ mobile: "09120000999", passwordHash: "x" });
  lawyerUserId = applicant.id;
  lawyerDb.upsertLawyerProfile(pendingLawyerProfile());
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("admin lawyer verification — full lifecycle", () => {
  it("the queue lists the pending applicant in the REVIEW bucket with a masked mobile", async () => {
    const res = await getQueue(adminReq(`${STATUS_URL}?bucket=REVIEW`));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { items: Record<string, unknown>[] } };
    const row = data.items.find((i) => i["id"] === LAWYER_ID);
    expect(row).toBeDefined();
    expect(row!["bucket"]).toBe("REVIEW");
    expect(String(row!["mobileMasked"])).toContain("•");
    expect(row!["lastDecision"]).toBeNull();
  });

  it("a decision WITHOUT a reason is refused — 400 REASON_REQUIRED, status unchanged", async () => {
    const res = await decideVerification(
      adminReq(`${STATUS_URL}/${LAWYER_ID}/verification`, {
        method: "POST",
        body: JSON.stringify({ status: "VERIFIED" }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("REASON_REQUIRED");
    expect(lawyerDb.getLawyerProfileById(LAWYER_ID)!.verificationStatus).toBe("UNDER_REVIEW");
    expect(lawyerDb.listStatusHistory(LAWYER_ID)).toHaveLength(0);
  });

  it("approving with a reason records actor + reason + timestamp and grants the LAWYER role", async () => {
    const res = await decideVerification(
      adminReq(`${STATUS_URL}/${LAWYER_ID}/verification`, {
        method: "POST",
        body: JSON.stringify({ status: "VERIFIED", reason: "مدارک پروانه بررسی و تأیید شد." }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);

    const profile = lawyerDb.getLawyerProfileById(LAWYER_ID)!;
    expect(profile.verificationStatus).toBe("VERIFIED");

    const history = lawyerDb.listStatusHistory(LAWYER_ID);
    expect(history).toHaveLength(1);
    expect(history[0]!.previousStatus).toBe("UNDER_REVIEW");
    expect(history[0]!.newStatus).toBe("VERIFIED");
    expect(history[0]!.reason).toContain("تأیید");
    expect(history[0]!.actorUserId).toBe(adminId);
    expect(history[0]!.actorName).toBeTruthy();
    expect(Date.parse(history[0]!.createdAt)).not.toBeNaN();

    // The platform audit trail carries the same decision.
    const audit = db.readTable<{ action: string; resourceId: string; reason: string }>(
      "admin_audit_log"
    );
    const entry = audit.find((a) => a.action === "lawyer.verify" && a.resourceId === LAWYER_ID);
    expect(entry).toBeDefined();
    expect(entry!.reason).toContain("تأیید");

    // Verification is the moment the lawyer role is granted.
    expect(db.findUserById(lawyerUserId)!.role).toBe("LAWYER");
  });

  it("the public site now serves the approved lawyer", async () => {
    const res = await getPublicLawyer(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { id: string; availabilityStatus: string } };
    expect(data.id).toBe(LAWYER_ID);
    expect(data.availabilityStatus).not.toBe("SUSPENDED");
  });

  it("the detail dossier exposes the decision history and the masked contact", async () => {
    const res = await getDetail(adminReq(`${STATUS_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: {
        contact: { mobileMasked: string };
        history: unknown[];
        bucket: string;
        stats: { decisions: number };
      };
    };
    expect(data.bucket).toBe("APPROVED");
    expect(data.contact.mobileMasked).toContain("•");
    expect(data.history).toHaveLength(1);
    expect(data.stats.decisions).toBe(1);
  });

  it("an admin message is delivered through the lawyer's notification feed", async () => {
    const res = await sendMessage(
      adminReq(`${STATUS_URL}/${LAWYER_ID}/messages`, {
        method: "POST",
        body: JSON.stringify({
          subject: "تکمیل پروفایل",
          body: "لطفاً عکس پروانه را بارگذاری کنید.",
        }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(201);

    // Persisted against the lawyer profile …
    expect(db.listMessagesForLawyerProfile(LAWYER_ID)).toHaveLength(1);
    // … and surfaced in the SAME derived notification center the app uses.
    const notifications = db.deriveNotifications(lawyerUserId);
    const delivered = notifications.find((n) => n.title === "تکمیل پروفایل");
    expect(delivered).toBeDefined();
    expect(delivered!.category).toBe("personal");
  });

  it("suspending shows the lawyer publicly but marks them unavailable", async () => {
    const res = await decideVerification(
      adminReq(`${STATUS_URL}/${LAWYER_ID}/verification`, {
        method: "POST",
        body: JSON.stringify({
          status: "SUSPENDED",
          reason: "شکایت تخلف حرفه‌ای در حال بررسی است.",
        }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);

    // Still reachable (the alert + reason must be visible) …
    const pub = await getPublicLawyer(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    expect(pub.status).toBe(200);
    const { data } = (await pub.json()) as {
      data: { availabilityStatus: string; acceptingRequests: boolean };
    };
    // … but the derived availability is SUSPENDED and intake is closed, so
    // every public CTA renders disabled.
    expect(data.availabilityStatus).toBe("SUSPENDED");
    expect(data.acceptingRequests).toBe(false);

    // The suspension is the second recorded decision.
    expect(lawyerDb.listStatusHistory(LAWYER_ID)).toHaveLength(2);
  });

  it("rejecting removes the lawyer from the public site — 404", async () => {
    const res = await decideVerification(
      adminReq(`${STATUS_URL}/${LAWYER_ID}/verification`, {
        method: "POST",
        body: JSON.stringify({ status: "REJECTED", reason: "پروانه وکالت معتبر نبود." }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);

    const pub = await getPublicLawyer(
      anonReq(`http://localhost/api/v1/lawyers/${LAWYER_ID}`),
      params(LAWYER_ID)
    );
    expect(pub.status).toBe(404);
  });

  it("the queue search finds the lawyer by name", async () => {
    const res = await getQueue(adminReq(`${STATUS_URL}?search=سارا`));
    const { data } = (await res.json()) as { data: { items: Record<string, unknown>[] } };
    expect(data.items.some((i) => i["id"] === LAWYER_ID)).toBe(true);
  });

  it("an unauthenticated caller is refused at the queue — 401", async () => {
    const res = await getQueue(anonReq(`${STATUS_URL}?bucket=REVIEW`));
    expect(res.status).toBe(401);
  });
});
