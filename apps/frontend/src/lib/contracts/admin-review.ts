// ============================================================
// LEGALIR — Contract admin review persistence (server-only)
// ============================================================
// A generated contract MUST pass an internal LEGALIR admin approval
// before a final version is stamped or a signature is issued. This
// module is the single source of truth for that gate.
//
// Tables:
//   contract-admin-reviews         ContractAdminReview
//   contract-admin-review-events   ContractAdminReviewEvent
//
// An approval is bound to the EXACT version hash it was given for
// (`documentHash`). `isCurrentVersionApproved` is the load-bearing
// check: an approval whose hash no longer matches the current version
// is stale and must not authorise issuance or signing.
// ============================================================

import crypto from "node:crypto";
import type {
  ContractAdminReview,
  ContractAdminReviewDetail,
  ContractAdminReviewEvent,
  PropertyContract,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";

const T_REVIEWS = "contract-admin-reviews";
const T_EVENTS = "contract-admin-review-events";

/** The office/person credited with the review. Never a court or notary. */
const REVIEWING_OFFICE_FA = "واحد بررسی حقوقی لیگالیر";

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------

export function listAdminReviews(contractId: string): ContractAdminReview[] {
  return readTable<ContractAdminReview>(T_REVIEWS)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAdminReview(
  contractId: string,
  reviewId: string
): ContractAdminReview | null {
  return (
    readTable<ContractAdminReview>(T_REVIEWS).find(
      (r) => r.contractId === contractId && r.id === reviewId
    ) ?? null
  );
}

/** The newest admin review for a contract, regardless of status. */
export function latestAdminReview(contractId: string): ContractAdminReview | null {
  return listAdminReviews(contractId)[0] ?? null;
}

/**
 * The newest admin review that is not terminal — one still awaiting a
 * decision. A contract has at most one open review at a time.
 */
export function openAdminReview(contractId: string): ContractAdminReview | null {
  const terminal = new Set(["APPROVED", "REJECTED", "CHANGES_REQUESTED", "CANCELLED"]);
  return listAdminReviews(contractId).find((r) => !terminal.has(r.status)) ?? null;
}

export function listAdminReviewEvents(reviewId: string): ContractAdminReviewEvent[] {
  return readTable<ContractAdminReviewEvent>(T_EVENTS)
    .filter((e) => e.reviewId === reviewId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function toAdminReviewDetail(review: ContractAdminReview): ContractAdminReviewDetail {
  return { ...review, events: listAdminReviewEvents(review.id) };
}

// ------------------------------------------------------------
// The gate — "may this exact version be signed / issued?"
// ------------------------------------------------------------

/**
 * The approval that authorises the contract's CURRENT version — i.e. an
 * APPROVED review whose recorded `documentHash` matches the hash of the
 * version the contract is currently on. Returns null when no such
 * approval exists (never submitted, rejected, or content changed since
 * approval). This is the single check both the sign and finalize routes
 * call, so direct API calls cannot bypass the gate.
 *
 * The binding is the HASH, not the version id. A snapshot is a
 * deterministic function of the content (data, parties, payments,
 * documents), so re-snapshotting unchanged content yields a new version
 * id but the SAME hash — and the approval legitimately still holds. Any
 * real content change yields a different hash and voids the approval.
 */
export function currentVersionApproval(
  contract: PropertyContract,
  currentVersionHash: string | null
): ContractAdminReview | null {
  if (!currentVersionHash) return null;
  const review = latestAdminReview(contract.id);
  if (!review) return null;
  if (review.status !== "APPROVED") return null;
  if (review.documentHash !== currentVersionHash) return null;
  if (review.expiresAt && review.expiresAt < new Date().toISOString()) return null;
  return review;
}

/** True when the contract's current version carries a valid approval. */
export function isCurrentVersionApproved(
  contract: PropertyContract,
  currentVersionHash: string | null
): boolean {
  return currentVersionApproval(contract, currentVersionHash) !== null;
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------

export function insertAdminReview(review: ContractAdminReview): ContractAdminReview {
  const rows = readTable<ContractAdminReview>(T_REVIEWS);
  rows.push(review);
  writeTable(T_REVIEWS, rows);
  return review;
}

export function updateAdminReview(
  reviewId: string,
  patch: Partial<ContractAdminReview>
): ContractAdminReview | null {
  const rows = readTable<ContractAdminReview>(T_REVIEWS);
  const idx = rows.findIndex((r) => r.id === reviewId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id, updatedAt: new Date().toISOString() };
  writeTable(T_REVIEWS, rows);
  return rows[idx]!;
}

export function appendAdminReviewEvent(
  event: Omit<ContractAdminReviewEvent, "id" | "createdAt"> &
    Partial<Pick<ContractAdminReviewEvent, "createdAt" | "contractVersionId" | "documentHash">>
): ContractAdminReviewEvent {
  const row: ContractAdminReviewEvent = {
    ...event,
    id: `arev-${crypto.randomUUID()}`,
    contractVersionId: event.contractVersionId ?? null,
    documentHash: event.documentHash ?? null,
    createdAt: event.createdAt ?? new Date().toISOString(),
  };
  const rows = readTable<ContractAdminReviewEvent>(T_EVENTS);
  rows.push(row);
  writeTable(T_EVENTS, rows);
  return row;
}

/** A new PENDING review bound to the given version. */
export function createPendingReview(params: {
  contractId: string;
  contractVersionId: string | null;
  documentHash: string | null;
  submittedByLabelFa?: string;
}): ContractAdminReview {
  const now = new Date().toISOString();
  return insertAdminReview({
    id: `arev-${crypto.randomUUID()}`,
    contractId: params.contractId,
    contractVersionId: params.contractVersionId,
    documentHash: params.documentHash,
    status: "PENDING",
    reviewerId: null,
    reviewerLabelFa: null,
    reviewerInitials: null,
    reviewingOfficeFa: REVIEWING_OFFICE_FA,
    reasonFa: params.submittedByLabelFa ? `ارسال برای بررسی توسط ${params.submittedByLabelFa}.` : "",
    submittedAt: now,
    decidedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export { REVIEWING_OFFICE_FA };
