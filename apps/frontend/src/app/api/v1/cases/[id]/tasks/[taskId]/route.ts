// ============================================================
// LEGALIR — /api/v1/cases/[id]/tasks/[taskId]
// ============================================================
// Update a single task (v2): status, priority, due date, assignee,
// dependencies, checklist and result. Completing a legal task without a
// receipt is recorded as a claim (`resultIsClaim`), never as a verified
// filing.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { updateCaseTask, getCaseTask, wouldCreateDependencyCycle, addCaseTimelineEvent } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toTaskV2 } from "@/lib/cases/dto";
import type { CaseTaskUpdateRequestV2 } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id, taskId } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  const existing = getCaseTask(id, taskId);
  if (!existing) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وظیفه یافت نشد" }, { status: 404 });
  }

  let body: CaseTaskUpdateRequestV2;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates["title"] = body.title;
  if (body.description !== undefined) updates["description"] = body.description;
  if (body.status !== undefined) updates["status"] = body.status;
  if (body.priority !== undefined) updates["priority"] = body.priority;
  if (body.dueDate !== undefined) updates["due_date"] = body.dueDate;
  if (body.assigneeUserId !== undefined) updates["assignee_user_id"] = body.assigneeUserId;
  if (body.checklist !== undefined) updates["checklist"] = body.checklist;
  if (body.result !== undefined) updates["result"] = body.result;
  if (body.resultIsClaim !== undefined) updates["result_is_claim"] = body.resultIsClaim;

  if (body.dependsOn !== undefined) {
    if (wouldCreateDependencyCycle(id, taskId, body.dependsOn)) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "وابستگی چرخه‌ای مجاز نیست" }, { status: 400 });
    }
    updates["depends_on"] = body.dependsOn;
  }

  const updated = updateCaseTask(id, taskId, updates);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وظیفه یافت نشد" }, { status: 404 });
  }

  // Completing a task records a timeline event; a claim is labelled as such.
  if (body.status === "done" && existing.status !== "done") {
    addCaseTimelineEvent({
      id: generateId(),
      caseId: id,
      eventType: "task_completed",
      title: "وظیفه تکمیل شد",
      description: updated.result ?? updated.title,
      recordedByUserId: userId,
      source: "user",
      taskId: updated.id,
      metadata: { resultIsClaim: updated.result_is_claim },
    });
  }

  return NextResponse.json({ data: toTaskV2(updated) });
}
