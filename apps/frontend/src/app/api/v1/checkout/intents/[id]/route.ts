// ============================================================
// LEGALIR — GET /api/v1/checkout/intents/[id]
// ============================================================
// Reads the PERSISTED payment (not an in-memory Map) so the status survives a
// restart. This is a PURE READ: it never activates a subscription. A pending
// payment stays pending until a REAL gateway settles it server-to-server — the
// old "auto-confirm a mock payment on read" behaviour was the defect that made
// a purchase succeed without any payment, and it has been removed.

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { getPayment, subscriptionForPayment } from "@/lib/payments";
import { getPlanByCode } from "@/lib/usage/plans";
import type { CheckoutIntent, Payment } from "@legalir/types";

/** Whole days between two ISO timestamps (the real activated term). */
function termDays(startAt: string, endAt: string): number {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  return ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

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

  const payment = getPayment(id);
  // Unknown payment, or one that belongs to another user → treat as not found.
  if (!payment || payment.userId !== userId) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست پرداخت یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  const subscription = subscriptionForPayment(payment);
  // Report the REAL plan terms from the catalog (never a hard-coded 31 days).
  const plan = getPlanByCode(payment.planCode);
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
      planNameFa: subscription?.plan_name_fa ?? plan?.nameFa ?? "",
      durationDays: subscription
        ? termDays(subscription.start_at, subscription.end_at)
        : plan?.durationDays ?? 0,
      dailyRequests: plan?.dailyRequestLimit ?? 0,
      totalTokens: plan?.tokenLimit ?? 0,
    },
  };

  return NextResponse.json({ data: intent });
}
