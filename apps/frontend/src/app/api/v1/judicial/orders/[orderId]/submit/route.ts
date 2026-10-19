// ============================================================
// LEGALIR — POST /api/v1/judicial/orders/[orderId]/submit
// ============================================================
// The explicit hand-off from «پیش‌نویس» to «ثبت‌شده — در انتظار بررسی».
//
// Why this is its own route instead of a PATCH flag: submitting is a state
// transition that starts the operator's clock, so it deserves the same
// re-checks as the creation route rather than piggy-backing on a field edit.
//
//   • only the owner can submit (a foreign id is a 404, never a 403);
//   • only a `draft` / `waiting_user` order can be submitted — a submitted
//     record is not silently re-opened;
//   • the service must still be orderable for this caller right now, the same
//     server-side projection the entry cards read. A service switched off
//     mid-draft keeps the draft readable and editable but stops accepting new
//     hand-offs, so no work is queued for an operator who cannot process it;
//   • required intake fields are re-validated here, never only in the browser.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { judicialFlagContext } from "@/lib/judicial/context";
import {
  judicialError,
  notFoundRequest,
  requireServiceOrderable,
} from "@/lib/judicial/http";
import { getOwnedOrder, submitOrder } from "@/lib/judicial/review-db";
import {
  fromOrderAnswers,
  judicialOrderConfig,
  validateOrderForm,
} from "@/lib/judicial/order-fields";

interface Params {
  params: Promise<{ orderId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const order = getOwnedOrder(auth.ctx.userId, orderId);
  if (!order) return notFoundRequest();

  const ctx = judicialFlagContext({ userId: auth.ctx.userId, orgId: auth.ctx.orgId });
  const gate = requireServiceOrderable(order.serviceId, ctx);
  if (gate) return gate;

  const config = judicialOrderConfig(order.serviceId);
  const { values, consent } = fromOrderAnswers(config, order.answers);
  const errors = validateOrderForm(
    config,
    values,
    order.purposeFa ?? "",
    consent,
    true
  );
  if (Object.keys(errors).length > 0) {
    return judicialError(
      400,
      "VALIDATION_ERROR",
      "برای ثبت نهایی، اطلاعات خواسته‌شده را کامل کنید.",
      { fieldErrors: errors }
    );
  }

  const submitted = submitOrder(auth.ctx.userId, orderId);
  if (!submitted) {
    return judicialError(
      409,
      "ORDER_NOT_SUBMITTABLE",
      "این درخواست پیش‌تر ثبت شده یا قابل ارسال نیست."
    );
  }

  return NextResponse.json({ data: { order: submitted } });
}
