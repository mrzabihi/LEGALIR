// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/lawyer-review
// ============================================================
// POST — the lawyer review workflow. One endpoint, five actions:
//
//   create          open a review request and match a lawyer by
//                   specialty; the SLA clock does NOT start yet
//   accept          the lawyer accepts; the SLA clock starts HERE
//   complete        the lawyer submits a summary and findings
//   decide_finding  the user accepts or rejects one finding
//   cancel          the user withdraws the request
//
// A lawyer NEVER edits the contract silently. A finding is a
// suggestion the user accepts or rejects; accepting one is what
// creates a new version (through the normal edit path), so the
// version-supremacy rule is never bypassed.
//
// The SLA is STORED on the request, not hardcoded, and is measured
// from ACCEPTED — a request that sits unmatched does not burn SLA.
// ============================================================

import crypto from "node:crypto";
import type {
  LawyerReviewFinding,
  LawyerReviewRequest,
  PropertyContract,
} from "@legalir/types";
import {
  audit,
  badRequest,
  conflict,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { getVersion } from "@/lib/contracts/db";
import {
  activeLawyerReview,
  getLawyerReview,
  insertFinding,
  insertLawyerReview,
  listFindings,
  toLawyerReviewDetail,
  updateFinding,
  updateLawyerReview,
} from "@/lib/contracts/review-db";
import { listLawyerProfiles } from "@/lib/lawyer-db";
import { isContractFeatureEnabled } from "@/lib/contracts/feature-flags";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_SLA_HOURS = 48;

type LawyerAction = "create" | "accept" | "complete" | "decide_finding" | "cancel";

interface LawyerBody {
  action?: LawyerAction;
  mode?: "BLOCKING" | "NON_BLOCKING";
  category?: string;
  slaHours?: number;
  note?: string;
  reviewId?: string;
  lawyerId?: string;
  summaryFa?: string;
  findings?: {
    kind: LawyerReviewFinding["kind"];
    severity: LawyerReviewFinding["severity"];
    titleFa: string;
    bodyFa: string;
    clauseRef?: string | null;
    proposedText?: string | null;
  }[];
  findingId?: string;
  decision?: "accepted" | "rejected";
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;

  if (!isContractFeatureEnabled("LAWYER_REVIEW_ENABLED")) {
    return conflict("بررسی توسط وکیل در حال حاضر فعال نیست.", "FEATURE_DISABLED");
  }

  let body: LawyerBody;
  try {
    body = (await request.json()) as LawyerBody;
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  switch (body.action) {
    case "create":
      return createReview(userId, contract, body);
    case "accept":
      return acceptReview(userId, contract, body);
    case "complete":
      return completeReview(userId, contract, body);
    case "decide_finding":
      return decideFinding(userId, contract, body);
    case "cancel":
      return cancelReview(userId, contract, body);
    default:
      return badRequest("عملیات درخواستی معتبر نیست", "INVALID_ACTION");
  }
}

// ------------------------------------------------------------

function createReview(userId: string, contract: PropertyContract, body: LawyerBody) {
  if (!contract.currentVersionId) {
    return conflict("ابتدا قرارداد را برای بررسی ارسال کنید.", "NO_VERSION");
  }
  if (activeLawyerReview(contract.id)) {
    return conflict("یک درخواست بررسی در جریان است.", "REVIEW_IN_FLIGHT");
  }

  const version = getVersion(contract.id, contract.currentVersionId);
  if (!version) return conflict("نسخه جاری یافت نشد.", "NO_VERSION");

  const category = body.category ?? contract.domain;
  const mode = body.mode ?? "NON_BLOCKING";
  const slaHours = body.slaHours ?? DEFAULT_SLA_HOURS;
  const now = new Date().toISOString();

  // Match a verified lawyer whose specialties include the category.
  const match = listLawyerProfiles().find(
    (l) =>
      l.verificationStatus === "VERIFIED" &&
      l.acceptingRequests &&
      l.specializations.some((s) => s.category === category)
  );

  const review: LawyerReviewRequest = {
    id: `lrev-${crypto.randomUUID()}`,
    contractId: contract.id,
    contractVersionId: version.id,
    documentHash: version.documentHash,
    requestedBy: userId,
    lawyerId: match?.id ?? null,
    lawyerNameFa: match?.fullName ?? null,
    mode,
    state: match ? "AWAITING_ACCEPTANCE" : "MATCHING",
    category,
    slaHours,
    slaStartedAt: null,
    slaDueAt: null,
    summaryFa: null,
    blocksSigning: mode === "BLOCKING",
    requestedAt: now,
    acceptedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  insertLawyerReview(review);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "lawyer_review.requested",
    descriptionFa: match
      ? `درخواست بررسی حقوقی ثبت شد و برای ${match.fullName} ارسال شد.`
      : "درخواست بررسی حقوقی ثبت شد؛ در حال یافتن وکیل.",
    metadata: { reviewId: review.id, category, mode, lawyerId: match?.id ?? null },
  });

  return ok({ review: toLawyerReviewDetail(review) });
}

function acceptReview(userId: string, contract: PropertyContract, body: LawyerBody) {
  const review = resolveReview(contract, body);
  if (!review) return conflict("درخواست بررسی یافت نشد.", "NO_REVIEW");
  if (review.state !== "AWAITING_ACCEPTANCE" && review.state !== "MATCHING") {
    return conflict("این درخواست در وضعیت قابل پذیرش نیست.", "NOT_ACCEPTABLE");
  }

  const now = new Date();
  const dueAt = new Date(now.getTime() + review.slaHours * 3600_000).toISOString();

  const updated = updateLawyerReview(contract.id, review.id, {
    state: "ACCEPTED",
    acceptedAt: now.toISOString(),
    // The SLA clock starts at ACCEPTED, never at request time.
    slaStartedAt: now.toISOString(),
    slaDueAt: dueAt,
  })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: review.lawyerNameFa ?? "وکیل",
    action: "lawyer_review.accepted",
    descriptionFa: `بررسی حقوقی پذیرفته شد؛ مهلت ${review.slaHours} ساعت آغاز شد.`,
    metadata: { reviewId: review.id, slaDueAt: dueAt },
  });

  return ok({ review: toLawyerReviewDetail(updated) });
}

