// ============================================================
// LEGALIR — GET /api/v1/subscription-history
// ============================================================

import { NextResponse } from "next/server";
import { fixtureV1SubscriptionHistory } from "@legalir/testing";

export async function GET() {
  return NextResponse.json({ data: { items: fixtureV1SubscriptionHistory } });
}
