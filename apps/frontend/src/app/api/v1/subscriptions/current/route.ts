// ============================================================
// LEGALIR — GET /api/v1/subscriptions/current
// ============================================================

import { NextResponse } from "next/server";
import { fixtureV1SubscriptionGold } from "@legalir/testing";

export async function GET() {
  return NextResponse.json({ data: fixtureV1SubscriptionGold });
}
