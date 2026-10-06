// ============================================================
// LEGALIR — POST /api/v1/admin/lawyers/[id]/messages
// ============================================================
// Send a direct message from the platform to a lawyer. Staff-only
// (`admin:lawyer:verify`, the same permission that gates the review queue).
//
// The message is NOT a parallel inbox: it is persisted to `lawyer_messages`
// and delivered through the SAME derived notification feed the rest of the
// app uses (category "personal"), so the lawyer sees it in their LegalIR
// notification center and the unread badge stays consistent. The send is
// audited.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLawyerProfileById } from "@/lib/lawyer-db";
import { createLawyerMessage, findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta } from "@/lib/admin/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { subject?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const subject = (body.subject ?? "").trim();
  const text = (body.body ?? "").trim();
  if (subject.length < 2) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "عنوان پیام الزامی است" },
      { status: 400 }
    );
  }
  if (text.length < 2) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "متن پیام الزامی است" },
      { status: 400 }
    );
  }

  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName ?? "مدیر پلتفرم";

  const message = createLawyerMessage({
    id: `lmsg-${crypto.randomUUID()}`,
    lawyerId: id,
    lawyerUserId: profile.userId,
    subject,
    body: text,
    actorUserId: auth.ctx.userId,
    actorName,
    createdAt: new Date().toISOString(),
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "lawyer.message.send",
    resourceType: "lawyer",
    resourceId: id,
    after: { subject },
    ...requestMeta(request),
  });

  return NextResponse.json({ data: message }, { status: 201 });
}
