// ============================================================
// LEGALIR — /api/v1/cases/[id]/representations
// ============================================================
// Representation records (وکالت‌نامه). A representation is INDEPENDENT of
// engagement acceptance and of the service contract: some authorities
// require explicit powers, and a platform checkbox is never a substitute
// for the document text.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404. Only the owner
// may record a representation.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseRepresentations, createCaseRepresentation } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toRepresentation } from "@/lib/cases/dto";
import type { CaseRepresentationCreateRequest } from "@legalir/types";

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

  return NextResponse.json({ data: getCaseRepresentations(id).map(toRepresentation) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.isOwner) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند وکالت‌نامه ثبت کند" }, { status: 403 });
  }

  let body: CaseRepresentationCreateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.documentType?.trim()) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "نوع سند الزامی است" }, { status: 400 });
  }

  const rep = createCaseRepresentation({
    id: generateId(),
    caseId: id,
    lawyerProfileId: body.lawyerProfileId ?? null,
    documentType: body.documentType.trim(),
    documentId: body.documentId ?? null,
    referenceNumber: body.referenceNumber ?? null,
    issuedAt: body.issuedAt ?? null,
    coveredProceedingIds: body.coveredProceedingIds ?? [],
    authorityLimits: body.authorityLimits ?? null,
    validUntil: body.validUntil ?? null,
    note: body.note ?? null,
  });

  return NextResponse.json({ data: toRepresentation(rep) }, { status: 201 });
}
