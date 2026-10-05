// ============================================================
// LEGALIR — /api/v1/cases/[id]/parties
// ============================================================
// Parties to a proceeding. Naming the opposing party creates NO account and
// grants NO access — a party is not a member. The legal role is validated
// against the proceeding's path so a criminal label can never be attached
// to a civil party.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseParties, createCaseParty, deleteCaseParty, getCaseProceeding } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toParty } from "@/lib/cases/dto";
import { legalRolesForPath, type CasePartyCreateRequest, type CaseLegalRole } from "@legalir/types";

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

  return NextResponse.json({ data: getCaseParties(id).map(toParty) });
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

  let body: CasePartyCreateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.legalRole) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "نام و نقش حقوقی الزامی است" }, { status: 400 });
  }

  // The legal role must be valid for the proceeding's path (when known).
  if (body.proceedingId) {
    const proceeding = getCaseProceeding(id, body.proceedingId);
    if (!proceeding) {
      return NextResponse.json({ code: "NOT_FOUND", message: "رسیدگی یافت نشد" }, { status: 404 });
    }
    if (!legalRolesForPath(proceeding.path).includes(body.legalRole as CaseLegalRole)) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "این نقش حقوقی با مسیر رسیدگی سازگار نیست" },
        { status: 400 }
      );
    }
  }

  const party = createCaseParty({
    id: generateId(),
    caseId: id,
    proceedingId: body.proceedingId ?? null,
    kind: body.kind ?? "person",
    name: body.name.trim(),
    legalRole: body.legalRole,
    nationalId: body.nationalId ?? null,
    phone: body.phone ?? null,
    note: body.note ?? null,
  });

  return NextResponse.json({ data: toParty(party) }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  const partyId = new URL(req.url).searchParams.get("partyId")?.trim();
  if (!partyId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه طرف الزامی است" }, { status: 400 });
  }
  if (!deleteCaseParty(id, partyId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "طرف یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ data: { partyId, removed: true } });
}
