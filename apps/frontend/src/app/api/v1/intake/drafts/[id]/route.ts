// ============================================================
// LEGALIR — /api/v1/intake/drafts/[id]
// ============================================================
// GET    — read one draft (owner only).
// PATCH  — save progress (currentStep + answers).
// DELETE — discard a draft.
//
// IDOR/BOLA: every operation is scoped to the session user id, so a draft
// belonging to another user is indistinguishable from a missing one (404).
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getDraft, updateDraft, deleteDraft } from "@/lib/intake-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const draft = getDraft(auth.ctx.userId, id);
  if (!draft) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پیش‌نویس یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ data: draft });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { currentStep?: number; answers?: Record<string, string>; savedAt?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const patch: { currentStep?: number; answers?: Record<string, string>; savedAt?: string | null } = {};
  if (typeof body.currentStep === "number") patch.currentStep = body.currentStep;
  if (body.answers && typeof body.answers === "object") patch.answers = body.answers;
  if (body.savedAt !== undefined) patch.savedAt = body.savedAt;

  const updated = updateDraft(auth.ctx.userId, id, patch);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پیش‌نویس یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const ok = deleteDraft(auth.ctx.userId, id);
  if (!ok) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پیش‌نویس یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ data: { deleted: true } });
}
