// ============================================================
// LEGALIR — /api/v1/cases/[id]/stage
// ============================================================
// Change the stage of a proceeding. A stage change is ALWAYS recorded with
// its provenance and a reason, and produces a `stage_changed` timeline
// event whose `occurredAt` may be in the past (a late-entered old stage).
//
// The stage must belong to the proceeding's path template — a criminal
// stage can never be set on a civil proceeding.
//
// AUTHORIZATION: `resolveCaseAccess` + `canWrite`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseProceeding, updateCaseProceeding, addCaseTimelineEvent } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { isValidStageForPath } from "@/lib/cases/domain";
import { toProceeding } from "@/lib/cases/dto";
import type { CaseStageChangeRequest, CaseStageKey } from "@legalir/types";

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
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  let body: CaseStageChangeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.proceedingId || !body.stage) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه رسیدگی و مرحله الزامی است" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "دلیل تغییر مرحله الزامی است" }, { status: 400 });
  }

  const proceeding = getCaseProceeding(id, body.proceedingId);
  if (!proceeding) {
    return NextResponse.json({ code: "NOT_FOUND", message: "رسیدگی یافت نشد" }, { status: 404 });
  }

  // The user may reclassify the case's path in the same action (e.g. moving
  // off the placeholder `other` path). The stage must fit the resulting path.
  const path = body.path ?? proceeding.path;
  const stage = body.stage as CaseStageKey;
  if (!isValidStageForPath(path, stage)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "این مرحله با مسیر رسیدگی این پرونده سازگار نیست" },
      { status: 400 }
    );
  }

  const source = body.source ?? "user";
  const now = new Date().toISOString();
  const updated = updateCaseProceeding(id, body.proceedingId, {
    path,
    stage,
    stage_source: source,
    stage_recorded_at: now,
  });
  if (!updated) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "تغییر مرحله ناموفق بود" }, { status: 500 });
  }

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    proceedingId: body.proceedingId,
    eventType: "stage_changed",
    title: "تغییر مرحله پرونده",
    description: body.reason.trim(),
    occurredAt: body.occurredAt ?? now,
    recordedByUserId: userId,
    source,
    documentId: body.documentId ?? null,
    metadata: { stage, path },
  });

  return NextResponse.json({ data: toProceeding(updated) });
}
