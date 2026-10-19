// ============================================================
// LEGALIR — /api/v1/judicial/requests/[id]/review
// ============================================================
// The owner's side of the review lane.
//
//   GET  — the request's reviews (active first, then closed), each with the
//          OWNER-VISIBLE timeline. Internal operator notes never appear here;
//          the filtering happens in the persistence layer, not in this route.
//   POST — submit ONE draft version for review. Idempotent by the client key,
//          so a double click or a retried request opens no second review.
//
// A review is never opened against text the user has not produced, and the
// service must still be enterable for this caller at submit time.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialFlagContext } from "@/lib/judicial/context";
import {
  judicialError,
  notFoundRequest,
  readJson,
  requireServiceAvailable,
} from "@/lib/judicial/http";
import { getOwnedRequest } from "@/lib/judicial/db";
import {
  listReviewsForRequest,
  ownerReviewEvents,
  submitForReview,
} from "@/lib/judicial/review-db";
import type { JudicialReviewKind } from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

function isReviewKind(value: unknown): value is JudicialReviewKind {
  return value === "legalir" || value === "lawyer";
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const request = getOwnedRequest(auth.ctx.userId, id);
  if (!request) return notFoundRequest();

  const items = listReviewsForRequest(auth.ctx.userId, id).map((review) => ({
    ...review,
    events: ownerReviewEvents(review.id),
  }));

  return NextResponse.json({ data: { items, total: items.length } });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await readJson<{
    draftId?: unknown;
    note?: unknown;
    kind?: unknown;
    idempotencyKey?: unknown;
  }>(req);
  if (!body) return judicialError(400, "VALIDATION_ERROR", "بدنهٔ درخواست نامعتبر است.");

  if (typeof body.draftId !== "string" || !body.draftId) {
    return judicialError(400, "VALIDATION_ERROR", "نسخهٔ پیش‌نویس انتخاب نشده است.");
  }
  const idempotencyKey = (
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : "") ||
    req.headers.get("Idempotency-Key") ||
    ""
  )
    .trim()
    .slice(0, 120);
  if (!idempotencyKey) {
    return judicialError(400, "VALIDATION_ERROR", "شناسهٔ یکتای درخواست ارسال نشده است.");
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    return judicialError(400, "VALIDATION_ERROR", "یادداشت باید متن باشد.");
  }
  if (body.note && body.note.length > 4000) {
    return judicialError(400, "VALIDATION_ERROR", "یادداشت بیش از حد طولانی است.");
  }

  const request = getOwnedRequest(auth.ctx.userId, id);
  if (!request) return notFoundRequest();

  // A disabled service blocks NEW submissions but never hides existing work.
  const ctx = judicialFlagContext({ userId: auth.ctx.userId, orgId: auth.ctx.orgId });
  const gate = requireServiceAvailable(request.serviceId, ctx);
  if (gate) return gate;

  const result = submitForReview({
    userId: auth.ctx.userId,
    requestId: id,
    draftId: body.draftId,
    note: body.note,
    kind: isReviewKind(body.kind) ? body.kind : "legalir",
    idempotencyKey,
  });

  if (!result.ok) {
    switch (result.code) {
      case "NOT_FOUND":
        return notFoundRequest();
      case "DRAFT_NOT_FOUND":
        return judicialError(404, "DRAFT_NOT_FOUND", "این نسخهٔ پیش‌نویس یافت نشد.");
      case "EMPTY_DRAFT":
        return judicialError(409, "EMPTY_DRAFT", "متن پیش‌نویس خالی است و قابل ارسال نیست.");
      case "ALREADY_IN_REVIEW":
        return judicialError(
          409,
          "ALREADY_IN_REVIEW",
          "یک درخواست بررسی در جریان است؛ تا تعیین تکلیف آن، ارسال دوباره ممکن نیست."
        );
      default:
        return judicialError(409, "REVIEW_SUBMIT_FAILED", "ارسال برای بررسی انجام نشد.");
    }
  }

  return NextResponse.json(
    {
      data: {
        review: { ...result.review, events: ownerReviewEvents(result.review.id) },
        replayed: result.replayed,
      },
    },
    { status: result.replayed ? 200 : 201 }
  );
}
