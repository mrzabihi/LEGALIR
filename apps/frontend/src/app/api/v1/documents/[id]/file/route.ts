// ============================================================
// LEGALIR — GET /api/v1/documents/[id]/file (inline preview bytes)
// ============================================================
// Streams the stored file for INLINE rendering (PDF viewer / <img>).
// Unlike /download this sends `Content-Disposition: inline`, so the
// browser renders rather than downloads.
//
// SECURITY: the document is looked up scoped to the session user, so
// another user's id yields 404. The stored reference is resolved
// through document-storage, which rejects path traversal and confines
// reads to the storage roots. No permanent public storage URL is ever
// exposed to the client.
// ============================================================

import { NextResponse } from "next/server";
import fs from "node:fs";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument } from "@/lib/demo-seed";
import { documentFileReference, resolveDocumentFile } from "@/lib/document-storage";
import { detectPreviewKind, previewContentType } from "@/lib/document-preview";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const doc = getDemoDocument(userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  // Only previewable types are served inline; everything else must go
  // through /download so we never render an unsupported type in-page.
  if (detectPreviewKind(doc.mime, doc.name) === "unsupported") {
    return NextResponse.json(
      { code: "UNSUPPORTED", message: "پیش‌نمایش این نوع فایل پشتیبانی نمی‌شود" },
      { status: 415 }
    );
  }

  const file = resolveDocumentFile(documentFileReference(doc));
  if (!file) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "فایل سند یافت نشد" },
      { status: 404 }
    );
  }

  const buf = fs.readFileSync(file.absolutePath);
  const encodedName = encodeURIComponent(file.fileName);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": previewContentType(doc.mime, doc.name),
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      // Private, per-user content — never cache in shared proxies.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
