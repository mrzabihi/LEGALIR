// ============================================================
// LEGALIR — /api/v1/cases/[id]/deadlines
// ============================================================
// Legal deadlines on a case (PART 10).
//
// A deadline is ALWAYS user-, lawyer- or source-supplied. The AI never
// invents one. When a deadline is derived from a legal rule it must carry
// the rule reference (`sourceRef`) and is flagged `needsConfirmation`
// until a human confirms it — the UI shows «نیازمند تأیید» for those.
//
// AUTHORIZATION: the case must belong to the caller.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseById,
  getCaseDeadlines,
  createCaseDeadline,
  updateCaseDeadline,
  deleteCaseDeadline,
  addCaseTimelineEvent,
} from "@/lib/case-db";

const VALID_SOURCES = ["user", "lawyer", "legal_source", "system"] as const;
type DeadlineSource = (typeof VALID_SOURCES)[number];

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ownedCase(userId: string, caseId: string) {
  const c = getCaseById(caseId);
  if (!c || c.user_id !== userId) return null;
  return c;
}

function toDto(d: ReturnType<typeof getCaseDeadlines>[number]) {
  return {
    id: d.id,
    caseId: d.case_id,
    title: d.title,
    dueAt: d.due_at,
    source: d.source,
    sourceRef: d.source_ref,
    needsConfirmation: d.needs_confirmation,
    completed: d.completed,
    createdAt: d.created_at,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: getCaseDeadlines(id).map(toDto) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  let body: {
    title?: string;
    dueAt?: string;
    source?: string;
    sourceRef?: string | null;
    needsConfirmation?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "عنوان مهلت الزامی است" }, { status: 400 });
  }
  if (!body.dueAt || Number.isNaN(Date.parse(body.dueAt))) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "تاریخ مهلت نامعتبر است" }, { status: 400 });
  }

  const source: DeadlineSource = VALID_SOURCES.includes(body.source as DeadlineSource)
    ? (body.source as DeadlineSource)
    : "user";

  // A deadline derived from a legal rule is never auto-trusted.
  const needsConfirmation =
    body.needsConfirmation ?? source === "legal_source";

  const deadline = createCaseDeadline({
    id: generateId(),
    caseId: id,
    title,
    dueAt: body.dueAt,
    source,
    sourceRef: body.sourceRef ?? null,
    needsConfirmation,
  });

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "deadline_added",
    title: "مهلت اضافه شد",
    description: title,
    metadata: { deadlineId: deadline.id, dueAt: deadline.due_at, source },
  });

  return NextResponse.json({ data: toDto(deadline) }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  let body: {
    deadlineId?: string;
    title?: string;
    dueAt?: string;
    completed?: boolean;
    needsConfirmation?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.deadlineId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه مهلت الزامی است" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates["title"] = body.title;
  if (body.dueAt !== undefined) updates["due_at"] = body.dueAt;
  if (body.completed !== undefined) updates["completed"] = body.completed;
  if (body.needsConfirmation !== undefined) updates["needs_confirmation"] = body.needsConfirmation;

  const updated = updateCaseDeadline(id, body.deadlineId, updates);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "مهلت یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: toDto(updated) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const deadlineId = new URL(req.url).searchParams.get("deadlineId")?.trim();
  if (!deadlineId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه مهلت الزامی است" }, { status: 400 });
  }

  if (!deleteCaseDeadline(id, deadlineId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "مهلت یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: { deadlineId, removed: true } });
}
