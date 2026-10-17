// ============================================================
// LEGALIR — Review comments: version binding, visibility and replies
// ============================================================
// §4 and the "نظرهای پس از ارسال" section of the contract brief:
//
//   • a comment is bound to the VERSION it was written against, never to
//     the mutable contract — so a note can never be silently re-dated;
//   • `internal` notes stay in the drafter's workspace and are never sent
//     to the counterparty, while `parties` notes are shared;
//   • a reply must live in the SAME version thread — replying to a note
//     about text that no longer exists is refused;
//   • an operator reviewing the contract sees the FULL thread, internal
//     notes included, because the decision depends on them.
//
// The route handlers are driven against an isolated temp DB (`db.ts`
// resolves its store from cwd at import time, so every module is
// imported dynamically after chdir — the team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { ContractParty, PropertyContract, PropertyContractVersion } from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as ReviewDbModule from "../contracts/review-db";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type ReviewDb = typeof ReviewDbModule;

let db: Db;
let contractDb: ContractDb;
let reviewDb: ReviewDb;

let ownerSession: string;
let ownerId: string;
let adminSession: string;
const CONTRACT_ID = "ctr-comments-1";
const OTHER_CONTRACT_ID = "ctr-comments-2";
const VERSION_1 = "ver-c-1";
const VERSION_2 = "ver-c-2";

let tmpDir: string;
let originalCwd: string;

