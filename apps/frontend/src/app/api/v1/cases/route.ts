import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  listCases,
  createCase,
  getCaseTasks,
  getCaseDocuments,
  getCaseContractLinks,
  findCaseByIdempotencyKey,
  addCaseTimelineEvent,
  addCaseMember,
  createCaseProceeding,
  createCaseTask,
} from "@/lib/case-db";
import { recordActivity } from "@/lib/db";
import type { CaseCreateRequestV2 } from "@legalir/types";

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

  const items = result.items.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    status: c.status,
    priority: c.priority,
    lifecycle: c.lifecycle ?? "ACTIVE",
    internalRef: c.internal_ref ?? "",
    documentCount: getCaseDocuments(c.id).length,
    contractCount: getCaseContractLinks(c.id).length,
    taskCount: getCaseTasks(c.id).length,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

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

  let body: CaseCreateRequestV2;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.description?.trim() || !body.category) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "عنوان، توضیحات و دسته‌بندی الزامی است" },
      { status: 400 }
    );
  }

  // Idempotency: a repeat create (double-click / retry) with the same key
  // returns the SAME case and never creates duplicate tasks.
  const idempotencyKey = body.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = findCaseByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return NextResponse.json(
        {
          data: {
            id: existing.id,
            userId: existing.user_id,
            title: existing.title,
            description: existing.description,
            category: existing.category,
            status: existing.status,
            priority: existing.priority,
            lifecycle: existing.lifecycle ?? "ACTIVE",
            internalRef: existing.internal_ref ?? "",
            version: existing.version ?? 1,
            createdAt: existing.created_at,
            updatedAt: existing.updated_at,
            idempotentReplay: true,
          },
        },
        { status: 200 }
      );
    }
  }

  const caseId = generateId();
  const c = createCase({
    id: caseId,
    userId,
    title: body.title.trim(),
    description: body.description.trim(),
    category: body.category,
    priority: body.priority || "medium",
    idempotencyKey,
  });

  // --- Transactional side-effects (single logical create) ---
  // 1. The owner's membership row.
  addCaseMember({
    id: generateId(),
    caseId,
    accountId: userId,
    role: "owner",
    grantedByUserId: userId,
  });

  // 2. A default proceeding in the honest "unknown" state — the user has not
  //    yet told us the path or stage, so we never fabricate one.
  createCaseProceeding({
    id: generateId(),
    caseId,
    path: "other",
    stage: "other_info_completion",
    stageSource: "user",
  });

  // 3. The creation event. The message is exactly the product copy.
  addCaseTimelineEvent({
    id: generateId(),
    caseId,
    eventType: "case_created",
    title: "ایجاد پرونده",
    description: "پرونده شما در لیگالیر ایجاد شد",
    recordedByUserId: userId,
    source: "user",
    metadata: { internalRef: c.internal_ref },
  });

  // 4. Two generic starter tasks. They are deletable and never require a lawyer.
  createCaseTask({
    id: generateId(),
    caseId,
    title: "تکمیل اطلاعات پرونده",
    description: "نقش شما، مرحله فعلی پرونده و اطلاعات مرجع را تکمیل کنید.",
    priority: "medium",
    dueDate: null,
    actionType: "general",
    createdByUserId: userId,
  });
  createCaseTask({
    id: generateId(),
    caseId,
    title: "افزودن مدارک مرتبط",
    description: "اسناد و مدارک مرتبط با پرونده را بارگذاری یا پیوست کنید.",
    priority: "low",
    dueDate: null,
    actionType: "document",
    createdByUserId: userId,
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

  return NextResponse.json(
    {
      data: {
        id: c.id,
        userId: c.user_id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        priority: c.priority,
        lifecycle: c.lifecycle ?? "ACTIVE",
        internalRef: c.internal_ref ?? "",
        version: c.version ?? 1,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      },
    },
    { status: 201 }
  );
}
