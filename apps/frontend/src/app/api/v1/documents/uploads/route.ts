// ============================================================
// LEGALIR — POST /api/v1/documents/uploads (demo dataset)
// ============================================================
// Initiates a document upload. Validates mime + size, creates a
// pending document row in the JSON DB, and returns an upload URL
// that the client completes via POST .../uploads/:id/complete.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { createDemoDocument } from "@/lib/demo-seed";
import { recordActivity, consumeDailyRequest, queryDailyQuota } from "@/lib/db";
import { SUPPORTED_DOCUMENT_MIMES, MAX_DOCUMENT_SIZE_BYTES } from "@legalir/types";

export async function POST(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  let body: { name?: string; mime?: string; sizeBytes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  const mime = body.mime;
  const sizeBytes = body.sizeBytes;

  if (!name || !mime || typeof sizeBytes !== "number" || sizeBytes < 0) {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "اطلاعات سند ناقص است" },
      { status: 400 }
    );
  }

  if (!(SUPPORTED_DOCUMENT_MIMES as readonly string[]).includes(mime)) {
    return NextResponse.json(
      { code: "UNSUPPORTED_FORMAT", message: "فرمت فایل پشتیبانی نمی‌شود", retryable: false },
      { status: 400 }
    );
  }

  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json(
      { code: "FILE_TOO_LARGE", message: "حجم فایل بیش از حد مجاز است", retryable: false },
      { status: 400 }
    );
  }

  // Enforce the day's allowance before accepting the upload.
  const quota = queryDailyQuota(userId);
  if (quota.exhausted) {
    return NextResponse.json(
      {
        code: "QUOTA_EXHAUSTED",
        message: "سهمیه درخواست امروز شما به پایان رسیده است.",
        quota,
      },
      { status: 429 }
    );
  }

  const doc = createDemoDocument(userId, { name, mime, sizeBytes });
  consumeDailyRequest(userId);

  // Record the upload in the durable activity log.
  recordActivity({
    userId,
    type: "document",
    title: doc.name,
    status: doc.status,
    statusFa: "در حال پردازش",
    description: "بارگذاری سند برای تحلیل",
    category: null,
    categoryFa: null,
    sourceId: doc.id,
  });

  return NextResponse.json(
    {
      data: {
        id: doc.id,
        uploadUrl: `/api/v1/documents/uploads/${doc.id}/complete`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    },
    { status: 201 }
  );
}
