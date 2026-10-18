// @vitest-environment node
// ============================================================
// LEGALIR — Dev-only END-TO-END sample contract (§2.7)
// ============================================================
// The brief asks for ONE sample contract that walks the whole lifecycle
// (draft → admin approval → signature request), carries the «نمونه
// آزمایشی» label on every surface, and NEVER sends a real SMS to a party.
// This drives the real seeding function against an isolated temp DB and
// asserts that promise:
//
//   • outside development it is a NO-OP — a production build can never
//     seed it, no matter who imports db.ts;
//   • inside development it creates exactly ONE contract, with two fake
//     parties, a draft version, an approval bound to that version's hash,
//     a frozen signature version, one participant per party, and
//     `dev-console` invitations;
//   • no SMS transport is invoked — even with a real provider configured,
//     nothing is fetched and nothing is logged to the SMS console;
//   • re-running it is idempotent (no duplicate sample);
//   • the admin queue shows the row WITH the sample flag.
//
// `db.ts` binds its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { AdminContractListResponse } from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as SignatureDbModule from "../contracts/signature/db";
import type * as AdminReviewModule from "../contracts/admin-review";
import type * as SampleModule from "../contracts/sample";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type SignatureDb = typeof SignatureDbModule;

let db: Db;
let contractDb: ContractDb;
let signatureDb: SignatureDb;
let adminReview: typeof AdminReviewModule;
let sample: typeof SampleModule;

let ownerId: string;
let adminSession: string;
let tmpDir: string;
let originalCwd: string;

