// ============================================================
// LEGALIR — /api/v1/legal-requests/[id]/messages
// ============================================================
// The private, case-scoped message room between the client and the
// assigned lawyer. This is NOT the AI chat: the thread has two human
// participants and every message records which of them sent it.
//
// GET  — list the thread's messages (creating the thread on first read).
// POST — append a message.
//
// Authorization: the owner or the assigned lawyer only. Anyone else gets
// 404 so a foreign case is indistinguishable from a missing one. The
// lawyer branch additionally requires `lawyer:message:send`.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth, forbidden, notFound, roleHasPermission } from "@/lib/rbac";
import { getRequestById } from "@/lib/legal-request-db";
import { getLawyerProfileById } from "@/lib/lawyer-db";
import {
  getOrCreateThread,
  appendMessage,
  markThreadRead,
} from "@/lib/consultation-message-db";
import { buildConsultationDetail, canViewConsultation } from "@/lib/consultation-detail";

/** Upper bound on a single message body, in characters. */
const MAX_BODY_LENGTH = 4000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row || !canViewConsultation(row, auth.ctx.userId)) {
    return notFound("درخواست یافت نشد");
  }

  // Reading the room marks the other party's messages as read.
  const thread = getOrCreateThread(id, row.caseId, participantIds(row));
  markThreadRead(thread.id, auth.ctx.userId);

  return NextResponse.json({ data: buildConsultationDetail(row, auth.ctx.userId) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const row = getRequestById(id);
  if (!row || !canViewConsultation(row, auth.ctx.userId)) {
    return notFound("درخواست یافت نشد");
  }

  const lawyerProfile = row.selectedLawyerId
    ? getLawyerProfileById(row.selectedLawyerId)
    : undefined;
  const isLawyer = Boolean(lawyerProfile && lawyerProfile.userId === auth.ctx.userId);

  // A lawyer must hold the messaging permission; the client is the owner.
  if (isLawyer && !roleHasPermission(auth.ctx.role, "lawyer:message:send")) {
    return forbidden();
  }

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه پیام نامعتبر است" },
      { status: 400 }
    );
  }

  const text = body.body?.trim() ?? "";
  if (text.length === 0 || text.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "متن پیام نامعتبر است" },
      { status: 400 }
    );
  }

  const thread = getOrCreateThread(id, row.caseId, participantIds(row));
  const message = appendMessage({
    threadId: thread.id,
    senderUserId: auth.ctx.userId,
    senderRole: auth.ctx.role,
    body: text,
  });

  return NextResponse.json({ data: message }, { status: 201 });
}

/** The two human participants of a request: the client and the lawyer. */
function participantIds(row: { userId: string; selectedLawyerId: string | null }): string[] {
  const ids = [row.userId];
  if (row.selectedLawyerId) {
    const profile = getLawyerProfileById(row.selectedLawyerId);
    if (profile) ids.push(profile.userId);
  }
  return ids;
}
