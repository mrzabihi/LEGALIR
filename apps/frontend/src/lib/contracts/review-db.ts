// ============================================================
// LEGALIR — Review persistence (comments, lawyer review, AI review)
// ============================================================
// Tables (all keyed by contract_id, all scoped by the caller):
//
//   contract-review-comments    ContractReviewComment
//   contract-lawyer-reviews     LawyerReviewRequest
//   contract-lawyer-findings    LawyerReviewFinding
//   contract-ai-reviews         AiContractReview
//
// A review is always bound to a contract VERSION, never to the mutable
// contract — the same rule the signature layer follows. Every read and
// write goes through `readTable`/`writeTable` so the parse cache stays
// coherent.
// ============================================================

import crypto from "node:crypto";
import type {
  AiContractReview,
  ContractReviewComment,
  LawyerReviewFinding,
  LawyerReviewRequest,
  LawyerReviewRequestDetail,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";

const T_COMMENTS = "contract-review-comments";
const T_LAWYER = "contract-lawyer-reviews";
const T_FINDINGS = "contract-lawyer-findings";
const T_AI = "contract-ai-reviews";

// ------------------------------------------------------------
// Review comments
// ------------------------------------------------------------

export function listReviewComments(contractId: string): ContractReviewComment[] {
  return readTable<ContractReviewComment>(T_COMMENTS)
    .filter((c) => c.contractId === contractId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function insertReviewComment(
  comment: Omit<ContractReviewComment, "id" | "createdAt">
): ContractReviewComment {
  const row: ContractReviewComment = {
    ...comment,
    id: `rc-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
  const rows = readTable<ContractReviewComment>(T_COMMENTS);
  rows.push(row);
  writeTable(T_COMMENTS, rows);
  return row;
}

// ------------------------------------------------------------
// Lawyer review requests
// ------------------------------------------------------------

export function listLawyerReviews(contractId: string): LawyerReviewRequest[] {
  return readTable<LawyerReviewRequest>(T_LAWYER)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLawyerReview(
  contractId: string,
  reviewId: string
): LawyerReviewRequest | null {
  return (
    readTable<LawyerReviewRequest>(T_LAWYER).find(
      (r) => r.contractId === contractId && r.id === reviewId
    ) ?? null
  );
}

/** The newest lawyer review that is still in flight (not terminal). */
export function activeLawyerReview(contractId: string): LawyerReviewRequest | null {
  const terminal = new Set(["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"]);
  return listLawyerReviews(contractId).find((r) => !terminal.has(r.state)) ?? null;
}

export function insertLawyerReview(review: LawyerReviewRequest): LawyerReviewRequest {
  const rows = readTable<LawyerReviewRequest>(T_LAWYER);
  rows.push(review);
  writeTable(T_LAWYER, rows);
  return review;
}

export function updateLawyerReview(
  contractId: string,
  reviewId: string,
  patch: Partial<LawyerReviewRequest>
): LawyerReviewRequest | null {
  const rows = readTable<LawyerReviewRequest>(T_LAWYER);
  const idx = rows.findIndex((r) => r.contractId === contractId && r.id === reviewId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id, updatedAt: new Date().toISOString() };
  writeTable(T_LAWYER, rows);
  return rows[idx]!;
}

// ------------------------------------------------------------
// Lawyer review findings
// ------------------------------------------------------------

export function listFindings(reviewId: string): LawyerReviewFinding[] {
  return readTable<LawyerReviewFinding>(T_FINDINGS)
    .filter((f) => f.lawyerReviewRequestId === reviewId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function insertFinding(finding: LawyerReviewFinding): LawyerReviewFinding {
  const rows = readTable<LawyerReviewFinding>(T_FINDINGS);
  rows.push(finding);
  writeTable(T_FINDINGS, rows);
  return finding;
}

export function updateFinding(
  findingId: string,
  patch: Partial<LawyerReviewFinding>
): LawyerReviewFinding | null {
  const rows = readTable<LawyerReviewFinding>(T_FINDINGS);
  const idx = rows.findIndex((f) => f.id === findingId);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx]!, ...patch, id: rows[idx]!.id };
  writeTable(T_FINDINGS, rows);
  return rows[idx]!;
}

/** A lawyer review plus its findings. */
export function toLawyerReviewDetail(
  review: LawyerReviewRequest
): LawyerReviewRequestDetail {
  return { ...review, findings: listFindings(review.id) };
}

/** The active lawyer review for a contract, hydrated, or null. */
export function activeLawyerReviewDetail(
  contractId: string
): LawyerReviewRequestDetail | null {
  const review = activeLawyerReview(contractId);
  return review ? toLawyerReviewDetail(review) : null;
}

// ------------------------------------------------------------
// AI reviews
// ------------------------------------------------------------

export function listAiReviews(contractId: string): AiContractReview[] {
  return readTable<AiContractReview>(T_AI)
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The most recent AI review for a contract, or null. */
export function latestAiReview(contractId: string): AiContractReview | null {
  return listAiReviews(contractId)[0] ?? null;
}

export function insertAiReview(review: AiContractReview): AiContractReview {
  const rows = readTable<AiContractReview>(T_AI);
  rows.push(review);
  writeTable(T_AI, rows);
  return review;
}
