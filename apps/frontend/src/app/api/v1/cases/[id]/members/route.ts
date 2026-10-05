// ============================================================
// LEGALIR — /api/v1/cases/[id]/members
// ============================================================
// Case membership. Membership on ONE case never grants access to another.
// Only the owner may grant or revoke membership. A `pending` member (a
// lawyer awaiting acceptance) is granted the minimal-summary role only.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404. Mutations are
// owner-only.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getCaseMembers, addCaseMember, revokeCaseMember } from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toMember } from "@/lib/cases/dto";
import type { CaseMemberRole } from "@legalir/types";

const GRANTABLE: CaseMemberRole[] = ["lawyer", "limited", "viewer", "pending"];

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

  return NextResponse.json({ data: getCaseMembers(id).map(toMember) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canManageMembers) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند دسترسی اعطا کند" }, { status: 403 });
  }

  let body: { accountId?: string; role?: CaseMemberRole; scopes?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.accountId?.trim() || !body.role || !GRANTABLE.includes(body.role)) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه حساب و نقش معتبر الزامی است" }, { status: 400 });
  }

  const member = addCaseMember({
    id: generateId(),
    caseId: id,
    accountId: body.accountId.trim(),
    role: body.role,
    scopes: body.scopes ?? [],
    grantedByUserId: userId,
  });

  return NextResponse.json({ data: toMember(member) }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canManageMembers) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند دسترسی را لغو کند" }, { status: 403 });
  }

  const accountId = new URL(req.url).searchParams.get("accountId")?.trim();
  if (!accountId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه حساب الزامی است" }, { status: 400 });
  }
  if (!revokeCaseMember(id, accountId)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "عضو یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ data: { accountId, revoked: true } });
}
