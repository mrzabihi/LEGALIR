// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/analysis
// ============================================================
// Re-derive the step-4 framing from the CURRENT stored inputs. The analysis is
// never stored, so it can never drift from the answers: what the user said,
// what came from their documents, what the routing derived, and what is still
// unconfirmed are always recomputed from the same rows the draft will use.
//
// Side-effect free: this route charges nothing, writes nothing and does not
// move the workflow. It is a projection, not an action.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getOwnedRequest, listAnswers, listAttachments, listDrafts } from "@/lib/judicial/db";
import { buildRequestDetail, residentQuestionnaire } from "@/lib/judicial/present";
import { computeCompleteness } from "@/lib/judicial/completeness";
import { buildAnalysis } from "@/lib/judicial/analysis";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const request = getOwnedRequest(auth.ctx.userId, id);
  if (!request) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  const questionnaire = residentQuestionnaire(request);
  if (!questionnaire) {
    // The family is still undetermined — there is nothing to frame yet, and
    // inventing a frame would be exactly the fabricated diagnosis the product
    // forbids. The client is told to settle the type first.
    return NextResponse.json(
      {
        code: "TYPE_UNDETERMINED",
        message:
          "برای جمع‌بندی، ابتدا نوع سند باید مشخص شود. توضیح خود را کامل کنید یا نوع را انتخاب کنید.",
        data: { analysis: null, completeness: null },
      },
      { status: 409 }
    );
  }

  const attachments = listAttachments(auth.ctx.userId, id);
  const drafts = listDrafts(auth.ctx.userId, id);
  const completeness = computeCompleteness(request, questionnaire);
  const analysis = buildAnalysis({
    request,
    questionnaire,
    attachments,
    completeness,
    references: drafts[0]?.references ?? [],
  });

  return NextResponse.json({
    data: {
      analysis,
      completeness,
      // The wizard shows the same fresh snapshot it would get from GET, so a
      // stale tab cannot present an outdated "ready to generate".
      detail: buildRequestDetail(
        request,
        attachments,
        drafts,
        listAnswers(auth.ctx.userId, id)
      ),
    },
  });
}
