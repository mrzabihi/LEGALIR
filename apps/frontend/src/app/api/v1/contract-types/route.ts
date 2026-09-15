// ============================================================
// LEGALIR — GET /api/v1/contract-types
// ============================================================
// Returns the static contract type catalog (personal + business).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { CONTRACT_TYPES } from "@/lib/contract-catalog";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  return NextResponse.json({ data: CONTRACT_TYPES });
}
