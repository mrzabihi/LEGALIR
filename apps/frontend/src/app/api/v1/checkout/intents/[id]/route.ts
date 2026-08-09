// ============================================================
// LEGALIR — GET /api/v1/checkout/intents/[id]
// ============================================================

import { NextResponse } from "next/server";
import type { CheckoutIntent } from "@legalir/types";

declare global {
  var __v1CheckoutIntents: Map<string, CheckoutIntent> | undefined;
}

function getStore(): Map<string, CheckoutIntent> {
  if (!globalThis.__v1CheckoutIntents) {
    globalThis.__v1CheckoutIntents = new Map();
  }
  return globalThis.__v1CheckoutIntents;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getStore();
  const intent = store.get(id);

  if (!intent) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست پرداخت یافت نشد", correlationId: crypto.randomUUID(), retryable: false },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: intent });
}
