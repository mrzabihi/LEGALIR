// ============================================================
// LEGALIR — /api/v1/cases/[id]/proceedings
// ============================================================
// A case may have several proceedings before authorities (first instance,
// appeal, enforcement). Each carries its own path, stage and official
// numbers — all stored as strings and kept independent.
//
// Creating a proceeding here records what the user tells us; it NEVER files
// anything with an authority.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseProceedings, createCaseProceeding, getCaseProceeding } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toProceeding } from "@/lib/cases/dto";
import { isValidStageForPath } from "@/lib/cases/domain";
import type { CaseProceedingCreateRequest } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });

  return NextResponse.json({ data: getCaseProceedings(id).map(toProceeding) });
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

  let body: CaseProceedingCreateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.path || !body.stage) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "مسیر و مرحله رسیدگی الزامی است" }, { status: 400 });
  }
  if (!isValidStageForPath(body.path, body.stage)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "این مرحله با مسیر رسیدگی سازگار نیست" },
      { status: 400 }
    );
  }
  if (body.parentProceedingId && !getCaseProceeding(id, body.parentProceedingId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "رسیدگی مرجع یافت نشد" }, { status: 404 });
  }

  const proceeding = createCaseProceeding({
    id: generateId(),
    caseId: id,
    path: body.path,
    stage: body.stage,
    authority: body.authority ?? null,
    province: body.province ?? null,
    city: body.city ?? null,
    branch: body.branch ?? null,
    judicialNumber: body.judicialNumber ?? null,
    archiveNumber: body.archiveNumber ?? null,
    trackingCode: body.trackingCode ?? null,
    judgmentId: body.judgmentId ?? null,
    filedAt: body.filedAt ?? null,
    stageSource: "user",
    parentProceedingId: body.parentProceedingId ?? null,
  });

  return NextResponse.json({ data: toProceeding(proceeding) }, { status: 201 });
}
