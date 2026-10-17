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
//     send is reported as OTP_SEND_FAILED, never a fake success
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
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import {
  CONTRACT_REVIEW_STAMP_TEXT,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;

let ownerSession: string;
let ownerId: string;
let otherSession: string;
let adminSession: string;
let rentData: PropertyContract["data"];
let today: string;

let tmpDir: string;
let originalCwd: string;

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id?: string; token?: string }> }
) => Promise<Response>;

let reviewPost: RouteHandler;
let adminPost: RouteHandler;
let signPost: RouteHandler;
let finalizePost: RouteHandler;
let invitationsRoute: {
  POST: RouteHandler;
  GET: RouteHandler;
  DELETE: RouteHandler;
};
let auditGet: RouteHandler;
let invitationTokenRoute: { GET: RouteHandler; POST: RouteHandler };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function tokenParams(token: string) {
  return { params: Promise.resolve({ token }) };
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
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");
  today = new Date().toISOString().slice(0, 10);

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
  finalizePost = (await import("@/app/api/v1/property-contracts/[id]/finalize/route"))
    .POST as unknown as RouteHandler;
  auditGet = (await import("@/app/api/v1/property-contracts/[id]/audit/route"))
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

  it("reports a REAL failed send as OTP_SEND_FAILED rather than a fake success", async () => {
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
    expect((await json<{ code: string }>(blocked)).code).toBe("OTP_SEND_FAILED");

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

    const tooLarge = new FormData();
    tooLarge.append("participantId", landlordId);
    tooLarge.append(
      "file",
      new File([new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)], "scan.png", { type: "image/png" })
    );
    const r3 = await signPost(
      multipartReq(`${BASE}/${ID}/sign`, ownerSession, tooLarge),
      params(ID)
    );
    expect(r3.status).toBe(400);
    expect((await json<{ code: string }>(r3)).code).toBe("FILE_TOO_LARGE");

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

  it("marks the participant VIEWED on first open and refuses a second use", async () => {
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

    // POST — consume the token: participant → VIEWED, DOCUMENT_VIEWED appended.
    const opened = await invitationTokenRoute.POST(
      getReq(`${INVITATIONS_BASE}/${token}`, null),
      tokenParams(token)
    );
    expect(opened.status).toBe(200);
    expect(signatureDb.getParticipant(landlordId)!.status).toBe("VIEWED");
    expect(
      signatureDb.listSignatureEvents(requestId).some((e) => e.type === "DOCUMENT_VIEWED")
    ).toBe(true);

    // Single-use: a second GET is refused.
    const again = await invitationTokenRoute.GET(getReq(`${INVITATIONS_BASE}/${token}`, null), tokenParams(token));
    expect(again.status).toBe(410);
    expect((await json<{ code: string }>(again)).code).toBe("USED");
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
    const adminReview = await import("../contracts/admin-review");
    expect(adminReview.currentVersionApproval(contract, approvedVersion.documentHash)).not.toBeNull();
    expect(adminReview.currentVersionApproval(contract, "f".repeat(64))).toBeNull();
  });
});
