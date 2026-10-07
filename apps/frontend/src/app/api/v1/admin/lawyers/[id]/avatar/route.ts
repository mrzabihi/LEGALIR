// ============================================================
// LEGALIR — PATCH /api/v1/admin/lawyers/[id]/avatar
// ============================================================
// Replace (or clear) a lawyer's portrait. Gated on
// `admin:lawyer:avatar:manage`. Two modes:
//   { regenerate: true }              → mint a fresh demo SVG from the
//                                       lawyer's gender + a new seed
//   { avatarUrl, avatarType, reason? }→ set an explicit URL / provenance
//
// The change is written straight to the shared profile row (so the public
// card and the admin table show the SAME portrait) and recorded in the audit
// trail as CHANGE_AVATAR with the before/after URL.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLawyerProfileById, setAvatar } from "@/lib/lawyer-db";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";
import { demoAvatarDataUri } from "@/lib/lawyers/demo-generator";
import {
  AVATAR_MAX_BYTES,
  deleteLawyerAvatar,
  isAllowedAvatarFormat,
  saveLawyerAvatar,
} from "@/lib/lawyer-avatar-storage";
import type { LawyerAvatarType, LawyerGender } from "@legalir/types";

const AVATAR_TYPES: LawyerAvatarType[] = ["demo", "real"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:avatar:manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as {
    regenerate?: boolean;
    avatarType?: LawyerAvatarType;
    avatarUrl?: string | null;
    reason?: string;
    avatarData?: string;
    avatarFileName?: string;
    avatarFormat?: string;
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

  // A change that is NOT itself the stored upload replaces (and thus should
  // delete) any previously uploaded portrait, so exactly one source remains.
  const storedUrl = `/api/v1/lawyers/${encodeURIComponent(id)}/avatar`;

  let avatarUrl: string | null;
  let avatarType: LawyerAvatarType;

  if (typeof body.avatarData === "string" && body.avatarData.length > 0) {
    // An uploaded portrait. Trust the declared MIME type — the client reads
    // it from the picked File, and only raster types are accepted (SVG is
    // refused, since it would be served from our own origin).
    const format = typeof body.avatarFormat === "string" ? body.avatarFormat : "";
    if (!isAllowedAvatarFormat(format)) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "فرمت تصویر پشتیبانی نمی‌شود (فقط PNG، JPEG یا WebP)",
        },
        { status: 400 }
      );
    }
    const bytes = Buffer.from(body.avatarData, "base64");
    if (bytes.length === 0) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "تصویر خالی است" },
        { status: 400 }
      );
    }
    if (bytes.length > AVATAR_MAX_BYTES) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "حجم تصویر بیش از حد مجاز است (حداکثر ۲ مگابایت)" },
        { status: 413 }
      );
    }
    try {
      avatarUrl = saveLawyerAvatar(id, format, bytes);
    } catch {
      return NextResponse.json(
        { code: "STORAGE_ERROR", message: "ذخیرهٔ تصویر ناموفق بود" },
        { status: 500 }
      );
    }
    avatarType = "real";
  } else if (body.regenerate === true) {
    // A fresh synthetic portrait — never a real photograph. Seed from the
    // current time so repeated regenerations differ.
    const gender = (before.gender ?? "MALE") as LawyerGender;
    avatarUrl = demoAvatarDataUri(Date.now() % 360, gender);
    avatarType = "demo";
  } else {
    const type = body.avatarType as LawyerAvatarType | undefined;
    if (type && !AVATAR_TYPES.includes(type)) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "نوع آواتار نامعتبر است" },
        { status: 400 }
      );
    }
    if (body.avatarUrl === null || body.avatarUrl === "") {
      avatarUrl = null;
      avatarType = type ?? "demo";
    } else if (typeof body.avatarUrl === "string") {
      avatarUrl = body.avatarUrl;
      avatarType = type ?? "real";
    } else {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "آواتار نامعتبر است" },
        { status: 400 }
      );
    }
  }

  // Drop the stored upload when this change no longer references it.
  if (avatarUrl !== storedUrl) deleteLawyerAvatar(id);

  const updated = setAvatar(id, avatarUrl, avatarType);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "LAWYER_CHANGE_AVATAR",
    resourceType: "lawyer",
    resourceId: id,
    reason: typeof body.reason === "string" ? body.reason : null,
    before: { avatarType: before.avatarType, hadAvatar: Boolean(before.avatarUrl) },
    after: { avatarType: updated.avatarType, hadAvatar: Boolean(updated.avatarUrl) },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: { id: updated.id, avatarUrl: updated.avatarUrl, avatarType: updated.avatarType },
  });
}
