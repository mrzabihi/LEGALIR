import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseById, updateCase, getCaseTimeline, getCaseTasks } from "@/lib/case-db";
import { recordActivity } from "@/lib/db";
import type { CaseUpdateRequest } from "@legalir/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(_req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const timeline = getCaseTimeline(id).map((e) => ({
    id: e.id,
    caseId: e.case_id,
    eventType: e.event_type,
    title: e.title,
    description: e.description,
    metadata: e.metadata,
    createdAt: e.created_at,
  }));

  const tasks = getCaseTasks(id).map((t) => ({
    id: t.id,
    caseId: t.case_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  return NextResponse.json({
    data: {
      case: {
        id: c.id,
        userId: c.user_id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        priority: c.priority,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      },
      documents: [],
      contracts: [],
      timeline,
      tasks,
    },
  });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(_req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const body: CaseUpdateRequest = await _req.json();
    const updates: Record<string, unknown> = {};
  if (body["title"] !== undefined) updates["title"] = body["title"];
  if (body["description"] !== undefined) updates["description"] = body["description"];
  if (body["category"] !== undefined) updates["category"] = body["category"];
  if (body["status"] !== undefined) updates["status"] = body["status"];
  if (body["priority"] !== undefined) updates["priority"] = body["priority"];

  const updated = updateCase(id, updates);
  if (!updated) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "به‌روزرسانی پرونده ناموفق بود" }, { status: 500 });
  }

  recordActivity({
    userId,
    type: "case",
    title: updated.title,
    status: updated.status,
    statusFa: "به‌روزرسانی شد",
    description: updated.description.slice(0, 160),
    category: updated.category,
    categoryFa: null,
    sourceId: id,
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      userId: updated.user_id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      status: updated.status,
      priority: updated.priority,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
}
