import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseById, getCaseTimeline, addCaseTimelineEvent } from "@/lib/case-db";
import type { CaseTimelineEventCreateRequest } from "@legalir/types";

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

  const timeline = getCaseTimeline(id).map((e) => ({
    id: e.id,
    caseId: e.case_id,
    eventType: e.event_type,
    title: e.title,
    description: e.description,
    metadata: e.metadata,
    createdAt: e.created_at,
  }));

  return NextResponse.json({ data: timeline });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const c = getCaseById(id);
  if (!c || c.user_id !== userId) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const body: CaseTimelineEventCreateRequest = await req.json();
  const event = addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: body.eventType,
    title: body.title,
    description: body.description || "",
    metadata: body.metadata || {},
  });

  return NextResponse.json({
    data: {
      id: event.id,
      caseId: event.case_id,
      eventType: event.event_type,
      title: event.title,
      description: event.description,
      metadata: event.metadata,
      createdAt: event.created_at,
    },
  }, { status: 201 });
}
