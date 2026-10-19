// ============================================================
// LEGALIR — Admin · the STAMPED final artifact is reachable
// ============================================================
// §4/§7: once both parties sign and LEGALIR gives final approval, the
// printable evidence is the A4 PDF with the official seal and hologram
// at the bottom of EVERY page. That artifact is stored privately and the
// only route that served it was owner-scoped — so an operator could not
// open the very document they approved.
//
// This proves both halves of the fix:
//   1. GET /admin/contracts/[id] carries `finalDocument` — file identity,
//      hash, and whether the stamp is STILL bound to the final version's
//      hash (a stale stamp is reported, never silently shown as sealed).
//   2. GET /admin/contracts/[id]/final-document streams the stored bytes
//      with the recorded hash, inline by default and as an attachment on
//      `?download=1`.
//
// Team convention: `db.ts` binds its store at import time, so every
// module is imported dynamically AFTER `chdir` into a temp dir.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  ContractDocument,
  ContractParty,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
// Type-only: erased at compile time, so it cannot bind the live DB early.
import type { AdminContractDetail } from "@/lib/api/admin";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as StampReviewModule from "../contracts/stamp-review";
import type * as StorageModule from "../contracts/storage";
import type * as StampAssetModule from "../contracts/stamp-asset";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type StampReview = typeof StampReviewModule;
type Storage = typeof StorageModule;
type StampAsset = typeof StampAssetModule;

let db: Db;
let contractDb: ContractDb;
let stampReview: StampReview;
let storage: Storage;
let stampAsset: StampAsset;

let ownerId: string;
let adminSession: string;
let tmpDir: string;
let originalCwd: string;

/** Sealed: a stored artifact + an APPLIED stamp bound to its hash. */
const SEALED = "ctr-final-sealed";
/** No artifact at all — the contract was never finalized. */
const NO_ARTIFACT = "ctr-final-none";
/** An artifact whose stamp no longer matches the final version hash. */
const STALE_SEAL = "ctr-final-stale";

const FINAL_HASH = "a".repeat(64);
const STALE_FINAL_HASH = "b".repeat(64);
const STALE_STAMP_HASH = "c".repeat(64);

/** Known bytes so the route can be proved to return exactly what it stored. */
const ARTIFACT_BYTES = Buffer.from("%PDF-1.7\nLEGALIR final artifact\n%%EOF\n", "utf8");
const STALE_ARTIFACT_BYTES = Buffer.from("%PDF-1.7\nstale\n%%EOF\n", "utf8");

type DetailRoute = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
type DocumentRoute = DetailRoute;

let adminGet: DetailRoute;
let adminDocumentGet: DocumentRoute;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string | null): NextRequest {
  const request = new Request(url, {
    method: "GET",
    headers: session ? { cookie: `legalir-session=${session}` } : {},
  }) as unknown as NextRequest;
  // The document route reads the query through `nextUrl`; a bare Request has none.
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request;
}

function party(contractId: string, role: ContractParty["role"], initiator = false): ContractParty {
  return {
    id: `pty-${contractId}-${role}`,
    contractId,
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
    createdAt: "2026-01-01T00:00:00.000Z",
  } as ContractParty;
}

let rentData: PropertyContract["data"];

