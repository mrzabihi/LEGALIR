// ============================================================
// LEGALIR — POST .../[id]/drafts/[draftId]/approve
// ============================================================
// The user's EXPLICIT confirmation of one draft version. This is the only
// route that can lead to `approved`, and it requires two things the client
// cannot fake:
//
//   1. the version must belong to the caller's request;
//   2. it must be the NEWEST version — approving a version the user has since
//      regenerated would bless text they may never have read.
//
// Approval marks a version, it does NOT file, send or register anything. The
// request's `approved` status means "the owner confirmed this text", which is
// exactly what the status label says.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { approveDraft, latestDraft, listDrafts } from "@/lib/judicial/db";
import { transitionRequest } from "@/lib/judicial/workflow";

interface Params {
  params: Promise<{ id: string; draftId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id, draftId } = await params;
  const userId = auth.ctx.userId;

  const latest = latestDraft(userId, id);
  if (!latest) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یا پیش‌نویس یافت نشد." },
      { status: 404 }
    );
  }
  if (latest.id !== draftId) {
    return NextResponse.json(
      {
        code: "STALE_VERSION",
        message:
          "نسخهٔ جدیدتری از پیش‌نویس وجود دارد. ابتدا آخرین نسخه را بازبینی و سپس تأیید کنید.",
      },
      { status: 409 }
    );
  }

  const approved = approveDraft(userId, id, draftId);
  if (!approved) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یا پیش‌نویس یافت نشد." },
      { status: 404 }
    );
  }

  // The workflow move is legal only because the version is now approved — the
  // transition function re-checks that fact itself.
  const moved = transitionRequest(userId, id, "approved", { allowInternal: true });

  return NextResponse.json({
    data: {
      draft: approved,
      drafts: listDrafts(userId, id),
      request: moved.ok ? moved.request : null,
    },
  });
}
