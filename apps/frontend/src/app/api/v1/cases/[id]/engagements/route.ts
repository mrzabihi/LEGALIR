// ============================================================
// LEGALIR — /api/v1/cases/[id]/engagements
// ============================================================
// Lawyer collaboration. An engagement is a REQUEST that must be BOTH
// accepted by the lawyer AND consented to by the owner for a specific
// scope before any access is granted. Until then the lawyer is a `pending`
// member and sees only a minimal summary.
//
// Accepting a consultation is NOT a full handover — the `kind` records what
// was actually requested.
//
// AUTHORIZATION: `resolveCaseAccess`; foreign case → 404. Only the owner
// may create/update an engagement.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseEngagements,
  getCaseEngagement,
  createCaseEngagement,
  updateCaseEngagement,
  addCaseMember,
  updateCaseMemberRole,
  addCaseTimelineEvent,
} from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toEngagement } from "@/lib/cases/dto";
import {
  CASE_ENGAGEMENT_SCOPES,
  type CaseEngagementCreateRequest,
  type CaseEngagementUpdateRequest,
  type CaseEngagementScope,
  type LawyerEngagementState,
} from "@legalir/types";

const VALID_STATES: LawyerEngagementState[] = [
  "requested",
  "under_review",
  "accepted",
  "declined",
  "cancelled",
  "expired",
];

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

  return NextResponse.json({ data: getCaseEngagements(id).map(toEngagement) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.isOwner) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند وکیل دعوت کند" }, { status: 403 });
  }

  let body: CaseEngagementCreateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.lawyerProfileId?.trim() || !body.kind) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه وکیل و نوع همکاری الزامی است" }, { status: 400 });
  }

  const scopes = (body.sharedScopes ?? []).filter((s): s is CaseEngagementScope =>
    (CASE_ENGAGEMENT_SCOPES as readonly string[]).includes(s)
  );
  if (scopes.length === 0) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "حداقل یک سطح دسترسی باید انتخاب شود" }, { status: 400 });
  }
  // The owner must explicitly consent to the shared scope before sending.
  if (!body.ownerConsent) {
    return NextResponse.json(
      { code: "CONSENT_REQUIRED", message: "برای ارسال درخواست، باید با اشتراک‌گذاری دامنه انتخابی موافقت کنید" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const engagement = createCaseEngagement({
    id: generateId(),
    caseId: id,
    lawyerProfileId: body.lawyerProfileId.trim(),
    lawyerUserId: null,
    kind: body.kind,
    sharedScopes: scopes,
    ownerConsentAt: now,
    requestedByUserId: userId,
    note: body.note ?? null,
  });

  // The lawyer is a PENDING member until they accept — minimal summary only.
  addCaseMember({
    id: generateId(),
    caseId: id,
    accountId: body.lawyerProfileId.trim(),
    role: "pending",
    scopes,
    grantedByUserId: userId,
  });

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "lawyer_requested",
    title: "درخواست همکاری با وکیل",
    description: `دامنه اشتراک‌گذاری: ${scopes.join("، ")}`,
    recordedByUserId: userId,
    source: "user",
    metadata: { engagementId: engagement.id, kind: body.kind, scopes },
  });

  return NextResponse.json({ data: toEngagement(engagement) }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.isOwner) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند وضعیت همکاری را تغییر دهد" }, { status: 403 });
  }

  let body: CaseEngagementUpdateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  if (!body.engagementId || !VALID_STATES.includes(body.state)) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه و وضعیت معتبر الزامی است" }, { status: 400 });
  }

  const existing = getCaseEngagement(id, body.engagementId);
  if (!existing) {
    return NextResponse.json({ code: "NOT_FOUND", message: "درخواست همکاری یافت نشد" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updated = updateCaseEngagement(id, body.engagementId, {
    state: body.state,
    note: body.note ?? existing.note,
    responded_at: now,
  });
  if (!updated) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "به‌روزرسانی ناموفق بود" }, { status: 500 });
  }

  // On acceptance the pending member becomes an active collaborating lawyer.
  // The member row already exists (created as `pending` when the request was
  // sent), so we PROMOTE it rather than adding a second row.
  if (body.state === "accepted") {
    const promoted = updateCaseMemberRole(id, existing.lawyer_profile_id, "lawyer", existing.shared_scopes);
    if (!promoted) {
      // No pending row (e.g. it was revoked) — grant a fresh lawyer membership.
      addCaseMember({
        id: generateId(),
        caseId: id,
        accountId: existing.lawyer_profile_id,
        role: "lawyer",
        scopes: existing.shared_scopes,
        grantedByUserId: userId,
      });
    }
    addCaseTimelineEvent({
      id: generateId(),
      caseId: id,
      eventType: "lawyer_accepted",
      title: "پذیرش همکاری وکیل",
      description: "وکیل همکار به پرونده دسترسی یافت.",
      recordedByUserId: userId,
      source: "user",
      metadata: { engagementId: updated.id },
    });
  }

  return NextResponse.json({ data: toEngagement(updated) });
}
