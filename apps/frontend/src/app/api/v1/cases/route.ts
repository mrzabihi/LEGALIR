import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { listCases, createCase, getCaseTasks } from "@/lib/case-db";
import { addCaseTimelineEvent } from "@/lib/case-db";
import { recordActivity } from "@/lib/db";
import type { CaseCreateRequest } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const result = listCases(userId, {
    status: searchParams.get("status") || undefined,
    category: searchParams.get("category") || undefined,
    priority: searchParams.get("priority") || undefined,
    search: searchParams.get("search") || undefined,
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 20,
  });

  const items = result.items.map((c) => {
    const tasks = getCaseTasks(c.id);
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      status: c.status,
      priority: c.priority,
      documentCount: 0,
      contractCount: 0,
      taskCount: tasks.length,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  });

  return NextResponse.json({
    data: {
      items,
      pagination: {
        page: Number(searchParams.get("page")) || 1,
        pageSize: Number(searchParams.get("pageSize")) || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (Number(searchParams.get("pageSize")) || 20)),
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const body: CaseCreateRequest = await req.json();
  if (!body.title?.trim() || !body.description?.trim() || !body.category) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "عنوان، توضیحات و دسته‌بندی الزامی است" }, { status: 400 });
  }

  const caseId = generateId();
  const c = createCase({
    id: caseId,
    userId: userId,
    title: body.title.trim(),
    description: body.description.trim(),
    category: body.category,
    priority: body.priority || "medium",
  });

  addCaseTimelineEvent({
    id: generateId(),
    caseId,
    eventType: "case_created",
    title: "ایجاد پرونده",
    description: `پرونده "${body.title}" ایجاد شد`,
    metadata: {},
  });

  recordActivity({
    userId,
    type: "case",
    title: c.title,
    status: c.status,
    statusFa: "ایجاد شد",
    description: c.description.slice(0, 160),
    category: c.category,
    categoryFa: null,
    sourceId: caseId,
  });

  return NextResponse.json({
    data: {
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
  }, { status: 201 });
}
