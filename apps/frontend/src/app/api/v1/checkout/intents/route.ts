import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { createPaymentIntent } from "@/lib/payments";
import { getPlanByCode, isPurchasable } from "@/lib/usage/plans";
import type { CheckoutIntent } from "@legalir/types";

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
    const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
    // The plan catalog is the source of truth — an admin-created plan is
    // purchasable too. A plan that does not exist, or is not `active`, cannot
    // start a purchase (this is the enforcement of «غیرفعال‌کردن پلن، خریدهای
    // جدید را متوقف می‌کند»); it is checked here AND authoritatively inside
    // createPaymentIntent so the two can never drift.
    const plan = planCode ? getPlanByCode(planCode) : undefined;
    if (!plan || !isPurchasable(plan)) {
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
    const result = createPaymentIntent({ userId, planCode, now });
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
        durationDays: plan.durationDays,
        dailyRequests: plan.dailyRequestLimit,
        totalTokens: plan.tokenLimit,
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
