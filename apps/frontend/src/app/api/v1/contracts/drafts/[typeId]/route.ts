// ============================================================
// LEGALIR — GET/PATCH/DELETE /api/v1/contracts/drafts/[typeId]
// ============================================================
// Per-type wizard draft read, save and delete.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getDemoContractDraft,
  saveDemoContractDraft,
  deleteDemoContractDraft,
} from "@/lib/demo-seed";

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
  return NextResponse.json({ data: getDemoContractDraft(userId, typeId) });
}

export async function PATCH(
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
  let body: { currentStep?: number; answers?: Record<string, string> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اطلاعات ناقص است" },
      { status: 400 }
    );
  }

  const draft = saveDemoContractDraft(
    userId,
    typeId,
    body.currentStep ?? 1,
    body.answers ?? {}
  );
  return NextResponse.json({ data: draft });
}

export async function DELETE(
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
  deleteDemoContractDraft(userId, typeId);
  return NextResponse.json({ data: { deleted: true } });
}
