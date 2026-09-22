// ============================================================
// LEGALIR — Contract API helpers (server-only)
// ============================================================
// Shared plumbing for every /api/v1/contracts route: the auth guard,
// the standard error envelope, the audit writer, and the projection
// of a contract row into the list-item shape.
//
// Authorization is enforced HERE, once: `requireContract` loads the
// contract scoped to the session user and returns 404 (never 403)
// when it belongs to someone else, so a contract id can never be
// probed for existence.
// ============================================================

import { NextResponse } from "next/server";
import type {
  ContractAuditEntry,
  ContractParty,
  PropertyContract,
  PropertyContractListItem,
} from "@legalir/types";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  appendAudit,
  getContractForUser,
  listContractDocuments,
  listParties,
  updateContractForUser,
} from "./db";
import { computeCompleteness } from "./completeness";
import { domainLabelFa, getContractDefinition, partyRoleLabelFa } from "./registry";
import { stateLabelFa } from "./state-machine";

export interface ApiErrorBody {
  code: string;
  message: string;
  retryable?: boolean;
}

/** A 401 response for an unauthenticated request. */
export function unauthorized(): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
    { status: 401 }
  );
}

/** A 404 response. Used for both "missing" and "not yours" — by design. */
export function notFound(message = "قرارداد یافت نشد"): NextResponse<ApiErrorBody> {
  return NextResponse.json({ code: "NOT_FOUND", message }, { status: 404 });
}

/** A 400 response for an invalid body. */
export function badRequest(message: string, code = "INVALID_BODY"): NextResponse<ApiErrorBody> {
  return NextResponse.json({ code, message, retryable: false }, { status: 400 });
}

/** A 409 response for an illegal state transition or a blocked action. */
export function conflict(message: string, code = "CONFLICT"): NextResponse<ApiErrorBody> {
  return NextResponse.json({ code, message, retryable: false }, { status: 409 });
}

/** A 200 response wrapping `data`. */
export function ok<T>(data: T, status = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

export interface AuthContext {
  userId: string;
  contract: PropertyContract;
}

/**
 * Resolve the session user and load the contract they own. Returns a
 * NextResponse on failure so callers can `return` it directly.
 */
export function requireContract(
  request: Request,
  contractId: string
): AuthContext | NextResponse<ApiErrorBody> {
  const userId = getUserIdFromRequest(request);
  if (!userId) return unauthorized();
  const contract = getContractForUser(userId, contractId);
  if (!contract) return notFound();
  return { userId, contract };
}

/** True when the value is a NextResponse (i.e. the guard failed). */
export function isErrorResponse(value: unknown): value is NextResponse<ApiErrorBody> {
  return value instanceof NextResponse;
}

/** Append an audit entry for a contract action. */
export function audit(params: {
  contractId: string;
  actorId: string;
  actorLabel: string;
  action: string;
  descriptionFa: string;
  metadata?: Record<string, unknown>;
}): ContractAuditEntry {
  return appendAudit({
    id: `aud-${crypto.randomUUID()}`,
    contractId: params.contractId,
    actorId: params.actorId,
    actorLabel: params.actorLabel,
    action: params.action,
    descriptionFa: params.descriptionFa,
    metadata: params.metadata ?? {},
    createdAt: new Date().toISOString(),
  });
}

/**
 * A short location summary for the list card, e.g. «پاسداران، تهران».
 * Property contracts read their address; schema-driven types have no
 * address, so they fall back to their domain label.
 */
function locationFa(contract: PropertyContract): string {
  const data = contract.data as { address?: { neighborhood?: string; city?: string } };
  const a = data.address;
  if (a) {
    const parts = [a.neighborhood, a.city].filter((p) => p && p.trim().length > 0);
    if (parts.length > 0) return parts.join("، ");
  }
  return domainLabelFa(getContractDefinition(contract.type).domain);
}

/** The two primary party names, e.g. «مریم محمدی و رضا کریمی». */
function partySummaryFa(contract: PropertyContract, parties: ContractParty[]): string {
  const def = getContractDefinition(contract.type);
  const names = def.roles
    .map((role) => parties.find((p) => p.role === role))
    .filter((p): p is ContractParty => !!p)
    .map((p) => `${p.identity.firstName} ${p.identity.lastName}`.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) return "طرفین ثبت نشده‌اند";
  return names.join(" و ");
}

/** Project a contract row into the list-item shape. */
/**
 * Recompute a contract's stored `progress` from its real required
 * fields and persist it. Called by every route that can change what
 * counts as complete — including document upload/delete, which do not
 * touch the contract row itself. Without this, a contract whose last
 * missing document is uploaded would keep reporting a stale progress.
 */
export function refreshProgress(userId: string, contractId: string): PropertyContract | null {
  const contract = getContractForUser(userId, contractId);
  if (!contract) return null;
  const completeness = computeCompleteness(
    contract,
    listParties(contractId),
    listContractDocuments(contractId)
  );
  if (contract.progress === completeness.overall) return contract;
  return updateContractForUser(userId, contractId, { progress: completeness.overall }) ?? contract;
}

export function toListItem(contract: PropertyContract): PropertyContractListItem {
  const parties = listParties(contract.id);
  const def = getContractDefinition(contract.type);
  const step = def.wizardSteps.find((s) => s.id === contract.currentStep);
  return {
    id: contract.id,
    referenceCode: contract.referenceCode,
    domain: contract.domain,
    type: contract.type,
    typeFa: contract.typeFa,
    title: contract.title,
    state: contract.state,
    stateFa: stateLabelFa(contract.state),
    progress: contract.progress,
    locationFa: locationFa(contract),
    partySummaryFa: partySummaryFa(contract, parties),
    currentStep: contract.currentStep,
    currentStepTitleFa: step?.titleFa ?? "بازبینی",
    updatedAt: contract.updatedAt,
    createdAt: contract.createdAt,
  };
}

/** The Persian label for a party role, re-exported for route use. */
export { partyRoleLabelFa };
