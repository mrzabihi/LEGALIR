// ============================================================
// LEGALIR — POST /api/v1/checkout/intents/[id]/confirm
// ============================================================
// The ONLY activation path. The mock gateway and a real PSP both funnel here:
// the client never activates a plan itself. Idempotent — a replayed confirm
// returns the existing paid payment without a second grant.

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { confirmPayment } from "@/lib/payments";
import { getPlanByCode } from "@/lib/usage/plans";
import type { CheckoutIntent } from "@legalir/types";

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

export async function POST(
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

  const result = confirmPayment({ paymentId: id, userId, method: "mock" });
  if (!result) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست پرداخت یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  const { payment, subscription } = result;
  // Report the REAL plan terms. The activated subscription's own start/end are
  // the authoritative term (they were stamped from the frozen snapshot at
  // purchase); the catalog fills the limit figures. Nothing is hard-coded.
  const plan = getPlanByCode(payment.planCode);
  const intent: CheckoutIntent = {
    id: payment.id,
    planCode: payment.planCode,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status === "paid" ? "paid" : "failed",
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
