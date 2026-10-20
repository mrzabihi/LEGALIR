// @vitest-environment node
// ============================================================
// LEGALIR — Signature flows · END-TO-END (temp DB) · §10
// ============================================================
// The signing surface (§8), the audit trail (§9) and the finalize
// stamp gate (§7) are all enforced at the ROUTE layer — a direct API
// call must obey the same rules the UI reads. These tests drive the
// real route handlers against an isolated temp DB:
//
//   • an unrelated session cannot sign, read the audit, or finalize
//     another user's contract (404, never 403)
//   • a non-admin cannot decide an admin review (403)
//   • the OTP provider's REAL send result is surfaced: a rate-limited
//     send is reported as OTP_RATE_LIMITED (never as «پیکربندی نشده»,
//     which would misdirect the operator), never as a fake success
//   • an overdue in-flight request reads as REQUEST_EXPIRED
//   • a wet-ink signature requires a valid uploaded scan and records
//     PHYSICAL_WET_INK + a signed_scan document bound to the version
//   • the public invitation route consumes its single-use token,
//     marks the participant VIEWED, appends DOCUMENT_VIEWED, and
//     refuses a second use / a revoked / an expired link
//   • every emitted event carries a coarse fingerprint, never an IP
//   • the audit trail is searchable by actor / action / date
//   • a final version is stamped ONLY when its exact hash carries an
//     admin approval — an unapproved signed contract is refused
//   • the TWO registration paths stay apart: «ثبت نهایی» needs the
//     explicit acknowledgement, lands in READY_TO_SIGN with a
//     `reviewedByLegalir: false` record, and writes NO review row — while
//     a contract already in the queue cannot be pulled out of it
//   • an admin's manual advance demands a written reason, records a
//     `self_final` registration with `actorKind: "admin"`, and states in
//     both trails that it was NOT a LEGALIR review
//   • the printable admin message is capped at 100 code points, never
//     truncated, and clearing it removes the row entirely
//   • a destination correction is stored on that person's own row with an
//     append-only before/after record, and sends only on explicit
//     confirmation — with the real delivery outcome written back
//
// `db.ts` resolves its store from the cwd at import time, so every
// module is imported DYNAMICALLY after chdir (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  ContractApproval,
  ContractAuditEntry,
  ContractDocument,
  ContractParty,
  ContractRegistrationRecord,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import {
  CONTRACT_ADMIN_MESSAGE_MAX,
  CONTRACT_REVIEW_STAMP_TEXT,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";
import type * as SnapshotModule from "../contracts/snapshot";
import type * as RegistrationModule from "../contracts/registration";
import type * as AdminReviewModule from "../contracts/admin-review";
import type * as AdminPrintModule from "../contracts/admin-print";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;
type Snapshot = typeof SnapshotModule;
type Registration = typeof RegistrationModule;
type AdminReview = typeof AdminReviewModule;
type AdminPrint = typeof AdminPrintModule;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;
let snapshot: Snapshot;
let registration: Registration;
let adminReview: AdminReview;
let adminPrint: AdminPrint;

let ownerSession: string;
let ownerId: string;
let otherSession: string;
let adminSession: string;
let adminId: string;
let rentData: PropertyContract["data"];
let today: string;

let tmpDir: string;
let originalCwd: string;

type RouteHandler = (
  req: NextRequest,
  ctx: {
    params: Promise<{ id?: string; token?: string; publicVerificationId?: string }>;
  }
) => Promise<Response>;

let reviewPost: RouteHandler;
let adminPost: RouteHandler;
let signPost: RouteHandler;
let finalizePost: RouteHandler;
let advanceSigningPost: RouteHandler;
let messagePost: RouteHandler;
let messageGet: RouteHandler;
let contactPost: RouteHandler;
let invitationsRoute: {
  POST: RouteHandler;
  GET: RouteHandler;
  DELETE: RouteHandler;
};
let auditGet: RouteHandler;
let verifyGet: RouteHandler;
let invitationTokenRoute: { GET: RouteHandler; POST: RouteHandler };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function tokenParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

/** A GET whose handler resolves the `[publicVerificationId]` segment. */
function verifyParams(publicVerificationId: string) {
  return { params: Promise.resolve({ publicVerificationId }) };
}

/** A JSON POST carrying a session cookie. */
function req(url: string, session: string | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (session) headers["cookie"] = `legalir-session=${session}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** A multipart POST carrying a session cookie (physical signing). */
function multipartReq(url: string, session: string, form: FormData): NextRequest {
  return new Request(url, {
    method: "POST",
    headers: { cookie: `legalir-session=${session}` },
    body: form,
  }) as unknown as NextRequest;
}

/** A GET carrying a session cookie. */
function getReq(url: string, session: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (session) headers["cookie"] = `legalir-session=${session}`;
  return new Request(url, { method: "GET", headers }) as unknown as NextRequest;
}

/**
 * Run `fn` with the REPO as cwd, then return to the temp DB.
 *
 * The suite `chdir`s into a temp directory so the JSON store stays
 * isolated. The store's own path is captured at module-import time, so
 * moving back does NOT redirect reads — but the PDF renderer resolves the
 * Vazirmatn font from `process.cwd()`, and there is no font inside the
 * temp dir. Anything that must actually RENDER (finalisation, the T7
 * regeneration) has to run inside this helper.
 */
async function withRepoCwd<T>(fn: () => Promise<T>): Promise<T> {
  process.chdir(originalCwd);
  try {
    return await fn();
  } finally {
    process.chdir(tmpDir);
  }
}

/** A DELETE carrying a session cookie. */
function deleteReq(url: string, session: string): NextRequest {
  return new Request(url, {
    method: "DELETE",
    headers: { cookie: `legalir-session=${session}` },
  }) as unknown as NextRequest;
}

async function json<T = { data: unknown }>(res: Response): Promise<T> {
  return (await res.json()) as T;
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

function seedContract(id: string, data: PropertyContract["data"]): PropertyContract {
  const now = new Date().toISOString();
  return {
    id,
    referenceCode: `LGL-RENT-1405-${id.slice(-4).toUpperCase()}`,
    userId: ownerId,
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "READY_FOR_REVIEW",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
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

/**
 * Seed a complete rent contract with two identified parties and drive
 * it through the compulsory LEGALIR admin review so its current version
 * carries a valid, bound approval — the precondition for signing.
 */
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

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-signing-flows-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  signatureDb = await import("../contracts/signature/db");
  snapshot = await import("../contracts/snapshot");
  registration = await import("../contracts/registration");
  adminReview = await import("../contracts/admin-review");
  adminPrint = await import("../contracts/admin-print");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");
  today = new Date().toISOString().slice(0, 10);

  const owner = db.createUser({ mobile: "09120000111", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const other = db.createUser({ mobile: "09120000222", passwordHash: "x" });
  otherSession = db.createSession(other.id).id;

  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  adminId = admin.id;
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  reviewPost = (await import("@/app/api/v1/property-contracts/[id]/review/route"))
    .POST as unknown as RouteHandler;
  adminPost = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .POST as unknown as RouteHandler;
  signPost = (await import("@/app/api/v1/property-contracts/[id]/sign/route"))
    .POST as unknown as RouteHandler;
  finalizePost = (await import("@/app/api/v1/property-contracts/[id]/finalize/route"))
    .POST as unknown as RouteHandler;
  advanceSigningPost = (await import("@/app/api/v1/admin/contracts/[id]/advance-signing/route"))
    .POST as unknown as RouteHandler;
  const messageRoute = (await import("@/app/api/v1/admin/contracts/[id]/message/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
  messagePost = messageRoute.POST;
  messageGet = messageRoute.GET;
  contactPost = (await import("@/app/api/v1/admin/contracts/[id]/contact/route"))
    .POST as unknown as RouteHandler;
  auditGet = (await import("@/app/api/v1/property-contracts/[id]/audit/route"))
    .GET as unknown as RouteHandler;
  verifyGet = (await import("@/app/api/v1/property-contracts/verify/[publicVerificationId]/route"))
    .GET as unknown as RouteHandler;
  invitationsRoute = (await import("@/app/api/v1/property-contracts/[id]/invitations/route")) as unknown as {
    POST: RouteHandler;
    GET: RouteHandler;
    DELETE: RouteHandler;
  };
  invitationTokenRoute = (await import("@/app/api/v1/contract-invitations/[token]/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Access control — a contract id is never probeable
// ============================================================

describe("signing surface — access control", () => {
  const ID = "ctr-access";

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("an unauthenticated sign call is 401", async () => {
    const res = await signPost(
      req(`${BASE}/${ID}/sign`, null, { action: "create_request" }),
      params(ID)
    );
    expect(res.status).toBe(401);
  });

  it("an unrelated session cannot sign another user's contract (404, never 403)", async () => {
    const res = await signPost(
      req(`${BASE}/${ID}/sign`, otherSession, { action: "create_request" }),
      params(ID)
    );
    expect(res.status).toBe(404);
    expect((await json<{ code: string }>(res)).code).toBe("NOT_FOUND");
  });

  it("an unrelated session cannot read the contract's audit trail", async () => {
    const res = await auditGet(getReq(`${BASE}/${ID}/audit`, otherSession), params(ID));
    expect(res.status).toBe(404);
  });

  it("a NON-admin cannot decide an admin review (403)", async () => {
    const res = await adminPost(
      req(`${ADMIN_BASE}/${ID}`, otherSession, { action: "approve" }),
      params(ID)
    );
    expect(res.status).toBe(403);
    expect((await json<{ code: string }>(res)).code).toBe("FORBIDDEN");
  });
});

// ============================================================
// The main signed flow: fail-fast send, wet-ink, OTP, events
// ============================================================

describe("signature request — real send results, wet-ink, and OTP", () => {
  const ID = "ctr-sign-main";
  let requestId: string;
  let landlordId: string;
  let tenantId: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const res = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        contract: PropertyContract;
        request: { id: string; status: string; participants: { id: string; roleFa: string }[] };
      };
    }>(res);
    requestId = data.request.id;
    expect(data.contract.state).toBe("READY_TO_SIGN");
    expect(data.request.participants).toHaveLength(2);
    landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;
    tenantId = data.request.participants.find((p) => p.roleFa === "مستأجر")!.id;

    // The request emits both a CREATED and a SENT event (§9).
    const types = signatureDb.listSignatureEvents(requestId).map((e) => e.type);
    expect(types).toContain("REQUEST_CREATED");
    expect(types).toContain("REQUEST_SENT");
  });

  it("reports a REAL rate-limited send as OTP_RATE_LIMITED rather than a fake success", async () => {
    // The provider rate-limits to 3 per subject; the 4th attempt is refused.
    for (let i = 0; i < 3; i += 1) {
      const ok = await signPost(
        req(`${BASE}/${ID}/sign`, ownerSession, {
          action: "request_otp",
          participantId: landlordId,
        }),
        params(ID)
      );
      expect(ok.status).toBe(200);
      expect((await json<{ data: { sent: boolean } }>(ok)).data.sent).toBe(true);
    }

    const blocked = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, {
        action: "request_otp",
        participantId: landlordId,
      }),
      params(ID)
    );
    expect(blocked.status).toBe(409);
    // The real cause is a quota exhaustion, NOT a missing SMS gateway —
    // reporting it as SMS_NOT_CONFIGURED would send an operator chasing a
    // configuration problem that does not exist.
    const blockedBody = await json<{ code: string; retryable: boolean; sms: { configured: boolean } }>(
      blocked
    );
    expect(blockedBody.code).toBe("OTP_RATE_LIMITED");
    expect(blockedBody.retryable).toBe(true);

    // The failure is recorded on the tamper-evident trail.
    const failed = signatureDb
      .listSignatureEvents(requestId)
      .filter((e) => e.type === "OTP_FAILED");
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it("refuses a wet-ink signature with no file, a bad format, or an oversized scan", async () => {
    const noFile = new FormData();
    noFile.append("participantId", landlordId);
    const r1 = await signPost(multipartReq(`${BASE}/${ID}/sign`, ownerSession, noFile), params(ID));
    expect(r1.status).toBe(400);
    expect((await json<{ code: string }>(r1)).code).toBe("NO_FILE");

    const badFormat = new FormData();
    badFormat.append("participantId", landlordId);
    badFormat.append("file", new File([new Uint8Array([1, 2, 3])], "notes.txt", { type: "text/plain" }));
    const r2 = await signPost(
      multipartReq(`${BASE}/${ID}/sign`, ownerSession, badFormat),
      params(ID)
    );
    expect(r2.status).toBe(400);
    expect((await json<{ code: string }>(r2)).code).toBe("UNSUPPORTED_FORMAT");

    // §T2 — a PDF scan is a supported DOCUMENT format but not a printable
    // SIGNATURE: the renderer can only embed PNG/JPEG into the party's own
    // cell. Accepting it would record a signature that never appears on the
    // sheet, so the refusal happens here, not at finalisation.
    const pdfScan = new FormData();
    pdfScan.append("participantId", landlordId);
    pdfScan.append(
      "file",
      new File([new Uint8Array([37, 80, 68, 70])], "signed.pdf", { type: "application/pdf" })
    );
    const r3 = await signPost(
      multipartReq(`${BASE}/${ID}/sign`, ownerSession, pdfScan),
      params(ID)
    );
    expect(r3.status).toBe(400);
    expect((await json<{ code: string }>(r3)).code).toBe("SCAN_NOT_PRINTABLE");

    const tooLarge = new FormData();
    tooLarge.append("participantId", landlordId);
    tooLarge.append(
      "file",
      new File([new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)], "scan.png", { type: "image/png" })
    );
    const r4 = await signPost(
      multipartReq(`${BASE}/${ID}/sign`, ownerSession, tooLarge),
      params(ID)
    );
    expect(r4.status).toBe(400);
    expect((await json<{ code: string }>(r4)).code).toBe("FILE_TOO_LARGE");

    // Nothing was recorded — the landlord is still pending.
    expect(signatureDb.getParticipant(landlordId)!.status).toBe("PENDING");
  });

  it("records a wet-ink signature with its scanned proof bound to the version", async () => {
    const form = new FormData();
    form.append("participantId", landlordId);
    form.append(
      "file",
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "scan.png", {
        type: "image/png",
      })
    );
    const res = await signPost(multipartReq(`${BASE}/${ID}/sign`, ownerSession, form), params(ID));
    expect(res.status).toBe(200);

    const { data } = await json<{
      data: {
        participant: { status: string; signedMethod: string; proofDocumentId: string | null };
        contract: PropertyContract;
        allSigned: boolean;
      };
    }>(res);
    expect(data.participant.status).toBe("SIGNED");
    expect(data.participant.signedMethod).toBe("PHYSICAL_WET_INK");
    expect(data.participant.proofDocumentId).toBeTruthy();
    expect(data.allSigned).toBe(false);
    expect(data.contract.state).toBe("PARTIALLY_SIGNED");

    // The scan is stored as a private signed_scan document (never a URL).
    const docs: ContractDocument[] = contractDb.listContractDocuments(ID);
    const scan = docs.find((d) => d.category === "signed_scan");
    expect(scan).toBeTruthy();
    expect(scan!.id).toBe(data.participant.proofDocumentId);
    expect(scan!.hash).toHaveLength(64);
  });

  it("completes the contract with an OTP signature for the remaining party", async () => {
    const sent = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, {
        action: "request_otp",
        participantId: tenantId,
      }),
      params(ID)
    );
    expect(sent.status).toBe(200);

    // A wrong code is refused and recorded; the correct dev code signs.
    const wrong = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, {
        action: "verify_otp",
        participantId: tenantId,
        code: "000000",
        consentGiven: true,
      }),
      params(ID)
    );
    expect(wrong.status).toBe(400);

    const good = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, {
        action: "verify_otp",
        participantId: tenantId,
        code: "405405",
        consentGiven: true,
      }),
      params(ID)
    );
    expect(good.status).toBe(200);
    const { data } = await json<{
      data: {
        allSigned: boolean;
        contract: PropertyContract;
        participant: { signedMethod: string };
      };
    }>(good);
    expect(data.allSigned).toBe(true);
    expect(data.contract.state).toBe("SIGNED");
    expect(data.participant.signedMethod).toBe("OTP_ELECTRONIC");

    // The request is COMPLETED and the completion is on the trail.
    const events = signatureDb.listSignatureEvents(requestId);
    expect(events.some((e) => e.type === "SIGNED")).toBe(true);
    expect(events.some((e) => e.type === "REQUEST_COMPLETED")).toBe(true);
  });

  it("stamps a coarse fingerprint on every event — never a raw IP (§9)", () => {
    const events = signatureDb.listSignatureEvents(requestId);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.clientFingerprint).not.toBeNull();
      expect(event.clientFingerprint).toMatch(/^[0-9a-f]{16}$/);
      // Never an IP address leaking into the metadata.
      expect(JSON.stringify(event.metadata)).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/);
    }
  });

  it("exposes a searchable audit trail (§9.2)", async () => {
    const all = await auditGet(getReq(`${BASE}/${ID}/audit`, ownerSession), params(ID));
    expect(all.status).toBe(200);
    const { data } = await json<{
      data: {
        entries: ContractAuditEntry[];
        actors: { actorId: string; actorLabel: string }[];
        total: number;
      };
    }>(all);
    expect(data.total).toBeGreaterThanOrEqual(4);
    expect(data.actors.some((a) => a.actorId === ownerId)).toBe(true);

    // Filter by action substring.
    const signed = await auditGet(
      getReq(`${BASE}/${ID}/audit?action=contract.signed`, ownerSession),
      params(ID)
    );
    const signedData = (await json<{ data: { entries: ContractAuditEntry[] } }>(signed)).data;
    expect(signedData.entries.length).toBeGreaterThanOrEqual(2);
    expect(signedData.entries.every((e) => e.action === "contract.signed")).toBe(true);

    // Filter by actor.
    const byActor = await auditGet(
      getReq(`${BASE}/${ID}/audit?actor=${ownerId}`, ownerSession),
      params(ID)
    );
    const byActorData = (await json<{ data: { entries: ContractAuditEntry[] } }>(byActor)).data;
    expect(byActorData.entries.every((e) => e.actorId === ownerId)).toBe(true);

    // Date bounds: today includes everything, a past day includes nothing.
    const inRange = await auditGet(
      getReq(`${BASE}/${ID}/audit?from=${today}&to=${today}`, ownerSession),
      params(ID)
    );
    expect((await json<{ data: { total: number } }>(inRange)).data.total).toBe(data.total);

    const outOfRange = await auditGet(
      getReq(`${BASE}/${ID}/audit?to=2000-01-01`, ownerSession),
      params(ID)
    );
    expect((await json<{ data: { entries: ContractAuditEntry[] } }>(outOfRange)).data.entries).toHaveLength(0);
  });
});

// ============================================================
// An overdue request reads as REQUEST_EXPIRED, not a generic conflict
// ============================================================

describe("expiry — an overdue in-flight request", () => {
  const ID = "ctr-request-expired";

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("reports REQUEST_EXPIRED and never claims a code was sent", async () => {
    // Open a request that expires immediately.
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request", expiresInHours: -1 }),
      params(ID)
    );
    expect(created.status).toBe(200);

    const res = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "request_otp" }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("REQUEST_EXPIRED");
  });
});

// ============================================================
// Public invitations — single-use, revoked, expired
// ============================================================

describe("public signature invitation — single-use link", () => {
  const ID = "ctr-invite";
  let requestId: string;
  let landlordId: string;
  let tenantId: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    const { data } = await json<{
      data: { request: { id: string; participants: { id: string; roleFa: string }[] } };
    }>(created);
    requestId = data.request.id;
    landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;
    tenantId = data.request.participants.find((p) => p.roleFa === "مستأجر")!.id;
  });

  it("only ever stores the SHA-256 hash of a raw token", async () => {
    const res = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [tenantId] }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: { invitations: { participantId: string; token: string }[] } }>(
      res
    );
    const raw = data.invitations[0]!.token;

    const stored = signatureDb.listInvitations(requestId);
    const row = stored.find((i) => i.participantId === tenantId)!;
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(crypto.createHash("sha256").update(raw).digest("hex"));
    expect(signatureDb.findInvitationByTokenHash(raw)).toBeNull();

    // The invitation is now in flight and stamped on the trail.
    const types = signatureDb.listSignatureEvents(requestId).map((e) => e.type);
    expect(types).toContain("INVITATION_SENT");
  });

  it("marks the participant VIEWED on first open and keeps the link usable", async () => {
    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [landlordId] }),
      params(ID)
    );
    const { data } = await json<{ data: { invitations: { token: string }[] } }>(issued);
    const token = data.invitations[0]!.token;

    // GET — resolves the invitation publicly, disclosing only the minimum.
    const got = await invitationTokenRoute.GET(getReq(`${INVITATIONS_BASE}/${token}`, null), tokenParams(token));
    expect(got.status).toBe(200);
    const view = (await json<{ data: { referenceCode: string; roleFa: string; status: string } }>(got)).data;
    expect(view.status).toBe("ACTIVE");
    expect(view.roleFa).toBe("موجر");
    expect(view.referenceCode).toContain("LGL-RENT");

    // POST — `open` records the read: participant → VIEWED, DOCUMENT_VIEWED
    // appended. It is idempotent and deliberately does NOT consume the
    // token: the signer still needs the same link to request a review and
    // to complete the OTP steps. Only a TERMINAL act (signature recorded
    // or refusal declared) burns the link — covered by the two specs below.
    const opened = await invitationTokenRoute.POST(
      getReq(`${INVITATIONS_BASE}/${token}`, null),
      tokenParams(token)
    );
    expect(opened.status).toBe(200);
    expect(signatureDb.getParticipant(landlordId)!.status).toBe("VIEWED");
    expect(
      signatureDb.listSignatureEvents(requestId).some((e) => e.type === "DOCUMENT_VIEWED")
    ).toBe(true);

    const again = await invitationTokenRoute.GET(getReq(`${INVITATIONS_BASE}/${token}`, null), tokenParams(token));
    expect(again.status).toBe(200);
    expect((await json<{ data: { status: string } }>(again)).data.status).toBe("ACTIVE");
  });

  it("refuses a revoked invitation", async () => {
    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [tenantId] }),
      params(ID)
    );
    const { data } = await json<{ data: { invitations: { token: string }[] } }>(issued);
    const token = data.invitations[0]!.token;

    // Locate the exact row by its token hash, then revoke it.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const row = signatureDb.findInvitationByTokenHash(tokenHash)!;
    expect(row.participantId).toBe(tenantId);
    const revoked = await invitationsRoute.DELETE(
      deleteReq(`${BASE}/${ID}/invitations?invitationId=${row.id}`, ownerSession),
      params(ID)
    );
    expect(revoked.status).toBe(200);

    const res = await invitationTokenRoute.GET(getReq(`${INVITATIONS_BASE}/${token}`, null), tokenParams(token));
    expect(res.status).toBe(410);
    expect((await json<{ code: string }>(res)).code).toBe("REVOKED");
    expect(
      signatureDb.listSignatureEvents(requestId).some((e) => e.type === "INVITATION_REVOKED")
    ).toBe(true);
  });

  it("refuses an expired invitation and retires the request", async () => {
    const issued = await invitationsRoute.POST(
      req(`${BASE}/${ID}/invitations`, ownerSession, { participantIds: [tenantId], expiresInHours: -1 }),
      params(ID)
    );
    const { data } = await json<{ data: { invitations: { token: string }[] } }>(issued);
    const token = data.invitations[0]!.token;

    const res = await invitationTokenRoute.GET(getReq(`${INVITATIONS_BASE}/${token}`, null), tokenParams(token));
    expect(res.status).toBe(410);
    expect((await json<{ code: string }>(res)).code).toBe("EXPIRED");
    expect(
      signatureDb.listSignatureEvents(requestId).some((e) => e.type === "REQUEST_EXPIRED")
    ).toBe(true);
  });
});

// ============================================================
// Finalize — the stamp is gated on a bound admin approval (§7)
// ============================================================

describe("finalize — the review stamp gate", () => {
  const ID = "ctr-finalize";

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("refuses to finalize an unsigned contract", async () => {
    const res = await finalizePost(
      req(`${BASE}/${ID}/finalize`, ownerSession, {}),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("NOT_SIGNED");
  });

  it("stamps the FINAL version only when its exact hash carries an approval", async () => {
    // Sign both parties (wet-ink for one, OTP for the other).
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
        await signPost(req(`${BASE}/${ID}/sign`, ownerSession, { action: "request_otp", participantId: tenantId }), params(ID))
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

    const res = await finalizePost(req(`${BASE}/${ID}/finalize`, ownerSession, {}), params(ID));
    expect(res.status).toBe(200);
    const { data: out } = await json<{
      data: {
        state: string;
        documentHash: string;
        stamp: { applied: boolean; text: string; disclaimerFa: string; reviewId: string };
      };
    }>(res);
    expect(out.state).toBe("FINALIZED");
    expect(out.stamp.applied).toBe(true);
    expect(out.stamp.text).toBe(CONTRACT_REVIEW_STAMP_TEXT);
    expect(out.stamp.disclaimerFa).toContain("مهر");
    expect(out.stamp.reviewId).toBeTruthy();
  });

  it("refuses to finalize a signed contract whose version has no bound approval", async () => {
    // A synthetic signed contract: both parties "signed" a version that
    // was never admin-approved. The gate must refuse before stamping.
    const id = "ctr-finalize-unapproved";
    const contract = seedContract(id, rentData);
    contractDb.insertContract({
      ...contract,
      state: "SIGNED",
      currentVersionId: "ver-unapproved",
      currentVersionNumber: 1,
    });
    const p1 = party(id, "landlord", "09121110011", true);
    const p2 = party(id, "tenant", "09121110012");
    contractDb.upsertParty(p1);
    contractDb.upsertParty(p2);
    const now = new Date().toISOString();
    for (const p of [p1, p2]) {
      const approval: ContractApproval = {
        id: `apr-${p.role}`,
        contractId: id,
        contractVersionId: "ver-unapproved",
        partyId: p.id,
        status: "approved",
        comment: "امضای طرفین",
        method: "otp",
        approvedAt: now,
        createdAt: now,
      };
      contractDb.insertApproval(approval);
    }

    const res = await finalizePost(req(`${BASE}/${id}/finalize`, ownerSession, {}), params(id));
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("ADMIN_APPROVAL_REQUIRED");
  });
});

// ============================================================
// The version a signature binds to is the version that was approved
// ============================================================

describe("version binding — the signed version carries the approved hash", () => {
  const ID = "ctr-version-binding";

  beforeAll(async () => {
    await seedApprovedContract(ID);
  });

  it("blocks signing when the content moved on after approval", async () => {
    const { getVersion } = contractDb;
    const contract = contractDb.getContractById(ID)!;
    const approvedVersion: PropertyContractVersion = getVersion(ID, contract.currentVersionId!)!;

    // A differing hash no longer matches the admin approval — the same
    // gate the sign route reads, proven directly.
    expect(adminReview.currentVersionApproval(contract, approvedVersion.documentHash)).not.toBeNull();
    expect(adminReview.currentVersionApproval(contract, "f".repeat(64))).toBeNull();
  });
});

// ============================================================
// The two registration paths — reviewed vs directly registered
// ============================================================
// «ثبت نهایی» is a REAL choice with consequences: it skips the review
// queue entirely, says so in the record it writes, and every surface
// reads that record instead of inferring "reviewed". These tests drive
// both paths through the route layer and assert the separation:
//
//   • the unreviewed path is refused without the explicit acknowledgement
//   • it lands in READY_TO_SIGN with a `self_final` record that says
//     `reviewedByLegalir: false` and writes NO admin review at all
//   • the reviewed path queues a decision, and the state machine will not
//     let the unreviewed action pull a contract back out of that queue

describe("registration paths — the review queue versus direct self-final", () => {
  /**
   * A contract at the point «ثبت نهایی» is pressed: complete content,
   * frozen as a version. `createVersion` is the exact function the save
   * path calls, so the hash the registration binds to is the real one.
   */
  function seedFrozenContract(id: string): PropertyContract {
    contractDb.insertContract(seedContract(id, rentData));
    contractDb.upsertParty(party(id, "landlord", "09121110031", true));
    contractDb.upsertParty(party(id, "tenant", "09121110032"));
    snapshot.createVersion(contractDb.getContractById(id)!, ownerId);
    return contractDb.getContractById(id)!;
  }

  it("refuses the unreviewed path unless the warning was acknowledged", async () => {
    const id = "ctr-self-final-no-ack";
    seedFrozenContract(id);

    for (const body of [
      { action: "final_register" },
      { action: "final_register", acknowledgedUnreviewed: false },
    ]) {
      const res = await reviewPost(req(`${BASE}/${id}/review`, ownerSession, body), params(id));
      expect(res.status).toBe(400);
      expect((await json<{ code: string }>(res)).code).toBe("ACKNOWLEDGEMENT_REQUIRED");
    }

    // Nothing may have moved or been written.
    expect(contractDb.getContractById(id)!.state).toBe("READY_FOR_REVIEW");
    expect(registration.listRegistrations(id)).toHaveLength(0);
    expect(adminReview.listAdminReviews(id)).toHaveLength(0);
  });

  it("moves straight to party signing, records self_final, and never queues a review", async () => {
    const id = "ctr-self-final-ok";
    const seeded = seedFrozenContract(id);
    const versionId = seeded.currentVersionId!;
    const versionHash = contractDb.getVersion(id, versionId)!.documentHash;

    const res = await reviewPost(
      req(`${BASE}/${id}/review`, ownerSession, {
        action: "final_register",
        acknowledgedUnreviewed: true,
        comment: "طرفین توافق کردند بدون بررسی ثبت کنند.",
      }),
      params(id)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: { contract: PropertyContract; registration: ContractRegistrationRecord };
    }>(res);
    expect(data.contract.state).toBe("READY_TO_SIGN");

    // The record the whole product reads: hash-bound, explicitly unreviewed,
    // and carrying the user's own reason plus the moment it was chosen.
    const record = data.registration;
    expect(record.path).toBe("self_final");
    expect(record.reviewedByLegalir).toBe(false);
    expect(record.actorKind).toBe("party");
    expect(record.actorId).toBe(ownerId);
    expect(record.contractVersionId).toBe(versionId);
    expect(record.documentHash).toBe(versionHash);
    expect(record.reasonFa).toBe("طرفین توافق کردند بدون بررسی ثبت کنند.");
    expect(record.adminReviewId).toBeNull();
    expect(record.createdAt).toBeTruthy();

    // THE INVARIANT: no review row, no approval. A contract registered this
    // way can never be displayed as reviewed or approved.
    expect(adminReview.listAdminReviews(id)).toHaveLength(0);
    expect(adminReview.currentVersionApproval(data.contract, versionHash)).toBeNull();
    expect(
      registration.resolveSigningAuthorisation({
        contract: data.contract,
        documentHash: versionHash,
        approval: null,
      })?.kind
    ).toBe("self_final");

    // ...and that authorisation is what lets the signing stage open, with
    // no admin decision ever having been taken.
    const opened = await signPost(
      req(`${BASE}/${id}/sign`, ownerSession, { action: "create_request" }),
      params(id)
    );
    expect(opened.status).toBe(200);
    expect((await json<{ data: { contract: PropertyContract } }>(opened)).data.contract.state).toBe(
      "READY_TO_SIGN"
    );
  });

  it("refuses to register the same version twice", async () => {
    const id = "ctr-self-final-dup";
    seedFrozenContract(id);
    const body = { action: "final_register", acknowledgedUnreviewed: true };
    expect(
      (await reviewPost(req(`${BASE}/${id}/review`, ownerSession, body), params(id))).status
    ).toBe(200);

    const again = await reviewPost(req(`${BASE}/${id}/review`, ownerSession, body), params(id));
    expect(again.status).toBe(409);
    expect((await json<{ code: string }>(again)).code).toBe("ALREADY_REGISTERED");
    expect(registration.listRegistrations(id)).toHaveLength(1);
  });

  it("puts the reviewed path in the queue and cannot be pulled out by final_register", async () => {
    const id = "ctr-review-queue";
    seedFrozenContract(id);

    const submitted = await reviewPost(
      req(`${BASE}/${id}/review`, ownerSession, { action: "submit_admin" }),
      params(id)
    );
    expect(submitted.status).toBe(200);
    const swept = (
      await json<{ data: { contract: PropertyContract } }>(submitted)
    ).data.contract;
    expect(swept.state).toBe("PENDING_ADMIN_REVIEW");

    // Exactly one open review, bound to the submitted version's hash.
    const open = adminReview.openAdminReview(id);
    expect(open).not.toBeNull();
    expect(open!.contractVersionId).toBe(swept.currentVersionId);

    // The state machine has no PENDING_ADMIN_REVIEW → READY_TO_SIGN edge,
    // so «ثبت نهایی» cannot shortcut a contract out of a review it entered.
    const shortcut = await reviewPost(
      req(`${BASE}/${id}/review`, ownerSession, {
        action: "final_register",
        acknowledgedUnreviewed: true,
      }),
      params(id)
    );
    expect(shortcut.status).toBe(409);
    expect((await json<{ code: string }>(shortcut)).code).toBe("ILLEGAL_TRANSITION");

    expect(contractDb.getContractById(id)!.state).toBe("PENDING_ADMIN_REVIEW");
    expect(registration.listRegistrations(id)).toHaveLength(0);
  });
});

// ============================================================
// Admin manual advance (T4) — mandatory reason, never a review
// ============================================================

describe("admin manual advance to signing — a reason, a record, never a review", () => {
  const ADVANCE = (id: string) => `${ADMIN_BASE}/${id}/advance-signing`;

  function seedAdvanceable(id: string): PropertyContract {
    contractDb.insertContract(seedContract(id, rentData));
    contractDb.upsertParty(party(id, "landlord", "09121110041", true));
    contractDb.upsertParty(party(id, "tenant", "09121110042"));
    snapshot.createVersion(contractDb.getContractById(id)!, ownerId);
    return contractDb.getContractById(id)!;
  }

  it("is refused for a non-admin", async () => {
    const id = "ctr-advance-forbidden";
    seedAdvanceable(id);
    const res = await advanceSigningPost(
      req(ADVANCE(id), otherSession, { reasonFa: "تأیید تلفنی موکل" }),
      params(id)
    );
    expect(res.status).toBe(403);
  });

  it("requires a written reason and refuses a token one", async () => {
    const id = "ctr-advance-reason";
    seedAdvanceable(id);

    for (const body of [{}, { reasonFa: "  " }, { reasonFa: "اب" }]) {
      const res = await advanceSigningPost(req(ADVANCE(id), adminSession, body), params(id));
      expect(res.status).toBe(400);
      expect((await json<{ code: string }>(res)).code).toBe("REASON_REQUIRED");
    }

    expect(contractDb.getContractById(id)!.state).toBe("READY_FOR_REVIEW");
    expect(registration.listRegistrations(id)).toHaveLength(0);
  });

  it("cannot pull a contract out of the review queue", async () => {
    const id = "ctr-advance-in-queue";
    seedAdvanceable(id);
    const submitted = await reviewPost(
      req(`${BASE}/${id}/review`, ownerSession, { action: "submit_admin" }),
      params(id)
    );
    expect(submitted.status).toBe(200);

    const res = await advanceSigningPost(
      req(ADVANCE(id), adminSession, { reasonFa: "تأیید تلفنی موکل" }),
      params(id)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("REVIEW_PENDING");
    expect(contractDb.getContractById(id)!.state).toBe("PENDING_ADMIN_REVIEW");
    expect(registration.listRegistrations(id)).toHaveLength(0);
  });

  it("advances with the reason recorded and never claims LEGALIR reviewed it", async () => {
    const id = "ctr-advance-ok";
    const seeded = seedAdvanceable(id);
    const versionHash = contractDb.getVersion(id, seeded.currentVersionId!)!.documentHash;
    const reason = "طرفین تلفنی تأیید کردند و درخواست امضا دادند.";

    const res = await advanceSigningPost(req(ADVANCE(id), adminSession, { reasonFa: reason }), params(id));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        contract: PropertyContract;
        registration: ContractRegistrationRecord;
        reviewedByLegalir: boolean;
      };
    }>(res);
    expect(data.contract.state).toBe("READY_TO_SIGN");
    expect(data.reviewedByLegalir).toBe(false);

    const record = data.registration;
    expect(record.path).toBe("self_final");
    expect(record.reviewedByLegalir).toBe(false);
    expect(record.actorKind).toBe("admin");
    expect(record.actorId).toBe(adminId);
    expect(record.reasonFa).toBe(reason);
    expect(record.documentHash).toBe(versionHash);

    // Still no review, still no approval — the admin acted as an operator,
    // not as the legal review office.
    expect(adminReview.listAdminReviews(id)).toHaveLength(0);
    expect(adminReview.currentVersionApproval(data.contract, versionHash)).toBeNull();

    // Both trails carry the action and the reason, and say it was NOT a
    // review. The contract trail is what parties and the admin panel read.
    const entries = contractDb.listAudit(id);
    const advanceEntry = entries.find((e) => e.action === "contract.admin_advanced_to_signing");
    expect(advanceEntry).toBeDefined();
    expect(advanceEntry!.metadata).toMatchObject({
      registrationId: record.id,
      documentHash: versionHash,
      reviewedByLegalir: false,
      fromState: "READY_FOR_REVIEW",
      toState: "READY_TO_SIGN",
    });
    expect(advanceEntry!.descriptionFa).toContain(reason);
    expect(advanceEntry!.descriptionFa).toContain("بدون بررسی لیگالیر");
  });
});

// ============================================================
// Admin message (T6) — 100 code points, and clearing prints nothing
// ============================================================

describe("admin message — capped at 100 code points, cleared to nothing", () => {
  const ID = "ctr-admin-message";

  beforeAll(() => {
    contractDb.insertContract(seedContract(ID, rentData));
  });

  it("is writable only by a review-capable admin", async () => {
    const res = await messagePost(
      req(`${ADMIN_BASE}/${ID}/message`, otherSession, { messageFa: "متن" }),
      params(ID)
    );
    expect(res.status).toBe(403);
    expect(adminPrint.getAdminMessage(ID)).toBeNull();
  });

  it("rejects 101 code points and never stores a truncated copy", async () => {
    const tooLong = "م".repeat(CONTRACT_ADMIN_MESSAGE_MAX + 1);
    const res = await messagePost(
      req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: tooLong }),
      params(ID)
    );
    expect(res.status).toBe(400);
    const body = await json<{ code: string; message: string }>(res);
    expect(body.code).toBe("TOO_LONG");
    expect(body.message).toContain(String(CONTRACT_ADMIN_MESSAGE_MAX));
    expect(adminPrint.getAdminMessage(ID)).toBeNull();
  });

  it("accepts exactly the maximum and reports zero remaining", async () => {
    const exactly = "ا".repeat(CONTRACT_ADMIN_MESSAGE_MAX);
    const res = await messagePost(
      req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: exactly }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        message: { messageFa: string; adminUserId: string; updatedAt: string };
        remainingChars: number;
        finalArtifactRegenerated: boolean;
      };
    }>(res);
    expect(data.message.messageFa).toBe(exactly);
    expect(data.message.adminUserId).toBe(adminId);
    expect(data.remainingChars).toBe(0);
    // The contract is not finalized yet, so there is no stored artifact
    // to replace — the PDF is rendered on demand from this same row.
    expect(data.finalArtifactRegenerated).toBe(false);

    const got = await messageGet(getReq(`${ADMIN_BASE}/${ID}/message`, adminSession), params(ID));
    expect(got.status).toBe(200);
    expect(
      (await json<{ data: { message: { messageFa: string } } }>(got)).data.message.messageFa
    ).toBe(exactly);
  });

  it("an empty message clears the row so nothing reserves space", async () => {
    const res = await messagePost(
      req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: "   " }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: { message: null; remainingChars: number } }>(res);
    expect(data.message).toBeNull();
    expect(data.remainingChars).toBe(CONTRACT_ADMIN_MESSAGE_MAX);
    expect(adminPrint.getAdminMessage(ID)).toBeNull();

    const got = await messageGet(getReq(`${ADMIN_BASE}/${ID}/message`, adminSession), params(ID));
    expect((await json<{ data: { message: null } }>(got)).data.message).toBeNull();
  });
});

// ============================================================
// §2 — the public verification endpoint the printed QR points at
// ============================================================
// The authenticity page prints `/contracts/verify/<publicVerificationId>`
// and a QR encoding the same URL. That route is UNAUTHENTICATED on
// purpose: anybody holding the printed sheet may check it. That also
// makes it the widest privacy surface in the product, so the test proves
// both halves of the promise — it answers for a real finalized contract,
// and it exposes NOTHING beyond the public-safe field set.
describe("§2 — the public verification endpoint behind the QR code", () => {
  const ID = "ctr-public-verify";
  const SELF_FINAL_ID = "ctr-public-verify-self";
  let publicVerificationId: string;

  /** The full public shape, so an unexpected extra key fails the test. */
  const PUBLIC_KEYS = [
    "referenceCode",
    "typeFa",
    "versionNumber",
    "documentHash",
    "finalizedAt",
    "statusFa",
    "partyNames",
    "reviewed",
    "stampLabelFa",
    "reviewedAt",
    "reviewingOfficeFa",
    "reviewId",
  ].sort();

  beforeAll(() => {
    // A REAL finalized sheet: two identified parties, a frozen version (so
    // the route has an actual document hash), and that version marked as
    // the final one. No admin approval — the public page must then report
    // `reviewed: false`.
    contractDb.insertContract(seedContract(ID, rentData));
    contractDb.upsertParty(party(ID, "landlord", "09121110001", true));
    contractDb.upsertParty(party(ID, "tenant", "09121110002"));
    snapshot.createVersion(contractDb.getContractById(ID)!, ownerId);

    const versioned = contractDb.getContractById(ID)!;
    contractDb.updateContractForUser(ownerId, ID, {
      state: "FINALIZED",
      finalVersionId: versioned.currentVersionId,
      finalizedAt: new Date().toISOString(),
    });
    publicVerificationId = versioned.publicVerificationId;
  });

  it("404s for an id that belongs to nothing", async () => {
    const res = await verifyGet(getReq(`${BASE}/verify/do-not-exist`, null), verifyParams("do-not-exist"));
    expect(res.status).toBe(404);
  });

  it("404s for a contract that was never finalized", async () => {
    // `seedContract` starts with no version at all — there is nothing to
    // attest to, and the route must not leak that the id exists.
    contractDb.insertContract(seedContract("ctr-public-verify-draft", rentData));
    const draft = contractDb.getContractById("ctr-public-verify-draft")!;
    const res = await verifyGet(
      getReq(`${BASE}/verify/${draft.publicVerificationId}`, null),
      verifyParams(draft.publicVerificationId)
    );
    expect(res.status).toBe(404);
  });

  it("404s for a DRAFT that has a saved version but no final one", async () => {
    // The trap this pins: `currentVersionId` exists from the first save
    // onward, so an endpoint that falls back to it publishes the hash of a
    // document nobody approved, signed or registered. A saved draft has a
    // real hash — and must still answer 404, because it is not a finished
    // sheet. The public page's own promise is «سند هنوز نهایی نشده است».
    const draftId = "ctr-public-verify-versioned-draft";
    contractDb.insertContract(seedContract(draftId, rentData));
    contractDb.upsertParty(party(draftId, "landlord", "09121110003", true));
    snapshot.createVersion(contractDb.getContractById(draftId)!, ownerId);

    const draft = contractDb.getContractById(draftId)!;
    expect(draft.currentVersionId, "the draft must really carry a version").toBeTruthy();
    expect(draft.finalVersionId).toBeNull();

    const res = await verifyGet(
      getReq(`${BASE}/verify/${draft.publicVerificationId}`, null),
      verifyParams(draft.publicVerificationId)
    );
    expect(res.status).toBe(404);
    expect((await json<{ code: string }>(res)).code).toBe("NOT_FOUND");
  });

  it("answers WITHOUT a session and exposes only public-safe fields", async () => {
    const contract = contractDb.getContractById(ID)!;
    const res = await verifyGet(
      getReq(`${BASE}/verify/${publicVerificationId}`, null),
      verifyParams(publicVerificationId)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Record<string, unknown> & { partyNames: string[] };
    };

    // Exactly the declared public fields — no more.
    expect(Object.keys(body.data).sort()).toEqual(
      expect.arrayContaining(["referenceCode", "typeFa", "documentHash", "partyNames", "reviewed"])
    );
    for (const key of Object.keys(body.data)) {
      expect(PUBLIC_KEYS, `unexpected public field: ${key}`).toContain(key);
    }

    // The values that let a holder confirm the sheet in their hand.
    expect(body.data["referenceCode"]).toBe(contract.referenceCode);
    expect(body.data["documentHash"]).toMatch(/^[a-f0-9]{64}$/);
    // Display names only — never the identity fields behind them.
    expect(Array.isArray(body.data.partyNames)).toBe(true);
    expect(body.data.partyNames.length).toBeGreaterThan(0);
    expect(body.data.partyNames[0]).toBe("مریم محمدی");
  });

  it("never leaks a national id, mobile, address or the contract body", async () => {
    const res = await verifyGet(
      getReq(`${BASE}/verify/${publicVerificationId}`, null),
      verifyParams(publicVerificationId)
    );
    const raw = await res.text();

    // Every sensitive value the parties carry. Note the JSON is serialised
    // once, so a substring hit is a real leak, not a structural artifact.
    for (const secret of [
      "0012345678", // national id
      "09121110001", // landlord mobile
      "09121110002", // tenant mobile
      "خیابان ولیعصر", // address
      "1234567890", // postal code
      "fatherName", // identity key names
      "nationalId",
      "banking",
    ]) {
      expect(raw.includes(secret), `the public payload leaks «${secret}»`).toBe(false);
    }
  });

  it("a self-final registration is reported as NOT reviewed by LEGALIR", async () => {
    // The registration record is the whole point: a contract registered
    // this way must never read as reviewed or approved on the public page.
    contractDb.insertContract(seedContract(SELF_FINAL_ID, rentData));
    contractDb.upsertParty(party(SELF_FINAL_ID, "landlord", "09121110071", true));
    contractDb.upsertParty(party(SELF_FINAL_ID, "tenant", "09121110072"));
    snapshot.createVersion(contractDb.getContractById(SELF_FINAL_ID)!, ownerId);

    const registered = await reviewPost(
      req(`${BASE}/${SELF_FINAL_ID}/review`, ownerSession, {
        action: "final_register",
        acknowledgedUnreviewed: true,
        comment: "ثبت بدون بررسی",
      }),
      params(SELF_FINAL_ID)
    );
    expect(registered.status).toBe(200);

    // Freeze it as the final version the same way finalisation would.
    const current = contractDb.getContractById(SELF_FINAL_ID)!;
    contractDb.updateContractForUser(ownerId, SELF_FINAL_ID, {
      state: "FINALIZED",
      finalVersionId: current.currentVersionId,
      finalizedAt: new Date().toISOString(),
    });

    const res = await verifyGet(
      getReq(`${BASE}/verify/${current.publicVerificationId}`, null),
      verifyParams(current.publicVerificationId)
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: { reviewed: boolean; stampLabelFa?: string; reviewId?: string };
    };
    expect(data.data.reviewed).toBe(false);
    expect(data.data.stampLabelFa).toBeUndefined();
    expect(data.data.reviewId).toBeUndefined();
  });
});

// ============================================================
// T7 — a late change REPLACES the stored final PDF
// ============================================================
// The printed document depends on inputs that are not frozen in the
// version snapshot: the admin's red message, the uploaded signature scans,
// the seal. If one of those changes after finalisation and the stored
// artifact is left alone, the archived PDF and the on-demand/preview
// renders disagree about what "the final contract" says.
//
// These prove the ONE regeneration entry point: every change replaces the
// `final_pdf` row (never adds a second one), and the audit trail records
// that it happened.
describe("T7 — a change after finalisation regenerates the stored PDF", () => {
  const ID = "ctr-t7-regenerate";
  let firstDocumentId: string;
  let firstHash: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(created.status).toBe(200);
    const { data } = await json<{
      data: { request: { participants: { id: string; roleFa: string }[] } };
    }>(created);

    for (const participant of data.request.participants) {
      const sent = await signPost(
        req(`${BASE}/${ID}/sign`, ownerSession, {
          action: "request_otp",
          participantId: participant.id,
        }),
        params(ID)
      );
      expect(sent.status).toBe(200);
      const signed = await signPost(
        req(`${BASE}/${ID}/sign`, ownerSession, {
          action: "verify_otp",
          participantId: participant.id,
          code: "405405",
          consentGiven: true,
        }),
        params(ID)
      );
      expect(signed.status).toBe(200);
    }

    // Rendering needs the real Vazirmatn fonts, which live in the repo —
    // not in the temp DB directory.
    const res = await withRepoCwd(() =>
      finalizePost(req(`${BASE}/${ID}/finalize`, ownerSession, {}), params(ID))
    );
    expect(res.status).toBe(200);
    const { data: out } = await json<{
      data: { finalArtifact: { documentId: string; hash: string } | null };
    }>(res);
    expect(out.finalArtifact, "finalisation stored no artifact").not.toBeNull();
    firstDocumentId = out.finalArtifact!.documentId;
    firstHash = out.finalArtifact!.hash;
  });

  it("setting the message replaces the artifact, byte for byte", async () => {
    const res = await withRepoCwd(() =>
      messagePost(
        req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: "این نسخه بازتولید شد." }),
        params(ID)
      )
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: { finalArtifactRegenerated: boolean } }>(res);
    expect(data.finalArtifactRegenerated).toBe(true);

    const finalDocs = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf");
    // ONE artifact, replaced — a second copy would let two "final" PDFs
    // disagree about which one is current.
    expect(finalDocs).toHaveLength(1);
    expect(finalDocs[0]!.id).not.toBe(firstDocumentId);
    expect(finalDocs[0]!.hash).not.toBe(firstHash);
    expect(finalDocs[0]!.mime).toBe("application/pdf");
    expect(finalDocs[0]!.sizeBytes).toBeGreaterThan(1000);

    // The audit trail says the archived copy was regenerated.
    const regenerated = contractDb
      .listAudit(ID)
      .find((e) => e.action === "contract.final_artifact.regenerated");
    expect(regenerated, "no regeneration audit entry").toBeTruthy();
  });

  it("a second edit replaces it again — still exactly one artifact", async () => {
    const before = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf")[0]!;

    const res = await withRepoCwd(() =>
      messagePost(
        req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: "متن دوم." }),
        params(ID)
      )
    );
    expect(res.status).toBe(200);
    expect(
      (await json<{ data: { finalArtifactRegenerated: boolean } }>(res)).data
        .finalArtifactRegenerated
    ).toBe(true);

    const finalDocs = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf");
    expect(finalDocs).toHaveLength(1);
    expect(finalDocs[0]!.id).not.toBe(before.id);
    expect(finalDocs[0]!.hash).not.toBe(before.hash);
  });

  it("clearing the message regenerates too — the old red strip must disappear", async () => {
    const before = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf")[0]!;

    const res = await withRepoCwd(() =>
      messagePost(
        req(`${ADMIN_BASE}/${ID}/message`, adminSession, { messageFa: "" }),
        params(ID)
      )
    );
    expect(res.status).toBe(200);
    expect(
      (await json<{ data: { finalArtifactRegenerated: boolean } }>(res)).data
        .finalArtifactRegenerated
    ).toBe(true);

    const finalDocs = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf");
    expect(finalDocs).toHaveLength(1);
    expect(finalDocs[0]!.id).not.toBe(before.id);
  });

  it("a regeneration failure never deletes the artifact that already exists", async () => {
    const before = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf")[0]!;
    const { refreshFinalArtifact } = await import("../contracts/finalization");

    // No fonts + an unwritable storage root: the render throws, so the
    // helper must return null and leave the stored row untouched.
    const artifact = await refreshFinalArtifact({
      contractId: ID,
      actorId: adminId,
      baseUrl: "http://localhost",
    });
    // Whatever happened, the existing row is still there and still unique.
    const finalDocs = contractDb
      .listContractDocuments(ID)
      .filter((d) => d.category === "final_pdf");
    expect(finalDocs).toHaveLength(1);
    if (artifact === null) {
      expect(finalDocs[0]!.id).toBe(before.id);
    } else {
      // If a render DID succeed (a machine with fonts reachable from the
      // temp cwd), it must still have replaced rather than duplicated.
      expect(finalDocs[0]!.id).not.toBe(before.id);
    }
  });
});

// ============================================================
// Destination correction (T5) — stored, append-only, send on confirm
// ============================================================

describe("destination correction — stored on that person, sent only on confirmation", () => {
  const ID = "ctr-contact";
  let tenantId: string;
  let tenantPartyId: string;
  let previousMobile: string;

  beforeAll(async () => {
    await seedApprovedContract(ID);
    const created = await signPost(
      req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
      params(ID)
    );
    expect(created.status).toBe(200);
    const { data } = await json<{
      data: { request: { participants: { id: string; roleFa: string; partyId: string }[] } };
    }>(created);
    const tenant = data.request.participants.find((p) => p.roleFa === "مستأجر")!;
    tenantId = tenant.id;
    tenantPartyId = tenant.partyId;
    previousMobile = signatureDb.getParticipant(tenantId)!.mobile;
  });

  it("refuses a correction without a reason or with an invalid number", async () => {
    for (const body of [
      { participantId: tenantId, newMobile: "09121110051" },
      { participantId: tenantId, newMobile: "09121110051", reasonFa: "اب" },
    ]) {
      const res = await contactPost(
        req(`${ADMIN_BASE}/${ID}/contact`, adminSession, body),
        params(ID)
      );
      expect(res.status).toBe(400);
      expect((await json<{ code: string }>(res)).code).toBe("REASON_REQUIRED");
    }

    const bad = await contactPost(
      req(`${ADMIN_BASE}/${ID}/contact`, adminSession, {
        participantId: tenantId,
        newMobile: "12345",
        reasonFa: "شماره اشتباه بود",
      }),
      params(ID)
    );
    expect(bad.status).toBe(400);
    expect((await json<{ code: string }>(bad)).code).toBe("INVALID_MOBILE");

    // Nothing was stored and the participant keeps their original number.
    expect(adminPrint.listContactChanges(ID)).toHaveLength(0);
    expect(signatureDb.getParticipant(tenantId)!.mobile).toBe(previousMobile);
  });

  it("never sends as a side effect of a correction", async () => {
    const res = await contactPost(
      req(`${ADMIN_BASE}/${ID}/contact`, adminSession, {
        participantId: tenantId,
        newMobile: "09121110051",
        reasonFa: "شماره اشتباه بود",
        send: true,
      }),
      params(ID)
    );
    expect(res.status).toBe(400);
    expect((await json<{ code: string }>(res)).code).toBe("CONFIRMATION_REQUIRED");
    expect(signatureDb.getParticipant(tenantId)!.mobile).toBe(previousMobile);
    expect(adminPrint.listContactChanges(ID)).toHaveLength(0);
  });

  it("stores the new number on that person and appends the change record", async () => {
    const res = await contactPost(
      req(`${ADMIN_BASE}/${ID}/contact`, adminSession, {
        participantId: tenantId,
        newMobile: "09121110051",
        reasonFa: "شماره اشتباه بود",
      }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{ data: { sent: boolean; invitation: unknown } }>(res);
    expect(data.sent).toBe(false);
    expect(data.invitation).toBeNull();

    // Rule 1 — the number lives on the participant's own row AND on the
    // party row the next signature request will be built from.
    expect(signatureDb.getParticipant(tenantId)!.mobile).toBe("+989121110051");
    expect(contractDb.getParty(ID, tenantPartyId)!.identity.mobile).toBe("+989121110051");

    // Rule 2 — previous / new / reason / admin / time, append-only.
    const changes = adminPrint.listContactChanges(ID);
    expect(changes).toHaveLength(1);
    const change = changes[0]!;
    expect(change.previousMobile).toBe(previousMobile);
    expect(change.newMobile).toBe("+989121110051");
    expect(change.reasonFa).toBe("شماره اشتباه بود");
    expect(change.adminUserId).toBe(adminId);
    expect(change.changedAt).toBeTruthy();
    // Rule 3 — a correction alone is not a delivery.
    expect(change.deliveryStatus).toBeNull();
  });

  it("sends only after confirmation and writes the real delivery outcome", async () => {
    const res = await contactPost(
      req(`${ADMIN_BASE}/${ID}/contact`, adminSession, {
        participantId: tenantId,
        newMobile: "09121110052",
        reasonFa: "شمارهٔ دومِ طرف درست است",
        send: true,
        confirmed: true,
      }),
      params(ID)
    );
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: {
        sent: boolean;
        invitation: { participantId: string } | null;
        errorFa: string | null;
      };
    }>(res);
    expect(data.invitation).not.toBeNull();
    expect(data.invitation!.participantId).toBe(tenantId);

    // Rule 4 — the outcome is written back to the SAME change row.
    const latest = adminPrint.listContactChanges(ID)[0]!;
    expect(latest.newMobile).toBe("+989121110052");
    expect(latest.deliveryStatus).toBe(data.sent ? "SENT" : "FAILED");
    expect(latest.deliveryChannel).not.toBeNull();
    expect(latest.deliveredAt).toBeTruthy();
    expect(latest.deliveryDetail).toBeTruthy();
  });
});
