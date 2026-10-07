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
  setReviewHidden,
  deleteReviewRow,
  listLawyerReviewRows,
  computePerformance,
} from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";
import type { LawyerAuditAction } from "@legalir/types";

const ACTIONS = ["hide", "restore", "delete"] as const;
type ReviewAction = (typeof ACTIONS)[number];

const AUDIT_FOR: Record<ReviewAction, LawyerAuditAction> = {
  hide: "LAWYER_REVIEW_HIDE",
  restore: "LAWYER_REVIEW_RESTORE",
  delete: "LAWYER_REVIEW_DELETE",
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

  const ok =
    action === "delete"
      ? deleteReviewRow(id, reviewId)
      : setReviewHidden(id, reviewId, action === "hide");
  if (!ok) {
    return NextResponse.json({ code: "NOT_FOUND", message: "نظر یافت نشد" }, { status: 404 });
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: AUDIT_FOR[action],
    resourceType: "lawyer_review",
    resourceId: reviewId,
    reason: typeof body?.reason === "string" ? body.reason : null,
    before: { hidden: Boolean(row.hidden), rating: row.rating, lawyerId: id },
    after: { hidden: action === "delete" ? null : action === "hide" },
    ...requestMeta(request),
  });

  // Return the recomputed rating so the caller can show the immediate effect.
  return NextResponse.json({
    data: { reviewId, action, performance: computePerformance(id) },
  });
}
