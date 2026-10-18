// @vitest-environment node
// ============================================================
// LEGALIR — Admin signature attestations · END-TO-END (temp DB)
// ============================================================
// §3/§5 of the contract brief: an admin may record that they VERIFIED a
// signature a party gave — and nothing more.
//
// These tests drive the real route handler against an isolated temp DB
// and pin the invariants:
//
//   • an attestation cannot exist for a party who has NOT signed;
//   • the origin (channel) and the note are mandatory — no anonymous or
//     note-less confirmation can be recorded;
//   • recording one NEVER changes the participant's status and NEVER
//     advances the contract state — an admin never signs for a party;
//   • the row carries time, admin identity, party, version + hash;
//   • a non-admin session is refused (403);
//   • the contract detail endpoint exposes the attestations separately
//     from the signature request, so the two origins stay distinct.
//
// It also covers the admin's INDEPENDENT per-party resend (§5): one
// party at a time, the previous link revoked in the same call, only the
// token hash stored, and the admin recorded as the actor.
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
import type { ContractParty, PropertyContract } from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id?: string }> }
) => Promise<Response>;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;

let ownerSession: string;
let ownerId: string;
let adminSession: string;
let rentData: PropertyContract["data"];

let tmpDir: string;
let originalCwd: string;

let reviewPost: RouteHandler;
let adminReviewPost: RouteHandler;
let adminDetailGet: RouteHandler;
let signPost: RouteHandler;
let attestationsRoute: { GET: RouteHandler; POST: RouteHandler };
let adminInvitationsRoute: { POST: RouteHandler };

const ID = "ctr-attest-1";
const BASE = "http://localhost/api/v1/property-contracts";
const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";

let landlordId = "";
let tenantId = "";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
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

