// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/approve
// ============================================================
// Final confirmation on the READY-DOCUMENT path.
//
// The AI-draft path approves through `.../drafts/[draftId]/approve`, where the
// approved artefact is a draft version. On the ready-document path there is no
// AI draft at all: the artefact is the finished document the user brought with
// them, so this route is the equivalent explicit confirmation — and the only
// way that path can reach `approved`.
//
// It deliberately requires a linked ready document. An approval without a
// concrete artefact to approve would bless nothing, and the workflow layer
// re-checks the same fact before any status change.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getOwnedRequest } from "@/lib/judicial/db";
import { transitionRequest } from "@/lib/judicial/workflow";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const userId = auth.ctx.userId;

  const request = getOwnedRequest(userId, id);
  if (!request) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  if (!request.readyDocument) {
    return NextResponse.json(
      {
        code: "READY_DOCUMENT_REQUIRED",
        message:
          "برای تأیید نهایی در این مسیر، ابتدا سند آمادهٔ خود را به درخواست پیوست کنید.",
      },
      { status: 409 }
    );
  }

  // Bring the request to `ready_to_review` first when it is still in a
  // collection state; the transition layer validates each hop.
  if (request.status !== "ready_to_review" && request.status !== "approved") {
    const staged = transitionRequest(userId, id, "ready_to_review", {
      allowInternal: true,
    });
    if (!staged.ok) {
      return NextResponse.json(
        {
          code: "ILLEGAL_TRANSITION",
          message: "این درخواست در وضعیتی نیست که بتوان آن را تأیید کرد.",
        },
        { status: 409 }
      );
    }
  }

  if (request.status === "approved") {
    const current = getOwnedRequest(userId, id);
    return NextResponse.json({ data: { request: current } });
  }

  const approved = transitionRequest(userId, id, "approved", {
    allowInternal: true,
  });
  if (!approved.ok) {
    return NextResponse.json(
      {
        code: "ILLEGAL_TRANSITION",
        message: "تأیید نهایی در وضعیت فعلی درخواست امکان‌پذیر نیست.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: { request: approved.request } });
}
