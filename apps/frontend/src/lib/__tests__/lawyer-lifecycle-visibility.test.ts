// ============================================================
// LEGALIR — Lawyer lifecycle ↔ public visibility (temp DB)
// ============================================================
// The regression these lock in: an admin "deactivate" / "delete" must stop the
// profile being REACHABLE, not merely drop it from the listing — the direct
// profile URL is public too. And "activate" (restore) must genuinely lift a
// suspension, otherwise the operator sees a success toast while the lawyer
// stays suspended forever and the marketplace keeps showing the alert.
//
// Everything is driven through the real route handlers against an isolated
// temp DB (db.ts binds cwd at import, so modules are imported dynamically
// AFTER chdir — see the team convention).
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
let adminSession: string;
let getPublicLawyer: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let setStatus: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const BASE = "http://localhost/api/v1/lawyers";
const ADMIN_BASE = "http://localhost/api/v1/admin/lawyers";

let tmpDir: string;
let originalCwd: string;
let seq = 0;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function adminReq(url: string, body: unknown): NextRequest {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `legalir-session=${adminSession}` },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function anonReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

/** A fully-verified, publicly-live lawyer profile. */
function verifiedProfile(id: string, overrides: Partial<LawyerProfile> = {}): LawyerProfile {
  const now = new Date().toISOString();
  seq += 1;
  return {
    id,
    userId: `u-${id}`,
    fullName: `وکیل شماره ${seq}`,
    licenseNumber: `${1000 + seq}`,
    licenseYear: 1400,
    bio: "وکیل پایه یک دادگستری.",
    avatarUrl: null,
    avatarType: "real",
    professionalTitle: "وکیل پایه یک دادگستری",
    activityType: "INDEPENDENT",
    licenseAuthority: "کانون وکلای مرکز",
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    verificationNote: null,
    specializations: [{ category: "family", yearsExperience: 5, note: null }],
    locations: [{ province: "تهران", city: "تهران", remote: true }],
    languages: [{ code: "fa", labelFa: "فارسی", proficiency: "native" }],
    pricing: {
      consultationFeeToman: 500_000,
      consultationDurationMinutes: 30,
      hourlyRateToman: null,
      contractReviewFeeToman: null,
      freeFirstConsultation: false,
    },
    availability: [],
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
    visibility: "PUBLIC",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-lifecycle-"));
  process.chdir(tmpDir);

  db = await import("../db");
  lawyerDb = await import("../lawyer-db");
  getPublicLawyer = (await import("@/app/api/v1/lawyers/[id]/route")).GET as typeof getPublicLawyer;
  setStatus = (await import("@/app/api/v1/admin/lawyers/[id]/status/route")).POST as typeof setStatus;

  const admin = db.createUser({ mobile: "09121110000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Pure gate
// ============================================================

describe("isPubliclyViewable", () => {
  it("is true for a verified, public, non-deleted lawyer", () => {
    expect(lawyerDb.isPubliclyViewable(verifiedProfile("g1"))).toBe(true);
  });

  it("is false for a HIDDEN (deactivated) lawyer", () => {
    expect(lawyerDb.isPubliclyViewable(verifiedProfile("g2", { visibility: "HIDDEN" }))).toBe(false);
  });

  it("is false for a soft-deleted lawyer", () => {
    expect(lawyerDb.isPubliclyViewable(verifiedProfile("g3", { deletedAt: "2026-01-01T00:00:00Z" }))).toBe(false);
  });

  it("is false for an unverified/rejected lawyer", () => {
    expect(lawyerDb.isPubliclyViewable(verifiedProfile("g4", { verificationStatus: "REJECTED" }))).toBe(false);
  });

  it("keeps a SUSPENDED lawyer reachable (transparency)", () => {
    expect(lawyerDb.isPubliclyViewable(verifiedProfile("g5", { verificationStatus: "SUSPENDED" }))).toBe(true);
  });
});

describe("adminStatusPatch reactivation", () => {
  it("restores a suspended lawyer to VERIFIED on ACTIVE", () => {
    const suspended = verifiedProfile("g6", { verificationStatus: "SUSPENDED" });
    const patch = lawyerDb.adminStatusPatch("ACTIVE", undefined, suspended);
    expect(patch.verificationStatus).toBe("VERIFIED");
    expect(patch.visibility).toBe("PUBLIC");
    expect(patch.acceptingRequests).toBe(true);
  });

  it("does NOT invent a verification for a never-verified lawyer on ACTIVE", () => {
    const pending = verifiedProfile("g7", { verificationStatus: "UNDER_REVIEW" });
    const patch = lawyerDb.adminStatusPatch("ACTIVE", undefined, pending);
    expect(patch.verificationStatus).toBeUndefined();
  });

  it("an INACTIVE patch hides the profile", () => {
    const patch = lawyerDb.adminStatusPatch("INACTIVE");
    expect(patch.visibility).toBe("HIDDEN");
    expect(patch.acceptingRequests).toBe(false);
  });
});

// ============================================================
// Route-level: the public URL obeys the lifecycle
// ============================================================

describe("public profile URL obeys the operator lifecycle", () => {
  it("deactivating (INACTIVE) makes the direct URL 404", async () => {
    const id = `law-inactive-${seq}`;
    lawyerDb.upsertLawyerProfile(verifiedProfile(id));

    // Live to begin with.
    let res = await getPublicLawyer(anonReq(`${BASE}/${id}`), params(id));
    expect(res.status).toBe(200);

    // Admin deactivates → the listing would drop it, AND the direct URL 404s.
    const deactivate = await setStatus(
      adminReq(`${ADMIN_BASE}/${id}/status`, { status: "INACTIVE" }),
      params(id)
    );
    expect(deactivate.status).toBe(200);

    res = await getPublicLawyer(anonReq(`${BASE}/${id}`), params(id));
    expect(res.status).toBe(404);
  });

  it("deleting makes the direct URL 404", async () => {
    const id = `law-deleted-${seq}`;
    lawyerDb.upsertLawyerProfile(verifiedProfile(id));
    const del = await setStatus(
      adminReq(`${ADMIN_BASE}/${id}/status`, { status: "DELETED", reason: "حذف به درخواست خود وکیل" }),
      params(id)
    );
    expect(del.status).toBe(200);
    const res = await getPublicLawyer(anonReq(`${BASE}/${id}`), params(id));
    expect(res.status).toBe(404);
  });

  it("suspending then re-activating truly restores public service", async () => {
    const id = `law-restore-${seq}`;
    lawyerDb.upsertLawyerProfile(verifiedProfile(id));

    // Suspend → reachable but unavailable + flagged.
    const suspend = await setStatus(
      adminReq(`${ADMIN_BASE}/${id}/status`, { status: "SUSPENDED", reason: "بررسی شکایت" }),
      params(id)
    );
    expect(suspend.status).toBe(200);
    let res = await getPublicLawyer(anonReq(`${BASE}/${id}`), params(id));
    expect(res.status).toBe(200);
    let body = (await res.json()) as { data: { availabilityStatus: string; verificationStatus: string } };
    expect(body.data.availabilityStatus).toBe("SUSPENDED");
    expect(body.data.verificationStatus).toBe("SUSPENDED");

    // Reactivate → the suspension is lifted, not just the availability flag.
    const activate = await setStatus(
      adminReq(`${ADMIN_BASE}/${id}/status`, { status: "ACTIVE" }),
      params(id)
    );
    expect(activate.status).toBe(200);
    expect(lawyerDb.getLawyerProfileById(id)!.verificationStatus).toBe("VERIFIED");

    res = await getPublicLawyer(anonReq(`${BASE}/${id}`), params(id));
    expect(res.status).toBe(200);
    body = (await res.json()) as { data: { availabilityStatus: string; verificationStatus: string } };
    expect(body.data.availabilityStatus).not.toBe("SUSPENDED");
    expect(body.data.verificationStatus).toBe("VERIFIED");

    // The suspension + the lift are both on the append-only timeline.
    const history = lawyerDb.listStatusHistory(id);
    expect(history.map((h) => h.newStatus)).toEqual(["VERIFIED", "SUSPENDED"]);
  });
});
