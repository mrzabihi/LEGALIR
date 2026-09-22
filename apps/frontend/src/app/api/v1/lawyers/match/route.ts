// ============================================================
// LEGALIR — POST /api/v1/lawyers/match
// ============================================================
// Runs the matching engine against the supplied criteria and returns the
// top candidates. The engine proposes; the USER decides. There is no
// automatic assignment and no "best lawyer" verdict.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchLawyers } from "@/lib/lawyer-match";
import type { MatchCriteria } from "@legalir/types";

export async function POST(req: NextRequest) {
  let body: Partial<MatchCriteria>;
  try {
    body = (await req.json()) as Partial<MatchCriteria>;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.category) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "دسته‌بندی حقوقی الزامی است" },
      { status: 400 }
    );
  }

  const criteria: MatchCriteria = {
    category: body.category,
    province: body.province ?? null,
    city: body.city ?? null,
    maxFeeToman: body.maxFeeToman ?? null,
    language: body.language ?? null,
    remote: body.remote ?? false,
    description: body.description ?? null,
  };

  const result = matchLawyers(criteria);
  return NextResponse.json({ data: result });
}
