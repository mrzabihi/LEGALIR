// ============================================================
// LEGALIR — /api/v1/judicial/requests/[id]/review/[reviewId]
// ============================================================
// The owner's actions on ONE review, all of which APPEND history:
//
//   PATCH { action: "reply",    bodyFa }              → answer / supplementary note
//   PATCH { action: "resubmit", bodyFa?, versionId }  → send a newer draft version
//   PATCH { action: "cancel",   bodyFa? }             → withdraw before a decision
//
// Every mutation is owner-scoped: a foreign review id is indistinguishable
// from a missing one. Nothing is deleted — a cancelled review keeps its
// events so the operator still sees what was withdrawn and why.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialError, notFoundRequest, readJson } from "@/lib/judicial/http";
import {
  cancelReviewByOwner,
  getOwnedReview,
  ownerReviewEvents,
  replyToReview,
} from "@/lib/judicial/review-db";

interface Params {
  params: Promise<{ id: string; reviewId: string }>;
}

type Action = "reply" | "resubmit" | "cancel";

function isAction(value: unknown): value is Action {
  return value === "reply" || value === "resubmit" || value === "cancel";
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id, reviewId } = await params;
  const review = getOwnedReview(auth.ctx.userId, reviewId);
  if (!review || review.requestId !== id) return notFoundRequest();

  return NextResponse.json({
    data: { review: { ...review, events: ownerReviewEvents(review.id) } },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id, reviewId } = await params;

  const body = await readJson<{
    action?: unknown;
    bodyFa?: unknown;
    versionId?: unknown;
  }>(req);
  if (!body) return judicialError(400, "VALIDATION_ERROR", "بدنهٔ درخواست نامعتبر است.");
  if (!isAction(body.action)) {
    return judicialError(400, "VALIDATION_ERROR", "عملیات درخواستی معتبر نیست.");
  }
  if (body.bodyFa !== undefined && typeof body.bodyFa !== "string") {
    return judicialError(400, "VALIDATION_ERROR", "متن پاسخ باید رشته باشد.");
  }
  if (typeof body.bodyFa === "string" && body.bodyFa.length > 4000) {
    return judicialError(400, "VALIDATION_ERROR", "متن پاسخ بیش از حد طولانی است.");
  }

  const review = getOwnedReview(auth.ctx.userId, reviewId);
  if (!review || review.requestId !== id) return notFoundRequest();

  if (body.action === "cancel") {
    const cancelled = cancelReviewByOwner(auth.ctx.userId, reviewId, body.bodyFa);
    if (!cancelled) {
      return judicialError(
        409,
        "REVIEW_CLOSED",
        "این بررسی بسته شده است و لغو آن ممکن نیست."
      );
    }
    const next = getOwnedReview(auth.ctx.userId, reviewId);
    return NextResponse.json({
      data: { review: next ? { ...next, events: ownerReviewEvents(next.id) } : null },
    });
  }

  if (body.action === "resubmit") {
    if (typeof body.versionId !== "string" || !body.versionId) {
      return judicialError(400, "VALIDATION_ERROR", "نسخهٔ جدید انتخاب نشده است.");
    }
  }

  // `reply` and `resubmit` share one persistence path: an optional version
  // rebinds the review to new text, a bare reply appends a message.
  const bodyFa = typeof body.bodyFa === "string" ? body.bodyFa : undefined;
  if (body.action === "reply" && !bodyFa?.trim()) {
    return judicialError(400, "VALIDATION_ERROR", "متن پاسخ خالی است.");
  }

  const result = replyToReview({
    userId: auth.ctx.userId,
    reviewId,
    bodyFa,
    versionId: body.action === "resubmit" ? (body.versionId as string) : undefined,
  });

  if (!result.ok) {
    switch (result.code) {
      case "NOT_FOUND":
        return notFoundRequest();
      case "REVIEW_CLOSED":
        return judicialError(
          409,
          "REVIEW_CLOSED",
          "این بررسی بسته شده است و پاسخ جدید نمی‌پذیرد."
        );
      case "DRAFT_NOT_FOUND":
        return judicialError(404, "DRAFT_NOT_FOUND", "نسخهٔ انتخاب‌شده یافت نشد.");
      case "EMPTY_DRAFT":
        return judicialError(409, "EMPTY_DRAFT", "متن نسخهٔ انتخاب‌شده خالی است.");
      default:
        return judicialError(409, "REVIEW_ACTION_FAILED", "این عملیات انجام نشد.");
    }
  }

  return NextResponse.json({
    data: {
      review: { ...result.review, events: ownerReviewEvents(result.review.id) },
    },
  });
}
