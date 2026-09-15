// ============================================================
// LEGALIR — POST /api/v1/contracts/drafts
// ============================================================
// Create (or fetch existing) a contract wizard draft.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoContractDraft, saveDemoContractDraft } from "@/lib/demo-seed";

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  let body: { typeId?: string };
  try {
    body = (await request.json()) as { typeId?: string };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اطلاعات ناقص است" },
      { status: 400 }
    );
  }

  if (!body.typeId) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نوع قرارداد الزامی است" },
      { status: 400 }
    );
  }

  const existing = getDemoContractDraft(userId, body.typeId);
  if (existing) return NextResponse.json({ data: existing });

  const draft = saveDemoContractDraft(userId, body.typeId, 1, {});
  return NextResponse.json({ data: draft }, { status: 201 });
}
