// ============================================================
// LEGALIR — PATCH /api/v1/judicial/requests/[id]/drafts/[draftId]
// ============================================================
// Save the owner's own edit of a draft as a NEW immutable version.
//
// The edited text is legal text the user is responsible for — it is stored
// exactly as typed, never re-generated, never "improved". The version it was
// edited FROM is kept byte-for-byte, so going back is always possible.
//
// Editing an APPROVED version is allowed and produces a new unapproved one;
// that is how a user revises after approval without erasing the record of
// what they had confirmed.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listDrafts, reviseDraft } from "@/lib/judicial/db";

interface Params {
  params: Promise<{ id: string; draftId: string }>;
}

const MAX_DRAFT_CHARS = 120_000;

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id, draftId } = await params;

  let body: { text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (typeof body.text !== "string") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "متن پیش‌نویس ارسال نشده است." },
      { status: 400 }
    );
  }
  if (body.text.length > MAX_DRAFT_CHARS) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "متن پیش‌نویس بیش از حد طولانی است." },
      { status: 400 }
    );
  }

  const revised = reviseDraft({
    userId: auth.ctx.userId,
    requestId: id,
    draftId,
    text: body.text,
  });
  if (!revised) {
    // Missing request, missing version, or an empty resulting text — all are
    // "cannot do that", and a foreign version must look like a missing one.
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یا پیش‌نویس یافت نشد." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { draft: revised, drafts: listDrafts(auth.ctx.userId, id) },
  });
}
