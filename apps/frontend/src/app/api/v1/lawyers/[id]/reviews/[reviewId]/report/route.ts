// ============================================================
// LEGALIR — POST /api/v1/lawyers/[id]/reviews/[reviewId]/report
// ============================================================
// Report an inappropriate review. Any signed-in user may file a report; the
// review moves to REPORTED (still visible until a moderator decides) and the
// report is queued for the moderation surface. One open report per user per
// review — a repeat is idempotent rather than piling up duplicates.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import {
  createReviewReport,
  listLawyerReviewRows,
  listReviewReports,
  moderateReview,
  reviewStatus,
} from "@/lib/lawyer-db";
import { readJson } from "@/lib/admin/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id, reviewId } = await params;

  const body = (await readJson(request)) as { reason?: string } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "دلیل گزارش نامعتبر است",
        fieldErrors: [{ path: "reason", reason: "دلیل گزارش باید بین ۳ تا ۵۰۰ نویسه باشد" }],
      },
      { status: 400 }
    );
  }

  const review = listLawyerReviewRows(id).find((r) => r.id === reviewId);
  if (!review) {
    return NextResponse.json({ code: "NOT_FOUND", message: "نظر یافت نشد" }, { status: 404 });
  }

  // Idempotent: a reporter with an already-open report gets the same outcome.
  const alreadyOpen = listReviewReports(reviewId).some(
    (r) => r.reporterUserId === auth.ctx.userId && r.status === "OPEN"
  );
  if (!alreadyOpen) {
    createReviewReport({
      id: `lrr-${crypto.randomUUID()}`,
      reviewId,
      lawyerId: id,
      reporterUserId: auth.ctx.userId,
      reason,
      status: "OPEN",
      resolutionNote: null,
      resolvedByUserId: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  // Flag a PUBLISHED review as REPORTED — a logged transition that keeps it
  // visible (the public list serves PUBLISHED ∪ REPORTED). A moderator's
  // later hide/reject is what actually pulls it. PENDING/HIDDEN/REJECTED rows
  // are left untouched: the report still queues for the moderation surface.
  const wasPublished = reviewStatus(review) === "PUBLISHED";
  if (wasPublished) {
    moderateReview({
      lawyerId: id,
      reviewId,
      toStatus: "REPORTED",
      reason,
      actorUserId: auth.ctx.userId,
      actorRole: auth.ctx.role,
    });
  }

  return NextResponse.json({
    data: { reviewId, status: wasPublished ? "REPORTED" : reviewStatus(review), reported: true },
  });
}
