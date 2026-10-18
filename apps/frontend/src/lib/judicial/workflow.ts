// ============================================================
// LEGALIR — Judicial request workflow (server-only)
// ============================================================
// One place decides which status move is legal, so a client can request a
// move but never force one. The transition table itself lives in
// `@legalir/types` (shared with the UI for labelling); this module adds the
// server-side guards:
//
//   • a move outside `JUDICIAL_TRANSITIONS` is rejected (409);
//   • `generating` / `draft_ready` are only reachable through the generation
//     route;
//   • `approved` requires a draft version that actually exists and was
//     explicitly approved by the owner — never a bare status patch.
//
// No state anywhere means filed/sent/submitted: there is no judicial-submission
// integration, and this module must never grow one without a real provider.
// ============================================================

import {
  JUDICIAL_TRANSITIONS,
  type JudicialRequest,
  type JudicialRequestStatus,
} from "@legalir/types";
import { patchRequest, getOwnedRequest, latestDraft } from "./db";

export type TransitionResult =
  | { ok: true; request: JudicialRequest }
  | { ok: false; code: "NOT_FOUND" | "ILLEGAL_TRANSITION" | "APPROVAL_REQUIRES_DRAFT" };

/** Statuses the generic transition route may never set on its own. */
const ROUTE_FORBIDDEN_TARGETS: readonly JudicialRequestStatus[] = [
  "generating",
  "draft_ready",
  "approved",
];

export interface TransitionOptions {
  /** Internal override used by the generation route for its own moves. */
  allowInternal?: boolean;
}

/**
 * Move a request to `to`, enforcing the shared transition table. Returns
 * `NOT_FOUND` for a foreign id (identical to a missing one).
 */
export function transitionRequest(
  userId: string,
  requestId: string,
  to: JudicialRequestStatus,
  options: TransitionOptions = {}
): TransitionResult {
  const request = getOwnedRequest(userId, requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };

  if (!options.allowInternal && ROUTE_FORBIDDEN_TARGETS.includes(to)) {
    return { ok: false, code: "ILLEGAL_TRANSITION" };
  }

  if (!(JUDICIAL_TRANSITIONS[request.status] ?? []).includes(to)) {
    return { ok: false, code: "ILLEGAL_TRANSITION" };
  }

  // Approval records the user's own explicit confirmation of a concrete
  // artefact: an approved draft version, OR the finished document they
  // brought on the ready-document path. A bare status patch can never do it.
  if (to === "approved") {
    const draft = latestDraft(userId, request.id);
    const hasApprovedDraft = draft?.status === "approved";
    const hasReadyDocument = request.readyDocument !== null;
    if (!hasApprovedDraft && !hasReadyDocument) {
      return { ok: false, code: "APPROVAL_REQUIRES_DRAFT" };
    }
  }

  const patch: Parameters<typeof patchRequest>[2] = { status: to };
  if (to === "approved") {
    patch.completedAt = new Date().toISOString();
    patch.userConfirmed = true;
    patch.currentStep = "review";
  }
  if (to === "archived") patch.archivedAt = new Date().toISOString();

  const next = patchRequest(userId, requestId, patch);
  return next ? { ok: true, request: next } : { ok: false, code: "NOT_FOUND" };
}

/** The statuses the owner may move to from the current one via the API. */
export function availableTransitions(request: JudicialRequest): JudicialRequestStatus[] {
  return (JUDICIAL_TRANSITIONS[request.status] ?? []).filter(
    (s) => !ROUTE_FORBIDDEN_TARGETS.includes(s)
  );
}

/** Statuses that count as "still open work" for the card's counter. */
export const OPEN_STATUSES: readonly JudicialRequestStatus[] = [
  "draft",
  "collecting",
  "needs_answers",
  "ready_to_generate",
  "generating",
  "draft_ready",
  "ready_to_review",
  "needs_correction",
] as const;

export function isOpenStatus(status: JudicialRequestStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

