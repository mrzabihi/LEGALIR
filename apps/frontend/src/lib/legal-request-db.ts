// ============================================================
// LEGALIR — Legal Request State Machine (JSON tables)
// ============================================================
// Tables:
//   legal_requests       — one row per request (LegalRequest)
//   legal_request_events — append-only transition log
//
// The state machine is authoritative here: `transitionRequest` rejects
// any move not present in LEGAL_REQUEST_TRANSITIONS. The UI can only
// request a transition; the server decides whether it is legal.
// ============================================================

import { readTable, writeTable } from "./db";
import {
  canTransitionLegalRequest,
  type LegalRequest,
  type LegalRequestEvent,
  type LegalRequestState,
  type PlatformRole,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listRequestsForUser(userId: string): LegalRequest[] {
  return readTable<LegalRequest>("legal_requests")
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getRequestById(id: string): LegalRequest | undefined {
  return readTable<LegalRequest>("legal_requests").find((r) => r.id === id);
}

/**
 * Requests assigned to a lawyer. A request is "assigned" once the client
 * selected the lawyer (LAWYER_SELECTED onward).
 */
export function listRequestsForLawyer(lawyerId: string): LegalRequest[] {
  return readTable<LegalRequest>("legal_requests")
    .filter((r) => r.selectedLawyerId === lawyerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listRequestEvents(requestId: string): LegalRequestEvent[] {
  return readTable<LegalRequestEvent>("legal_request_events")
    .filter((e) => e.requestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function createRequest(row: LegalRequest): LegalRequest {
  const rows = readTable<LegalRequest>("legal_requests");
  rows.push(row);
  writeTable("legal_requests", rows);
  appendRequestEvent({
    id: `lre-${crypto.randomUUID()}`,
    requestId: row.id,
    fromState: null,
    toState: row.state,
    actorId: row.userId,
    actorRole: "USER",
    note: "ایجاد درخواست",
    createdAt: new Date().toISOString(),
  });
  return row;
}

export function updateRequest(
  id: string,
  patch: Partial<Omit<LegalRequest, "id" | "userId" | "createdAt">>
): LegalRequest | undefined {
  const rows = readTable<LegalRequest>("legal_requests");
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx]!, ...patch, updatedAt: new Date().toISOString() };
  writeTable("legal_requests", rows);
  return rows[idx];
}

export function appendRequestEvent(event: LegalRequestEvent): LegalRequestEvent {
  const rows = readTable<LegalRequestEvent>("legal_request_events");
  rows.push(event);
  writeTable("legal_request_events", rows);
  return event;
}

// ---------------------------------------------------------------------------
// Transition (the authoritative gate)
// ---------------------------------------------------------------------------

export interface TransitionResult {
  ok: boolean;
  request?: LegalRequest;
  reason?: "not_found" | "illegal_transition";
}

/**
 * Move a request to `to`. Rejects illegal transitions. Every accepted
 * transition is logged with the actor so the history is auditable.
 */
export function transitionRequest(params: {
  requestId: string;
  to: LegalRequestState;
  actorId: string;
  actorRole: PlatformRole | "system";
  note?: string | null;
  patch?: Partial<Omit<LegalRequest, "id" | "userId" | "createdAt">>;
}): TransitionResult {
  const rows = readTable<LegalRequest>("legal_requests");
  const idx = rows.findIndex((r) => r.id === params.requestId);
  if (idx === -1) return { ok: false, reason: "not_found" };

  const current = rows[idx]!;
  if (!canTransitionLegalRequest(current.state, params.to)) {
    return { ok: false, reason: "illegal_transition" };
  }

  const from = current.state;
  const next: LegalRequest = {
    ...current,
    ...params.patch,
    state: params.to,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  writeTable("legal_requests", rows);

  appendRequestEvent({
    id: `lre-${crypto.randomUUID()}`,
    requestId: params.requestId,
    fromState: from,
    toState: params.to,
    actorId: params.actorId,
    actorRole: params.actorRole,
    note: params.note ?? null,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, request: next };
}
