// ============================================================
// LEGALIR — GET /api/v1/plans
// ============================================================

import { NextResponse } from "next/server";
import { fixturePlans } from "@legalir/testing";

export async function GET() {
  return NextResponse.json({ data: fixturePlans });
}
