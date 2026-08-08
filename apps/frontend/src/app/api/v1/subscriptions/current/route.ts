// ============================================================
// LEGALIR — GET /api/v1/subscriptions/current
// ============================================================

import { NextResponse } from "next/server";
import { fixtureV1SubscriptionPro } from "@legalir/testing";

export async function GET() {
  return NextResponse.json(fixtureV1SubscriptionPro);
}
