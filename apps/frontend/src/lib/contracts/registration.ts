// ============================================================
// LEGALIR — Final registration paths (server-only)
// ============================================================
// A contract reaches the signature stage through exactly ONE of two
// routes, and every surface must be able to tell which:
//
//   1. `legalir_review` — the version was submitted to LEGALIR's legal
//      team and carries a bound approval. The approval row is the proof,
//      so no extra record is written for it.
//
//   2. `self_final` — the user (or an admin acting on the contract)
//      registered the document directly. NOBODY reviewed it, so a record
//      with `reviewedByLegalir: false` is written and stays in the audit
//      trail. That record is ALSO the authorisation that lets the
//      signature stage proceed without an approval — it never claims a
//      review happened.
//
// The record is bound to a version HASH. A content change produces a new
// hash, so a stale self-final record stops authorising anything, exactly
// like an admin approval does.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractAdminReview,
  ContractRegistrationPath,
  ContractRegistrationRecord,
  PropertyContract,
  PropertyContractVersion,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";

const T_REGISTRATIONS = "contract-registrations";

/** The label used for the unreviewed registration in every surface. */
export const SELF_FINAL_REASON_FA =
  "ثبت نهایی بدون بررسی لیگالیر — به درخواست و تأیید کاربر.";

export const SELF_FINAL_ACTOR_LABEL_FA = "طرف قرارداد";

/** Every registration record for a contract, newest first. */
export function listRegistrations(contractId: string): ContractRegistrationRecord[] {
  return readTable<ContractRegistrationRecord>(T_REGISTRATIONS)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The registration bound to a specific version hash, or null. This is
 * the ONLY read every gate should use — an older record for previous
 * content must never authorise the current document.
 */
export function registrationForHash(
  contractId: string,
  documentHash: string | null
): ContractRegistrationRecord | null {
  if (!documentHash) return null;
  return listRegistrations(contractId).find((r) => r.documentHash === documentHash) ?? null;
}

/** Record a self-final registration bound to the version's hash. */
export function recordSelfFinalRegistration(params: {
  contract: PropertyContract;
  version: PropertyContractVersion;
  actorId: string;
  actorLabelFa: string;
  actorKind: "party" | "admin";
  reasonFa?: string;
}): ContractRegistrationRecord {
  const now = new Date().toISOString();
  const row: ContractRegistrationRecord = {
    id: `creg-${crypto.randomUUID()}`,
    contractId: params.contract.id,
    contractVersionId: params.version.id,
    documentHash: params.version.documentHash,
    path: "self_final",
    reviewedByLegalir: false,
    adminReviewId: null,
    reasonFa: params.reasonFa?.trim() || SELF_FINAL_REASON_FA,
    actorId: params.actorId,
    actorLabelFa: params.actorLabelFa,
    actorKind: params.actorKind,
    createdAt: now,
  };
  const rows = readTable<ContractRegistrationRecord>(T_REGISTRATIONS);
  rows.push(row);
  writeTable(T_REGISTRATIONS, rows);
  return row;
}

/** The registration path chosen for a version hash, when recorded. */
export function registrationPathFor(
  contractId: string,
  documentHash: string | null
): ContractRegistrationPath | null {
  return registrationForHash(contractId, documentHash)?.path ?? null;
}

/**
 * The authorisation that lets a version enter the signature stage.
 *
 * `review` wins when a real approval exists (it is the stronger, reviewed
 * path). Otherwise a hash-bound `self_final` registration authorises the
 * signature WITHOUT any review — callers must print the unreviewed
 * disclaimer, and must never draw the blue review mark for it.
 */
export type SigningAuthorisation =
  | { kind: "review"; review: ContractAdminReview }
  | { kind: "self_final"; registration: ContractRegistrationRecord };

export function resolveSigningAuthorisation(params: {
  contract: PropertyContract;
  documentHash: string | null;
  approval: ContractAdminReview | null;
}): SigningAuthorisation | null {
  if (params.approval) return { kind: "review", review: params.approval };
  const registration = registrationForHash(params.contract.id, params.documentHash);
  if (registration && registration.path === "self_final") {
    return { kind: "self_final", registration };
  }
  return null;
}
