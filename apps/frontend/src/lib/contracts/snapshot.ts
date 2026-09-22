// ============================================================
// LEGALIR — Immutable version snapshots
// ============================================================
// A version is an immutable snapshot of everything that determines
// the contract's legal content: the domain data, the parties, the
// payment schedule and a manifest of the attached documents (ids +
// hashes, never the bytes). The snapshot is hashed with SHA-256 over
// a canonical JSON serialization, so the same content always yields
// the same hash and any change yields a different one.
//
// Creating a snapshot invalidates every approval tied to an older
// version — an approval can never survive a content change.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractDocument,
  ContractParty,
  ContractPayment,
  PropertyContractVersion,
  ContractVersionSnapshot,
  PropertyContract,
} from "@legalir/types";
import {
  insertVersion,
  invalidateApprovalsForOtherVersions,
  latestVersionNumber,
  listContractDocuments,
  listParties,
  listPayments,
  updateContractForUser,
} from "./db";

/** Deterministic JSON: object keys sorted, so the hash is stable. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 over the canonical snapshot JSON. */
export function hashSnapshot(snapshot: ContractVersionSnapshot): string {
  return crypto.createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

/** Build the snapshot payload from the current working state. */
export function buildSnapshot(
  contract: PropertyContract,
  parties: ContractParty[],
  payments: ContractPayment[],
  documents: ContractDocument[]
): ContractVersionSnapshot {
  return {
    data: contract.data,
    parties,
    payments,
    documentsManifest: documents.map((d) => ({
      id: d.id,
      category: d.category,
      hash: d.hash,
      fileName: d.fileName,
    })),
  };
}

/**
 * Snapshot the contract's current state as a new immutable version.
 * Returns the created version and the number of approvals that were
 * invalidated because they referred to an older version.
 */
export function createVersion(
  contract: PropertyContract,
  actorId: string
): { version: PropertyContractVersion; invalidatedApprovals: number } {
  const parties = listParties(contract.id);
  const payments = listPayments(contract.id);
  const documents = listContractDocuments(contract.id);

  const snapshot = buildSnapshot(contract, parties, payments, documents);
  const versionNumber = latestVersionNumber(contract.id) + 1;

  const version: PropertyContractVersion = {
    id: `ver-${crypto.randomUUID()}`,
    contractId: contract.id,
    versionNumber,
    snapshot,
    templateVersion: contract.templateVersion,
    schemaVersion: contract.schemaVersion,
    documentHash: hashSnapshot(snapshot),
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  };

  insertVersion(version);

  // Point the contract at the new version and invalidate stale approvals.
  updateContractForUser(contract.userId, contract.id, {
    currentVersionId: version.id,
    currentVersionNumber: versionNumber,
  });
  const invalidatedApprovals = invalidateApprovalsForOtherVersions(contract.id, version.id);

  return { version, invalidatedApprovals };
}
