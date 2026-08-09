// ============================================================
// LEGALIR — GET /api/v1/usage
// ============================================================

import { NextResponse } from "next/server";
import { fixtureV1UsageResponse } from "@legalir/testing";

export async function GET() {
  return NextResponse.json({ data: fixtureV1UsageResponse });
}
