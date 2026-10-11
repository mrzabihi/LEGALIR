// ============================================================
// LEGALIR — Admin-set lawyer avatar · "everywhere" (temp DB)
// ============================================================
// An avatar applied by an OPERATOR in the admin panel must reach every
// surface that renders a lawyer's portrait — the panel's own queue + dossier,
// and the PUBLIC marketplace list / profile / served bytes. This drives the
// real route handlers against an isolated temp DB and asserts the SAME
// avatarUrl on all of them, plus the audit trail:
//
//   PATCH /api/v1/admin/lawyers/[id]/avatar  (upload | regenerate | clear)
//     → admin queue item, admin dossier profile
//     → public list item, public detail, GET …/avatar bytes
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory.
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

const LAWYER_ID = "law-admin-1";
const ADMIN_URL = "http://localhost/api/v1/admin/lawyers";
const PUBLIC_URL = "http://localhost/api/v1/lawyers";
const EXPECTED_PATH = `/api/v1/lawyers/${LAWYER_ID}/avatar`;
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
// A different 1×1 PNG so a re-upload changes the bytes (and thus the version).
const PNG_BASE64_ALT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** The stored URL is content-versioned; assert the path + version token. */
function expectStoredUrl(url: string | null | undefined) {
  expect(typeof url).toBe("string");
  expect(url!.startsWith(`${EXPECTED_PATH}?v=`)).toBe(true);
}

let tmpDir: string;
let originalCwd: string;

let patchAvatar: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let getAdminQueue: (req: NextRequest) => Promise<Response>;
let getAdminDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let getPublicList: (req: NextRequest) => Promise<Response>;
let getPublicLawyer: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let getPublicAvatarBytes: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

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

