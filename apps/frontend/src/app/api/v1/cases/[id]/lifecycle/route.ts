// ============================================================
// LEGALIR — /api/v1/cases/[id]/lifecycle
// ============================================================
// Change the INTERNAL LEGALIR lifecycle of a case (ACTIVE / ON_HOLD /
// CLOSED / ARCHIVED). This is entirely separate from any proceeding stage
// and never closes anything before an authority.
//
// Closing/archiving does NOT stop open deadlines — they keep their
// reminders unless the user explicitly cancels them.
//
// AUTHORIZATION: owner-only; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { updateCase, addCaseTimelineEvent } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toCaseV2 } from "@/lib/cases/dto";
import { CASE_LIFECYCLE_FA, type CaseLifecycleChangeRequest, type CaseLifecycleStatus } from "@legalir/types";

const VALID: CaseLifecycleStatus[] = ["ACTIVE", "ON_HOLD", "CLOSED", "ARCHIVED"];

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.isOwner) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند وضعیت آن را تغییر دهد" }, { status: 403 });
  }

  let body: CaseLifecycleChangeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!VALID.includes(body.lifecycle)) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "وضعیت نامعتبر است" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "دلیل تغییر وضعیت الزامی است" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = updateCase(id, {
    lifecycle: body.lifecycle,
    lifecycle_reason: body.reason.trim(),
    lifecycle_changed_at: now,
  });
  if (!result || "conflict" in result) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "تغییر وضعیت ناموفق بود" }, { status: 500 });
  }

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "case_closed",
    title: `تغییر وضعیت به «${CASE_LIFECYCLE_FA[body.lifecycle]}»`,
    description: body.reason.trim(),
    recordedByUserId: userId,
    source: "user",
    metadata: { lifecycle: body.lifecycle },
  });

  return NextResponse.json({ data: toCaseV2(result.case, access.role) });
}
