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
import { insertReviewComment } from "@/lib/contracts/review-db";
import { createVersion } from "@/lib/contracts/snapshot";
import { assertTransition, IllegalTransitionError } from "@/lib/contracts/state-machine";
import { partyRoleLabelFa } from "@/lib/contracts/registry";

type Params = { params: Promise<{ id: string }> };

type ReviewAction = "submit" | "approve" | "request_changes" | "comment";

interface ReviewBody {
  action?: ReviewAction;
  partyId?: string;
  comment?: string;
  method?: "otp" | "explicit_consent";
  /** For the `comment` action: the comment body and optional clause ref. */
  body?: string;
  clauseRef?: string | null;
  kind?: "comment" | "change_request" | "approval_note";
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

  const comment = insertReviewComment({
    contractId: contract.id,
    contractVersionId: contract.currentVersionId,
    partyId: party?.id ?? null,
    authorLabelFa: party ? partyRoleLabelFa(party.role) : "کاربر",
    authorKind: "party",
    kind: body.kind ?? "comment",
    body: text,
    clauseRef: body.clauseRef ?? null,
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
