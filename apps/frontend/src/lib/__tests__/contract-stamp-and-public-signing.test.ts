// @vitest-environment node
// ============================================================
// LEGALIR — Official stamp + public (token-scoped) signing · END-TO-END
// ============================================================
// These capabilities are new and carry hard security/legal invariants,
// so they are proven at the ROUTE layer against an isolated temp DB:
//
//   • the OFFICIAL stamp surface is Super-Admin-only: a plain user is
//     refused (403) on both the read and the manage endpoints, and every
//     action carries a mandatory reason
//   • a stamp request binds the CURRENT version hash AND the exact stamp
//     master bytes; an APPLIED request whose hash moved on is STALE and a
//     request bound to swapped stamp bytes is refused (STAMP_ASSET_CHANGED)
//   • `currentVersionStamp` is the single gate: it returns the applied
//     request only while both bindings still hold
//   • the stamp master is PRIVATE — `reviewStampInfo` never returns a path
//     and there is no `public/` URL for it
//   • the real PNG master is drawn on the A4 document (multi-page) and a
//     hash that does not match the master falls back, never draws a foreign mark
//   • online signing is disabled per contract type (sale/vehicle) and the
//     refusal is surfaced with the policy's own Persian note — on the
//     owner route AND the public token route
//   • a public token LOCKS the invited participant (a crafted body cannot
//     sign another party) and is consumed only on a terminal act
//
// `db.ts` resolves its store from the cwd at import time, so every module
// is imported DYNAMICALLY after chdir (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  ContractParty,
  PropertyContract,
  SignatureInvitation,
  SignatureParticipant,
  SignatureRequest,
} from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";
import type * as StampReviewModule from "../contracts/stamp-review";
import type * as StampAssetModule from "../contracts/stamp-asset";
import type * as RegistryModule from "../contracts/registry";
import type * as AdminReviewModule from "../contracts/admin-review";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;
type StampReview = typeof StampReviewModule;
type StampAsset = typeof StampAssetModule;
type Registry = typeof RegistryModule;
type AdminReview = typeof AdminReviewModule;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;
let stampReview: StampReview;
let stampAsset: StampAsset;
let registry: Registry;
let adminReview: AdminReview;

let ownerSession: string;
let ownerId: string;
let otherSession: string;
let adminSession: string;
let rentData: PropertyContract["data"];
let saleData: PropertyContract["data"];

let tmpDir: string;
let originalCwd: string;

/** The real, on-disk stamp master (byte-for-byte the approved reference). */
const REAL_STAMP_SHA256 =
  "129352b0ba24626b82d8b929d2df871251d96f1c88d920bff16fdf49e449e1c8";

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id?: string; token?: string }> }
) => Promise<Response>;

let reviewPost: RouteHandler;
let adminPost: RouteHandler;
let signPost: RouteHandler;
let invitationsRoute: { POST: RouteHandler; GET: RouteHandler; DELETE: RouteHandler };
let invitationTokenRoute: { GET: RouteHandler; POST: RouteHandler };
let invitationStampAssetRoute: RouteHandler;
let stampGet: RouteHandler;
let stampPost: RouteHandler;
let adminPdfGet: RouteHandler;
let detailGet: RouteHandler;
let evidenceGet: RouteHandler;
let evidencePost: RouteHandler;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function tokenParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

