import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseById, updateCaseTask } from "@/lib/case-db";
import type { CaseTaskUpdateRequest } from "@legalir/types";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const userId = getUserIdFromRequest(_req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id, taskId } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const body: CaseTaskUpdateRequest = await _req.json();
  const updates: Record<string, unknown> = {};
  if (body["title"] !== undefined) updates["title"] = body["title"];
  if (body["description"] !== undefined) updates["description"] = body["description"];
  if (body["status"] !== undefined) updates["status"] = body["status"];
  if (body["priority"] !== undefined) updates["priority"] = body["priority"];
  if (body["dueDate"] !== undefined) updates["due_date"] = body["dueDate"];

  const updated = updateCaseTask(id, taskId, updates);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وظیفه یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      caseId: updated.case_id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      dueDate: updated.due_date,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
}
