// ============================================================
// LEGALIR — /api/v1/judicial/requests/[id]
// ============================================================
// GET    — the full wizard payload (request, its pinned questionnaire version,
//          responses, attachments, draft versions, completeness, analysis,
//          legal transitions and the caller's own linkable cases).
// PATCH  — save the narrative / current step / case link / explicit family
//          choice. A foreign id returns 404, never 403.
// DELETE — remove the request and every row private to it.
//
// Status is NEVER patchable here: only the workflow/generation routes may move
// a request, so a client cannot talk itself into `approved`.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import {
  deleteRequest,
  isDraftableType,
  listAttachments,
  listAnswers,
  listDrafts,
  patchRequest,
} from "@/lib/judicial/db";
import { buildRequestDetail, getOwnedRequestDetail } from "@/lib/judicial/present";
import { getOwnedFinalDocument, purgeReviewRows } from "@/lib/judicial/review-db";
import {
  JUDICIAL_STEP_FA,
  type JudicialRequestStep,
  type JudicialUpdateRequestInput,
} from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

function isJudicialStep(value: unknown): value is JudicialRequestStep {
  return typeof value === "string" && value in JUDICIAL_STEP_FA;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const detail = getOwnedRequestDetail(auth.ctx.userId, id, {
    withAnalysis: true,
    withLinkableCases: true,
  });
  if (!detail) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: detail });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Partial<JudicialUpdateRequestInput>;
  try {
    body = (await req.json()) as Partial<JudicialUpdateRequestInput>;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (body.narrative !== undefined) {
    if (typeof body.narrative !== "string") {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "شرح موضوع باید متن باشد." },
        { status: 400 }
      );
    }
    if (body.narrative.length > 20_000) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "شرح موضوع بیش از حد طولانی است." },
        { status: 400 }
      );
    }
  }
  if (body.currentStep !== undefined && !isJudicialStep(body.currentStep)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "مرحلهٔ انتخاب‌شده معتبر نیست." },
      { status: 400 }
    );
  }
  if (
    body.documentType !== undefined &&
    body.documentType !== null &&
    !isDraftableType(body.documentType)
  ) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نوع سند انتخاب‌شده معتبر نیست." },
      { status: 400 }
    );
  }

  const updated = patchRequest(auth.ctx.userId, id, {
    ...(body.narrative !== undefined ? { narrative: body.narrative } : {}),
    ...(body.currentStep !== undefined ? { currentStep: body.currentStep } : {}),
    ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
    ...(body.titleFa !== undefined ? { titleFa: body.titleFa } : {}),
    ...(body.documentType !== undefined ? { documentType: body.documentType } : {}),
  });
  if (!updated) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  // Re-project through the SAME builder the GET uses, so the client receives
  // refreshed completeness/analysis rather than a bare row, and the wizard
  // never has to re-fetch to know whether it may advance.
  const detail = buildRequestDetail(
    updated,
    listAttachments(auth.ctx.userId, id),
    listDrafts(auth.ctx.userId, id),
    listAnswers(auth.ctx.userId, id),
    { withAnalysis: true }
  );
  return NextResponse.json({ data: detail });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // An issued artifact is a registered legal record. Deleting the request
  // would orphan it, so the owner is offered the archive path instead.
  if (getOwnedFinalDocument(auth.ctx.userId, id)) {
    return NextResponse.json(
      {
        code: "FINAL_DOCUMENT_ISSUED",
        message:
          "برای این درخواست نسخهٔ نهایی صادر شده است و حذف امکان‌پذیر نیست؛ می‌توانید آن را بایگانی کنید.",
      },
      { status: 409 }
    );
  }

  // Review rows, status history and orders are private to the request and
  // must go with it — otherwise an operator queue would keep a ghost entry.
  purgeReviewRows(auth.ctx.userId, id);
  const removed = deleteRequest(auth.ctx.userId, id);
  if (!removed) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: { deleted: true } });
}
