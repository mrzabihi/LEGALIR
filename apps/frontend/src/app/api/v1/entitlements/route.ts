// ============================================================
// LEGALIR — GET /api/v1/entitlements
// ============================================================

import { NextResponse } from "next/server";
import { fixtureV1EntitlementsResponse } from "@legalir/testing";

export async function GET() {
  return NextResponse.json(fixtureV1EntitlementsResponse);
}
