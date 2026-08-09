// ============================================================
// LEGALIR — Checkout API Route
// POST /api/checkout — Create a checkout intent (mock)
// ============================================================
// Simulates payment gateway integration. In production this
// would call a real payment provider API (e.g., Zarinpal, IDPay).
// ============================================================

import { NextResponse } from "next/server";
import { fixturePlans, createCheckoutIntent } from "@legalir/testing";
import type { PlanCode, CheckoutIntent } from "@legalir/types";

// In-memory store for checkout intents (mirrors the MSW store)
// In production, this would use a real database.
declare global {
  var __checkoutIntents: Map<string, CheckoutIntent> | undefined;
}

function getIntentStore(): Map<string, CheckoutIntent> {
  if (!globalThis.__checkoutIntents) {
    globalThis.__checkoutIntents = new Map();
  }
  return globalThis.__checkoutIntents;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { planCode?: string };
    const planCode = body.planCode as PlanCode | undefined;

    if (!planCode || !["silver", "gold", "diamond"].includes(planCode)) {
      return NextResponse.json(
        {
          code: "INVALID_PLAN",
          message: "کد پلن نامعتبر است. یکی از ultra, pro, pro_max را انتخاب کنید",
          correlationId: crypto.randomUUID(),
          retryable: false,
        },
        { status: 400 }
      );
    }

    const plan = fixturePlans.find((p) => p.code === planCode);
    if (!plan) {
      return NextResponse.json(
        {
          code: "PLAN_NOT_FOUND",
          message: "پلن مورد نظر یافت نشد",
          correlationId: crypto.randomUUID(),
          retryable: false,
        },
        { status: 404 }
      );
    }

    // Create checkout intent with "pending" status
    const intent = createCheckoutIntent(planCode, "pending");
    const store = getIntentStore();
    store.set(intent.id, intent);

    // Simulate payment processing: after ~3s mark as paid
    setTimeout(() => {
      const stored = store.get(intent.id);
      if (stored && stored.status === "pending") {
        store.set(intent.id, { ...stored, status: "paid" });
      }
    }, 3000);

    return NextResponse.json({ data: intent }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "خطای داخلی سرور",
        correlationId: crypto.randomUUID(),
        retryable: true,
      },
      { status: 500 }
    );
  }
}
