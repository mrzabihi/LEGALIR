// ============================================================
// LEGALIR — /api/v1/me/avatar
// ============================================================
// The signed-in user's own portrait:
//   GET    → serve the stored upload (404 when none)
//   POST   → multipart upload (`file`), validated then persisted
//   DELETE → remove the upload and clear the profile's avatarUrl
//
// Scoped to the session owner — a user can only ever read or write their own
// portrait. The stored file is named from the internal user id, so no
// user-supplied path segment reaches the filesystem.

import fs from "node:fs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findSessionById, upsertProfile } from "@/lib/db";
import {
  USER_AVATAR_MAX_BYTES,
  deleteUserAvatar,
  isAllowedUserAvatarFormat,
  resolveUserAvatar,
  saveUserAvatar,
} from "@/lib/user-avatar-storage";

function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const found = resolveUserAvatar(userId);
  if (!found) return new NextResponse("not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(found.absolutePath);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(bytes.length),
      // The body is replaced (not versioned) on each upload; the URL carries a
      // cache-busting query. Keep the TTL short and forbid MIME sniffing.
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "فایلی برای بارگذاری ارسال نشد" },
      { status: 400 }
    );
  }

  if (!isAllowedUserAvatarFormat(file.type)) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "فرمت تصویر پشتیبانی نمی‌شود؛ فقط PNG، JPEG یا WebP مجاز است",
      },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "تصویر خالی است" },
      { status: 400 }
    );
  }
  if (bytes.length > USER_AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "حجم تصویر بیش از حد مجاز است (حداکثر ۲ مگابایت)" },
      { status: 413 }
    );
  }

  let avatarUrl: string;
  try {
    avatarUrl = saveUserAvatar(userId, file.type, bytes);
  } catch {
    return NextResponse.json(
      { code: "STORAGE_ERROR", message: "ذخیرهٔ تصویر ناموفق بود" },
      { status: 500 }
    );
  }

  const profile = upsertProfile(userId, { avatarUrl });
  return NextResponse.json({ data: { avatarUrl: profile.avatarUrl } });
}

export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  deleteUserAvatar(userId);
  const profile = upsertProfile(userId, { avatarUrl: null });
  return NextResponse.json({ data: { avatarUrl: profile.avatarUrl } });
}