function getReq(url: string, session: string): NextRequest {
  return new Request(url, {
    method: "GET",
    headers: { cookie: `legalir-session=${session}` },
  }) as unknown as NextRequest;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function party(role: ContractParty["role"], mobile: string, initiator = false): ContractParty {
  return {
    id: `pty-${ID}-${role}`,
    contractId: ID,
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

function seedContract(): PropertyContract {
  const now = new Date().toISOString();
  return {
    id: ID,
    referenceCode: "LGL-RENT-1405-0901",
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
    data: rentData,
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${ID}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as PropertyContract;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-attestations-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  signatureDb = await import("../contracts/signature/db");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");

  const owner = db.createUser({ mobile: "09120000111", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  reviewPost = (await import("@/app/api/v1/property-contracts/[id]/review/route"))
    .POST as unknown as RouteHandler;
  adminReviewPost = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .POST as unknown as RouteHandler;
  adminDetailGet = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .GET as unknown as RouteHandler;
  signPost = (await import("@/app/api/v1/property-contracts/[id]/sign/route"))
    .POST as unknown as RouteHandler;
  attestationsRoute = (await import("@/app/api/v1/admin/contracts/[id]/attestations/route")) as unknown as {
    GET: RouteHandler;
    POST: RouteHandler;
  };
  adminInvitationsRoute = (await import("@/app/api/v1/admin/contracts/[id]/invitations/route")) as unknown as {
    POST: RouteHandler;
  };

  // A complete contract with both parties, driven through the real
  // review gate so a signature request can be opened.
  contractDb.insertContract(seedContract());
  contractDb.upsertParty(party("landlord", "09121110001", true));
  contractDb.upsertParty(party("tenant", "09121110002"));

  expect(
    (
      await reviewPost(
        req(`${BASE}/${ID}/review`, ownerSession, { action: "submit_admin" }),
        params(ID)
      )
    ).status
  ).toBe(200);
  expect(
    (
      await adminReviewPost(
        req(`${ADMIN_BASE}/${ID}`, adminSession, { action: "approve" }),
        params(ID)
      )
    ).status
  ).toBe(200);

  const created = await signPost(
    req(`${BASE}/${ID}/sign`, ownerSession, { action: "create_request" }),
    params(ID)
  );
  expect(created.status).toBe(200);
  const { data } = await json<{
    data: { request: { participants: { id: string; roleFa: string }[] } };
  }>(created);
  landlordId = data.request.participants.find((p) => p.roleFa === "موجر")!.id;
  tenantId = data.request.participants.find((p) => p.roleFa === "مستأجر")!.id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const A = `${ADMIN_BASE}/${ID}/attestations`;

describe("admin signature attestations — evidence, never a signature", () => {
  it("refuses an attestation for a party who has NOT signed", async () => {
    const res = await attestationsRoute.POST(
      req(A, adminSession, {
        participantId: landlordId,
        channel: "party_link",
        noteFa: "لینک اختصاصی را بررسی کردم.",
      }),
      params(ID)
    );
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("PARTICIPANT_NOT_SIGNED");
    expect(signatureDb.listAttestations(ID)).toHaveLength(0);
  });

  it("refuses a missing origin or a note shorter than the minimum", async () => {
    for (const body of [
      { participantId: landlordId, noteFa: "بررسی شد و تأیید می‌کنم." },
      { participantId: landlordId, channel: "made_up", noteFa: "بررسی شد و تأیید می‌کنم." },
      { participantId: landlordId, channel: "phone_call", noteFa: "باشه" },
      { channel: "phone_call", noteFa: "بررسی شد و تأیید می‌کنم." },
    ]) {
      const res = await attestationsRoute.POST(req(A, adminSession, body), params(ID));
      expect(res.status).toBe(400);
    }
    expect(signatureDb.listAttestations(ID)).toHaveLength(0);
  });

  it("refuses a non-admin session (403)", async () => {
    const res = await attestationsRoute.POST(
      req(A, ownerSession, {
        participantId: landlordId,
        channel: "party_link",
        noteFa: "بررسی شد و تأیید می‌کنم.",
      }),
      params(ID)
    );
    expect(res.status).toBe(403);
  });

  it("records the attestation with time, admin, party, version + hash — and changes NO status", async () => {
    // The party signs first (the store is written directly: the signing
    // route's own behaviour is covered by contract-signing-flows).
    signatureDb.updateParticipant(landlordId, {
      status: "SIGNED",
      signedAt: new Date().toISOString(),
      signedMethod: "OTP_ELECTRONIC",
    });
    const before = contractDb.getContractById(ID)!;
    const participantBefore = signatureDb.getParticipant(landlordId)!;

    const res = await attestationsRoute.POST(
      req(A, adminSession, {
        participantId: landlordId,
        channel: "sms_otp_observed",
        noteFa: "کد پیامکی در تماس تصویری برای همین شماره خوانده و تأیید شد.",
      }),
      params(ID)
    );
    expect(res.status).toBe(200);

    const { data } = await json<{
      data: {
        attestation: {
          id: string;
          channel: string;
          channelFa: string;
          noteFa: string;
          adminUserId: string;
          adminLabelFa: string;
          participantId: string;
          contractVersionId: string;
          documentHash: string | null;
          createdAt: string;
        };
        stateChanged: boolean;
        participantStatusChanged: boolean;
      };
    }>(res);

    expect(data.attestation.channel).toBe("sms_otp_observed");
    expect(data.attestation.channelFa).toContain("کد پیامکی");
    expect(data.attestation.adminUserId).toBeTruthy();
    expect(data.attestation.adminLabelFa).toBeTruthy();
    expect(data.attestation.participantId).toBe(landlordId);
    expect(data.attestation.contractVersionId).toBe(before.currentVersionId);
    expect(data.attestation.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(data.attestation.createdAt).toISOString()).toBe(data.attestation.createdAt);

    // The two assertions the § instruction demands:
    expect(data.stateChanged).toBe(false);
    expect(data.participantStatusChanged).toBe(false);

    // And the store agrees — nothing moved except the new evidence row.
    expect(contractDb.getContractById(ID)!.state).toBe(before.state);
    expect(signatureDb.getParticipant(landlordId)!.status).toBe(participantBefore.status);
    expect(signatureDb.listAttestations(ID)).toHaveLength(1);

    // The event trail carries the attestation with its origin.
    const request = signatureDb.latestSignatureRequest(ID)!;
    const event = signatureDb
      .listSignatureEvents(request.id)
      .find((e) => e.type === "ADMIN_ATTESTATION");
    expect(event).toBeDefined();
    expect(event!.metadata["channel"]).toBe("sms_otp_observed");
    expect(event!.metadata["noteFa"]).toContain("کد پیامکی");

    // The platform audit trail records it too.
    const audit = db.readTable<{ action: string; resourceId: string }>("admin_audit_log");
    expect(
      audit.some((a) => a.action === "contract.signature.attested" && a.resourceId === ID)
    ).toBe(true);
  });

  it("surfaces attestations separately from the signature request on the admin detail", async () => {
    const res = await adminDetailGet(getReq(`${ADMIN_BASE}/${ID}`, adminSession), params(ID));
    expect(res.status).toBe(200);

    const { data } = await json<{
      data: {
        attestations: { id: string; channel: string; participantId: string }[];
        signatureRequest: { participants: { id: string; status: string }[] } | null;
      };
    }>(res);

    expect(data.attestations).toHaveLength(1);
    expect(data.attestations[0]!.channel).toBe("sms_otp_observed");
    // The party's own status is still the one THEY produced — the
    // attestation did not create or alter a signature.
    const party = data.signatureRequest!.participants.find((p) => p.id === landlordId)!;
    expect(party.status).toBe("SIGNED");
    const unsigned = data.signatureRequest!.participants.find((p) => p.id === tenantId)!;
    expect(unsigned.status).toBe("PENDING");
  });

  it("GET lists every attestation for the contract", async () => {
    const res = await attestationsRoute.GET(getReq(A, adminSession), params(ID));
    expect(res.status).toBe(200);
    const { data } = await json<{
      data: { attestations: { channelFa: string }[] };
    }>(res);
    expect(data.attestations).toHaveLength(1);
    expect(data.attestations[0]!.channelFa).toBeTruthy();
  });
});

// ============================================================
// §5 — the admin's INDEPENDENT per-party resend
// ============================================================
// One party at a time, through the SAME issuing implementation as the
// owner workspace: previous ACTIVE link revoked, only the hash stored,
// the real delivery outcome reported, and the actor recorded as an admin.

describe("admin per-party resend", () => {
  const R = `${ADMIN_BASE}/${ID}/invitations`;

  it("issues a link for ONE party only, revoking that party's previous link", async () => {
    const first = await adminInvitationsRoute.POST(
      req(R, adminSession, { participantIds: [tenantId] }),
      params(ID)
    );
    expect(first.status).toBe(200);
    const firstData = (
      await json<{
        data: {
          invitations: { participantId: string; token: string }[];
          revokedInvitationIds: string[];
          actorLabelFa: string;
        };
      }>(first)
    ).data;
    expect(firstData.invitations).toHaveLength(1);
    expect(firstData.invitations[0]!.participantId).toBe(tenantId);
    // The actor is the real admin display name — never the owner's label.
    expect(firstData.actorLabelFa).toBeTruthy();
    expect(firstData.actorLabelFa).not.toBe("کاربر");
    expect(firstData.revokedInvitationIds).toHaveLength(0);

    const request = signatureDb.latestSignatureRequest(ID)!;
    const oldToken = firstData.invitations[0]!.token;
    const oldRow = signatureDb.findInvitationByTokenHash(
      crypto.createHash("sha256").update(oldToken).digest("hex")
    )!;

    // Resend to the SAME party: exactly one new link, the old one revoked.
    const second = await adminInvitationsRoute.POST(
      req(R, adminSession, { participantIds: [tenantId] }),
      params(ID)
    );
    const secondData = (
      await json<{
        data: { invitations: { participantId: string; token: string }[]; revokedInvitationIds: string[] };
      }>(second)
    ).data;
    expect(secondData.invitations).toHaveLength(1);
    expect(secondData.revokedInvitationIds).toContain(oldRow.id);

    // Only ONE link can ever be usable for that party.
    const active = signatureDb
      .listInvitations(request.id)
      .filter((i) => i.participantId === tenantId && i.status === "ACTIVE");
    expect(active).toHaveLength(1);
  });

  it("records the resend in the event trail with the admin as the actor", async () => {
    const request = signatureDb.latestSignatureRequest(ID)!;
    const before = signatureDb.listSignatureEvents(request.id).length;

    // Resend to the landlord — a fresh send (and, because the tenant's
    // link is untouched, exactly one recipient) must land on the trail.
    const res = await adminInvitationsRoute.POST(
      req(R, adminSession, { participantIds: [landlordId] }),
      params(ID)
    );
    expect(res.status).toBe(200);

    const added = signatureDb.listSignatureEvents(request.id).slice(before);
    expect(added.length).toBeGreaterThanOrEqual(1);
    const send = added.find(
      (e) => e.type === "INVITATION_SENT" || e.type === "INVITATION_FAILED"
    );
    expect(send).toBeDefined();
    // The actor names the ADMIN, so an admin resend can never be read as
    // an owner-initiated send («کاربر»).
    expect(send!.metadata["actor"]).toBe("ادمین لیگالیر");
    expect(send!.participantId).toBe(landlordId);
    expect(send!.contractVersionId).toBe(request.contractVersionId);
  });

  it("refuses a non-admin session (403)", async () => {
    const res = await adminInvitationsRoute.POST(
      req(R, ownerSession, { participantIds: [tenantId] }),
      params(ID)
    );
    expect(res.status).toBe(403);
  });
});
