// ============================================================
// LEGALIR — PATCH /api/v1/lawyer/avatar
// ============================================================
// The lawyer's OWN professional portrait. This is the self-service
// counterpart of `PATCH /api/v1/admin/lawyers/[id]/avatar`: it edits the
// SAME lawyer profile row, so a change made here appears on the public
// marketplace card, the public profile and every consultation surface —
// exactly like a change made by an operator.
//
// Scoped to the session owner: the profile is resolved from the caller's
// user id (`getLawyerProfileByUserId`), never from the request body, so a
// lawyer can only ever edit their own portrait. A caller with no lawyer
// profile gets 403.
//
// Modes (identical to the admin route):
//   { avatarData, avatarFormat } → an uploaded PNG/JPEG/WebP (base64)
//   { regenerate: true }         → a fresh gender-consistent demo SVG
//   { avatarUrl, avatarType }    → an explicit URL (or null to clear)
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidden, requireAuth } from "@/lib/rbac";
import { getLawyerProfileByUserId, setAvatar } from "@/lib/lawyer-db";
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

export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const before = getLawyerProfileByUserId(auth.ctx.userId);
  if (!before) {
    // A role gate, not an ownership gate — a non-lawyer gets 403 (mirrors the
    // workspace endpoint).
    return forbidden("این حساب پروفایل وکیل ندارد");
  }
  const id = before.id;

  const body = (await readJson(request)) as {
    regenerate?: boolean;
    avatarType?: LawyerAvatarType;
    avatarUrl?: string | null;
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

  // A change that is NOT itself the stored upload replaces (and thus should
  // delete) any previously uploaded portrait, so exactly one source remains.
  const storedUrl = `/api/v1/lawyers/${encodeURIComponent(id)}/avatar`;

  let avatarUrl: string | null;
  let avatarType: LawyerAvatarType;

  if (typeof body.avatarData === "string" && body.avatarData.length > 0) {
    // An uploaded portrait. Trust the declared MIME type — the client reads it
    // from the picked File, and only raster types are accepted (SVG is refused,
    // since it would be served from our own origin).
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
    reason: "self-service",
    before: { avatarType: before.avatarType, hadAvatar: Boolean(before.avatarUrl) },
    after: { avatarType: updated.avatarType, hadAvatar: Boolean(updated.avatarUrl) },
    ...requestMeta(request),
  });

  return NextResponse.json({
    data: { id: updated.id, avatarUrl: updated.avatarUrl, avatarType: updated.avatarType },
  });
}
