// ============================================================
// LEGALIR — POST /api/v1/checkout/intents
// Mock payment: alternates success/failure each call
// ============================================================

import { NextResponse } from "next/server";
import type { CheckoutIntent, PlanCode } from "@legalir/types";
import { fixturePlans } from "@legalir/testing";

declare global {
  var __v1CheckoutIntents: Map<string, CheckoutIntent> | undefined;
  var __v1CheckoutCallCount: number | undefined;
}

function getStore(): Map<string, CheckoutIntent> {
  if (!globalThis.__v1CheckoutIntents) {
    globalThis.__v1CheckoutIntents = new Map();
  }
  return globalThis.__v1CheckoutIntents;
}

function getCallCount(): number {
  if (globalThis.__v1CheckoutCallCount === undefined) {
    globalThis.__v1CheckoutCallCount = 0;
  }
  return globalThis.__v1CheckoutCallCount;
}

function incrementCallCount(): number {
  globalThis.__v1CheckoutCallCount = getCallCount() + 1;
  return globalThis.__v1CheckoutCallCount;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { planCode?: string };
    const planCode = body.planCode as PlanCode | undefined;

    if (!planCode || !["ultra", "pro", "pro_max"].includes(planCode)) {
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

    const callNum = incrementCallCount();
    // Odd calls succeed, even calls fail
    const willSucceed = callNum % 2 === 1;

    const intent: CheckoutIntent = {
      id: crypto.randomUUID(),
      planCode: plan.code,
      amount: plan.salePrice,
      currency: "IRT",
      status: "pending",
      paymentUrl: willSucceed ? "https://mock-payment.legalir.ir/pay" : null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: {
        planNameFa: plan.nameFa,
        durationDays: plan.durationDays,
        dailyRequests: plan.dailyRequestLimit,
        totalTokens: plan.totalTokenLimit,
      },
    };

    const store = getStore();
    store.set(intent.id, intent);

    if (willSucceed) {
      setTimeout(() => {
        const stored = store.get(intent.id);
        if (stored?.status === "pending") {
          store.set(intent.id, { ...stored, status: "paid" });
        }
      }, 4000);
    } else {
      setTimeout(() => {
        const stored = store.get(intent.id);
        if (stored?.status === "pending") {
          store.set(intent.id, { ...stored, status: "failed" });
        }
      }, 4000);
    }

    return NextResponse.json(intent, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "خطای داخلی سرور", correlationId: crypto.randomUUID(), retryable: true },
      { status: 500 }
    );
  }
}
