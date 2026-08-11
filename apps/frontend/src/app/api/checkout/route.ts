import { NextResponse } from "next/server";
import { findSessionById, createSubscription } from "@/lib/db";
import { fixturePlans } from "@legalir/testing";
import type { CheckoutIntent } from "@legalir/types";

declare global {
  var __checkoutIntents: Map<string, CheckoutIntent> | undefined;
}

function getIntentStore(): Map<string, CheckoutIntent> {
  if (!globalThis.__checkoutIntents) globalThis.__checkoutIntents = new Map();
  return globalThis.__checkoutIntents;
}

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
    const plan = fixturePlans.find((p) => p.code === planCode);
    if (!plan) {
      return NextResponse.json(
        { code: "PLAN_NOT_FOUND", message: "پلن مورد نظر یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
        { status: 404 }
      );
    }
    const now = new Date();
    createSubscription({
      userId, planCode: plan.code, planNameFa: plan.nameFa,
      amount: plan.salePrice, status: "active", statusFa: "فعال",
      startAt: now.toISOString(),
      endAt: new Date(now.getTime() + plan.durationDays * 86400000).toISOString(),
    });
    const intent: CheckoutIntent = {
      id: crypto.randomUUID(), planCode: plan.code, amount: plan.salePrice, currency: "IRT",
      status: "paid", paymentUrl: null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      metadata: { planNameFa: plan.nameFa, durationDays: plan.durationDays, dailyRequests: plan.dailyRequestLimit, totalTokens: plan.totalTokenLimit },
    };
    getIntentStore().set(intent.id, intent);
    return NextResponse.json({ data: intent }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "خطای داخلی سرور", correlationId: crypto.randomUUID(), retryable: true },
      { status: 500 }
    );
  }
}
