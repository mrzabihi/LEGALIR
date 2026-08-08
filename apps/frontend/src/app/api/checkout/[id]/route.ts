// ============================================================
// LEGALIR — Checkout Intent API Route
// GET /api/checkout/[id] — Get checkout intent status
// POST /api/checkout/[id] — Confirm/pay a checkout intent
// ============================================================

import { NextResponse } from "next/server";
import type { CheckoutIntent } from "@legalir/types";

declare global {
  var __checkoutIntents: Map<string, CheckoutIntent> | undefined;
}

function getIntentStore(): Map<string, CheckoutIntent> {
  if (!globalThis.__checkoutIntents) {
    globalThis.__checkoutIntents = new Map();
  }
  return globalThis.__checkoutIntents;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getIntentStore();
  const intent = store.get(id);

  if (!intent) {
    return NextResponse.json(
      {
        code: "NOT_FOUND",
        message: "درخواست پرداخت یافت نشد",
        correlationId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: intent });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getIntentStore();
  const intent = store.get(id);

  if (!intent) {
    return NextResponse.json(
      {
        code: "NOT_FOUND",
        message: "درخواست پرداخت یافت نشد",
        correlationId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 404 }
    );
  }

  // Simulate payment confirmation — mark as paid
  const updated: CheckoutIntent = { ...intent, status: "paid" };
  store.set(id, updated);

  return NextResponse.json({ data: updated });
}
