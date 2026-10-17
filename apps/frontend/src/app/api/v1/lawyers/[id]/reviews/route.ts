// ============================================================
// LEGALIR — POST /api/v1/lawyers/[id]/reviews
// ============================================================
// Submit or edit the signed-in client's review of a lawyer. Two hard rules,
// both enforced here (never in the UI alone):
//
//   · ELIGIBILITY — a review may only be filed by a user who actually had a
//     COMPLETED engagement with this lawyer. An in-flight, declined or
//     cancelled request never qualifies.
//   · ONE REVIEW PER USER — a second submit EDITS the viewer's own review
//     (within the edit window) rather than creating a duplicate. Edits keep
//     the current moderation status; the content change is recorded.
//
// A new review starts PENDING and is only counted toward the rating once a
// moderator PUBLISHES it (see the admin moderation route).
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import {
  buildReviewEligibility,
  getLawyerProfileById,
  hasCompletedEngagement,
  isPubliclyViewable,
  upsertClientReview,
  reviewEditDeadline,
} from "@/lib/lawyer-db";
import { readJson } from "@/lib/admin/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const profile = getLawyerProfileById(id);
  if (!profile || !isPubliclyViewable(profile)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const body = (await readJson(request)) as { rating?: number; comment?: string } | null;
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const errors: { path: string; reason: string }[] = [];
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push({ path: "rating", reason: "امتیاز باید بین ۱ تا ۵ باشد" });
  }
  if (comment.length < 3 || comment.length > 2000) {
    errors.push({ path: "comment", reason: "متن نظر باید بین ۳ تا ۲۰۰۰ نویسه باشد" });
  }
  if (errors.length > 0) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نظر نامعتبر است", fieldErrors: errors },
      { status: 400 }
    );
  }

  const eligibility = buildReviewEligibility(id, auth.ctx.userId);

  // Editing an existing review: only within the window and unless rejected.
  if (eligibility.existing) {
    if (!eligibility.canReview) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: eligibility.reason ?? "ویرایش این نظر مجاز نیست" },
        { status: 403 }
      );
    }
    const row = upsertClientReview({
      lawyerId: id,
      authorUserId: auth.ctx.userId,
      rating,
      comment,
      verifiedEngagement: true,
      replaceId: eligibility.existing.id,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        status: row.status ?? "PUBLISHED",
        rating: row.rating,
        comment: row.comment,
        updatedAt: row.updatedAt ?? row.createdAt,
        editableUntil: reviewEditDeadline(row),
        created: false,
      },
    });
  }

  // First review: only against a genuinely completed engagement.
  if (!hasCompletedEngagement(auth.ctx.userId, id)) {
    return NextResponse.json(
      {
        code: "FORBIDDEN",
        message: "برای ثبت نظر باید یک مشاورهٔ تکمیل‌شده با این وکیل داشته باشید.",
      },
      { status: 403 }
    );
  }

  const row = upsertClientReview({
    lawyerId: id,
    authorUserId: auth.ctx.userId,
    rating,
    comment,
    verifiedEngagement: true,
  });
  return NextResponse.json({
    data: {
      id: row.id,
      status: row.status ?? "PENDING",
      rating: row.rating,
      comment: row.comment,
      updatedAt: row.updatedAt ?? row.createdAt,
      editableUntil: reviewEditDeadline(row),
      created: true,
    },
  });
}
