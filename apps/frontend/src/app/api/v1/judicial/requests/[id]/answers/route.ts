// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/answers
// ============================================================
// Save ONE questionnaire step wholesale. Other steps are untouched, so editing
// one section never erases another, and clearing/hiding a field removes only
// that field.
//
// Guards (all server-side):
//   • the request must belong to the caller (404 otherwise);
//   • `questionnaireVersion` must match the version pinned on the request —
//     a stale form writes nothing and is told to reload (409);
//   • every question id must exist in THAT version's schema (400 with the
//     offending ids in `fieldErrors`, so the form can highlight them).
//
// Saving answers is FREE — a user is never charged for being asked a question.
// The response carries the refreshed completeness so the wizard knows up front
// whether it may advance to the draft.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import {
  getOwnedRequest,
  listAnswers,
  listAttachments,
  listDrafts,
  saveAnswers,
} from "@/lib/judicial/db";
import { buildRequestDetail } from "@/lib/judicial/present";
import type { JudicialSaveAnswersInput } from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Partial<JudicialSaveAnswersInput> & { stepId?: string };
  try {
    body = (await req.json()) as Partial<JudicialSaveAnswersInput> & { stepId?: string };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (typeof body.stepId !== "string" || !body.stepId) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "مرحلهٔ پرسش‌نامه مشخص نیست." },
      { status: 400 }
    );
  }
  if (typeof body.questionnaireVersion !== "number") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نسخهٔ پرسش‌نامه مشخص نیست." },
      { status: 400 }
    );
  }
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "پاسخ‌های ارسالی نامعتبر است." },
      { status: 400 }
    );
  }

  // Reject a body whose values are not strings before the storage layer sees
  // it — a numeric/array value would otherwise be silently coerced.
  for (const [key, value] of Object.entries(body.answers)) {
    if (typeof value !== "string") {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "مقدار پاسخ‌ها باید متن باشد.",
          fieldErrors: { [key]: "مقدار این پاسخ نامعتبر است." },
        },
        { status: 400 }
      );
    }
  }

  const result = saveAnswers({
    userId: auth.ctx.userId,
    requestId: id,
    questionnaireVersion: body.questionnaireVersion,
    stepId: body.stepId,
    answers: body.answers,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "درخواست یافت نشد." },
        { status: 404 }
      );
    }
    if (result.code === "VERSION_MISMATCH") {
      return NextResponse.json(
        {
          code: "VERSION_MISMATCH",
          message:
            "پرسش‌نامهٔ این درخواست به‌روزرسانی شده است. صفحه بازخوانی می‌شود تا پاسخ‌ها با نسخهٔ درست ثبت شوند.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        code: "UNKNOWN_QUESTION",
        message: "برخی پاسخ‌ها به پرسش‌های این نسخه تعلق ندارند.",
        fieldErrors: result.fieldErrors ?? {},
      },
      { status: 400 }
    );
  }

  const request = getOwnedRequest(auth.ctx.userId, id);
  if (!request) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }
  const detail = buildRequestDetail(
    request,
    listAttachments(auth.ctx.userId, id),
    listDrafts(auth.ctx.userId, id),
    listAnswers(auth.ctx.userId, id)
  );

  return NextResponse.json({
    data: {
      answers: result.answers ?? {},
      request: detail.request,
      completeness: detail.completeness,
    },
  });
}
