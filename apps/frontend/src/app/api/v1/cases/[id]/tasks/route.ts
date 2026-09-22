import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseById, getCaseTasks, createCaseTask } from "@/lib/case-db";
import type { CaseTaskCreateRequest } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(_req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

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

  return NextResponse.json({ data: tasks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const body: CaseTaskCreateRequest = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "عنوان وظیفه الزامی است" }, { status: 400 });
  }

  const task = createCaseTask({
    id: generateId(),
    caseId: id,
    title: body.title.trim(),
    description: body.description || "",
    priority: body.priority || "medium",
    dueDate: body.dueDate || null,
  });

  return NextResponse.json({
    data: {
      id: task.id,
      caseId: task.case_id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    },
  }, { status: 201 });
}
