// ============================================================
// LEGALIR — Admin contract record · the whole lifecycle in one payload
// ============================================================
// §2.4 of the brief: the admin panel must record and display the
// contract, the parties, the draft and final versions, the
// supplementary note, the changes, the approval times, the signature
// requests and each party's own status — with no duplicates and no
// version lost.
//
// The drawer renders these fields, but the payload is the authority:
// if the GET route does not carry them, no UI can show them honestly.
// This drives the real route handler against an isolated temp DB (the
// team convention: `db.ts` binds its store at import time, so every
// module is imported dynamically AFTER chdir).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  ContractApproval,
  ContractParty,
  PropertyContract,
  PropertyContractVersion,
  SignatureInvitation,
  SignatureParticipant,
  SignatureRequest,
} from "@legalir/types";
// Type-only import: erased at compile time, so it cannot bind the live DB
// before `chdir` the way a value import of db.ts would.
import type { AdminContractDetail } from "@/lib/api/admin";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;

let ownerId: string;
let adminSession: string;
let tmpDir: string;
let originalCwd: string;

const CONTRACT_ID = "ctr-record-1";
const VERSION_1 = "ver-r-1";
const VERSION_2 = "ver-r-2";
const NOTE = "یادداشت تکمیلی یکتا — تمدید تلفنی معتبر نیست.";

type Route = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let adminGet: Route;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string): NextRequest {
  return new Request(url, {
    method: "GET",
    headers: { cookie: `legalir-session=${session}` },
  }) as unknown as NextRequest;
}

function party(role: ContractParty["role"], initiator = false): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: CONTRACT_ID,
    role,
    capacity: "owner",
    identity: {
      firstName: role === "landlord" ? "مریم" : "رضا",
      lastName: role === "landlord" ? "محمدی" : "کریمی",
      fatherName: "علی",
      nationalId: "0012345678",
      birthCertificateNumber: "1234",
      birthCertificatePlace: "تهران",
      birthDate: null,
      mobile: role === "landlord" ? "09121110001" : "09121110002",
      address: "تهران",
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
  } as ContractParty;
}

let rentData: PropertyContract["data"];

