// ============================================================
// LEGALIR — POST /api/v1/checkout/intents/[id]/confirm  (DISABLED)
// ============================================================
// This endpoint used to be "the ONLY activation path" for the MOCK gateway: a
// client POST here would confirm a mock payment and activate a plan. That path
// is the reason a purchase could succeed without a real payment, so it is
// deliberately shut off.
//
// A real gateway is NOT active yet. When one lands, settlement must happen
// server-to-server (the PSP calls US back) or via `settleOrder` in
// `lib/checkout/orders.ts`, NEVER from a client-callable confirm. Until then
// this route answers 410 Gone and activates nothing.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      code: "GATEWAY_INACTIVE",
      message: "درگاه پرداخت هنوز فعال نشده است. برای تکمیل خرید با پشتیبانی تماس بگیرید.",
      correlationId: crypto.randomUUID(),
      retryable: false,
    },
    { status: 410 }
  );
}
