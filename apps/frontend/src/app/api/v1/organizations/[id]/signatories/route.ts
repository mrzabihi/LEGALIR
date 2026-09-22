// ============================================================
// LEGALIR — /api/v1/organizations/[id]/signatories
// ============================================================
// Authorized signatories (صاحبان امضا) of a legal entity. A signatory is
// an official record, NOT a platform user — kept separate from membership.
//
// Authorization: the caller must be an active member of the organization.
// A signatory never implies login access.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth, findActiveMembership } from "@/lib/rbac";
import { addSignatory, listSignatories, removeSignatory } from "@/lib/org-db";
import type { OrganizationAuthorizedSignatory } from "@legalir/types";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when the caller is an active member of the given organization. */
function isMember(userId: string, orgId: string): boolean {
  const membership = findActiveMembership(userId);
  return membership?.orgId === orgId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  if (!isMember(auth.ctx.userId, id)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سازمان یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { items: listSignatories(id) } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  if (!isMember(auth.ctx.userId, id)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سازمان یافت نشد" },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const fullName = str(body["fullName"]);
  if (!fullName) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "نام و نام خانوادگی صاحب امضا الزامی است",
        fieldErrors: [{ path: "fullName", reason: "نام صاحب امضا الزامی است" }],
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const signatory: OrganizationAuthorizedSignatory = {
    id: crypto.randomUUID(),
    orgId: id,
    fullName,
    nationalCode: str(body["nationalCode"]),
    position: str(body["position"]),
    authorityType: str(body["authorityType"]),
    phone: str(body["phone"]),
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ data: addSignatory(signatory) }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  if (!isMember(auth.ctx.userId, id)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سازمان یافت نشد" },
      { status: 404 }
    );
  }

  const signatoryId = new URL(request.url).searchParams.get("signatoryId");
  if (!signatoryId) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "شناسه صاحب امضا الزامی است" },
      { status: 400 }
    );
  }

  const removed = removeSignatory(id, signatoryId);
  if (!removed) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "صاحب امضا یافت نشد" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}