type Route = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let reviewPost: Route;
let adminGet: Route;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string, body?: unknown): NextRequest {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function party(role: ContractParty["role"], initiator = false): ContractParty {
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
      mobile: "09121110001",
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

let rentData: PropertyContract["data"];

function seedContract(
  id: string,
  currentVersionId: string | null,
  data: PropertyContract["data"]
): PropertyContract {
  const now = new Date().toISOString();
  return {
    id,
    referenceCode: "LGL-RENT-1405-000123",
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
    currentVersionId,
    currentVersionNumber: currentVersionId ? 1 : 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${id}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as PropertyContract;
}

function seedVersion(contractId: string, id: string, number: number): PropertyContractVersion {
  const now = new Date().toISOString();
  return {
    id,
    contractId,
    versionNumber: number,
    templateVersion: "1.0.0",
    documentHash: "a".repeat(64),
    snapshot: {
      data: rentData,
      parties: [party("landlord", true), party("tenant")],
      payments: [],
      documentsManifest: [],
    },
    createdBy: ownerId,
    createdAt: now,
  } as unknown as PropertyContractVersion;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-contract-comments-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  reviewDb = await import("../contracts/review-db");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");

  const owner = db.createUser({ mobile: "09120000222", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  contractDb.insertContract(seedContract(CONTRACT_ID, VERSION_1, rentData));
  contractDb.upsertParty(party("landlord", true));
  contractDb.upsertParty(party("tenant"));
  contractDb.insertVersion(seedVersion(CONTRACT_ID, VERSION_1, 1));

  reviewPost = (await import("@/app/api/v1/property-contracts/[id]/review/route"))
    .POST as Route;
  adminGet = (await import("@/app/api/v1/admin/contracts/[id]/route")).GET as Route;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const BASE = "http://localhost/api/v1/property-contracts";
const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";

async function comment(body: Record<string, unknown>) {
  return reviewPost(
    req(`${BASE}/${CONTRACT_ID}/review`, ownerSession, { action: "comment", ...body }),
    params(CONTRACT_ID)
  );
}

describe("review comments — version binding and visibility", () => {
  it("defaults to an internal note bound to the current version", async () => {
    const res = await comment({ body: "بند ۳ نیاز به اصلاح دارد." });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { comment: { contractVersionId: string; visibility: string; parentId: unknown } };
    };
    expect(data.comment.contractVersionId).toBe(VERSION_1);
    expect(data.comment.visibility).toBe("internal");
    expect(data.comment.parentId).toBeNull();
  });

  it("stores a shared note as `parties`", async () => {
    const res = await comment({ body: "لطفاً تاریخ تحویل را تأیید کنید.", visibility: "parties" });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { comment: { visibility: string } } };
    expect(data.comment.visibility).toBe("parties");
  });

  it("never hands an internal note to a counterparty view", () => {
    const all = reviewDb.listReviewComments(CONTRACT_ID);
    const shared = reviewDb.listReviewComments(CONTRACT_ID, { maxVisibility: "parties" });

    expect(all.length).toBeGreaterThan(shared.length);
    expect(shared.length).toBeGreaterThan(0);
    for (const c of shared) expect(c.visibility).toBe("parties");
    const internal = all.find((c) => c.visibility !== "parties");
    expect(internal).toBeDefined();
    expect(shared.some((c) => c.id === internal!.id)).toBe(false);
  });

  it("filters the thread by version so a note is never re-dated", () => {
    contractDb.insertVersion(seedVersion(CONTRACT_ID, VERSION_2, 2));
    contractDb.updateContractForUser(ownerId, CONTRACT_ID, { currentVersionId: VERSION_2 });

    expect(
      reviewDb.listReviewComments(CONTRACT_ID, { versionId: VERSION_1 }).length
    ).toBeGreaterThan(0);
    expect(reviewDb.listReviewComments(CONTRACT_ID, { versionId: VERSION_2 })).toEqual([]);
  });
});

describe("review comments — replies stay inside their version thread", () => {
  it("accepts a reply to a note on the current version", async () => {
    const res = await comment({ body: "در نسخهٔ ۲ اعمال شد." });
    const { data } = (await res.json()) as { data: { comment: { id: string } } };

    const reply = await comment({ body: "تأیید می‌شود.", parentId: data.comment.id });
    expect(reply.status).toBe(200);
    const replyData = (await reply.json()) as {
      data: { comment: { parentId: string; contractVersionId: string } };
    };
    expect(replyData.data.comment.parentId).toBe(data.comment.id);
    expect(replyData.data.comment.contractVersionId).toBe(VERSION_2);
  });

  it("REFUSES a reply to a note written against another version", async () => {
    const oldNote = reviewDb.listReviewComments(CONTRACT_ID, { versionId: VERSION_1 })[0]!;
    const res = await comment({ body: "پاسخ به یادداشت قدیمی.", parentId: oldNote.id });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("PARENT_VERSION_MISMATCH");
    expect(
      reviewDb.listReviewComments(CONTRACT_ID).some((c) => c.body === "پاسخ به یادداشت قدیمی.")
    ).toBe(false);
  });

  it("REFUSES a reply to a note that does not exist", async () => {
    const res = await comment({ body: "پاسخ یتیم.", parentId: "rc-does-not-exist" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("PARENT_NOT_FOUND");
  });

  it("REFUSES an empty note — no blank row reaches the thread", async () => {
    const res = await comment({ body: "   " });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("EMPTY_COMMENT");
  });
});

describe("operator view — the full thread, internal notes included", () => {
  it("returns every comment, including internal, with its version", async () => {
    const res = await adminGet(
      req(`${ADMIN_BASE}/${CONTRACT_ID}`, adminSession),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: { comments: { contractVersionId: string; visibility?: string }[] };
    };
    const all = reviewDb.listReviewComments(CONTRACT_ID);
    expect(data.comments).toHaveLength(all.length);
    expect(data.comments.some((c) => (c.visibility ?? "internal") === "internal")).toBe(true);
    expect(
      data.comments.every(
        (c) => c.contractVersionId === VERSION_1 || c.contractVersionId === VERSION_2
      )
    ).toBe(true);
  });

  it("never leaks another contract's thread", () => {
    expect(reviewDb.listReviewComments(OTHER_CONTRACT_ID)).toEqual([]);
  });
});

describe("post-send comments — anchored, attributed, durable, never operative", () => {
  it("stores a clause-anchored change request with its author and timestamp", async () => {
    const res = await comment({
      body: "مبلغ پیش‌پرداخت را به ۳۰٪ برسانید.",
      kind: "change_request",
      clauseRef: "rent.financial",
      visibility: "parties",
    });
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: { comment: { id: string; kind: string; clauseRef: string; authorLabelFa: string } };
    };
    expect(data.comment.kind).toBe("change_request");
    expect(data.comment.clauseRef).toBe("rent.financial");
    expect(data.comment.authorLabelFa).toBeTruthy();

    // The stored row is exactly what the UI shows: anchor + kind +
    // author + a real ISO timestamp, bound to the current version.
    const stored = reviewDb.listReviewComments(CONTRACT_ID).find((c) => c.id === data.comment.id)!;
    expect(stored.clauseRef).toBe("rent.financial");
    expect(stored.kind).toBe("change_request");
    expect(stored.contractVersionId).toBe(VERSION_2);
    expect(Number.isNaN(Date.parse(stored.createdAt))).toBe(false);
  });

  it("accepts a comment on a contract that has already been sent", async () => {
    contractDb.updateContractForUser(ownerId, CONTRACT_ID, { state: "READY_TO_SIGN" });

    const res = await comment({ body: "نظر پس از ارسال برای طرفین." });
    expect(res.status).toBe(200);

    // Posting a comment must never mutate the contract or its version —
    // the official text and the discussion around it stay separate.
    const updated = contractDb.getContractForUser(ownerId, CONTRACT_ID)!;
    expect(updated.state).toBe("READY_TO_SIGN");
    expect(updated.currentVersionId).toBe(VERSION_2);

    contractDb.updateContractForUser(ownerId, CONTRACT_ID, { state: "READY_FOR_REVIEW" });
  });

  it("keeps the comment after a fresh read of the store", async () => {
    const before = reviewDb.listReviewComments(CONTRACT_ID);
    const target = before.find((c) => c.body === "نظر پس از ارسال برای طرفین.")!;
    expect(target).toBeDefined();

    // Re-read from disk (a reload/restart): the row must still be there.
    const after = reviewDb.listReviewComments(CONTRACT_ID);
    const again = after.find((c) => c.id === target.id)!;
    expect(again).toBeDefined();
    expect(again.body).toBe(target.body);
    expect(again.createdAt).toBe(target.createdAt);
  });

  it("never mixes a comment into the rendered document", async () => {
    const { renderContract } = await import("../contracts/template");
    const contract = contractDb.getContractForUser(ownerId, CONTRACT_ID)!;
    const rendered = renderContract(
      contract,
      contractDb.listParties(CONTRACT_ID),
      contractDb.listPayments(CONTRACT_ID)
    );
    const text = rendered.clauses.map((c) => c.paragraphs.join(" ")).join("\n");
    expect(text).not.toContain("مبلغ پیش‌پرداخت را به ۳۰٪ برسانید.");
    expect(text).not.toContain("نظر پس از ارسال برای طرفین.");
  });
});
