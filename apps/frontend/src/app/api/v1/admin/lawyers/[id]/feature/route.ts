// ============================================================
// LEGALIR — PATCH /api/v1/admin/lawyers/[id]/feature
// ============================================================
// Toggle the marketplace "featured" flag. Gated on `admin:lawyer:feature`.
// A featured lawyer is promoted into the public «وکلای پیشنهادی» rail and
// sorted first in the default relevance order — the change is written to the
// shared profile row so it appears on the public site immediately.
// Recorded as LAWYER_FEATURE / LAWYER_UNFEATURE.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLawyerProfileById, setFeatured } from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:feature");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as { featured?: boolean; reason?: string } | null;
  if (!body || typeof body.featured !== "boolean") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "مقدار برجسته‌سازی نامعتبر است" },
      { status: 400 }
    );
  }

  const before = getLawyerProfileById(id);
  if (!before) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const updated = setFeatured(id, body.featured);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: updated.featured ? "LAWYER_FEATURE" : "LAWYER_UNFEATURE",
    resourceType: "lawyer",
    resourceId: id,
    reason: typeof body.reason === "string" ? body.reason : null,
    before: { featured: before.featured ?? false },
    after: { featured: updated.featured ?? false },
    ...requestMeta(request),
  });

  return NextResponse.json({ data: { id: updated.id, featured: updated.featured ?? false } });
}