/** A VERIFIED lawyer so it appears in the public (verified-only) listing. */
function verifiedLawyerProfile(userId: string): LawyerProfile {
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-admin-avatar-"));
  process.chdir(tmpDir);

  db = await import("../db");
  lawyerDb = await import("../lawyer-db");

  patchAvatar = (await import("@/app/api/v1/admin/lawyers/[id]/avatar/route"))
    .PATCH as typeof patchAvatar;
  getAdminQueue = (await import("@/app/api/v1/admin/lawyers/route")).GET as typeof getAdminQueue;
  getAdminDetail = (await import("@/app/api/v1/admin/lawyers/[id]/route"))
    .GET as typeof getAdminDetail;
  getPublicList = (await import("@/app/api/v1/lawyers/route")).GET as typeof getPublicList;
  getPublicLawyer = (await import("@/app/api/v1/lawyers/[id]/route"))
    .GET as typeof getPublicLawyer;
  getPublicAvatarBytes = (await import("@/app/api/v1/lawyers/[id]/avatar/route"))
    .GET as typeof getPublicAvatarBytes;

  // The operator: a staff user with a session.
  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
  adminSession = db.createSession(adminId).id;

  // The lawyer: a real user row + a VERIFIED profile.
  const applicant = db.createUser({ mobile: "09120000999", passwordHash: "x" });
  lawyerUserId = applicant.id;
  lawyerDb.upsertLawyerProfile(verifiedLawyerProfile(lawyerUserId));
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("admin-set lawyer avatar reaches every surface", () => {
  it("refuses an unauthenticated caller (401)", async () => {
    const res = await patchAvatar(anonReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`), params(LAWYER_ID));
    expect(res.status).toBe(401);
  });

  it("an upload writes the profile row, stores the bytes, and records the audit", async () => {
    const res = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({
          avatarData: PNG_BASE64,
          avatarFileName: "portrait.png",
          avatarFormat: "image/png",
          reason: "پرترهٔ رسمی ارسال‌شده توسط وکیل",
        }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { avatarUrl: string | null; avatarType: string } };
    expect(body.data.avatarType).toBe("real");
    expectStoredUrl(body.data.avatarUrl);

    // Bytes really landed on disk under the private root.
    const stored = path.resolve(tmpDir, ".data", "lawyer-avatars", `${LAWYER_ID}.png`);
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.readFileSync(stored).length).toBeGreaterThan(0);

    // Audit trail carries the change, attributed to the operator.
    const audit = db.readTable<{ action: string; resourceId: string; actorUserId: string }>(
      "admin_audit_log"
    );
    const entry = audit.find(
      (a) => a.action === "LAWYER_CHANGE_AVATAR" && a.resourceId === LAWYER_ID
    );
    expect(entry).toBeDefined();
    expect(entry!.actorUserId).toBe(adminId);
  });

  it("the admin queue item carries the new portrait", async () => {
    const res = await getAdminQueue(adminReq(ADMIN_URL));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { items: Record<string, unknown>[] } };
    const row = data.items.find((i) => i["id"] === LAWYER_ID);
    expect(row).toBeDefined();
    expectStoredUrl(row!["avatarUrl"] as string | null);
    expect(row!["avatarType"]).toBe("real");
  });

  it("the admin dossier profile carries the new portrait", async () => {
    const res = await getAdminDetail(adminReq(`${ADMIN_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { profile: { avatarUrl: string | null; avatarType: string } };
    };
    expectStoredUrl(data.profile.avatarUrl);
    expect(data.profile.avatarType).toBe("real");
  });

  it("the PUBLIC marketplace list shows the new portrait", async () => {
    const res = await getPublicList(anonReq(PUBLIC_URL));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { items: Record<string, unknown>[] } };
    const row = data.items.find((i) => i["id"] === LAWYER_ID);
    expect(row).toBeDefined();
    expectStoredUrl(row!["avatarUrl"] as string | null);
    expect(row!["avatarType"]).toBe("real");
  });

  it("the PUBLIC profile shows the new portrait", async () => {
    const res = await getPublicLawyer(anonReq(`${PUBLIC_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { avatarUrl: string | null; avatarType: string };
    };
    expectStoredUrl(data.avatarUrl);
    expect(data.avatarType).toBe("real");
  });

  it("the stored bytes are publicly served as an image", async () => {
    const res = await getPublicAvatarBytes(
      anonReq(`${PUBLIC_URL}/${LAWYER_ID}/avatar`),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/png/);
    expect(Number(res.headers.get("content-length"))).toBeGreaterThan(0);
  });

  it("the exact versioned URL stored on the row serves the image (the <img src> the UI renders)", async () => {
    // What the admin table / drawer will put in `<img src={avatarUrl}>` — the
    // versioned URL must resolve to real bytes, not 404, or the fallback chips.
    const storedUrl = lawyerDb.getLawyerProfileById(LAWYER_ID)!.avatarUrl;
    expectStoredUrl(storedUrl);
    const res = await getPublicAvatarBytes(
      anonReq(`http://localhost${storedUrl}`),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/png/);
  });

  it("regenerate mints a demo portrait that also reaches the public surfaces", async () => {
    const res = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ regenerate: true }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { avatarUrl: string | null; avatarType: string } };
    expect(body.data.avatarType).toBe("demo");
    expect(body.data.avatarUrl ?? "").toContain("data:image/svg+xml");

    // The prior upload was replaced, so its bytes are gone from disk …
    const stored = path.resolve(tmpDir, ".data", "lawyer-avatars", `${LAWYER_ID}.png`);
    expect(fs.existsSync(stored)).toBe(false);
    // … and the public profile reflects the demo portrait.
    const pub = await getPublicLawyer(anonReq(`${PUBLIC_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    const { data } = (await pub.json()) as { data: { avatarType: string } };
    expect(data.avatarType).toBe("demo");
  });

  it("clearing the portrait removes it from the public surfaces", async () => {
    const res = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: null, avatarType: "demo" }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { avatarUrl: string | null } };
    expect(body.data.avatarUrl).toBeNull();

    const pub = await getPublicLawyer(anonReq(`${PUBLIC_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    const { data } = (await pub.json()) as { data: { avatarUrl: string | null } };
    expect(data.avatarUrl).toBeNull();
  });

  it("re-uploading a DIFFERENT portrait yields a NEW versioned URL and replaces the file", async () => {
    // Upload #1 …
    const first = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({
          avatarData: PNG_BASE64,
          avatarFileName: "a.png",
          avatarFormat: "image/png",
        }),
      }),
      params(LAWYER_ID)
    );
    const firstUrl = ((await first.json()) as { data: { avatarUrl: string } }).data.avatarUrl;
    expectStoredUrl(firstUrl);
    const storedPath = path.resolve(tmpDir, ".data", "lawyer-avatars", `${LAWYER_ID}.png`);
    const firstBytes = fs.readFileSync(storedPath);

    // … upload #2 with DIFFERENT bytes.
    const second = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({
          avatarData: PNG_BASE64_ALT,
          avatarFileName: "b.png",
          avatarFormat: "image/png",
        }),
      }),
      params(LAWYER_ID)
    );
    const secondUrl = ((await second.json()) as { data: { avatarUrl: string } }).data.avatarUrl;
    expectStoredUrl(secondUrl);

    // The URL CHANGED — this is what stops the browser cache / a reconciled
    // <img> from showing the old portrait ("آواتار قبلی برمی‌گردد").
    expect(secondUrl).not.toBe(firstUrl);
    // … and the row now stores the NEW url on every read surface.
    const detail = await getAdminDetail(adminReq(`${ADMIN_URL}/${LAWYER_ID}`), params(LAWYER_ID));
    const detailUrl = ((await detail.json()) as { data: { profile: { avatarUrl: string } } }).data
      .profile.avatarUrl;
    expect(detailUrl).toBe(secondUrl);
    // … and the file on disk was actually replaced (not left stale), with one file.
    expect(fs.existsSync(storedPath)).toBe(true);
    expect(fs.readFileSync(storedPath)).not.toEqual(firstBytes);
    expect(
      fs.readdirSync(path.resolve(tmpDir, ".data", "lawyer-avatars")).filter((f) =>
        f.startsWith(LAWYER_ID)
      ).length
    ).toBe(1);
  });

  it("re-uploading the SAME bytes keeps the same URL (idempotent)", async () => {
    const a = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ avatarData: PNG_BASE64, avatarFormat: "image/png" }),
      }),
      params(LAWYER_ID)
    );
    const urlA = ((await a.json()) as { data: { avatarUrl: string } }).data.avatarUrl;
    const b = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ avatarData: PNG_BASE64, avatarFormat: "image/png" }),
      }),
      params(LAWYER_ID)
    );
    const urlB = ((await b.json()) as { data: { avatarUrl: string } }).data.avatarUrl;
    expect(urlB).toBe(urlA);
  });

  it("refuses an SVG upload (400) and leaves the profile untouched", async () => {
    const before = lawyerDb.getLawyerProfileById(LAWYER_ID)!.avatarUrl;
    const res = await patchAvatar(
      adminReq(`${ADMIN_URL}/${LAWYER_ID}/avatar`, {
        method: "PATCH",
        body: JSON.stringify({ avatarData: "AAAA", avatarFormat: "image/svg+xml" }),
      }),
      params(LAWYER_ID)
    );
    expect(res.status).toBe(400);
    expect(lawyerDb.getLawyerProfileById(LAWYER_ID)!.avatarUrl).toBe(before);
  });
});