function req(url: string, session: string): NextRequest {
  return new Request(url, {
    method: "GET",
    headers: { cookie: `legalir-session=${session}` },
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-sample-contract-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  signatureDb = await import("../contracts/signature/db");
  adminReview = await import("../contracts/admin-review");
  sample = await import("../contracts/sample");

  ownerId = db.createUser({ mobile: "09120000341", passwordHash: "x" }).id;
  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("seedSampleContract — the synthetic end-to-end record (§2.7)", () => {
  it("is a NO-OP outside development — production can never seed a contract", () => {
    vi.stubEnv("NODE_ENV", "test");
    sample.seedSampleContract(ownerId);

    expect(contractDb.listContractsForUser(ownerId)).toHaveLength(0);
  });

  it("seeds exactly one labelled contract with the whole lifecycle intact", () => {
    vi.stubEnv("NODE_ENV", "development");
    sample.seedSampleContract(ownerId);

    const contracts = contractDb.listContractsForUser(ownerId);
    expect(contracts).toHaveLength(1);

    const contract = contracts[0]!;
    // §2.7 — labelled so it can never be mistaken for a real contract.
    // The flag is the machine-readable label; the title carries it in prose.
    expect(contract.isSample).toBe(true);
    expect(contract.title).toBe(sample.SAMPLE_CONTRACT_TITLE);
    expect(contract.referenceCode).toMatch(/^LGL-SAMPLE-\d{4}$/);
    // The request is open: the signature stage is the next step.
    expect(contract.state).toBe("READY_TO_SIGN");

    // Two fake parties.
    const parties = contractDb.listParties(contract.id);
    expect(parties).toHaveLength(2);
    expect(parties.map((p) => p.role).sort()).toEqual(["landlord", "tenant"]);
    expect(parties.filter((p) => p.isInitiator)).toHaveLength(1);

    // The note and the changes the admin record must show (§2.4).
    expect(contract.data.supplementary?.notes).toContain("یادداشت نمونه");
    expect(contract.data.supplementary?.noteConfirmedAt).toBeTruthy();
    expect(contract.data.customClauses).toHaveLength(2);
    expect(contract.data.customClauses?.map((c) => c.kind).sort()).toEqual([
      "agreement",
      "change_request",
    ]);

    // The draft that was reviewed, and the FINAL version frozen for
    // signing — both retained, nothing collapsed.
    const versions = contractDb.listVersions(contract.id);
    expect(versions).toHaveLength(2);
    const draft = versions.find((v) => v.versionNumber === 1)!;
    const final = versions.find((v) => v.versionNumber === 2)!;
    expect(contract.currentVersionId).toBe(final.id);
    // The seed stops at the OPEN request: nothing is finalized until every
    // party signs, so the final stamp/version is legitimately still unset.
    expect(contract.finalVersionId).toBeNull();
    // Freezing the same approved content reproduced the approved hash, so
    // the signed version is exactly the reviewed one.
    expect(final.documentHash).toBe(draft.documentHash);

    // The approval is bound to the reviewed version's hash.
    const review = adminReview.latestAdminReview(contract.id)!;
    expect(review.status).toBe("APPROVED");
    expect(review.contractVersionId).toBe(draft.id);
    expect(review.documentHash).toBe(draft.documentHash);
    expect(adminReview.currentVersionApproval(contract, final.documentHash)).not.toBeNull();
    expect(
      adminReview.listAdminReviewEvents(review.id).some((e) => e.action === "approve")
    ).toBe(true);

    // One participant per party, and a request that is genuinely open.
    const detail = signatureDb.latestSignatureRequestDetail(contract.id)!;
    expect(detail.status).toBe("SENT");
    expect(detail.contractVersionId).toBe(final.id);
    expect(detail.documentHash).toBe(final.documentHash);
    expect(detail.participants).toHaveLength(2);
    expect(detail.participants.map((p) => p.status)).toEqual(["PENDING", "PENDING"]);

    // §2.7 — NO SMS: every invitation records the honest transport, and
    // the raw tokens are hashed at rest.
    const invitations = signatureDb.listInvitations(detail.id);
    expect(invitations).toHaveLength(2);
    for (const invitation of invitations) {
      expect(invitation.deliveryChannel).toBe("dev-console");
      expect(invitation.deliveryStatus).toBe("SENT");
      expect(invitation.status).toBe("ACTIVE");
      expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("never reaches an SMS transport, even when a real provider is configured", () => {
    const cleanOwner = db.createUser({ mobile: "09120000342", passwordHash: "x" }).id;
    vi.stubEnv("NODE_ENV", "development");
    // A real gateway IS configured — the seed must still not use it.
    vi.stubEnv("LEGALIR_SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_SENDER", "10004346");

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    sample.seedSampleContract(cleanOwner);

    // Nothing was sent by the seed: no HTTP call, no dev-console line.
    expect(fetchSpy).not.toHaveBeenCalled();
    const smsLogs = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).startsWith("[legalir:sms:")
    );
    expect(smsLogs).toHaveLength(0);

    // And nothing recorded an OTP attempt either — the flow stopped at
    // "invitation prepared", exactly as the brief requires.
    const contract = contractDb.listContractsForUser(cleanOwner)[0]!;
    const detail = signatureDb.latestSignatureRequestDetail(contract.id)!;
    expect(detail.events.some((e) => e.type.startsWith("OTP"))).toBe(false);
  });

  it("is idempotent — re-running the dev seed adds no duplicate", () => {
    vi.stubEnv("NODE_ENV", "development");
    const before = contractDb.listContractsForUser(ownerId).length;
    sample.seedSampleContract(ownerId);
    sample.seedSampleContract(ownerId);
    expect(contractDb.listContractsForUser(ownerId)).toHaveLength(before);
  });

  it("is visible in the admin queue, flagged as a sample with live signing progress", async () => {
    const route = await import("@/app/api/v1/admin/contracts/route");
    const res = await route.GET(req("http://localhost/api/v1/admin/contracts", adminSession));
    expect(res.status).toBe(200);

    const body = ((await res.json()) as { data: AdminContractListResponse }).data;
    const row = body.items.find((item) => item.isSample);
    expect(row).toBeDefined();
    expect(row!.title).toBe(sample.SAMPLE_CONTRACT_TITLE);
    expect(row!.isSample).toBe(true);
    expect(row!.signatureStatus).toBe("SENT");
    expect(row!.signedCount).toBe(0);
    expect(row!.participantCount).toBe(2);
  });
});
