// ============================================================
// LEGALIR — Demo-lawyer production isolation (temp DB)
// ============================================================
// The seeded «نمونه» (demo) lawyers exist so the marketplace has something to
// look at in development. They must NEVER reach a real environment. The brief
// (§2) demands that test data and real data be separated at the env/API level,
// not merely hidden in the UI.
//
// This drives the same gates the public surface uses, against an isolated temp
// DB, with NODE_ENV toggled per-case:
//
//   · NODE_ENV=production  → demo rows vanish from the public listing, their
//                            detail URL 404s, `isPubliclyViewable` is false,
//                            and `demoLawyersVisible()` is false — while the
//                            admin dossier (listLawyerProfiles) still sees them.
//   · NODE_ENV=development → the demo row is visible again (the dev preview),
//                            proving the gate flips with the environment.
//
// db.ts binds its store from cwd at import time, so every module is imported
// DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { LawyerProfile } from "@legalir/types";
import type * as LawyerDbModule from "../lawyer-db";

type LawyerDb = typeof LawyerDbModule;

let lawyerDb: LawyerDb;

let getPublic: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

const DEMO_ID = "law-demo-1";
const REAL_ID = "law-real-1";

let tmpDir: string;
let originalCwd: string;
let originalNodeEnv: string | undefined;

/**
 * Read/write NODE_ENV through a mutable record. `process.env.NODE_ENV` is typed
 * read-only and reachable only by index, so this is the one honest way to flip
 * it per-case in the test.
 */
function setNodeEnv(value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env["NODE_ENV"];
  else env["NODE_ENV"] = value;
}

function anonReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** A VERIFIED, publicly viewable profile, demo flag parameterised. */
function profile(id: string, fullName: string, isDemo: boolean): LawyerProfile {
  const now = new Date().toISOString();
  return {
    id,
    userId: `user-${id}`,
    fullName,
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
    isDemo,
    acceptingRequests: true,
    createdAt: now,
    updatedAt: now,
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  originalNodeEnv = process.env["NODE_ENV"];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-demo-"));
  process.chdir(tmpDir);

  lawyerDb = await import("../lawyer-db");

  const pub = await import("@/app/api/v1/lawyers/[id]/route");
  getPublic = pub.GET as typeof getPublic;

  lawyerDb.upsertLawyerProfile(profile(DEMO_ID, "نمونهٔ وکیل (دمو)", true));
  lawyerDb.upsertLawyerProfile(profile(REAL_ID, "مریم وکیلی", false));
});

afterEach(() => {
  setNodeEnv(originalNodeEnv);
});

afterAll(() => {
  setNodeEnv(originalNodeEnv);
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("demo lawyers — production isolation gate", () => {
  it("in PRODUCTION the demo lawyer is invisible everywhere public, but real lawyers and the admin pool are unaffected", async () => {
    setNodeEnv("production");

    // The env gate itself.
    expect(lawyerDb.demoLawyersVisible()).toBe(false);

    // The public listing excludes the demo row but keeps the real one.
    const list = lawyerDb.queryLawyers({});
    const ids = list.items.map((l) => l.id);
    expect(ids).toContain(REAL_ID);
    expect(ids).not.toContain(DEMO_ID);

    // The public detail gate and the actual route agree.
    expect(lawyerDb.isPubliclyViewable(lawyerDb.getLawyerProfileById(DEMO_ID)!)).toBe(false);
    const demoRes = await getPublic(anonReq(`http://localhost/api/v1/lawyers/${DEMO_ID}`), params(DEMO_ID));
    expect(demoRes.status).toBe(404);
    const realRes = await getPublic(anonReq(`http://localhost/api/v1/lawyers/${REAL_ID}`), params(REAL_ID));
    expect(realRes.status).toBe(200);

    // Admins still manage demo rows — the dossier is NOT gated.
    const adminPool = lawyerDb.listLawyerProfiles().map((l) => l.id);
    expect(adminPool).toContain(DEMO_ID);
    expect(adminPool).toContain(REAL_ID);
  });

  it("outside PRODUCTION the demo lawyer is visible again so the dev preview works", async () => {
    setNodeEnv("development");

    expect(lawyerDb.demoLawyersVisible()).toBe(true);
    expect(lawyerDb.queryLawyers({}).items.map((l) => l.id)).toContain(DEMO_ID);
    expect(lawyerDb.isPubliclyViewable(lawyerDb.getLawyerProfileById(DEMO_ID)!)).toBe(true);

    const res = await getPublic(anonReq(`http://localhost/api/v1/lawyers/${DEMO_ID}`), params(DEMO_ID));
    expect(res.status).toBe(200);
  });
});