function seedContract(contractId: string): PropertyContract {
  const now = "2026-01-06T00:00:00.000Z";
  return {
    id: contractId,
    referenceCode: `LGL-RENT-1405-${contractId.slice(-4).toUpperCase()}`,
    userId: ownerId,
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "FINALIZED",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title: "اجاره‌نامه آپارتمان",
    currentStep: "finalized",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data: rentData,
    currentVersionId: `ver-${contractId}-1`,
    currentVersionNumber: 1,
    finalVersionId: `ver-${contractId}-1`,
    finalizedAt: now,
    publicVerificationId: `vrf-${contractId}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as PropertyContract;
}

function seedVersion(contractId: string, documentHash: string): PropertyContractVersion {
  return {
    id: `ver-${contractId}-1`,
    contractId,
    versionNumber: 1,
    templateVersion: "1.0.0",
    documentHash,
    snapshot: {} as PropertyContractVersion["snapshot"],
    createdBy: ownerId,
    createdAt: "2026-01-06T00:00:00.000Z",
    schemaVersion: 1,
  } as unknown as PropertyContractVersion;
}

interface StoredDocument {
  row: ContractDocument;
  hash: string;
}

/** Persist bytes through the real storage layer, then record the row. */
function storeArtifact(contractId: string, documentId: string, bytes: Buffer): StoredDocument {
  const written = storage.writeContractFile({
    contractId,
    documentId,
    fileName: `${contractId}-final.pdf`,
    bytes,
  });
  const row: ContractDocument = {
    id: documentId,
    contractId,
    category: "final_pdf",
    fileName: `${contractId}-final.pdf`,
    mime: "application/pdf",
    sizeBytes: written.sizeBytes,
    storageKey: written.storageKey,
    hash: written.hash,
    description: "نسخهٔ نهایی با مهر رسمی",
    photoCategory: null,
    uploadedBy: ownerId,
    uploadedAt: "2026-01-06T11:00:00.000Z",
  } as ContractDocument;
  contractDb.insertContractDocument(row);
  return { row, hash: written.hash };
}

function seedStamp(contractId: string, documentHash: string, stampAssetSha256: string): void {
  stampReview.insertStampRequest({
    id: `stmp-${contractId}`,
    contractId,
    contractVersionId: `ver-${contractId}-1`,
    documentHash,
    stampAssetVersion: stampAsset.STAMP_ASSET_VERSION,
    stampAssetSha256,
    status: "APPLIED",
    requestedById: null,
    requestedByLabelFa: null,
    approvedById: ownerId,
    approvedByLabelFa: "مدیر لیگالیر",
    reasonFa: "بررسی نهایی انجام شد",
    requestedAt: "2026-01-06T10:00:00.000Z",
    decidedAt: "2026-01-06T10:57:00.000Z",
    appliedAt: "2026-01-06T10:57:29.000Z",
    createdAt: "2026-01-06T10:00:00.000Z",
    updatedAt: "2026-01-06T10:57:29.000Z",
  });
}

let sealedArtifact: StoredDocument;
let staleArtifact: StoredDocument;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-admin-final-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  stampReview = await import("../contracts/stamp-review");
  storage = await import("../contracts/storage");
  stampAsset = await import("../contracts/stamp-asset");
  const { getContractDefinition } = await import("../contracts/registry");
  rentData = getContractDefinition("property_rent").createDefaultData("apartment");

  const owner = db.createUser({ mobile: "09120000333", passwordHash: "x" });
  ownerId = owner.id;
  const admin = db.createUser({ mobile: "09120000000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  // The stamp master must still be byte-identical for a stamp to be valid.
  const master = stampAsset.loadReviewStamp();
  expect(master).not.toBeNull();
  const masterSha = master!.sha256;

  // 1 — the normal case: artifact + a stamp bound to the final hash.
  contractDb.insertContract(seedContract(SEALED));
  contractDb.upsertParty(party(SEALED, "landlord", true));
  contractDb.upsertParty(party(SEALED, "tenant"));
  contractDb.insertVersion(seedVersion(SEALED, FINAL_HASH));
  sealedArtifact = storeArtifact(SEALED, "doc-sealed-1", ARTIFACT_BYTES);
  seedStamp(SEALED, FINAL_HASH, masterSha);

  // 2 — never finalized: no final_pdf row at all.
  contractDb.insertContract(seedContract(NO_ARTIFACT));
  contractDb.upsertParty(party(NO_ARTIFACT, "landlord", true));
  contractDb.insertVersion(seedVersion(NO_ARTIFACT, "d".repeat(64)));

  // 3 — an artifact whose stamp was bound to a DIFFERENT hash.
  contractDb.insertContract(seedContract(STALE_SEAL));
  contractDb.upsertParty(party(STALE_SEAL, "landlord", true));
  contractDb.insertVersion(seedVersion(STALE_SEAL, STALE_FINAL_HASH));
  staleArtifact = storeArtifact(STALE_SEAL, "doc-stale-1", STALE_ARTIFACT_BYTES);
  seedStamp(STALE_SEAL, STALE_STAMP_HASH, masterSha);

  adminGet = (await import("@/app/api/v1/admin/contracts/[id]/route")).GET as DetailRoute;
  adminDocumentGet = (
    await import("@/app/api/v1/admin/contracts/[id]/final-document/route")
  ).GET as DocumentRoute;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const ADMIN_BASE = "http://localhost/api/v1/admin/contracts";

async function loadDetail(
  id: string,
  session: string | null = adminSession
): Promise<AdminContractDetail> {
  const res = await adminGet(req(`${ADMIN_BASE}/${id}`, session), params(id));
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: AdminContractDetail }).data;
}

describe("admin · the stamped final artifact (§4/§7)", () => {
  it("carries the stored final PDF, its hash and a valid seal binding", async () => {
    const data = await loadDetail(SEALED);
    const doc = data.finalDocument;

    expect(doc).not.toBeNull();
    expect(doc!.documentId).toBe(sealedArtifact.row.id);
    expect(doc!.fileName).toBe("ctr-final-sealed-final.pdf");
    expect(doc!.sizeBytes).toBe(ARTIFACT_BYTES.byteLength);
    // The hash is the storage layer's own SHA-256 — the same number the
    // finalization record reports.
    expect(doc!.hash).toBe(sealedArtifact.hash);
    expect(doc!.sealed).toBe(true);
    expect(doc!.sealAssetVersion).toBe(stampAsset.STAMP_ASSET_VERSION);
    expect(doc!.sealedAt).toBe("2026-01-06T10:57:29.000Z");
    // Both URLs point at the ADMIN route — the owner route is owner-scoped.
    expect(doc!.url).toBe(`/api/v1/admin/contracts/${SEALED}/final-document`);
    expect(doc!.downloadUrl).toBe(
      `/api/v1/admin/contracts/${SEALED}/final-document?download=1`
    );
  });

  it("reports null — never a fabricated artifact — before finalization", async () => {
    const data = await loadDetail(NO_ARTIFACT);
    expect(data.finalDocument).toBeNull();
  });

  it("reports an artifact whose stamp is no longer bound as NOT sealed", async () => {
    const data = await loadDetail(STALE_SEAL);
    // The file is still shown (it exists), but the seal claim is withdrawn.
    expect(data.finalDocument).not.toBeNull();
    expect(data.finalDocument!.documentId).toBe(staleArtifact.row.id);
    expect(data.finalDocument!.sealed).toBe(false);
    expect(data.finalDocument!.sealAssetVersion).toBeNull();
    expect(data.finalDocument!.sealedAt).toBeNull();
  });

  it("streams the exact stored bytes inline, with the hash in a header", async () => {
    const res = await adminDocumentGet(
      req(`${ADMIN_BASE}/${SEALED}/final-document`, adminSession),
      params(SEALED)
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe(String(ARTIFACT_BYTES.byteLength));
    expect(res.headers.get("content-disposition")).toContain("inline");
    // Private + no-store: a contract is never cached by a shared proxy.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-document-sha256")).toBe(sealedArtifact.hash);

    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(ARTIFACT_BYTES)).toBe(true);
  });

  it("forces an attachment on ?download=1 — same bytes, different disposition", async () => {
    const res = await adminDocumentGet(
      req(`${ADMIN_BASE}/${SEALED}/final-document?download=1`, adminSession),
      params(SEALED)
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-document-sha256")).toBe(sealedArtifact.hash);
    expect(Buffer.from(await res.arrayBuffer()).equals(ARTIFACT_BYTES)).toBe(true);
  });

  it("404s with NOT_FINALIZED when no artifact exists yet", async () => {
    const res = await adminDocumentGet(
      req(`${ADMIN_BASE}/${NO_ARTIFACT}/final-document`, adminSession),
      params(NO_ARTIFACT)
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code?: string; message?: string };
    expect(body.code).toBe("NOT_FINALIZED");
    expect(body.message).toContain("نسخهٔ نهایی");
  });

  it("404s for an unknown contract — no existence leak", async () => {
    const res = await adminDocumentGet(
      req(`${ADMIN_BASE}/ctr-does-not-exist/final-document`, adminSession),
      params("ctr-does-not-exist")
    );
    expect(res.status).toBe(404);
  });

  it("refuses an unauthenticated caller on both the detail and the document", async () => {
    const detail = await adminGet(req(`${ADMIN_BASE}/${SEALED}`, null), params(SEALED));
    expect(detail.status).toBe(401);

    const doc = await adminDocumentGet(
      req(`${ADMIN_BASE}/${SEALED}/final-document`, null),
      params(SEALED)
    );
    expect(doc.status).toBe(401);
  });
});
