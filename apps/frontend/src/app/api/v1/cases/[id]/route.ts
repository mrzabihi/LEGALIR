import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseById,
  updateCase,
  getCaseTimeline,
  getCaseTasks,
  getCaseDocuments,
  getCaseDeadlines,
} from "@/lib/case-db";
import { listContractsForUser } from "@/lib/contracts/db";
import { getDemoDocument } from "@/lib/demo-seed";
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

  // Documents linked to this case. Each link is re-checked against the
  // caller's own documents, so a stale link to a foreign/deleted document
  // can never leak through the case.
  const documents = getCaseDocuments(id)
    .map((link) => {
      const doc = getDemoDocument(userId, link.document_id);
      if (!doc) return null;
      return {
        id: doc.id,
        name: doc.name,
        mime: doc.mime,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        linkedAt: link.created_at,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const deadlines = getCaseDeadlines(id).map((d) => ({
    id: d.id,
    caseId: d.case_id,
    title: d.title,
    dueAt: d.due_at,
    source: d.source,
    sourceRef: d.source_ref,
    needsConfirmation: d.needs_confirmation,
    completed: d.completed,
    createdAt: d.created_at,
  }));

  // Contracts linked to this case (PART 11). Scoped to the session user
  // so a foreign contract can never leak through a case.
  const contracts = listContractsForUser(userId)
    .filter((ct) => ct.caseId === id)
    .map((ct) => ({
      id: ct.id,
      referenceCode: ct.referenceCode,
      title: ct.title,
      typeFa: ct.typeFa,
      state: ct.state,
      progress: ct.progress,
      updatedAt: ct.updatedAt,
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
      documents,
      contracts,
      timeline,
      tasks,
      deadlines,
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
