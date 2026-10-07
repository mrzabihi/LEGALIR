// ============================================================
// LEGALIR — POST /api/v1/admin/lawyers/[id]/verification
// ============================================================
// Set a lawyer's verification state. Staff-only. The status is validated
// against the known set; the actor is always the session user, never a
// client-supplied id.
//
// A status change is a DECISION and is never anonymous: a non-empty reason
// is mandatory for every transition (approve included), the previous status
// is read from the stored profile, and the whole thing is written to both
// the lawyer's decision history and the platform audit trail — actor,
// timestamp, previous → new, reason. Without a reason the request is refused.
//
// Verification is also the moment the LAWYER role is granted: a verified
// lawyer must be able to reach the lawyer workspace, respond to requests
// and send case messages. Without this the `lawyer:*` permissions are
// held by nobody and every lawyer endpoint 403s.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { setVerificationStatus, getLawyerProfileById, recordStatusDecision } from "@/lib/lawyer-db";
import { setUserRole, setPlatformAccountType, findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta } from "@/lib/admin/http";
import {
  LAWYER_VERIFICATION_FA,
  type LawyerVerificationStatus,
} from "@legalir/types";

/** The statuses an admin may set through this endpoint. */
const VALID_STATUSES: LawyerVerificationStatus[] = [
  "UNVERIFIED",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:verify");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { status?: string; note?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as LawyerVerificationStatus)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "وضعیت تأیید معتبر نیست" },
      { status: 400 }
    );
  }

  // A decision can never be recorded without supplementary information.
  const reason = (body.reason ?? body.note ?? "").trim();
  if (reason.length < 3) {
    return NextResponse.json(
      {
        code: "REASON_REQUIRED",
        message: "ثبت دلیل برای تغییر وضعیت الزامی است",
        fieldErrors: [{ path: "reason", reason: "دلیل تصمیم را وارد کنید" }],
      },
      { status: 400 }
    );
  }

  const before = getLawyerProfileById(id);
  if (!before) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }
  const previousStatus = before.verificationStatus;
  const newStatus = body.status as LawyerVerificationStatus;

  const updated = setVerificationStatus(id, newStatus, reason);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  // Grant the LAWYER role on verification so the lawyer side is reachable.
  // A suspended/rejected lawyer keeps their role but loses the ability to
  // accept requests (the marketplace filters on verificationStatus).
  if (updated.verificationStatus === "VERIFIED") {
    setUserRole(updated.userId, "LAWYER");
    setPlatformAccountType(updated.userId, "LAWYER");
  }

  // Record the decision: lawyer-facing history (who/when/why) + the platform
  // audit trail. Both are append-only; a later change cannot erase either.
  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName ?? "مدیر پلتفرم";
  const decision = recordStatusDecision({
    id: `lsd-${crypto.randomUUID()}`,
    lawyerId: id,
    previousStatus,
    newStatus,
    reason,
    actorUserId: auth.ctx.userId,
    actorName,
    actorRole: auth.ctx.role,
    createdAt: new Date().toISOString(),
  });

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "lawyer.verify",
    resourceType: "lawyer",
    resourceId: id,
    reason,
    before: { verificationStatus: previousStatus },
    after: {
      verificationStatus: newStatus,
      label: LAWYER_VERIFICATION_FA[newStatus],
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      verificationStatus: updated.verificationStatus,
      verificationNote: updated.verificationNote,
      verifiedAt: updated.verifiedAt,
      decision,
    },
  });
}
