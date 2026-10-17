// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/review
// ============================================================
// POST — the review workflow. One endpoint, three actions:
//
//   submit          freeze the current content as a version and move
//                   the contract to READY_FOR_REVIEW
//   approve         record an approval for the CURRENT version only
//   request_changes move the contract to CHANGES_REQUESTED
//
// An approval is always bound to a version id. Because snapshotting
// invalidates approvals for older versions, an approval can never
// outlive the content it was given for.
// ============================================================

import type { ContractApproval, PropertyContract } from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import {
  getVersion,
  insertApproval,
  listApprovals,
  listContractDocuments,
  listParties,
  updateContractForUser,
} from "@/lib/contracts/db";
import { computeCompleteness, isReadyForReview } from "@/lib/contracts/completeness";
import { insertReviewComment, listReviewComments } from "@/lib/contracts/review-db";
import { createPendingReview, openAdminReview } from "@/lib/contracts/admin-review";
import { createVersion } from "@/lib/contracts/snapshot";
import { assertTransition, IllegalTransitionError } from "@/lib/contracts/state-machine";
import { partyRoleLabelFa } from "@/lib/contracts/registry";

interface Params {
  params: Promise<{ id: string }>;
}

type ReviewAction = "submit" | "approve" | "request_changes" | "comment" | "submit_admin";

interface ReviewBody {
  action?: ReviewAction;
  partyId?: string;
  comment?: string;
  method?: "otp" | "explicit_consent";
  /** For the `comment` action: the comment body and optional clause ref. */
  body?: string;
  clauseRef?: string | null;
  kind?: "comment" | "change_request" | "approval_note";
  /** Reply to an existing comment on the SAME version. */
  parentId?: string | null;
  /**
   * `internal` (default) stays in the drafter's workspace and never reaches
   * the counterparty, the signer page or the PDF; `parties` is shared.
   */
  visibility?: "internal" | "parties";
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  if (body.action === "submit") return submitForReview(userId, contract);
  if (body.action === "approve") return approve(userId, contract, body);
  if (body.action === "request_changes") return requestChanges(userId, contract, body);
  if (body.action === "comment") return addComment(userId, contract, body);
  if (body.action === "submit_admin") return submitForAdminReview(userId, contract);

  return badRequest("عملیات درخواستی معتبر نیست", "INVALID_ACTION");
}

// ------------------------------------------------------------
// comment — a review note on the current version
// ------------------------------------------------------------

function addComment(userId: string, contract: PropertyContract, body: ReviewBody) {
  const text = (body.body ?? body.comment ?? "").trim();
  if (!text) return badRequest("متن نظر الزامی است.", "EMPTY_COMMENT");
  if (!contract.currentVersionId) {
    return conflict("ابتدا قرارداد را برای بررسی ارسال کنید.", "NO_VERSION");
  }

  const parties = listParties(contract.id);
  const party = body.partyId
    ? parties.find((p) => p.id === body.partyId)
    : parties.find((p) => p.isInitiator);

  // A reply must stay inside the same version thread: a note written
  // against an older revision is about text that may no longer exist, and
  // attaching it to the current version would silently mis-date it.
  let parentId: string | null = null;
  if (body.parentId) {
    const parent = listReviewComments(contract.id).find((c) => c.id === body.parentId);
    if (!parent) return badRequest("نظر مورد پاسخ یافت نشد.", "PARENT_NOT_FOUND");
    if (parent.contractVersionId !== contract.currentVersionId) {
      return conflict(
        "پاسخ فقط به نظرهای همین نسخه امکان‌پذیر است.",
        "PARENT_VERSION_MISMATCH"
      );
    }
    parentId = parent.id;
  }

  const comment = insertReviewComment({
    contractId: contract.id,
    contractVersionId: contract.currentVersionId,
    partyId: party?.id ?? null,
    authorLabelFa: party ? partyRoleLabelFa(party.role) : "کاربر",
    authorKind: "party",
    visibility: body.visibility ?? "internal",
    kind: body.kind ?? "comment",
    body: text,
    clauseRef: body.clauseRef ?? null,
    parentId,
  });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: comment.authorLabelFa,
    action: "review.commented",
    descriptionFa: "نظر بررسی ثبت شد.",
    metadata: { commentId: comment.id, clauseRef: comment.clauseRef },
  });

  return ok({ comment });
}

// ------------------------------------------------------------
// submit — freeze content, then move to READY_FOR_REVIEW
// ------------------------------------------------------------

function submitForReview(userId: string, contract: PropertyContract) {
  const parties = listParties(contract.id);
  const documents = listContractDocuments(contract.id);
  const completeness = computeCompleteness(contract, parties, documents);

  if (!isReadyForReview(completeness)) {
    return conflict(
      "برای ارسال به بررسی، ابتدا بخش‌های ناقص را تکمیل کنید.",
      "INCOMPLETE"
    );
  }

  try {
    assertTransition(contract.state, "READY_FOR_REVIEW");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return conflict(err.message, "ILLEGAL_TRANSITION");
    throw err;
  }

  const { version, invalidatedApprovals } = createVersion(contract, userId);
  const updated = updateContractForUser(userId, contract.id, { state: "READY_FOR_REVIEW" });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "review.submitted",
    descriptionFa: `قرارداد برای بررسی ارسال شد (نسخه ${version.versionNumber}).`,
    metadata: { versionId: version.id, invalidatedApprovals },
  });

  return ok({ contract: updated, version, invalidatedApprovals });
}

