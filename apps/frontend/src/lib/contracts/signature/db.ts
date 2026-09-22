// ============================================================
// LEGALIR — Signature persistence
// ============================================================
// Tables (all keyed by contract_id, all scoped by the caller):
//
//   contract-signature-requests      SignatureRequest
//   contract-signature-participants  SignatureParticipant
//   contract-signature-events        SignatureEvent
//   contract-signature-invitations   SignatureInvitation
//
// The raw invitation token is NEVER stored — only its SHA-256 hash.
// The OTP code is NEVER stored — only its hash, with a TTL.
//
// Every read/write goes through `readTable`/`writeTable`, so the
// process-wide parse cache stays coherent.
// ============================================================

import crypto from "node:crypto";
import type {
  SignatureEvent,
  SignatureInvitation,
  SignatureParticipant,
  SignatureRequest,
  SignatureRequestDetail,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";

const T_REQUESTS = "contract-signature-requests";
const T_PARTICIPANTS = "contract-signature-participants";
const T_EVENTS = "contract-signature-events";
const T_INVITATIONS = "contract-signature-invitations";

// ------------------------------------------------------------
// Requests
// ------------------------------------------------------------

export function listSignatureRequests(contractId: string): SignatureRequest[] {
  return readTable<SignatureRequest>(T_REQUESTS)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSignatureRequest(
  contractId: string,
  requestId: string
): SignatureRequest | null {
  return (
    readTable<SignatureRequest>(T_REQUESTS).find(
      (r) => r.contractId === contractId && r.id === requestId
    ) ?? null
  );
}

/** The newest request that is still in flight (not terminal). */
export function activeSignatureRequest(contractId: string): SignatureRequest | null {
  const terminal = new Set(["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"]);
  return listSignatureRequests(contractId).find((r) => !terminal.has(r.status)) ?? null;
}

/**
 * The newest request regardless of status. The workspace renders from
 * this so a COMPLETED request stays visible after the last signature —
 * the participant list and the event trail are the record of what
 * happened, not a transient in-flight state.
 */
export function latestSignatureRequest(contractId: string): SignatureRequest | null {
  return listSignatureRequests(contractId)[0] ?? null;
}

export function insertSignatureRequest(request: SignatureRequest): SignatureRequest {
  const rows = readTable<SignatureRequest>(T_REQUESTS);
  rows.push(request);
  writeTable(T_REQUESTS, rows);
  return request;
}

export function updateSignatureRequest(
  contractId: string,
  requestId: string,
  patch: Partial<SignatureRequest>
): SignatureRequest | null {
  const rows = readTable<SignatureRequest>(T_REQUESTS);
  const idx = rows.findIndex((r) => r.contractId === contractId && r.id === requestId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id, updatedAt: new Date().toISOString() };
  writeTable(T_REQUESTS, rows);
  return rows[idx]!;
}

/**
 * Cancel every in-flight request for a contract. Called when a new
 * version is created: a request bound to an older version can never
 * be signed, so it is retired rather than left dangling.
 */
export function cancelInFlightRequests(contractId: string, reason: string): number {
  const rows = readTable<SignatureRequest>(T_REQUESTS);
  const terminal = new Set(["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"]);
  const cancelled: SignatureRequest[] = [];
  for (const row of rows) {
    if (row.contractId !== contractId) continue;
    if (terminal.has(row.status)) continue;
    row.status = "CANCELLED";
    row.updatedAt = new Date().toISOString();
    cancelled.push(row);
  }
  if (cancelled.length === 0) return 0;
  writeTable(T_REQUESTS, rows);
  for (const row of cancelled) {
    appendSignatureEvent({
      signatureRequestId: row.id,
      contractId,
      participantId: null,
      type: "REQUEST_CANCELLED",
      descriptionFa: reason,
      contractVersionId: row.contractVersionId,
      documentHash: row.documentHash,
    });
  }
  return cancelled.length;
}

// ------------------------------------------------------------
// Participants
// ------------------------------------------------------------

export function listParticipants(requestId: string): SignatureParticipant[] {
  return readTable<SignatureParticipant>(T_PARTICIPANTS)
    .filter((p) => p.signatureRequestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getParticipant(participantId: string): SignatureParticipant | null {
  return (
    readTable<SignatureParticipant>(T_PARTICIPANTS).find((p) => p.id === participantId) ?? null
  );
}

export function insertParticipant(participant: SignatureParticipant): SignatureParticipant {
  const rows = readTable<SignatureParticipant>(T_PARTICIPANTS);
  rows.push(participant);
  writeTable(T_PARTICIPANTS, rows);
  return participant;
}

export function updateParticipant(
  participantId: string,
  patch: Partial<SignatureParticipant>
): SignatureParticipant | null {
  const rows = readTable<SignatureParticipant>(T_PARTICIPANTS);
  const idx = rows.findIndex((p) => p.id === participantId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id };
  writeTable(T_PARTICIPANTS, rows);
  return rows[idx]!;
}

// ------------------------------------------------------------
// Events (append-only)
// ------------------------------------------------------------

export function listSignatureEvents(requestId: string): SignatureEvent[] {
  return readTable<SignatureEvent>(T_EVENTS)
    .filter((e) => e.signatureRequestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function appendSignatureEvent(
  event: Omit<
    SignatureEvent,
    "id" | "createdAt" | "metadata" | "authMethod" | "clientFingerprint"
  > &
    Partial<Pick<SignatureEvent, "metadata" | "authMethod" | "clientFingerprint">>
): SignatureEvent {
  const row: SignatureEvent = {
    ...event,
    id: `sev-${crypto.randomUUID()}`,
    metadata: event.metadata ?? {},
    authMethod: event.authMethod ?? null,
    clientFingerprint: event.clientFingerprint ?? null,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<SignatureEvent>(T_EVENTS);
  rows.push(row);
  writeTable(T_EVENTS, rows);
  return row;
}

// ------------------------------------------------------------
// Invitations
// ------------------------------------------------------------

export function listInvitations(requestId: string): SignatureInvitation[] {
  return readTable<SignatureInvitation>(T_INVITATIONS)
    .filter((i) => i.signatureRequestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function insertInvitation(invitation: SignatureInvitation): SignatureInvitation {
  const rows = readTable<SignatureInvitation>(T_INVITATIONS);
  rows.push(invitation);
  writeTable(T_INVITATIONS, rows);
  return invitation;
}

export function updateInvitation(
  invitationId: string,
  patch: Partial<SignatureInvitation>
): SignatureInvitation | null {
  const rows = readTable<SignatureInvitation>(T_INVITATIONS);
  const idx = rows.findIndex((i) => i.id === invitationId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id };
  writeTable(T_INVITATIONS, rows);
  return rows[idx]!;
}

/** Look up an invitation by the SHA-256 hash of its raw token. */
export function findInvitationByTokenHash(tokenHash: string): SignatureInvitation | null {
  return (
    readTable<SignatureInvitation>(T_INVITATIONS).find((i) => i.tokenHash === tokenHash) ?? null
  );
}

// ------------------------------------------------------------
// Aggregate
// ------------------------------------------------------------

/** A request plus its participants and event trail. */
export function toRequestDetail(request: SignatureRequest): SignatureRequestDetail {
  return {
    ...request,
    participants: listParticipants(request.id),
    events: listSignatureEvents(request.id),
  };
}

/** The active request for a contract, hydrated, or null. */
export function activeSignatureRequestDetail(contractId: string): SignatureRequestDetail | null {
  const request = activeSignatureRequest(contractId);
  return request ? toRequestDetail(request) : null;
}

/**
 * The newest request for a contract, hydrated, or null — including a
 * COMPLETED one. The lifecycle view uses this so the signature panel
 * and its audit trail remain visible after the last signature.
 */
export function latestSignatureRequestDetail(contractId: string): SignatureRequestDetail | null {
  const request = latestSignatureRequest(contractId);
  return request ? toRequestDetail(request) : null;
}