function seedContract(): PropertyContract {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: CONTRACT_ID,
    referenceCode: "LGL-RENT-1405-000777",
    userId: ownerId,
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "READY_TO_SIGN",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
    currentStep: "signature",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data: {
      ...rentData,
      customClauses: [
        {
          id: "cc-1",
          kind: "agreement",
          title: "بند توافقی یکتا",
          body: "متن بند توافقی.",
          sectionRef: "financial",
          createdAt: now,
        },
        {
          id: "cc-2",
          kind: "change_request",
          title: "درخواست تغییر یکتا",
          body: "متن درخواست تغییر.",
          createdAt: now,
        },
      ],
      supplementary: { notes: NOTE, noteConfirmedAt: now, confirmedAt: now },
    },
    currentVersionId: VERSION_2,
    currentVersionNumber: 2,
    finalVersionId: VERSION_1,
    finalizedAt: now,
    publicVerificationId: `vrf-${CONTRACT_ID}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as PropertyContract;
}

function seedVersion(id: string, number: number, createdAt: string): PropertyContractVersion {
  return {
    id,
    contractId: CONTRACT_ID,
    versionNumber: number,
    templateVersion: "1.0.0",
    documentHash: `hash-${number}`.padEnd(64, "a"),
    snapshot: {} as PropertyContractVersion["snapshot"],
    createdBy: ownerId,
    createdAt,
    schemaVersion: 1,
  } as unknown as PropertyContractVersion;
}

function approval(
  versionId: string,
  partyId: string,
  status: ContractApproval["status"]
): ContractApproval {
  return {
    id: `ap-${partyId}-${versionId}`,
    contractId: CONTRACT_ID,
    contractVersionId: versionId,
    partyId,
    status,
    comment: "",
    method: "explicit_consent",
    approvedAt: status === "approved" ? "2026-01-04T10:00:00.000Z" : null,
    createdAt: "2026-01-04T09:00:00.000Z",
  };
}

function seedSignature(): void {
  const request: SignatureRequest = {
    id: "sr-1",
    contractId: CONTRACT_ID,
    contractVersionId: VERSION_2,
    documentHash: "hash-2".padEnd(64, "a"),
    provider: "OTP_SIGNATURE",
    assuranceLevel: "ELECTRONIC_CONFIRMATION",
    status: "SENT",
    expiresAt: null,
    createdBy: ownerId,
    createdAt: "2026-01-05T08:00:00.000Z",
    updatedAt: "2026-01-05T08:00:00.000Z",
    completedAt: null,
  };
  signatureDb.insertSignatureRequest(request);

  const signed: SignatureParticipant = {
    id: "p-1",
    signatureRequestId: request.id,
    contractId: CONTRACT_ID,
    partyId: "pty-landlord",
    roleFa: "موجر",
    nameFa: "مریم محمدی",
    mobileMasked: "0912***0001",
    mobile: "09121110001",
    status: "SIGNED",
    viewedAt: "2026-01-05T09:00:00.000Z",
    signedAt: "2026-01-06T09:00:00.000Z",
    signedMethod: "OTP_ELECTRONIC",
    proofDocumentId: null,
    declinedAt: null,
    declineReason: null,
    createdAt: "2026-01-05T08:00:00.000Z",
  };
  const pending: SignatureParticipant = {
    ...signed,
    id: "p-2",
    partyId: "pty-tenant",
    roleFa: "مستأجر",
    nameFa: "رضا کریمی",
    mobileMasked: "0912***0002",
    mobile: "09121110002",
    status: "PENDING",
    viewedAt: null,
    signedAt: null,
    signedMethod: null,
  };
  signatureDb.insertParticipant(signed);
  signatureDb.insertParticipant(pending);

  const used: SignatureInvitation = {
    id: "inv-1",
    contractId: CONTRACT_ID,
    signatureRequestId: request.id,
    participantId: "p-1",
    tokenHash: "b".repeat(64),
    recipientMasked: "0912***0001",
    status: "USED",
    verifyBeforeView: false,
    expiresAt: "2026-01-12T08:00:00.000Z",
    usedAt: "2026-01-06T09:00:00.000Z",
    revokedAt: null,
    createdAt: "2026-01-05T08:00:00.000Z",
    deliveryChannel: "sms",
    deliveryStatus: "SENT",
    lastSentAt: "2026-01-05T08:00:00.000Z",
  };
  const failed: SignatureInvitation = {
    ...used,
    id: "inv-2",
    participantId: "p-2",
    recipientMasked: "0912***0002",
    status: "ACTIVE",
    usedAt: null,
    deliveryChannel: "none",
    deliveryStatus: "FAILED",
  };
  signatureDb.insertInvitation(used);
  signatureDb.insertInvitation(failed);

  // A superseded request must stay on record, never be duplicated away.
  signatureDb.insertSignatureRequest({
    ...request,
    id: "sr-0",
    contractVersionId: VERSION_1,
    status: "CANCELLED",
    createdAt: "2026-01-02T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
  });
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-admin-record-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  signatureDb = await import("../contracts/signature/db");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");

  const owner = db.createUser({ mobile: "09120000333", passwordHash: "x" });
  ownerId = owner.id;
  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  contractDb.insertContract(seedContract());
  contractDb.upsertParty(party("landlord", true));
  contractDb.upsertParty(party("tenant"));
  contractDb.insertVersion(seedVersion(VERSION_1, 1, "2026-01-01T00:00:00.000Z"));
  contractDb.insertVersion(seedVersion(VERSION_2, 2, "2026-01-03T00:00:00.000Z"));
  contractDb.insertApproval(approval(VERSION_2, "pty-landlord", "approved"));
  contractDb.insertApproval(approval(VERSION_2, "pty-tenant", "pending"));
  seedSignature();

  adminGet = (await import("@/app/api/v1/admin/contracts/[id]/route")).GET as Route;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";

async function loadRecord(): Promise<AdminContractDetail> {
  const res = await adminGet(
    req(`${ADMIN_BASE}/${CONTRACT_ID}`, adminSession),
    params(CONTRACT_ID)
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: AdminContractDetail }).data;
}

describe("admin contract record (§2.4)", () => {
  it("carries the supplementary note and the moment it was confirmed", async () => {
    const data = await loadRecord();
    const supplementary = data.supplementary as {
      notes: string;
      noteConfirmedAt: string | null;
      confirmedAt: string | null;
    };

    expect(supplementary.notes).toBe(NOTE);
    expect(supplementary.noteConfirmedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(supplementary.confirmedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("lists agreed clauses and requested changes as distinct kinds", async () => {
    const data = await loadRecord();
    const clauses = data.customClauses as {
      id: string;
      kind: string;
      title: string;
      sectionTitleFa: string | null;
    }[];

    expect(clauses).toHaveLength(2);
    expect(clauses[0]!.kind).toBe("agreement");
    // The section ref is resolved to its Persian title, not left raw.
    expect(clauses[0]!.sectionTitleFa).toBe("شرایط مالی");
    expect(clauses[1]!.kind).toBe("change_request");
  });

  it("returns EVERY version, marking the current and the final one", async () => {
    const data = await loadRecord();
    const versions = data.versions as {
      id: string;
      versionNumber: number;
      isCurrent: boolean;
      isFinal: boolean;
      templateVersion: string;
    }[];

    expect(versions).toHaveLength(2);
    // Newest first, both survive — no version is collapsed or overwritten.
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({ id: VERSION_2, isCurrent: true, isFinal: false });
    expect(versions[1]).toMatchObject({ id: VERSION_1, isCurrent: false, isFinal: true });
  });

  it("returns party approvals with their exact times and Persian role labels", async () => {
    const data = await loadRecord();
    const approvals = data.approvals as {
      partyRoleFa: string;
      status: string;
      approvedAt: string | null;
    }[];

    expect(approvals).toHaveLength(2);
    expect(approvals.every((a) => a.partyRoleFa.length > 0)).toBe(true);
    const yes = approvals.find((a) => a.status === "approved")!;
    expect(yes.approvedAt).toBe("2026-01-04T10:00:00.000Z");
    expect(approvals.find((a) => a.status === "pending")!.approvedAt).toBeNull();
  });

  it("labels each party with a Persian role — never the raw token", async () => {
    const data = await loadRecord();
    const parties = data.parties as { role: string; roleFa: string }[];

    expect(parties.map((p) => p.roleFa)).toEqual(["موجر", "مستأجر"]);
    expect(parties.some((p) => p.roleFa === p.role)).toBe(false);
  });

  it("returns each signing party's own status and every invitation's delivery outcome", async () => {
    const data = await loadRecord();
    const request = data.signatureRequest as {
      status: string;
      statusFa: string;
      participants: {
        partyId: string | null;
        status: string;
        statusFa: string;
        signedAt: string | null;
      }[];
      invitations: {
        participantId: string;
        deliveryStatus: string | null;
        deliveryChannel: string | null;
      }[];
    };

    expect(request.status).toBe("SENT");
    expect(request.statusFa).toBe("ارسال‌شده");
    expect(request.participants).toHaveLength(2);
    const signed = request.participants.find((p) => p.partyId === "pty-landlord")!;
    expect(signed).toMatchObject({ status: "SIGNED", signedAt: "2026-01-06T09:00:00.000Z" });
    expect(request.participants.find((p) => p.partyId === "pty-tenant")!.status).toBe("PENDING");

    // A failed delivery is reported as failed — never silently as sent.
    const failed = request.invitations.find((i) => i.participantId === "p-2")!;
    expect(failed).toMatchObject({ deliveryStatus: "FAILED", deliveryChannel: "none" });
    expect(request.invitations.find((i) => i.participantId === "p-1")!.deliveryStatus).toBe("SENT");
  });

  it("keeps every request ever issued, including a superseded one", async () => {
    const data = await loadRecord();
    const requests = data.signatureRequests as { id: string; statusFa: string }[];

    expect(requests.map((r) => r.id).sort()).toEqual(["sr-0", "sr-1"]);
    expect(requests.find((r) => r.id === "sr-0")!.statusFa).toBe("لغو‌شده");
  });
});
