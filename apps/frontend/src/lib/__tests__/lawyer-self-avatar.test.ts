// ============================================================
// LEGALIR — Lawyer SELF-service avatar · route-level (temp DB)
// ============================================================
// A lawyer editing their OWN professional portrait must write the SAME
// profile row the admin panel edits — so the change is visible on the
// public marketplace. This drives the real route handlers against an
// isolated temp DB:
//
//   · an upload sets avatarType "real" + the stored URL, and the PUBLIC
//     `GET /api/v1/lawyers/[id]` reflects it (the "همه جا" guarantee);
//   · regenerate mints a demo SVG;
//   · a signed-in user with NO lawyer profile is refused (403);
//   · an unauthenticated caller is refused (401);
//   · SVG is refused (400).
//
// `db.ts` resolves its store from the cwd at import time, so every module
// is imported DYNAMICALLY after chdir into a throwaway directory.
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
let lawyerUserId: string;
let lawyerSession: string;
let nonLawyerSession: string;

const LAWYER_ID = "law-self-1";
const AVATAR_URL = "http://localhost/api/v1/lawyer/avatar";

let tmpDir: string;
let originalCwd: string;

let patchAvatar: (req: NextRequest) => Promise<Response>;
let getPublicLawyer: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string | null, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: `legalir-session=${session}` } : {}),
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

/** A verified lawyer profile owned by `userId`. */
function lawyerProfile(userId: string): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id: LAWYER_ID,
    userId,
    fullName: "سارا احمدی",
    licenseNumber: "۱۲۳۴۵",
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
  } as LawyerProfile;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-self-"));
  process.chdir(tmpDir);

  db = await import("../db");
  lawyerDb = await import("../lawyer-db");

  patchAvatar = (await import("@/app/api/v1/lawyer/avatar/route")).PATCH as typeof patchAvatar;
  getPublicLawyer = (await import("@/app/api/v1/lawyers/[id]/route")).GET as typeof getPublicLawyer;

  // A lawyer: real user row + session + a verified profile.
  const applicant = db.createUser({ mobile: "09120000888", passwordHash: "x" });
  lawyerUserId = applicant.id;
  lawyerSession = db.createSession(lawyerUserId).id;
  lawyerDb.upsertLawyerProfile(lawyerProfile(lawyerUserId));

  // A plain user with NO lawyer profile.
  const plain = db.createUser({ mobile: "09120000777", passwordHash: "x" });
  nonLawyerSession = db.createSession(plain.id).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("PATCH /api/v1/lawyer/avatar (self-service)", () => {
  it("refuses an unauthenticated caller (401)", async () => {
    const res = await patchAvatar(
      req(AVATAR_URL, null, { method: "PATCH", body: JSON.stringify({ regenerate: true }) })
    );
    expect(res.status).toBe(401);
  });

  it("refuses a signed-in user with no lawyer profile (403)", async () => {
    const res = await patchAvatar(
      req(AVATAR_URL, nonLawyerSession, {
        method: "PATCH",
        body: JSON.stringify({ regenerate: true }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("regenerate mints a demo avatar on the caller's own profile", async () => {
    const res = await patchAvatar(
      req(AVATAR_URL, lawyerSession, { method: "PATCH", body: JSON.stringify({ regenerate: true }) })
    );
    expect(res.status).toBe(200);
    const profile = lawyerDb.getLawyerProfileById(LAWYER_ID)!;
    expect(profile.avatarType).toBe("demo");
    expect(profile.avatarUrl ?? "").toContain("data:image/svg+xml");
  });

  it("refuses an unsupported format (SVG) with 400 and leaves the profile untouched", async () => {
    const before = lawyerDb.getLawyerProfileById(LAWYER_ID)!.avatarUrl;
    const res = await patchAvatar(
      req(AVATAR_URL, lawyerSession, {
        method: "PATCH",
        body: JSON.stringify({ avatarData: "AAAA", avatarFormat: "image/svg+xml" }),
      })
    );
    expect(res.status).toBe(400);
    expect(lawyerDb.getLawyerProfileById(LAWYER_ID)!.avatarUrl).toBe(before);
  });

  it("an upload persists bytes, sets avatarType 'real', and the PUBLIC profile reflects it", async () => {
    // A 1×1 PNG.
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = await patchAvatar(
      req(AVATAR_URL, lawyerSession, {
        method: "PATCH",
        body: JSON.stringify({ avatarData: png, avatarFileName: "p.png", avatarFormat: "image/png" }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { avatarUrl: string | null; avatarType: string } };
    expect(body.data.avatarType).toBe("real");
    expect(body.data.avatarUrl).toBe(`/api/v1/lawyers/${LAWYER_ID}/avatar`);

    // The bytes really landed on disk under the private root.
    const stored = path.resolve(tmpDir, ".data", "lawyer-avatars", `${LAWYER_ID}.png`);
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.readFileSync(stored).length).toBeGreaterThan(0);

    // …and the PUBLIC profile (same row) now advertises the stored URL —
    // this is the "همه جا نمایش داده شود" guarantee.
    const pub = await getPublicLawyer(
      new Request(`http://localhost/api/v1/lawyers/${LAWYER_ID}`) as unknown as NextRequest,
      params(LAWYER_ID)
    );
    expect(pub.status).toBe(200);
    const pubBody = (await pub.json()) as { data: { avatarUrl: string | null; avatarType: string } };
    expect(pubBody.data.avatarUrl).toBe(`/api/v1/lawyers/${LAWYER_ID}/avatar`);
    expect(pubBody.data.avatarType).toBe("real");
  });
});