// ------------------------------------------------------------
// approve — bind an approval to the current version
// ------------------------------------------------------------

function approve(userId: string, contract: PropertyContract, body: ReviewBody) {
  if (!contract.currentVersionId) {
    return conflict("ابتدا قرارداد را برای بررسی ارسال کنید.", "NO_VERSION");
  }

  const version = getVersion(contract.id, contract.currentVersionId);
  if (!version) return conflict("نسخه جاری یافت نشد.", "NO_VERSION");

  const parties = listParties(contract.id);
  const party = body.partyId
    ? parties.find((p) => p.id === body.partyId)
    : parties.find((p) => p.isInitiator);
  if (!party) return badRequest("طرف تأییدکننده مشخص نیست", "NO_PARTY");

  // Replace any prior approval by this party for this version.
  const existing = listApprovals(contract.id).find(
    (a) => a.partyId === party.id && a.contractVersionId === version.id
  );

  // A signature is stronger than an approval: once a party has signed
  // this version with an OTP, a plain approval must not downgrade it.
  const method: ContractApproval["method"] =
    existing?.method === "otp" ? "otp" : body.method === "otp" ? "otp" : "explicit_consent";

  const approval: ContractApproval = {
    id: existing?.id ?? `apr-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    partyId: party.id,
    status: "approved",
    comment: body.comment ?? existing?.comment ?? "",
    method,
    approvedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  insertApproval(approval);

  // When every declared role has approved this version, the contract
  // becomes ready to sign.
  const approvals = listApprovals(contract.id).filter(
    (a) => a.contractVersionId === version.id && a.status === "approved"
  );
  const approvedRoles = new Set(
    approvals
      .map((a) => parties.find((p) => p.id === a.partyId)?.role)
      .filter((r): r is NonNullable<typeof r> => !!r)
  );
  const allApproved = parties.length > 0 && parties.every((p) => approvedRoles.has(p.role));

  let updated = contract;
  if (allApproved && contract.state === "READY_FOR_REVIEW") {
    try {
      assertTransition(contract.state, "READY_TO_SIGN");
      updated = updateContractForUser(userId, contract.id, { state: "READY_TO_SIGN" }) ?? contract;
    } catch {
      // Leave the state as-is when the transition is not legal.
    }
  }

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: partyRoleLabelFa(party.role),
    action: "review.approved",
    descriptionFa: `${partyRoleLabelFa(party.role)} نسخه ${version.versionNumber} را تأیید کرد.`,
    metadata: { versionId: version.id, partyId: party.id, allApproved },
  });

  return ok({ approval, contract: updated, allApproved });
}

// ------------------------------------------------------------
// request_changes — send the contract back for edits
// ------------------------------------------------------------

function requestChanges(userId: string, contract: PropertyContract, body: ReviewBody) {
  try {
    assertTransition(contract.state, "CHANGES_REQUESTED");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return conflict(err.message, "ILLEGAL_TRANSITION");
    throw err;
  }

  const parties = listParties(contract.id);
  const party = body.partyId
    ? parties.find((p) => p.id === body.partyId)
    : parties.find((p) => !p.isInitiator) ?? parties[0];

  if (party && contract.currentVersionId) {
    insertApproval({
      id: `apr-${crypto.randomUUID()}`,
      contractId: contract.id,
      contractVersionId: contract.currentVersionId,
      partyId: party.id,
      status: "changes_requested",
      comment: body.comment ?? "",
      method: "explicit_consent",
      approvedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  const updated = updateContractForUser(userId, contract.id, { state: "CHANGES_REQUESTED" });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: party ? partyRoleLabelFa(party.role) : "کاربر",
    action: "review.changes_requested",
    descriptionFa: "درخواست اصلاح ثبت شد.",
    metadata: { comment: body.comment ?? "" },
  });

  return ok({ contract: updated });
}

// ------------------------------------------------------------
// submit_admin — enter the compulsory LEGALIR admin review queue
// ------------------------------------------------------------
// The contract's content is frozen as a fresh immutable version and a
// PENDING admin review is opened, bound to that exact version's hash.
// The version is the thing the admin judges; because snapshotting
// invalidates stale approvals, any later content change produces a NEW
// version with a DIFFERENT hash, and the old approval stops matching —
// the contract must be re-submitted. This is the same hash-bound gate
// the sign and finalize routes enforce.

function submitForAdminReview(userId: string, contract: PropertyContract) {
  // One open review at a time — a second submission while a review is
  // pending would create an ambiguous decision trail.
  if (openAdminReview(contract.id)) {
    return conflict("یک درخواست بررسی ادمین در جریان است.", "REVIEW_IN_FLIGHT");
  }

  try {
    assertTransition(contract.state, "PENDING_ADMIN_REVIEW");
  } catch (err) {
    if (err instanceof IllegalTransitionError) return conflict(err.message, "ILLEGAL_TRANSITION");
    throw err;
  }

  // Freeze the content. The admin reviews THIS version, and any later
  // edit yields a new hash that the approval will no longer match.
  const { version } = createVersion(contract, userId);

  const review = createPendingReview({
    contractId: contract.id,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    submittedByLabelFa: "کاربر",
  });

  const updated = updateContractForUser(userId, contract.id, {
    state: "PENDING_ADMIN_REVIEW",
  });

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "admin_review.submitted",
    descriptionFa: `قرارداد برای بررسی ادمین ارسال شد (نسخه ${version.versionNumber}).`,
    metadata: { reviewId: review.id, versionId: version.id, documentHash: version.documentHash },
  });

  return ok({ contract: updated, review, version });
}
