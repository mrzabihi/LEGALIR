// ============================================================
// LEGALIR — Compulsory admin review of contracts · END-TO-END (temp DB)
// ============================================================
// §6/§7 of the contract brief: a generated contract MUST pass an internal
// LEGALIR admin approval BEFORE a final version is stamped or a signature is
// issued — and the gate must hold at the BACKEND, not merely in the UI.
//
// This drives the real route handlers against an isolated temp DB:
//
//   owner submit_admin → PENDING review bound to the version hash, contract
//   PENDING_ADMIN_REVIEW → a sign request is REFUSED (ADMIN_APPROVAL_REQUIRED)
//   → a reason-less reject is refused (REASON_REQUIRED) → admin approve →
//   ADMIN_APPROVED with a bound approval → a sign request now SUCCEEDS and
//   the contract enters the signature stage → a differing hash voids the
//   approval (hash binding).
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir. A static import would bind the real dev
// DB — see the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  ContractParty,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as AdminReviewModule from "../contracts/admin-review";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type AdminReview = typeof AdminReviewModule;

let db: Db;
let contractDb: ContractDb;
let adminReview: AdminReview;

let adminSession: string;
let ownerSession: string;
let ownerId: string;
let rentData: PropertyContract["data"];
const CONTRACT_ID = "ctr-admin-rev-1";

let tmpDir: string;
let originalCwd: string;

// Route handlers, imported dynamically so they resolve to the temp DB.
let reviewPost: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let adminPost: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let signPost: (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string, body?: unknown): NextRequest {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function party(role: ContractParty["role"], mobile: string, initiator = false): ContractParty {
  return {
    id: `pty-${role}`,
    contractId: CONTRACT_ID,
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
    referenceCode: "LGL-RENT-1405-000777",
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

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-contract-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  adminReview = await import("../contracts/admin-review");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");

  // The owner + the seeded admin operator.
  const owner = db.createUser({ mobile: "09120000111", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  // A complete rent contract with both parties identified.
  contractDb.insertContract(seedContract(CONTRACT_ID, rentData));
  contractDb.upsertParty(party("landlord", "09121110001", true));
  contractDb.upsertParty(party("tenant", "09121110002"));

  reviewPost = (await import("@/app/api/v1/property-contracts/[id]/review/route"))
    .POST as typeof reviewPost;
  adminPost = (await import("@/app/api/v1/admin/contracts/[id]/route"))
    .POST as typeof adminPost;
  signPost = (await import("@/app/api/v1/property-contracts/[id]/sign/route"))
    .POST as typeof signPost;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const BASE = "http://localhost/api/v1/property-contracts";
const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";

// ============================================================

describe("compulsory admin review — the backend gate on the contract lifecycle", () => {
  it("submit_admin opens a PENDING review bound to the frozen version hash", async () => {
    const res = await reviewPost(
      req(`${BASE}/${CONTRACT_ID}/review`, ownerSession, { action: "submit_admin" }),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: {
        review: { id: string; status: string; documentHash: string };
        version: PropertyContractVersion;
      };
    };
    expect(data.review.status).toBe("PENDING");
    expect(data.review.documentHash).toBe(data.version.documentHash);
    expect(contractDb.getContractById(CONTRACT_ID)!.state).toBe("PENDING_ADMIN_REVIEW");
  });

  it("REFUSES a sign request while the current version has no admin approval", async () => {
    const res = await signPost(
      req(`${BASE}/${CONTRACT_ID}/sign`, ownerSession, { action: "create_request" }),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("ADMIN_APPROVAL_REQUIRED");
  });

  it("REFUSES a reason-less reject — 400 REASON_REQUIRED, nothing decided", async () => {
    const res = await adminPost(
      req(`${ADMIN_BASE}/${CONTRACT_ID}`, adminSession, { action: "reject" }),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("REASON_REQUIRED");
    expect(adminReview.openAdminReview(CONTRACT_ID)!.status).toBe("PENDING");
  });

  it("an admin approve binds APPROVED to the exact hash and records reviewer + event + audit", async () => {
    const res = await adminPost(
      req(`${ADMIN_BASE}/${CONTRACT_ID}`, adminSession, { action: "approve" }),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: {
        approved: boolean;
        review: { status: string; reviewerInitials: string | null; events: unknown[] };
      };
    };
    expect(data.approved).toBe(true);
    expect(data.review.status).toBe("APPROVED");
    expect(data.review.reviewerInitials).toBeTruthy();
    expect(data.review.events).toHaveLength(1);

    expect(contractDb.getContractById(CONTRACT_ID)!.state).toBe("ADMIN_APPROVED");
    expect(adminReview.openAdminReview(CONTRACT_ID)).toBeNull();

    const audit = db.readTable<{ action: string; resourceId: string }>("admin_audit_log");
    expect(
      audit.some(
        (a) => a.action === "contract.admin_review.approve" && a.resourceId === CONTRACT_ID
      )
    ).toBe(true);
  });

  it("NOW a sign request succeeds and the contract enters the signature stage", async () => {
    const res = await signPost(
      req(`${BASE}/${CONTRACT_ID}/sign`, ownerSession, { action: "create_request" }),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: {
        contract: PropertyContract;
        request: { contractVersionId: string; documentHash: string };
      };
    };
    expect(data.contract.state).toBe("READY_TO_SIGN");

    // The signed version carries the SAME hash that was approved.
    const approvedHash = adminReview.latestAdminReview(CONTRACT_ID)!.documentHash;
    expect(data.request.documentHash).toBe(approvedHash);
  });

  it("a content change voids the approval — a differing hash no longer matches", () => {
    const contract = contractDb.getContractById(CONTRACT_ID)!;
    const currentVersion = contractDb.getVersion(CONTRACT_ID, contract.currentVersionId!)!;

    // The approval holds for the approved version's hash...
    expect(
      adminReview.currentVersionApproval(contract, currentVersion.documentHash)
    ).not.toBeNull();
    // ...but a DIFFERENT hash (changed content) no longer matches.
    expect(adminReview.currentVersionApproval(contract, "f".repeat(64))).toBeNull();
    // ...and a missing version authorises nothing.
    expect(adminReview.currentVersionApproval(contract, null)).toBeNull();
    expect(adminReview.latestAdminReview(CONTRACT_ID)!.status).toBe("APPROVED");
  });
});

describe("currentVersionApproval — the hash-bound gate", () => {
  it("returns null when there is no approval for the contract", () => {
    const other = seedContract("ctr-with-no-review", rentData);
    expect(adminReview.currentVersionApproval(other, "a".repeat(64))).toBeNull();
  });

  it("returns null when the latest review is not APPROVED", () => {
    const freshId = "ctr-not-yet-approved";
    contractDb.insertContract(seedContract(freshId, rentData));
    adminReview.createPendingReview({
      contractId: freshId,
      contractVersionId: "ver-x",
      documentHash: "b".repeat(64),
    });
    expect(
      adminReview.currentVersionApproval(seedContract(freshId, rentData), "b".repeat(64))
    ).toBeNull();
  });
});
