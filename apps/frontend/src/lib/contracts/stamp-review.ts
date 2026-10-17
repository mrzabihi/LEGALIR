// ============================================================
// LEGALIR — Official stamp approval persistence (server-only)
// ============================================================
// The OFFICIAL stamp is a stronger act than the internal review: it is
// reserved to a Super Admin and is bound to BOTH the exact contract
// version hash AND the exact bytes of the stamp master. This module is
// the single source of truth for that second gate.
//
// Tables:
//   contract-stamp-requests   ContractStampRequest
//   contract-stamp-events     ContractStampEvent
//
// `currentVersionStamp` is the load-bearing check: a stamp whose
// `documentHash` OR `stampAssetSha256` no longer matches the current
// state is stale and must not authorise drawing the stamp.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractStampEvent,
  ContractStampRequest,
  ContractStampRequestDetail,
  PropertyContract,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import { loadReviewStamp, STAMP_ASSET_VERSION } from "./stamp-asset";

const T_REQUESTS = "contract-stamp-requests";
const T_EVENTS = "contract-stamp-events";

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------

export function listStampRequests(contractId: string): ContractStampRequest[] {
  return readTable<ContractStampRequest>(T_REQUESTS)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getStampRequest(
  contractId: string,
  stampRequestId: string
): ContractStampRequest | null {
  return (
    readTable<ContractStampRequest>(T_REQUESTS).find(
      (r) => r.contractId === contractId && r.id === stampRequestId
    ) ?? null
  );
}

/** The newest stamp request for a contract, regardless of status. */
export function latestStampRequest(contractId: string): ContractStampRequest | null {
  return listStampRequests(contractId)[0] ?? null;
}

/** The newest stamp request still awaiting a decision. */
export function openStampRequest(contractId: string): ContractStampRequest | null {
  return listStampRequests(contractId).find((r) => r.status === "PENDING") ?? null;
}

export function listStampEvents(stampRequestId: string): ContractStampEvent[] {
  return readTable<ContractStampEvent>(T_EVENTS)
    .filter((e) => e.stampRequestId === stampRequestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function toStampRequestDetail(request: ContractStampRequest): ContractStampRequestDetail {
  return { ...request, events: listStampEvents(request.id) };
}

// ------------------------------------------------------------
// The gate — "may the official stamp be drawn on this version?"
// ------------------------------------------------------------

/**
 * The stamp approval that authorises the contract's CURRENT version —
 * an APPLIED request whose `documentHash` matches the version hash AND
 * whose `stampAssetSha256` still matches the loaded stamp master.
 * Returns null otherwise. This is the single check the PDF/finalize
 * surfaces call, so a direct call cannot bypass it.
 */
export function currentVersionStamp(
  contract: PropertyContract,
  currentVersionHash: string | null
): ContractStampRequest | null {
  if (!currentVersionHash) return null;
  const request = latestStampRequest(contract.id);
  if (!request) return null;
  if (request.status !== "APPLIED") return null;
  if (request.documentHash !== currentVersionHash) return null;
  const asset = loadReviewStamp();
  // The stamp master must still be byte-identical to what was approved.
  if (!asset || !request.stampAssetSha256 || request.stampAssetSha256 !== asset.sha256) return null;
  return request;
}

/** True when the contract's current version carries a valid stamp. */
export function isCurrentVersionStamped(
  contract: PropertyContract,
  currentVersionHash: string | null
): boolean {
  return currentVersionStamp(contract, currentVersionHash) !== null;
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------

export function insertStampRequest(request: ContractStampRequest): ContractStampRequest {
  const rows = readTable<ContractStampRequest>(T_REQUESTS);
  rows.push(request);
  writeTable(T_REQUESTS, rows);
  return request;
}

export function updateStampRequest(
  stampRequestId: string,
  patch: Partial<ContractStampRequest>
): ContractStampRequest | null {
  const rows = readTable<ContractStampRequest>(T_REQUESTS);
  const idx = rows.findIndex((r) => r.id === stampRequestId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id, updatedAt: new Date().toISOString() };
  writeTable(T_REQUESTS, rows);
  return rows[idx]!;
}

export function appendStampEvent(
  event: Omit<ContractStampEvent, "id" | "createdAt">
): ContractStampEvent {
  const row: ContractStampEvent = {
    ...event,
    id: `stev-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<ContractStampEvent>(T_EVENTS);
  rows.push(row);
  writeTable(T_EVENTS, rows);
  return row;
}

/**
 * Open a PENDING stamp request bound to the given version hash and the
 * stamp master currently on disk. Reuses an existing open request for the
 * same version rather than stacking duplicates.
 */
export function createPendingStampRequest(params: {
  contractId: string;
  contractVersionId: string | null;
  documentHash: string | null;
  requestedById: string | null;
  requestedByLabelFa: string | null;
  reasonFa: string;
}): ContractStampRequest {
  const existing = openStampRequest(params.contractId);
  if (existing && existing.documentHash === params.documentHash) return existing;

  const asset = loadReviewStamp();
  const now = new Date().toISOString();
  return insertStampRequest({
    id: `stamp-req-${crypto.randomUUID()}`,
    contractId: params.contractId,
    contractVersionId: params.contractVersionId,
    documentHash: params.documentHash,
    stampAssetVersion: asset?.version ?? STAMP_ASSET_VERSION,
    stampAssetSha256: asset?.sha256 ?? null,
    status: "PENDING",
    requestedById: params.requestedById,
    requestedByLabelFa: params.requestedByLabelFa,
    approvedById: null,
    approvedByLabelFa: null,
    reasonFa: params.reasonFa,
    requestedAt: now,
    decidedAt: null,
    appliedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