function completeReview(userId: string, contract: PropertyContract, body: LawyerBody) {
  const review = resolveReview(contract, body);
  if (!review) return conflict("درخواست بررسی یافت نشد.", "NO_REVIEW");
  if (review.state !== "ACCEPTED" && review.state !== "IN_PROGRESS") {
    return conflict("این درخواست در وضعیت قابل تکمیل نیست.", "NOT_COMPLETABLE");
  }

  const now = new Date().toISOString();
  const created: LawyerReviewFinding[] = [];
  for (const f of body.findings ?? []) {
    created.push(
      insertFinding({
        id: `lfind-${crypto.randomUUID()}`,
        lawyerReviewRequestId: review.id,
        contractId: contract.id,
        contractVersionId: review.contractVersionId,
        kind: f.kind,
        severity: f.severity,
        titleFa: f.titleFa,
        bodyFa: f.bodyFa,
        clauseRef: f.clauseRef ?? null,
        proposedText: f.proposedText ?? null,
        decision: "pending",
        decidedAt: null,
        createdAt: now,
      })
    );
  }

  const updated = updateLawyerReview(contract.id, review.id, {
    state: "COMPLETED",
    summaryFa: body.summaryFa ?? null,
    completedAt: now,
  })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: review.lawyerNameFa ?? "وکیل",
    action: "lawyer_review.completed",
    descriptionFa: `بررسی حقوقی تکمیل شد (${created.length} یافته).`,
    metadata: { reviewId: review.id, findings: created.length },
  });

  return ok({ review: toLawyerReviewDetail(updated) });
}

function decideFinding(userId: string, contract: PropertyContract, body: LawyerBody) {
  if (!body.findingId || !body.decision) {
    return badRequest("شناسه یافته و تصمیم الزامی است.", "INVALID_BODY");
  }
  const review = resolveReview(contract, body);
  if (!review) return conflict("درخواست بررسی یافت نشد.", "NO_REVIEW");

  const finding = listFindings(review.id).find((f) => f.id === body.findingId);
  if (!finding) return badRequest("یافته یافت نشد.", "NO_FINDING");

  const updated = updateFinding(finding.id, {
    decision: body.decision,
    decidedAt: new Date().toISOString(),
  })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "lawyer_review.finding_decided",
    descriptionFa:
      body.decision === "accepted"
        ? `پیشنهاد «${finding.titleFa}» پذیرفته شد.`
        : `پیشنهاد «${finding.titleFa}» رد شد.`,
    metadata: { reviewId: review.id, findingId: finding.id, decision: body.decision },
  });

  return ok({ finding: updated, review: toLawyerReviewDetail(review) });
}

function cancelReview(userId: string, contract: PropertyContract, body: LawyerBody) {
  const review = resolveReview(contract, body);
  if (!review) return conflict("درخواست بررسی یافت نشد.", "NO_REVIEW");

  const updated = updateLawyerReview(contract.id, review.id, { state: "CANCELLED" })!;

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "lawyer_review.cancelled",
    descriptionFa: "درخواست بررسی حقوقی لغو شد.",
    metadata: { reviewId: review.id },
  });

  return ok({ review: toLawyerReviewDetail(updated) });
}

// ------------------------------------------------------------

/** Resolve the review from the body, defaulting to the active one. */
function resolveReview(
  contract: PropertyContract,
  body: LawyerBody
): LawyerReviewRequest | null {
  if (body.reviewId) return getLawyerReview(contract.id, body.reviewId);
  return activeLawyerReview(contract.id);
}
