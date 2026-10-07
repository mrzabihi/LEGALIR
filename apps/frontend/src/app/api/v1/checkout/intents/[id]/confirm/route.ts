// ============================================================
// LEGALIR — POST /api/v1/checkout/intents/[id]/confirm
// ============================================================
// The ONLY activation path. The mock gateway and a real PSP both funnel here:
// the client never activates a plan itself. Idempotent — a replayed confirm
// returns the existing paid payment without a second grant.

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { confirmPayment } from "@/lib/payments";
import type { CheckoutIntent } from "@legalir/types";

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

  const { payment } = result;
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
      planNameFa: result.subscription?.plan_name_fa ?? "",
      durationDays: 31,
      dailyRequests: 0,
      totalTokens: 0,
    },
  };

  return NextResponse.json({ data: intent });
}
