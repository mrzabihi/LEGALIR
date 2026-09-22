// ============================================================
// LEGALIR — POST /api/v1/legal-requests/[id]/transition
// ============================================================
// The ONLY way a request changes state. The server validates the move
// against LEGAL_REQUEST_TRANSITIONS and rejects anything illegal with
// 409 — the UI can request a transition but never force one.
//
// Owner-only. The actor recorded in the event log is always the session
// user, never a client-supplied id.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getRequestById, transitionRequest } from "@/lib/legal-request-db";
import { createCase, addCaseTimelineEvent } from "@/lib/case-db";
import { LEGAL_REQUEST_STATE_FA, canTransitionLegalRequest, type LegalRequestState } from "@legalir/types";

const VALID_STATES = new Set(Object.keys(LEGAL_REQUEST_STATE_FA));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const existing = getRequestById(id);
  if (!existing || existing.userId !== auth.ctx.userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
  }

  let body: { to?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.to || !VALID_STATES.has(body.to)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "وضعیت مقصد معتبر نیست" },
      { status: 400 }
    );
  }

  // Reject illegal moves before any side effect so a rejected transition
  // can never leave an orphaned case behind.
  if (!canTransitionLegalRequest(existing.state, body.to as LegalRequestState)) {
    return NextResponse.json(
      {
        code: "ILLEGAL_TRANSITION",
        message: `تغییر وضعیت از «${LEGAL_REQUEST_STATE_FA[existing.state]}» به «${LEGAL_REQUEST_STATE_FA[body.to as LegalRequestState]}» مجاز نیست`,
      },
      { status: 409 }
    );
  }

  // PART 11 — cross-module flow: when a request is accepted, a Case is
  // created (once) and linked back to the request. The case is the
  // architectural center; the request is the intake that seeds it.
  let patch: { caseId?: string } | undefined;
  if (body.to === "ACCEPTED" && !existing.caseId) {
    const caseId = crypto.randomUUID();
    createCase({
      id: caseId,
      userId: auth.ctx.userId,
      title: existing.title,
      description: `پرونده ایجادشده از درخواست «${existing.title}»`,
      category: existing.category,
      priority: "medium",
    });
    addCaseTimelineEvent({
      id: crypto.randomUUID(),
      caseId,
      eventType: "case_created",
      title: "ایجاد پرونده از درخواست",
      description: `پرونده از درخواست «${existing.title}» ایجاد شد`,
      metadata: { requestId: id },
    });
    patch = { caseId };
  }

  const result = transitionRequest({
    requestId: id,
    to: body.to as LegalRequestState,
    actorId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    note: body.note ?? null,
    patch,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ code: "NOT_FOUND", message: "درخواست یافت نشد" }, { status: 404 });
    }
    return NextResponse.json(
      {
        code: "ILLEGAL_TRANSITION",
        message: `تغییر وضعیت از «${LEGAL_REQUEST_STATE_FA[existing.state]}» به «${LEGAL_REQUEST_STATE_FA[body.to as LegalRequestState]}» مجاز نیست`,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: result.request });
}
