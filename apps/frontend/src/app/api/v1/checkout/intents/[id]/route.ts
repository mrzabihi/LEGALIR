// ============================================================
// LEGALIR — GET /api/v1/checkout/intents/[id]
// ============================================================
// Reads the PERSISTED payment (not an in-memory Map) so the status survives a
// restart and reflects the real activation path.
//
// Mock-gateway seam: a pending `mock` payment is "approved" on first read,
// which runs the ONE activation path (`confirmPayment`). This mimics a real
// gateway redirecting back a success callback — the client keeps polling and
// observes `paid` once the gateway settles. Repeat reads are idempotent no-ops.

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getPayment, confirmPayment, subscriptionForPayment } from "@/lib/payments";
import type { CheckoutIntent, Payment } from "@legalir/types";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

/** Map a persisted payment status onto the UI intent status. */
function toIntentStatus(status: Payment["status"]): CheckoutIntent["status"] {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "cancelled":
    case "refunded":
      return "cancelled";
    default:
      return "pending";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید", correlationId: crypto.randomUUID(), retryable: false },
      { status: 401 }
    );
  }

  let payment = getPayment(id);
  // Unknown payment, or one that belongs to another user → treat as not found.
  if (!payment || payment.userId !== userId) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست پرداخت یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  if (payment.status === "pending" && payment.method === "mock") {
    const confirmed = confirmPayment({ paymentId: id, userId, method: "mock" });
    if (confirmed?.payment) payment = confirmed.payment;
  }

  const subscription = subscriptionForPayment(payment);
  const intent: CheckoutIntent = {
    id: payment.id,
    planCode: payment.planCode,
    amount: payment.amount,
    currency: payment.currency,
    status: toIntentStatus(payment.status),
    paymentUrl: null,
    createdAt: payment.createdAt,
    expiresAt: payment.paidAt ?? payment.updatedAt,
    metadata: {
      planNameFa: subscription?.plan_name_fa ?? "",
      durationDays: 31,
      dailyRequests: 0,
      totalTokens: 0,
    },
  };

  return NextResponse.json({ data: intent });
}