function req(url: string, session: string | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers["cookie"] = `legalir-session=${session}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function getReq(url: string, session: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (session) headers["cookie"] = `legalir-session=${session}`;
  return new Request(url, { method: "GET", headers }) as unknown as NextRequest;
}

/**
 * A GET whose handler reads `request.nextUrl` (the PDF route resolves the
 * `?version=` parameter through it). A bare `Request` has no `nextUrl`, so
 * the route would throw before it ever reached its own logic.
 */
function getReqWithUrl(url: string, session: string | null): NextRequest {
  const request = getReq(url, session);
  (request as unknown as { nextUrl: URL }).nextUrl = new URL(url);
  return request;
}

/** A multipart POST carrying a session cookie (evidence upload). */
function multipartReq(url: string, session: string, form: FormData): NextRequest {
  return new Request(url, {
    method: "POST",
    headers: { cookie: `legalir-session=${session}` },
    body: form,
  }) as unknown as NextRequest;
}

async function json<T = { data: unknown }>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/**
 * Run `fn` with the REPO as cwd, then return to the temp DB.
 *
 * The suite `chdir`s into a temp directory so the JSON store stays
 * isolated. The store's own path is captured at module-import time, so
 * moving back does NOT redirect reads — but the PDF renderer resolves the
 * Vazirmatn font from `process.cwd()`, and there is no font inside the
 * temp dir. Without this the route can only ever answer PDF_FAILED.
 */
async function withRepoCwd<T>(fn: () => Promise<T>): Promise<T> {
  process.chdir(originalCwd);
  try {
    return await fn();
  } finally {
    process.chdir(tmpDir);
  }
}

function party(
  contractId: string,
  role: ContractParty["role"],
  mobile: string,
  initiator = false
): ContractParty {
  return {
    id: `pty-${contractId}-${role}`,
    contractId,
    role,
    capacity: "owner",
    identity: {
      firstName: "مریم",
      lastName: "محمدی",
      fatherName: "علی",
      nationalId: "0012345678",
      birthCertificateNumber: "1234",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile,
      address: "تهران، خیابان ولیعصر",
      postalCode: "1234567890",
    },
    personKind: "natural",
    nationality: "iranian",
    representativeOfPartyId: null,
    representativePositionFa: "",
    ownershipShare: null,
    powerOfAttorney: null,
    banking: null,
    isInitiator: initiator,
    createdAt: new Date().toISOString(),
  };
}

function seedContract(
  id: string,
  data: PropertyContract["data"],
  type: PropertyContract["type"] = "property_rent",
  typeFa = "اجاره‌نامه",
  initiatorRole = "landlord"
): PropertyContract {
  const now = new Date().toISOString();
  return {
    id,
    referenceCode: `LGL-${id.slice(-6).toUpperCase()}`,
    userId: ownerId,
    domain: "property",
    type,
    typeFa,
    state: "READY_FOR_REVIEW",
    initiatorRole,
    initiatorSide: "first",
    title: "قرارداد نمونه",
    currentStep: "review",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data,
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${id}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as PropertyContract;
}

const BASE = "http://localhost/api/v1/property-contracts";
const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";
const INVITATIONS_BASE = "http://localhost/api/v1/contract-invitations";

/** Seed a rent contract and drive it through the compulsory admin review. */
async function seedApprovedContract(id: string): Promise<void> {
  contractDb.insertContract(seedContract(id, rentData));
  contractDb.upsertParty(party(id, "landlord", "09121110001", true));
  contractDb.upsertParty(party(id, "tenant", "09121110002"));

  const submitted = await reviewPost(
    req(`${BASE}/${id}/review`, ownerSession, { action: "submit_admin" }),
    params(id)
  );
  expect(submitted.status).toBe(200);
  const approved = await adminPost(
    req(`${ADMIN_BASE}/${id}`, adminSession, { action: "approve" }),
    params(id)
  );
  expect(approved.status).toBe(200);
}

/**
 * Drive BOTH parties through the real OTP signature flow, so a later stamp
 * `apply` is judged against genuine completed signatures.
 *
 * The route's rule is that the admin seal comes AFTER the parties sign; a
 * fixture that skipped this step would only prove the route's refusal, not
 * the happy path. `create_request` freezes a NEW version, so this must run
 * BEFORE the stamp request is opened — otherwise the request binds to a
 * hash that the signature step then replaces.
 */
async function completeSignatures(id: string): Promise<void> {
  const created = await signPost(
    req(`${BASE}/${id}/sign`, ownerSession, { action: "create_request" }),
    params(id)
  );
  if (created.status !== 200) {
    throw new Error(`create_request failed: ${created.status} ${await created.text()}`);
  }
  const { data } = await json<{
    data: { request: { participants: { id: string; roleFa: string }[] } };
  }>(created);

  for (const participant of data.request.participants) {
    const sent = await signPost(
      req(`${BASE}/${id}/sign`, ownerSession, {
        action: "request_otp",
        participantId: participant.id,
      }),
      params(id)
    );
    if (sent.status !== 200) {
      throw new Error(
        `request_otp failed for ${participant.roleFa}: ${sent.status} ${await sent.text()}`
      );
    }
    const signed = await signPost(
      req(`${BASE}/${id}/sign`, ownerSession, {
        action: "verify_otp",
        participantId: participant.id,
        code: "405405",
        consentGiven: true,
      }),
      params(id)
    );
    if (signed.status !== 200) {
      throw new Error(
        `verify_otp failed for ${participant.roleFa}: ${signed.status} ${await signed.text()}`
      );
    }
  }
}

/** The current version hash of a seeded contract. */
function currentHash(id: string): string {
  const contract = contractDb.getContractById(id)!;
  return contractDb.getVersion(id, contract.currentVersionId!)!.documentHash;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-stamp-signing-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  signatureDb = await import("../contracts/signature/db");
  stampReview = await import("../contracts/stamp-review");
  stampAsset = await import("../contracts/stamp-asset");
  adminReview = await import("../contracts/admin-review");
  registry = await import("../contracts/registry");

  rentData = registry.getContractDefinition("property_rent").createDefaultData("apartment");
  saleData = registry.getContractDefinition("property_sale").createDefaultData("apartment");

  const owner = db.createUser({ mobile: "09120000111", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const other = db.createUser({ mobile: "09120000222", passwordHash: "x" });
  otherSession = db.createSession(other.id).id;

  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  reviewPost = (await import("@/app/api/v1/property-contracts/[id]/review/route"))
    .POST as unknown as RouteHandler;
  adminPost = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .POST as unknown as RouteHandler;
  signPost = (await import("@/app/api/v1/property-contracts/[id]/sign/route"))
    .POST as unknown as RouteHandler;
  invitationsRoute = (await import("@/app/api/v1/property-contracts/[id]/invitations/route")) as unknown as {
    POST: RouteHandler;
    GET: RouteHandler;
    DELETE: RouteHandler;
  };
  invitationTokenRoute = (await import("@/app/api/v1/contract-invitations/[token]/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
  invitationStampAssetRoute = (
    await import("@/app/api/v1/contract-invitations/[token]/stamp-asset/[kind]/route")
  ).GET as unknown as RouteHandler;
  const stampRoute = (await import("@/app/api/v1/admin/contracts/[id]/stamp/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
  stampGet = stampRoute.GET;
  stampPost = stampRoute.POST;
  adminPdfGet = (await import("@/app/api/v1/admin/contracts/[id]/pdf/route"))
    .GET as unknown as RouteHandler;
  detailGet = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .GET as unknown as RouteHandler;
  const evidenceRoute = (await import("@/app/api/v1/admin/contracts/[id]/evidence/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
  evidenceGet = evidenceRoute.GET;
  evidencePost = evidenceRoute.POST;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// The stamp master — real bytes, private by construction
// ============================================================

describe("stamp master — integrity and privacy", () => {
  it("is the byte-identical reference master, not a substitute", () => {
    const info = stampAsset.reviewStampInfo();
    expect(info.available).toBe(true);
    expect(info.sha256).toBe(REAL_STAMP_SHA256);
    expect(info.sizeBytes).toBeGreaterThan(0);
  });

  it("never exposes a filesystem path or a public URL", () => {
    const serialized = JSON.stringify(stampAsset.reviewStampInfo());
    expect(serialized).not.toContain("public");
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);
    expect(serialized).not.toMatch(/\/(assets|legalir)\//);
  });
});

// ============================================================
// Super-Admin-only stamp surface
// ============================================================

describe("official stamp — access control", () => {
  const ID = "ctr-stamp-acl";

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("refuses a non-Super-Admin on the read endpoint (403)", async () => {
    const res = await stampGet(getReq(`${ADMIN_BASE}/${ID}/stamp`, otherSession), params(ID));
    expect(res.status).toBe(403);
    expect((await json<{ code: string }>(res)).code).toBe("FORBIDDEN");
  });

  it("refuses a non-Super-Admin on the manage endpoint (403)", async () => {
    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, otherSession, { action: "request", reason: "دلیل" }),
      params(ID)
    );
    expect(res.status).toBe(403);
  });

  it("requires an action and a reason", async () => {
    const noAction = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { reason: "دلیل" }),
      params(ID)
    );
    expect(noAction.status).toBe(400);
    expect((await json<{ code: string }>(noAction)).code).toBe("ACTION_REQUIRED");

    const noReason = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request" }),
      params(ID)
    );
    expect(noReason.status).toBe(400);
    expect((await json<{ code: string }>(noReason)).code).toBe("REASON_REQUIRED");

    const unknown = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "nope", reason: "دلیل معتبر" }),
      params(ID)
    );
    expect(unknown.status).toBe(400);
    expect((await json<{ code: string }>(unknown)).code).toBe("UNKNOWN_ACTION");
  });

  it("refuses every action when CONTRACT_STAMP_ENABLED is off (409)", async () => {
    const previous = process.env["CONTRACT_STAMP_ENABLED"];
    process.env["CONTRACT_STAMP_ENABLED"] = "0";
    try {
      const res = await stampPost(
        req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
        params(ID)
      );
      expect(res.status).toBe(409);
      expect((await json<{ code: string }>(res)).code).toBe("FEATURE_DISABLED");

      // The read endpoint still reports the flag as off (UI can hide the surface).
      const read = await stampGet(getReq(`${ADMIN_BASE}/${ID}/stamp`, adminSession), params(ID));
      expect(read.status).toBe(200);
      expect((await json<{ data: { featureEnabled: boolean } }>(read)).data.featureEnabled).toBe(false);
    } finally {
      if (previous === undefined) delete process.env["CONTRACT_STAMP_ENABLED"];
      else process.env["CONTRACT_STAMP_ENABLED"] = previous;
    }
  });
});

// ============================================================
// The double binding: version hash AND stamp-asset bytes
// ============================================================

describe("official stamp — request → apply binds hash + asset bytes", () => {
  const ID = "ctr-stamp-apply";

  beforeAll(async () => {
    await seedApprovedContract(ID);
    // The seal comes after the parties sign: complete both signatures
    // FIRST, because `create_request` freezes the version the stamp
    // request must then bind to.
    await completeSignatures(ID);
  });

  it("binds a PENDING request to the current version hash and asset bytes", async () => {
    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
        action: "request",
        reason: "امضای طرفین تکمیل شده است",
      }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: { stampRequest: { status: string; documentHash: string; stampAssetSha256: string } };
    }>(res);
    expect(data.stampRequest.status).toBe("PENDING");
    expect(data.stampRequest.documentHash).toBe(currentHash(ID));
    expect(data.stampRequest.stampAssetSha256).toBe(REAL_STAMP_SHA256);
  });

  it("reports the stamp as not yet applied on the context endpoint", async () => {
    const res = await stampGet(getReq(`${ADMIN_BASE}/${ID}/stamp`, adminSession), params(ID));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: { applied: boolean; reviewed: boolean; featureEnabled: boolean; requests: unknown[] };
    }>(res);
    expect(data.reviewed).toBe(true);
    expect(data.featureEnabled).toBe(true);
    expect(data.applied).toBe(false);
    expect(data.requests.length).toBeGreaterThanOrEqual(1);
  });

  it("APPLIES the stamp and the gate then authorises the current version", async () => {
    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
        action: "apply",
        reason: "صدور مهر رسمی لیگالیر",
      }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: { applied: boolean; stampRequest: { status: string } } }>(res);
    expect(data.applied).toBe(true);
    expect(data.stampRequest.status).toBe("APPLIED");

    // The single gate now returns the applied request for the current hash.
    const contract = contractDb.getContractById(ID)!;
    const hash = currentHash(ID);
    const stamp = stampReview.currentVersionStamp(contract, hash);
    expect(stamp).not.toBeNull();
    expect(stamp!.status).toBe("APPLIED");
    // …and NOT for a different hash (a version that moved on).
    expect(stampReview.currentVersionStamp(contract, "f".repeat(64))).toBeNull();
  });

  it("refuses a second decision on an already-decided request", async () => {
    // The only request for this contract is now APPLIED, so naming it
    // explicitly must be refused as already-décidée — never re-applied.
    const requests = stampReview.listStampRequests(ID);
    const applied = requests.find((r) => r.status === "APPLIED")!;
    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
        action: "apply",
        reason: "تلاش دوباره",
        stampRequestId: applied.id,
      }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("ALREADY_DECIDED");
  });
});

// ============================================================
// Server authority — the panel's verdict cannot be bypassed
// ============================================================
// The admin drawer now renders the server's own eligibility verdict and
// disables the action it refuses. These tests prove the REFUSALS are real
// on the endpoint, so removing `disabled` (or hand-crafting the POST)
// still cannot reach the forbidden state.

describe("official stamp — a crafted request cannot bypass the panel", () => {
  it("refuses a fresh request for a version that already carries the seal", async () => {
    const ID = "ctr-stamp-bypass-applied";
    await seedApprovedContract(ID);
    await completeSignatures(ID);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    expect(created.status).toBe(200);
    const applied = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "apply", reason: "صدور مهر" }),
      params(ID)
    );
    expect(applied.status).toBe(200);

    // A second request for the SAME (sealed) hash must be refused, not
    // silently accepted as another open request.
    const again = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست دوباره" }),
      params(ID)
    );
    expect(again.status).toBe(409);
    expect((await json<{ code: string }>(again)).code).toBe("ALREADY_STAMPED");
  });

  it("refuses a second request while one is open on another hash", async () => {
    const ID = "ctr-stamp-bypass-stale";
    await seedApprovedContract(ID);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    const { data } = await json<{ data: { stampRequest: { id: string } } }>(created);
    // Simulate the version moving on behind the open request.
    stampReview.updateStampRequest(data.stampRequest.id, { documentHash: "1".repeat(64) });

    const again = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست دوباره" }),
      params(ID)
    );
    expect(again.status).toBe(409);
    expect((await json<{ code: string }>(again)).code).toBe("PENDING_REQUEST");
  });

  it("refuses to apply when the review was withdrawn after the request", async () => {
    const ID = "ctr-stamp-bypass-unreviewed";
    await seedApprovedContract(ID);
    await completeSignatures(ID);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    expect(created.status).toBe(200);

    // Withdraw the approval: the stamp is the mark on a REVIEWED version.
    const review = adminReview.latestAdminReview(ID)!;
    adminReview.updateAdminReview(review.id, { status: "CHANGES_REQUESTED" });

    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "apply", reason: "تلاش صدور" }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("NOT_REVIEWED");

    // …and nothing was applied behind the refusal.
    const contract = contractDb.getContractById(ID)!;
    expect(stampReview.currentVersionStamp(contract, currentHash(ID))).toBeNull();
  });

  it("reports the same verdict on GET that the POST enforces", async () => {
    const ID = "ctr-stamp-verdict-parity";
    await seedApprovedContract(ID);

    const read = await stampGet(getReq(`${ADMIN_BASE}/${ID}/stamp`, adminSession), params(ID));
    const { data } = await json<{
      data: { eligibility: { canRequest: boolean; canApply: boolean; blockers: { code: string }[] } };
    }>(read);
    // A reviewed, unsealed, unsigned version: a request IS allowed; the
    // seal is not. The endpoint must agree with the panel's render.
    expect(data.eligibility.canRequest).toBe(true);
    expect(data.eligibility.canApply).toBe(false);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    expect(created.status).toBe(200);
  });

  it("shows a missing permission on the stage table for a role that cannot seal", async () => {
    // `admin:contracts:stamp:*` is SUPER_ADMIN-only, so the stamp panel
    // itself is never rendered for another role. The STAGE TABLE is: an
    // ADMIN can read the contract but may not manage the seal, and its
    // stamp row must say exactly that instead of a dead button.
    const adminRole = db.createUser({ mobile: "09120000333", passwordHash: "x" });
    db.setUserRole(adminRole.id, "ADMIN");
    const adminRoleSession = db.createSession(adminRole.id).id;

    const ID = "ctr-stamp-verdict-permission";
    await seedApprovedContract(ID);

    const read = await detailGet(
      getReqWithUrl(`${ADMIN_BASE}/${ID}`, adminRoleSession),
      params(ID)
    );
    expect(read.status).toBe(200);
    const { data } = await json<{
      data: {
        stages: {
          rows: { key: string; status: string; actions: { id: string; enabled: boolean; reasonFa: string | null }[] }[];
        };
      };
    }>(read);
    const stampRow = data.stages.rows.find((r) => r.key === "stamp")!;
    expect(stampRow.actions[0]!.enabled).toBe(false);
    expect(stampRow.actions[0]!.reasonFa).toContain("مدیریت مهر رسمی قراردادها");
  });
});

describe("admin contract PDF — operator-scoped preview", () => {
  it("streams a real PDF of the version the decision is bound to", async () => {
    const ID = "ctr-admin-pdf";
    await seedApprovedContract(ID);

    const res = await withRepoCwd(() =>
      adminPdfGet(getReqWithUrl(`${ADMIN_BASE}/${ID}/pdf`, adminSession), params(ID))
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-document-sha256")).toBe(currentHash(ID));
    const bytes = new Uint8Array(await res.arrayBuffer());
    // A real PDF starts with %PDF- — never HTML renamed to .pdf.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("serves an explicitly requested version, not just the newest", async () => {
    const ID = "ctr-admin-pdf-version";
    await seedApprovedContract(ID);
    const contract = contractDb.getContractById(ID)!;
    const versionId = contract.currentVersionId!;

    const res = await withRepoCwd(() =>
      adminPdfGet(
        getReqWithUrl(`${ADMIN_BASE}/${ID}/pdf?version=${versionId}`, adminSession),
        params(ID)
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-document-sha256")).toBe(currentHash(ID));
  });

  it("refuses an unauthenticated and an unauthorised caller", async () => {
    const ID = "ctr-admin-pdf-acl";
    await seedApprovedContract(ID);

    const anon = await adminPdfGet(getReqWithUrl(`${ADMIN_BASE}/${ID}/pdf`, null), params(ID));
    expect(anon.status).toBe(401);

    // The contract's OWNER is not an operator, even though it is their data.
    const owner = await adminPdfGet(
      getReqWithUrl(`${ADMIN_BASE}/${ID}/pdf`, ownerSession),
      params(ID)
    );
    expect(owner.status).toBe(403);
  });

  it("404s for a contract that does not exist", async () => {
    const res = await adminPdfGet(
      getReqWithUrl(`${ADMIN_BASE}/ctr-does-not-exist/pdf`, adminSession),
      params("ctr-does-not-exist")
    );
    expect(res.status).toBe(404);
  });
});

describe("official stamp — stale guards", () => {
  it("refuses to apply a request whose bound version hash moved on", async () => {
    const ID = "ctr-stamp-stale";
    await seedApprovedContract(ID);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    const { data } = await json<{ data: { stampRequest: { id: string } } }>(created);
    // Simulate a content change: the request now points at an older hash.
    stampReview.updateStampRequest(data.stampRequest.id, { documentHash: "0".repeat(64) });

    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "apply", reason: "تلاش صدور" }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("STALE_STAMP_REQUEST");
  });

  it("refuses to apply when the stamp master bytes changed since the request", async () => {
    const ID = "ctr-stamp-asset-changed";
    await seedApprovedContract(ID);
    // The asset guard is checked AFTER the signature gate, so the fixture
    // must supply completed signatures or it would only prove the earlier
    // refusal.
    await completeSignatures(ID);

    const created = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    const { data } = await json<{ data: { stampRequest: { id: string } } }>(created);
    stampReview.updateStampRequest(data.stampRequest.id, { stampAssetSha256: "a".repeat(64) });

    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "apply", reason: "تلاش صدور" }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("STAMP_ASSET_CHANGED");
  });

  it("rejects a request without applying it", async () => {
    const ID = "ctr-stamp-reject";
    await seedApprovedContract(ID);

    await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "request", reason: "درخواست مهر" }),
      params(ID)
    );
    const res = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, { action: "reject", reason: "مغایرت حقوقی" }),
      params(ID)
    );
    expect(res.status).toBe(200);

    const contract = contractDb.getContractById(ID)!;
    expect(stampReview.currentVersionStamp(contract, currentHash(ID))).toBeNull();
  });
});

// ============================================================
// Per-type signing policy — online signing disabled (sale/vehicle)
// ============================================================

describe("signing policy — data-driven per type", () => {
  it("disables online signing for sale/vehicle and allows rent", () => {
    expect(registry.signingPolicyFor("property_sale").onlineSigningAllowed).toBe(false);
    expect(registry.signingPolicyFor("vehicle_sale").onlineSigningAllowed).toBe(false);
    expect(registry.signingPolicyFor("property_rent").onlineSigningAllowed).toBe(true);
    // The refusal carries a Persian note (never a generic error).
    expect(registry.signingPolicyFor("property_sale").noteFa.length).toBeGreaterThan(10);
  });

  it("refuses to open a signature request for a notary-restricted type (409)", async () => {
    const ID = "ctr-sale-policy";
    contractDb.insertContract(
      seedContract(ID, saleData, "property_sale", "قولنامه فروش ملک", "seller")
    );

    const res = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("ONLINE_SIGNING_DISABLED");
  });

  it("refuses a token-scoped sign action on the same disabled type (409)", async () => {
    const ID = "ctr-sale-token-policy";
    const contract = seedContract(ID, saleData, "property_sale", "قولنامه فروش ملک", "seller");
    contractDb.insertContract(contract);

    // Seed an in-flight request + participant + invitation directly, as if
    // one had been issued before the policy disabled the type.
    const requestId = "sreq-sale-policy";
    const participantId = "spart-sale-policy";
    const nowIso = new Date().toISOString();
    signatureDb.insertSignatureRequest({
      id: requestId,
      contractId: ID,
      contractVersionId: "ver-sale",
      documentHash: "a".repeat(64),
      provider: "OTP_SIGNATURE",
      assuranceLevel: "ELECTRONIC_CONFIRMATION",
      status: "SENT",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      createdBy: ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
    } as SignatureRequest);
    signatureDb.insertParticipant({
      id: participantId,
      signatureRequestId: requestId,
      contractId: ID,
      partyId: null,
      roleFa: "فروشنده",
      nameFa: "مریم احمدی",
      mobileMasked: "0912***0003",
      mobile: "09121110003",
      status: "PENDING",
      viewedAt: null,
      signedAt: null,
      signedMethod: null,
      proofDocumentId: null,
      declinedAt: null,
      declineReason: null,
      createdAt: nowIso,
    } as SignatureParticipant);

    const rawToken = crypto.randomBytes(32).toString("hex");
    signatureDb.insertInvitation({
      id: "sinv-sale-policy",
      contractId: ID,
      signatureRequestId: requestId,
      participantId,
      tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
      recipientMasked: "0912***0003",
      status: "ACTIVE",
      verifyBeforeView: false,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      usedAt: null,
      revokedAt: null,
      createdAt: nowIso,
    } as SignatureInvitation);

    // GET discloses the policy and that signing is not possible.
    const got = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(got.status).toBe(200);
    const view = (await json<{ data: { onlineSigningAllowed: boolean; canSign: boolean } }>(got)).data;
    expect(view.onlineSigningAllowed).toBe(false);
    expect(view.canSign).toBe(false);

    // A sign action is refused with the policy code.
    const res = await invitationTokenRoute.POST(
      req(`${INVITATIONS_BASE}/${rawToken}`, null, { action: "request_otp" }),
      tokenParams(rawToken)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("ONLINE_SIGNING_DISABLED");
  });
});

// ============================================================
// Public token-scoped signing — locked participant, single-use
// ============================================================

describe("public token-scoped signing — the invited party signs on their own device", () => {
  const ID = "ctr-public-sign";
  let rawToken: string;
  let tenantId: string;
  let landlordId: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(created.status).toBe(200);
    const { data } = await json<{
      data: { request: { id: string; participants: { id: string; roleFa: string }[] } };
    }>(created);
    tenantId = data.request.participants.find((p) => p.roleFa === "مستأجر")!.id;
    landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;

    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [tenantId] }),
      params(ID)
    );
    rawToken = (await json<{ data: { invitations: { token: string }[] } }>(issued)).data.invitations[0]!
      .token;
  });

  it("keeps the link usable across the OTP steps — no consumption on request_otp", async () => {
    const sent = await invitationTokenRoute.POST(
      req(`${INVITATIONS_BASE}/${rawToken}`, null, { action: "request_otp" }),
      tokenParams(rawToken)
    );
    expect(sent.status).toBe(200);
    expect((await json<{ data: { sent: boolean } }>(sent)).data.sent).toBe(true);

    // Still active — the signer has not terminally acted.
    const still = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(still.status).toBe(200);
  });

  it("refuses a wrong code without consuming the token", async () => {
    const wrong = await invitationTokenRoute.POST(
      req(`${INVITATIONS_BASE}/${rawToken}`, null, {
        action: "verify_otp",
        code: "000000",
        consentGiven: true,
      }),
      tokenParams(rawToken)
    );
    expect(wrong.status).toBe(400);

    const still = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(still.status).toBe(200);
  });

  it("records the invited party's signature and locks the signer to the token", async () => {
    const good = await invitationTokenRoute.POST(
      req(`${INVITATIONS_BASE}/${rawToken}`, null, {
        action: "verify_otp",
        code: "405405",
        consentGiven: true,
        // A crafted body naming the OTHER participant is ignored — the
        // token locks the signer.
        participantId: landlordId,
      }),
      tokenParams(rawToken)
    );
    expect(good.status).toBe(200);

    // The INVITED (tenant) participant signed; the landlord did not.
    expect(signatureDb.getParticipant(tenantId)!.status).toBe("SIGNED");
    expect(signatureDb.getParticipant(tenantId)!.signedMethod).toBe("OTP_ELECTRONIC");
    expect(signatureDb.getParticipant(landlordId)!.status).toBe("PENDING");
  });

  it("consumes the single-use token once the signature is recorded", async () => {
    const after = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(after.status).toBe(410);
    expect((await json<{ code: string }>(after)).code).toBe("USED");
  });
});

describe("public token-scoped signing — a refusal is terminal", () => {
  const ID = "ctr-public-decline";
  let rawToken: string;
  let landlordId: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    const { data } = await json<{
      data: { request: { participants: { id: string; roleFa: string }[] } };
    }>(created);
    landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;

    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [landlordId] }),
      params(ID)
    );
    rawToken = (await json<{ data: { invitations: { token: string }[] } }>(issued)).data.invitations[0]!
      .token;
  });

  it("records the refusal, retires the request and consumes the token", async () => {
    const res = await invitationTokenRoute.POST(
      req(`${INVITATIONS_BASE}/${rawToken}`, null, {
        action: "decline",
        reason: "شرایط قرارداد مورد تأیید نیست",
      }),
      tokenParams(rawToken)
    );
    expect(res.status).toBe(200);

    expect(signatureDb.getParticipant(landlordId)!.status).toBe("DECLINED");

    const after = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(after.status).toBe(410);
    expect((await json<{ code: string }>(after)).code).toBe("USED");
  });
});

// ============================================================
// Finalize — the final artifact is best-effort, never blocking
// ============================================================
// The final A4 PDF is rendered once from the frozen snapshot and stored
// privately. A render/storage failure must NEVER block finalization,
// because the /pdf route can always re-render from the same snapshot.

describe("finalize — state advances even when the artifact cannot be stored", () => {
  const ID = "ctr-finalize-artifact";
  let finalizePost: RouteHandler;

  beforeAll(async () => {
    finalizePost = (await import("@/app/api/v1/property-contracts/[id]/finalize/route"))
      .POST as unknown as RouteHandler;
    await seedApprovedContract(ID);

    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    const { data } = await json<{
      data: { request: { participants: { id: string; roleFa: string }[] } };
    }>(created);
    const landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;
    const tenantId = data.request.participants.find((p) => p.roleFa === "مستأجر")!.id;

    const form = new FormData();
    form.append("participantId", landlordId);
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "scan.png", { type: "image/png" }));
    expect((await signPost(multipartReq(`${BASE}/${ID}/sign`, ownerSession, form), params(ID))).status).toBe(200);

    expect(
      (
        await signPost(
          req(`${BASE}/${ID}/sign`, ownerSession, { action: "request_otp", participantId: tenantId }),
          params(ID)
        )
      ).status
    ).toBe(200);
    expect(
      (
        await signPost(
          req(`${BASE}/${ID}/sign`, ownerSession, {
            action: "verify_otp",
            participantId: tenantId,
            code: "405405",
            consentGiven: true,
          }),
          params(ID)
        )
      ).status
    ).toBe(200);
  });

  it("finalizes the contract and records the review stamp, artifact best-effort", async () => {
    const res = await finalizePost(req(`${BASE}/${ID}/finalize`, ownerSession, {}), params(ID));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        state: string;
        finalVersionId: string;
        documentHash: string;
        stamp: { applied: boolean; officialStamp: unknown };
        finalArtifact: { documentId: string } | null;
      };
    }>(res);
    // The state advances regardless of whether the PDF could be rendered
    // (here the temp cwd has no fonts, so the artifact is null — and that
    // must not block finalization).
    expect(data.state).toBe("FINALIZED");
    expect(data.stamp.applied).toBe(true);
    // No official stamp was applied for this contract, so the drawn mark
    // falls back to the reviewed text stamp.
    expect(data.stamp.officialStamp).toBeNull();
    // If an artifact WAS produced it is bound to the same frozen hash.
    if (data.finalArtifact) expect(data.finalArtifact.documentId).toBeTruthy();
  });
});

// ============================================================
// Admin wet-ink evidence — records proof WITHOUT changing state
// ============================================================

describe("admin wet-ink evidence — proof only, never a signature", () => {
  const ID = "ctr-evidence";
  const EVIDENCE_BASE = `${ADMIN_BASE}/${ID}/evidence`;

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("refuses a non-admin on both the read and the upload endpoints (403)", async () => {
    const read = await evidenceGet(getReq(EVIDENCE_BASE, otherSession), params(ID));
    expect(read.status).toBe(403);

    const form = new FormData();
    form.append("description", "امضای دستی موجر در دفتر");
    form.append("file", new File([new Uint8Array([137, 80, 78, 71])], "wet.png", { type: "image/png" }));
    const upload = await evidencePost(multipartReq(EVIDENCE_BASE, otherSession, form), params(ID));
    expect(upload.status).toBe(403);
  });

  it("refuses a missing file or a too-short description", async () => {
    const noFile = new FormData();
    noFile.append("description", "امضای دستی موجر");
    const r1 = await evidencePost(multipartReq(EVIDENCE_BASE, adminSession, noFile), params(ID));
    expect(r1.status).toBe(400);
    expect((await json<{ code: string }>(r1)).code).toBe("NO_FILE");

    const shortDesc = new FormData();
    shortDesc.append("description", "خ");
    shortDesc.append("file", new File([new Uint8Array([137, 80, 78, 71])], "wet.png", { type: "image/png" }));
    const r2 = await evidencePost(multipartReq(EVIDENCE_BASE, adminSession, shortDesc), params(ID));
    expect(r2.status).toBe(400);
    expect((await json<{ code: string }>(r2)).code).toBe("REASON_REQUIRED");
  });

  it("records the evidence privately and NEVER advances the contract state", async () => {
    const before = contractDb.getContractById(ID)!;

    const form = new FormData();
    form.append("description", "امضای دستی موجر روی نسخه چاپی، شهود حاضر");
    form.append(
      "file",
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "wet-ink.png", { type: "image/png" })
    );
    const res = await evidencePost(multipartReq(EVIDENCE_BASE, adminSession, form), params(ID));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        evidence: { id: string; hash: string; documentHash: string | null };
        stateChanged: boolean;
      };
    }>(res);
    expect(data.stateChanged).toBe(false);
    expect(data.evidence.hash).toHaveLength(64);

    // The document is stored privately as wet_ink_evidence — never public.
    const docs = contractDb.listContractDocuments(ID);
    const evidence = docs.find((d) => d.category === "wet_ink_evidence");
    expect(evidence).toBeTruthy();
    expect(evidence!.id).toBe(data.evidence.id);
    expect(evidence!.storageKey).not.toContain("public");

    // The contract state and its participants are untouched by evidence.
    const after = contractDb.getContractById(ID)!;
    expect(after.state).toBe(before.state);

    // …and it is now listed on the evidence endpoint.
    const listed = await evidenceGet(getReq(EVIDENCE_BASE, adminSession), params(ID));
    expect(listed.status).toBe(200);
    const list = (await json<{ data: { evidence: { id: string }[] } }>(listed)).data;
    expect(list.evidence.some((e) => e.id === data.evidence.id)).toBe(true);
  });
});

// ============================================================
// §4 — the final LEGALIR approval freezes the final version
// ============================================================
// Applying the official seal IS the final approval, so the same act must
// freeze the signed snapshot as the FINAL version: the final document is
// the exact version the parties signed, the earlier reviewed version is
// retained, and the freeze is recorded in the contract's own audit trail.

describe("official stamp apply — final approval freezes the final version", () => {
  const ID = "ctr-final-approval";

  beforeAll(async () => {
    await seedApprovedContract(ID);
    await completeSignatures(ID);
  });

  it("reports signature readiness from the real request bound to the version", async () => {
    const res = await stampGet(getReq(`${ADMIN_BASE}/${ID}/stamp`, adminSession), params(ID));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: { signatures: { ready: boolean; reasonFa: string | null } };
    }>(res);
    expect(data.signatures.ready).toBe(true);
    expect(data.signatures.reasonFa).toBeNull();
  });

  it("locks the signed version as the final one and keeps the reviewed version", async () => {
    const before = contractDb.getContractById(ID)!;
    const reviewedVersionId = before.currentVersionId!;
    const reviewedHash = currentHash(ID);
    const versionsBefore = contractDb.listVersions(ID).length;

    expect(
      (
        await stampPost(
          req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
            action: "request",
            reason: "همهٔ طرفین امضا کرده‌اند",
          }),
          params(ID)
        )
      ).status
    ).toBe(200);

    const applied = await stampPost(
      req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
        action: "apply",
        reason: "تأیید نهایی لیگالیر",
      }),
      params(ID)
    );
    expect(applied.status).toBe(200);
    const { data } = await json<{
      data: {
        applied: boolean;
        finalization: {
          ok: true;
          finalVersionId: string;
          documentHash: string;
          state: string;
          finalizedAt: string;
          artifactStored: boolean;
        } | null;
      };
    }>(applied);

    expect(data.applied).toBe(true);
    expect(data.finalization).not.toBeNull();
    const finalization = data.finalization!;
    // The final version IS the version the parties signed — same row, same
    // hash — so the signatures the parties gave stay bound to the final doc.
    expect(finalization.finalVersionId).toBe(reviewedVersionId);
    expect(finalization.documentHash).toBe(reviewedHash);
    expect(finalization.state).toBe("FINALIZED");
    expect(new Date(finalization.finalizedAt).toISOString()).toBe(finalization.finalizedAt);

    // The stored contract agrees, and no version was lost: the freeze
    // reused the signed snapshot rather than minting a parallel copy.
    const after = contractDb.getContractById(ID)!;
    expect(after.state).toBe("FINALIZED");
    expect(after.finalVersionId).toBe(reviewedVersionId);
    expect(after.finalizedAt).toBe(finalization.finalizedAt);
    expect(contractDb.listVersions(ID)).toHaveLength(versionsBefore);
    expect(contractDb.listVersions(ID).some((v) => v.id === reviewedVersionId)).toBe(true);

    // The approval records the official seal, bound to the same hash.
    const audit = contractDb.listAudit(ID).find((a) => a.action === "contract.finalized");
    expect(audit).toBeDefined();
    expect(audit!.metadata["finalVersionId"]).toBe(reviewedVersionId);
    expect(audit!.metadata["documentHash"]).toBe(reviewedHash);
    const stampMeta = audit!.metadata["stamp"] as { officialStamp: { sha256: string } | null };
    expect(stampMeta.officialStamp?.sha256).toBe(REAL_STAMP_SHA256);
  });

  it("refuses the final approval while a party has not signed", async () => {
    const unsignedId = "ctr-final-approval-unsigned";
    await seedApprovedContract(unsignedId);

    const ctx = await stampGet(
      getReq(`${ADMIN_BASE}/${unsignedId}/stamp`, adminSession),
      params(unsignedId)
    );
    const { data } = await json<{
      data: { signatures: { ready: boolean; reasonFa: string | null } };
    }>(ctx);
    expect(data.signatures.ready).toBe(false);
    expect(data.signatures.reasonFa).toBeTruthy();

    await stampPost(
      req(`${ADMIN_BASE}/${unsignedId}/stamp`, adminSession, {
        action: "request",
        reason: "درخواست مهر پیش از امضای طرفین",
      }),
      params(unsignedId)
    );

    const res = await stampPost(
      req(`${ADMIN_BASE}/${unsignedId}/stamp`, adminSession, {
        action: "apply",
        reason: "تلاش تأیید نهایی",
      }),
      params(unsignedId)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("SIGNATURES_REQUIRED");
    // Nothing was frozen.
    expect(contractDb.getContractById(unsignedId)!.finalVersionId).toBeNull();
  });
});

// ============================================================
// The signer's own sheet carries the OFFICIAL mark its PDF carries
// ============================================================
// A signing party often has no account, so the owner-scoped stamp route
// is closed to them — yet the PDF their token downloads already has the
// seal and hologram drawn on every page. This proves the token-scoped
// sheet agrees with that file: the invitation payload names the bound
// mark, the sibling asset route serves the very same PNG bytes, and a
// stale/unknown token gets nothing.

describe("public invitation — the official mark on the signer's sheet", () => {
  const ID = "ctr-signer-mark";
  let rawToken: string;

  function assetParams(kind: string) {
    return { params: Promise.resolve({ token: rawToken, kind }) };
  }

  beforeAll(async () => {
    await seedApprovedContract(ID);

    // Freeze the version the parties will sign, then issue the link —
    // BEFORE the signatures, so the invitation stays ACTIVE and unused.
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(created.status).toBe(200);
    const { data } = await json<{
      data: { request: { participants: { id: string; roleFa: string }[] } };
    }>(created);
    const participants = data.request.participants;

    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, {
        participantIds: [participants.find((p) => p.roleFa === "مستأجر")!.id],
      }),
      params(ID)
    );
    expect(issued.status).toBe(200);
    rawToken = (
      await json<{ data: { invitations: { token: string }[] } }>(issued)
    ).data.invitations[0]!.token;

    // Both parties sign, then LEGALIR applies the official seal — the
    // final approval that turns this version into the stamped document.
    for (const participant of participants) {
      expect(
        (
          await signPost(
            req(`${BASE}/${ID}/sign`, ownerSession, {
              action: "request_otp",
              participantId: participant.id,
            }),
            params(ID)
          )
        ).status
      ).toBe(200);
      expect(
        (
          await signPost(
            req(`${BASE}/${ID}/sign`, ownerSession, {
              action: "verify_otp",
              participantId: participant.id,
              code: "405405",
              consentGiven: true,
            }),
            params(ID)
          )
        ).status
      ).toBe(200);
    }

    expect(
      (
        await stampPost(
          req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
            action: "request",
            reason: "همهٔ طرفین امضا کرده‌اند",
          }),
          params(ID)
        )
      ).status
    ).toBe(200);
    expect(
      (
        await stampPost(
          req(`${ADMIN_BASE}/${ID}/stamp`, adminSession, {
            action: "apply",
            reason: "تأیید نهایی لیگالیر",
          }),
          params(ID)
        )
      ).status
    ).toBe(200);
  });

  it("names the bound mark and points at the token-scoped assets", async () => {
    const res = await invitationTokenRoute.GET(
      getReq(`${INVITATIONS_BASE}/${rawToken}`, null),
      tokenParams(rawToken)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        stamp: {
          applied: boolean;
          official: boolean;
          sealHref?: string;
          hologramHref?: string;
          reviewId: string;
          approvedByLabelFa: string | null;
        };
      };
    }>(res);

    expect(data.stamp.applied).toBe(true);
    expect(data.stamp.official).toBe(true);
    // The signer has no session: the hrefs must stay under THIS token,
    // never the session-scoped owner route. They are same-origin paths,
    // which is what the page renders into an <img src>.
    expect(data.stamp.sealHref).toBe(
      `/api/v1/contract-invitations/${rawToken}/stamp-asset/seal`
    );
    expect(data.stamp.hologramHref).toBe(
      `/api/v1/contract-invitations/${rawToken}/stamp-asset/hologram`
    );
    expect(data.stamp.reviewId).toBeTruthy();
    expect(data.stamp.approvedByLabelFa).toBeTruthy();
  });

  it("serves the real seal and hologram PNGs under the signer's token", async () => {
    for (const [kind, loader] of [
      ["seal", () => stampAsset.loadReviewStamp()],
      ["hologram", () => stampAsset.loadHologram()],
    ] as const) {
      const res = await invitationStampAssetRoute(
        getReq(`${INVITATIONS_BASE}/${rawToken}/stamp-asset/${kind}`, null),
        assetParams(kind)
      );
      expect(res.status, `the ${kind} asset must be served`).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("private, max-age=300");
      const master = loader();
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(bytes.byteLength).toBe(master!.sizeBytes);
      // Byte-for-byte the same master the PDF embeds.
      expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(master!.sha256);
    }
  });

  it("serves nothing for an unknown token or an unknown asset kind", async () => {
    const unknown = await invitationStampAssetRoute(
      getReq(`${INVITATIONS_BASE}/not-a-real-token/stamp-asset/seal`, null),
      { params: Promise.resolve({ token: "not-a-real-token", kind: "seal" }) }
    );
    expect(unknown.status).toBe(404);
    expect((await json<{ code: string }>(unknown)).code).toBe("NOT_FOUND");

    const bogus = await invitationStampAssetRoute(
      getReq(`${INVITATIONS_BASE}/${rawToken}/stamp-asset/logo`, null),
      assetParams("logo")
    );
    expect(bogus.status).toBe(404);
  });

  it("loses the mark the moment the invitation is revoked", async () => {
    const invitation = signatureDb.findInvitationByTokenHash(
      crypto.createHash("sha256").update(rawToken).digest("hex")
    )!;
    signatureDb.updateInvitation(invitation.id, { status: "REVOKED" });

    const res = await invitationStampAssetRoute(
      getReq(`${INVITATIONS_BASE}/${rawToken}/stamp-asset/seal`, null),
      assetParams("seal")
    );
    expect(res.status).toBe(410);
    expect((await json<{ code: string }>(res)).code).toBe("REVOKED");

    // Restore for any later assertions in this file.
    signatureDb.updateInvitation(invitation.id, { status: "ACTIVE" });
  });
});
