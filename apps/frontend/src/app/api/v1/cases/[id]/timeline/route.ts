// ============================================================
// LEGALIR — /api/v1/cases/[id]/timeline
// ============================================================
// The case timeline. `occurredAt` (when it actually happened) is separate
// from `recordedAt` (when it was entered) — an old hearing entered today
// shows at its real date with a «بعداً ثبت شده» badge on the client.
//
// Private events are filtered per viewer: a member never sees another
// author's private note.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseTimeline, addCaseTimelineEvent } from "@/lib/case-db";
import { resolveCaseAccess, canReadPrivateNote } from "@/lib/cases/access";
import { toEvent } from "@/lib/cases/dto";
import type { CaseEventCreateRequestV2 } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });

  const timeline = getCaseTimeline(id)
    .filter((e) => {
      if ((e.visibility ?? "shared") === "shared") return true;
      return canReadPrivateNote(access, e.recorded_by_user_id ?? "", userId);
    })
    .map(toEvent);

  return NextResponse.json({ data: timeline });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  let body: CaseEventCreateRequestV2;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.eventType || !body.title?.trim()) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "نوع رویداد و عنوان الزامی است" }, { status: 400 });
  }

  const event = addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: body.eventType,
    title: body.title.trim(),
    description: body.description ?? "",
    occurredAt: body.occurredAt,
    proceedingId: body.proceedingId ?? null,
    recordedByUserId: userId,
    source: "user",
    visibility: body.visibility ?? "shared",
    documentId: body.documentId ?? null,
    taskId: body.taskId ?? null,
    deadlineId: body.deadlineId ?? null,
    contractId: body.contractId ?? null,
    metadata: body.metadata ?? {},
  });

  return NextResponse.json({ data: toEvent(event) }, { status: 201 });
}
