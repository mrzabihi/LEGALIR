// ============================================================
// LEGALIR — /api/v1/cases/[id]/deadlines
// ============================================================
// Deadlines on a case (v2). Three INDEPENDENT kinds — legal / internal /
// hearing — are never merged. A deadline is ALWAYS user-, lawyer- or
// source-supplied; the AI never invents one. A rule-derived deadline
// carries its rule reference and stays `proposed`/`needs_review` until a
// human confirms it.
//
// A date-only deadline is NOT overdue at the start of its day: the
// operational state is derived in the Asia/Tehran calendar, so it reads
// «روز موعد» until the end of that date.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseDeadlines,
  createCaseDeadline,
  updateCaseDeadline,
  deleteCaseDeadline,
  addCaseTimelineEvent,
} from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toDeadlineV2 } from "@/lib/cases/dto";
import { deriveOperationalState } from "@/lib/cases/domain";
import type {
  CaseDeadlineCreateRequestV2,
  CaseDeadlineUpdateRequestV2,
  CaseDeadlineKind,
  CaseDeadlineBasis,
  CaseDeadlineReviewState,
  CaseDeadlineOperationalState,
} from "@legalir/types";

const VALID_SOURCES = ["user", "lawyer", "legal_source", "system"] as const;
type DeadlineSource = (typeof VALID_SOURCES)[number];

const VALID_KINDS: CaseDeadlineKind[] = ["legal", "internal", "hearing"];
const VALID_BASIS: CaseDeadlineBasis[] = ["manual", "computed", "document"];
const VALID_REVIEW: CaseDeadlineReviewState[] = ["user_entered", "proposed", "needs_review", "reviewed"];
const VALID_OPERATIONAL: CaseDeadlineOperationalState[] = ["open", "action_done", "needs_review_after_due", "cancelled"];

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** The stored row plus its derived operational state for the current instant. */
function toDto(row: ReturnType<typeof getCaseDeadlines>[number]) {
  const dto = toDeadlineV2(row);
  return { ...dto, operationalState: deriveOperationalState(dto, new Date()) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) {
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
  const access = resolveCaseAccess(userId, id);
  if (!access) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  let body: CaseDeadlineCreateRequestV2;
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
  const kind: CaseDeadlineKind = VALID_KINDS.includes(body.kind as CaseDeadlineKind)
    ? (body.kind as CaseDeadlineKind)
    : "legal";
  const basis: CaseDeadlineBasis = VALID_BASIS.includes(body.basis as CaseDeadlineBasis)
    ? (body.basis as CaseDeadlineBasis)
    : source === "legal_source"
      ? "computed"
      : "manual";

  // A deadline derived from a legal rule is never auto-trusted.
  const needsConfirmation = basis === "computed" || source === "legal_source";

  const deadline = createCaseDeadline({
    id: generateId(),
    caseId: id,
    title,
    dueAt: body.dueAt,
    source,
    sourceRef: body.ruleRef ?? null,
    needsConfirmation,
    proceedingId: body.proceedingId ?? null,
    kind,
    dateOnly: body.dateOnly ?? true,
    basis,
    ruleRef: body.ruleRef ?? null,
    sourceDocumentId: body.sourceDocumentId ?? null,
    announcedDueAt: body.announcedDueAt ?? null,
  });

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "deadline_added",
    title: "مهلت اضافه شد",
    description: title,
    recordedByUserId: userId,
    source: "user",
    deadlineId: deadline.id,
    metadata: { dueAt: deadline.due_at, source, kind },
  });

  return NextResponse.json({ data: toDto(deadline) }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  let body: CaseDeadlineUpdateRequestV2;
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
  if (body.kind !== undefined && VALID_KINDS.includes(body.kind)) updates["kind"] = body.kind;
  if (body.overrideReason !== undefined) updates["override_reason"] = body.overrideReason;
  if (body.announcedDueAt !== undefined) updates["announced_due_at"] = body.announcedDueAt;
  if (body.reviewState !== undefined && VALID_REVIEW.includes(body.reviewState)) {
    updates["review_state"] = body.reviewState;
    if (body.reviewState === "reviewed") {
      updates["reviewed_by_user_id"] = userId;
      updates["reviewed_at"] = new Date().toISOString();
      updates["needs_confirmation"] = false;
    }
  }
  if (body.operationalState !== undefined && VALID_OPERATIONAL.includes(body.operationalState)) {
    updates["operational_state"] = body.operationalState;
  }

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
  const access = resolveCaseAccess(userId, id);
  if (!access) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
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
