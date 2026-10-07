import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { createPaymentIntent } from "@/lib/payments";
import type { CheckoutIntent, PlanCode } from "@legalir/types";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function POST(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید", correlationId: crypto.randomUUID(), retryable: false },
      { status: 401 }
    );
  }
  try {
    const body = (await request.json()) as { planCode?: string };
    const planCode = body.planCode;
    if (!planCode || !["silver", "gold", "diamond"].includes(planCode)) {
      return NextResponse.json(
        { code: "INVALID_PLAN", message: "کد پلن نامعتبر است", correlationId: crypto.randomUUID(), retryable: false },
        { status: 400 }
      );
    }
    const now = new Date();
    // Create (or reuse) a PENDING payment + PENDING subscription. No plan is
    // activated here — only a verified payment confirmation does that. The
    // price is resolved server-side from the catalog; the client sends only a
    // planCode.
    const result = createPaymentIntent({ userId, planCode: planCode as PlanCode, now });
    if (!result) {
      return NextResponse.json(
        { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
        { status: 404 }
      );
    }
    const intent: CheckoutIntent = {
      id: result.payment.id,
      planCode: result.payment.planCode,
      amount: result.payment.amount,
      currency: result.payment.currency,
      status: "pending",
      paymentUrl: `/checkout/mock-gateway?intent=${result.payment.id}`,
      createdAt: result.payment.createdAt,
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      metadata: {
        planNameFa: result.subscription.plan_name_fa,
        durationDays: 31,
        dailyRequests: 0,
        totalTokens: 0,
      },
    };
    return NextResponse.json({ data: intent }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "خطای داخلی سرور", correlationId: crypto.randomUUID(), retryable: true },
      { status: 500 }
    );
  }
}
