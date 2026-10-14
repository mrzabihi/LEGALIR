// ============================================================
// LEGALIR — POST /api/v1/admin/lawyers/[id]/reviews/[reviewId]
// ============================================================
// Moderate a single review. Gated on `admin:lawyer:review:manage`. Three
// actions:
//   hide    → soft-hide (reversible). The review drops out of the public
//             list AND the derived average, but the row is kept.
//   restore → unhide (undo a previous hide).
//   delete  → permanent removal of the row.
//
// Because the public profile and the derived rating both read through the
// same `listLawyerReviews()` (which excludes hidden rows), a moderation
// action changes the visible reviews and the displayed rating together — the
// two can never disagree. The action is recorded in the audit trail.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import {
  getLawyerProfileById,
  deleteReviewRow,
  listLawyerReviewRows,
  moderateReview,
  resolveReviewReports,
  reviewStatus,
  computePerformance,
} from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";
import type { LawyerAuditAction, LawyerReviewStatus } from "@legalir/types";

const ACTIONS = ["publish", "hide", "restore", "reject", "delete"] as const;
type ReviewAction = (typeof ACTIONS)[number];

const AUDIT_FOR: Record<ReviewAction, LawyerAuditAction> = {
  publish: "LAWYER_REVIEW_RESTORE",
  hide: "LAWYER_REVIEW_HIDE",
  restore: "LAWYER_REVIEW_RESTORE",
  reject: "LAWYER_REVIEW_HIDE",
  delete: "LAWYER_REVIEW_DELETE",
};

/** The moderation status each action lands on (delete is handled separately). */
const STATUS_FOR: Record<Exclude<ReviewAction, "delete">, LawyerReviewStatus> = {
  publish: "PUBLISHED",
  hide: "HIDDEN",
  restore: "PUBLISHED",
  reject: "REJECTED",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:review:manage");
  if (!auth.ok) return auth.response;
  const { id, reviewId } = await params;

  const body = (await readJson(request)) as { action?: string; reason?: string } | null;
  const action = body?.action as ReviewAction | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "عملیات مدیریت نظر نامعتبر است" },
      { status: 400 }
    );
  }

  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const row = listLawyerReviewRows(id).find((r) => r.id === reviewId);
  if (!row) {
    return NextResponse.json({ code: "NOT_FOUND", message: "نظر یافت نشد" }, { status: 404 });
  }
  const beforeStatus = reviewStatus(row);

  // Withholding a review (hide/reject) is a decision and is never anonymous.
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if ((action === "hide" || action === "reject") && reason.length < 3) {
    return NextResponse.json(
      {
        code: "REASON_REQUIRED",
        message: "ثبت دلیل برای پنهان‌سازی/رد نظر الزامی است",
        fieldErrors: [{ path: "reason", reason: "دلیل را وارد کنید" }],
      },
      { status: 400 }
    );
  }

  if (action === "delete") {
    if (!deleteReviewRow(id, reviewId)) {
      return NextResponse.json({ code: "NOT_FOUND", message: "نظر یافت نشد" }, { status: 404 });
    }
    recordAudit({
      actorUserId: auth.ctx.userId,
      actorRole: auth.ctx.role,
      orgId: auth.ctx.orgId,
      action: AUDIT_FOR[action],
      resourceType: "lawyer_review",
      resourceId: reviewId,
      reason: reason || null,
      before: { status: beforeStatus, rating: row.rating, lawyerId: id },
      after: { status: null },
      ...requestMeta(request),
    });
    return NextResponse.json({
      data: { reviewId, action, performance: computePerformance(id) },
    });
  }

  // Apply the status transition (records a review event) in one code path.
  const updated = moderateReview({
    lawyerId: id,
    reviewId,
    toStatus: STATUS_FOR[action],
    reason: reason || null,
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
  });
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "نظر یافت نشد" }, { status: 404 });
  }
  // Deciding a reported review also closes its open reports.
  const resolvedReports =
    action === "hide" || action === "reject" || action === "publish"
      ? resolveReviewReports(
          reviewId,
          action === "publish" ? "DISMISSED" : "RESOLVED",
          reason || null,
          auth.ctx.userId
        )
      : 0;

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: AUDIT_FOR[action],
    resourceType: "lawyer_review",
    resourceId: reviewId,
    reason: reason || null,
    before: { status: beforeStatus, rating: row.rating, lawyerId: id },
    after: { status: STATUS_FOR[action], resolvedReports },
    ...requestMeta(request),
  });

  // Return the recomputed rating so the caller can show the immediate effect.
  return NextResponse.json({
    data: { reviewId, action, status: STATUS_FOR[action], performance: computePerformance(id) },
  });
}
