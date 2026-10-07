// ============================================================
// LEGALIR — PATCH /api/v1/admin/lawyers/[id]/rating
// ============================================================
// Set the DISPLAYED rating / review count / consultation fee for a lawyer.
// Gated on `admin:lawyer:rating:manage`. These are presentation overrides and
// are stored on the profile's `display` object — DELIBERATELY separate from
// the review-derived `performance`, so a hand-set number can never be
// mistaken for the real average. Passing null for a field clears the
// override and the derived value takes over again.
//
// When every override is null the `display` object is removed entirely, so a
// cleared lawyer is indistinguishable from one that was never overridden.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLawyerProfileById, setDisplaySettings } from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";
import type { LawyerDisplaySettings } from "@legalir/types";

/** A rating override must be within 1–5, or null to clear. */
function ratingOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && v >= 1 && v <= 5) return Math.round(v * 10) / 10;
  return undefined;
}

function countOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:rating:manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as {
    ratingOverride?: number | null;
    reviewCountOverride?: number | null;
    consultationFeeOverrideToman?: number | null;
    badgeFa?: string | null;
    reason?: string;
  } | null;
  if (!body) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const before = getLawyerProfileById(id);
  if (!before) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const rating = ratingOrNull(body.ratingOverride);
  const count = countOrNull(body.reviewCountOverride);
  if (rating === undefined || count === undefined) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "امتیاز باید بین ۱ تا ۵ و تعداد نظرات عددی نامنفی باشد" },
      { status: 400 }
    );
  }

  const fee =
    typeof body.consultationFeeOverrideToman === "number"
      ? body.consultationFeeOverrideToman
      : null;
  const badgeFa = typeof body.badgeFa === "string" && body.badgeFa.trim() ? body.badgeFa.trim() : null;

  const allNull = rating === null && count === null && fee === null && !badgeFa;
  const display: LawyerDisplaySettings | null = allNull
    ? null
    : { ratingOverride: rating, reviewCountOverride: count, consultationFeeOverrideToman: fee, badgeFa };

  const updated = setDisplaySettings(id, display);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "LAWYER_RATING_SET",
    resourceType: "lawyer",
    resourceId: id,
    reason: typeof body.reason === "string" ? body.reason : null,
    before: { display: before.display ?? null },
    after: { display: display ?? null },
    ...requestMeta(request),
  });

  return NextResponse.json({ data: { id: updated.id, display: updated.display ?? null } });
}
