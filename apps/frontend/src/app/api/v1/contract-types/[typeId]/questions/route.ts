// ============================================================
// LEGALIR — GET /api/v1/contract-types/[typeId]/questions
// ============================================================
// Returns the wizard question list for a given contract type.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { CONTRACT_QUESTIONS } from "@/lib/contract-catalog";
import type { V1ContractType } from "@legalir/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { typeId } = await params;
  const questions = CONTRACT_QUESTIONS[typeId as V1ContractType] ?? [];

  return NextResponse.json({
    data: { typeId, questions },
  });
}
