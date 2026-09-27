// ============================================================
// LEGALIR — POST /api/v1/legal-requests/[id]/respond
// ============================================================
// The lawyer's accept/decline decision on a request assigned to them.
//
// Authorization is two-layered:
//   1. the caller must hold `lawyer:request:respond` (the LAWYER role),
//   2. the caller must be the lawyer the request is assigned to.
// A caller who fails either check gets 404 — a request assigned to
// another lawyer is indistinguishable from a missing one.
//
// accept  → ACCEPTED, creating the Case exactly as the client-driven
//           transition route does (the case is the architectural center).
// decline → DECLINED, from which the client may reassign or cancel.
//
// The decision is recorded in the request's event log (auditable history)
// and surfaced to the client's activity feed.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission, notFound } from "@/lib/rbac";
import { getRequestById, transitionRequest } from "@/lib/legal-request-db";
import { getLawyerProfileByUserId } from "@/lib/lawyer-db";
import { createCase, addCaseTimelineEvent } from "@/lib/case-db";
import { recordActivity } from "@/lib/db";
import { LEGAL_REQUEST_STATE_FA } from "@legalir/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "lawyer:request:respond");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const existing = getRequestById(id);
  if (!existing) return notFound("درخواست یافت نشد");

  // The caller must be the assigned lawyer. Resolve their profile from
  // the session user id — never trust a client-supplied lawyer id.
  const profile = getLawyerProfileByUserId(auth.ctx.userId);
  if (!profile || existing.selectedLawyerId !== profile.id) {
    return notFound("درخواست یافت نشد");
  }

  let body: { action?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "اقدام نامعتبر است" },
      { status: 400 }
    );
  }

  const to = body.action === "accept" ? "ACCEPTED" : "DECLINED";

  // On accept, create the Case once and link it back to the request.
  let patch: { caseId?: string } | undefined;
  if (to === "ACCEPTED" && !existing.caseId) {
    const caseId = crypto.randomUUID();
    createCase({
      id: caseId,
      userId: existing.userId,
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
    to,
    actorId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    note: body.note ?? null,
    patch,
  });

  if (!result.ok) {
    // The only legal source state is WAITING_FOR_ACCEPTANCE; anything
    // else is a stale or repeated decision.
    return NextResponse.json(
      {
        code: "ILLEGAL_TRANSITION",
        message: `تغییر وضعیت از «${LEGAL_REQUEST_STATE_FA[existing.state]}» به «${LEGAL_REQUEST_STATE_FA[to]}» مجاز نیست`,
      },
      { status: 409 }
    );
  }

  // Surface the decision in the client's activity feed. Keyed by the
  // request id so repeated decisions update one row rather than pile up.
  recordActivity({
    userId: existing.userId,
    type: "case",
    title: existing.title,
    status: to,
    statusFa: LEGAL_REQUEST_STATE_FA[to],
    description:
      to === "ACCEPTED"
        ? `وکیل «${profile.fullName}» درخواست مشاوره شما را پذیرفت`
        : `وکیل «${profile.fullName}» درخواست مشاوره شما را نپذیرفت`,
    category: existing.category,
    sourceId: `legal-request-${id}`,
  });

  return NextResponse.json({ data: result.request });
}
