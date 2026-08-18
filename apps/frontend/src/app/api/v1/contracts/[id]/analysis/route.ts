// ============================================================
// LEGALIR — GET /api/v1/contracts/[id]/analysis (demo dataset)
// ============================================================
// Returns the contract's risk analysis (V1ContractRiskAnalysis).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoContract } from "@/lib/demo-seed";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const contract = getDemoContract(userId, id);
  if (!contract) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "قرارداد یافت نشد" },
      { status: 404 }
    );
  }
  if (!contract.analysis) {
    return NextResponse.json(
      { code: "ANALYSIS_NOT_READY", message: "تحلیل قرارداد هنوز آماده نیست", retryable: true },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: contract.analysis });
}
