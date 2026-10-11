// ============================================================
// LEGALIR — POST /api/v1/admin/lawyers/[id]/status
// ============================================================
// Set a lawyer's operator lifecycle state: فعال / غیرفعال / معلق / حذف‌شده.
// Each transition is a SEPARATE capability, checked here against the
// caller's role:
//   ACTIVE / INACTIVE → admin:lawyer:status
//   SUSPENDED         → admin:lawyer:suspend
//   DELETED           → admin:lawyer:delete
//   restore (→ACTIVE) → admin:lawyer:restore
//
// Suspension and deletion are DECISIONS and are never anonymous: a reason of
// at least 3 characters is mandatory. Suspension additionally writes to the
// lawyer's public decision history (the status the marketplace reads);
// deletion is a soft tombstone — the row is retained and restorable.
//
// Everything is mirrored into the platform audit trail with a before/after
// snapshot, the actor and the reason.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth, isStaffWith } from "@/lib/rbac";
import {
  getLawyerProfileById,
  updateLawyerProfile,
  adminStatusPatch,
  recordStatusDecision,
} from "@/lib/lawyer-db";
import { findUserById } from "@/lib/db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson, mapDataError } from "@/lib/admin/http";
import {
  LAWYER_VERIFICATION_FA,
  type AdminLawyerStatus,
  type LawyerAuditAction,
  type Permission,
  type LawyerVerificationStatus,
} from "@legalir/types";

const VALID: AdminLawyerStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"];

/** The capability each lifecycle target requires. */
const PERMISSION_FOR: Record<AdminLawyerStatus, Permission> = {
  ACTIVE: "admin:lawyer:status",
  INACTIVE: "admin:lawyer:status",
  SUSPENDED: "admin:lawyer:suspend",
  DELETED: "admin:lawyer:delete",
};

/** The audit verb for a transition (a restore is distinguished from ACTIVATE). */
function auditAction(target: AdminLawyerStatus, wasDeleted: boolean): LawyerAuditAction {
  switch (target) {
    case "SUSPENDED":
      return "LAWYER_SUSPEND";
    case "DELETED":
      return "LAWYER_DELETE";
    case "ACTIVE":
      return wasDeleted ? "LAWYER_RESTORE" : "LAWYER_ACTIVATE";
    case "INACTIVE":
      return "LAWYER_CHANGE_STATUS";
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as {
    status?: AdminLawyerStatus;
    reason?: string;
  } | null;
  if (!body) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const target = body.status as AdminLawyerStatus;
  if (!VALID.includes(target)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "وضعیت هدف معتبر نیست" },
      { status: 400 }
    );
  }

  // Restoring a deleted profile needs the restore capability, not `status`.
  const before = getLawyerProfileById(id);
  if (!before) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }
  const wasDeleted = Boolean(before.deletedAt);
  const requiredPermission: Permission =
    target === "ACTIVE" && wasDeleted ? "admin:lawyer:restore" : PERMISSION_FOR[target];

  if (!isStaffWith(auth.ctx, requiredPermission)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "شما به این بخش دسترسی ندارید" },
      { status: 403 }
    );
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if ((target === "SUSPENDED" || target === "DELETED") && reason.length < 3) {
    return NextResponse.json(
      {
        code: "REASON_REQUIRED",
        message: "ثبت دلیل برای تعلیق/حذف الزامی است",
        fieldErrors: [{ path: "reason", reason: "دلیل را وارد کنید" }],
      },
      { status: 400 }
    );
  }

  const previousStatus = before.verificationStatus;
  const updated = updateLawyerProfile(id, adminStatusPatch(target, undefined, before));
  if (!updated) return mapDataError("NOT_FOUND");

  // Suspension is a public, transparency-bearing state — record it in the
  // lawyer's decision history exactly like a verification decision, so the
  // same timeline shows why the profile is flagged. A reactivation of a
  // previously-suspended lawyer is recorded the same way, so the timeline
  // shows the suspension was lifted (and by whom).
  const actor = findUserById(auth.ctx.userId);
  const actorName = actor?.displayName ?? "مدیر پلتفرم";
  const liftedSuspension = target === "ACTIVE" && previousStatus === "SUSPENDED";
  if (target === "SUSPENDED" || liftedSuspension) {
    recordStatusDecision({
      id: `lsd-${crypto.randomUUID()}`,
      lawyerId: id,
      previousStatus,
      newStatus: (target === "SUSPENDED" ? "SUSPENDED" : "VERIFIED") as LawyerVerificationStatus,
      reason:
        reason ||
        (target === "SUSPENDED" ? "تعلیق توسط مدیر پلتفرم" : "رفع تعلیق توسط مدیر پلتفرم"),
      actorUserId: auth.ctx.userId,
      actorName,
      actorRole: auth.ctx.role,
      createdAt: new Date().toISOString(),
    });
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: auditAction(target, wasDeleted),
    resourceType: "lawyer",
    resourceId: id,
    reason: reason || null,
    before: {
      verificationStatus: previousStatus,
      visibility: before.visibility ?? "PUBLIC",
      deletedAt: before.deletedAt ?? null,
    },
    after: {
      verificationStatus: updated.verificationStatus,
      visibility: updated.visibility ?? "PUBLIC",
      deletedAt: updated.deletedAt ?? null,
      label: LAWYER_VERIFICATION_FA[updated.verificationStatus as LawyerVerificationStatus] ?? target,
    },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      verificationStatus: updated.verificationStatus,
      visibility: updated.visibility ?? "PUBLIC",
      deletedAt: updated.deletedAt ?? null,
      lifecycle: target,
    },
  });
}
