// ============================================================
// LEGALIR — GET /api/v1/legal-requests/[id]/attachments/[docId]
// ============================================================
// Streams an attachment's bytes for a consultation case. This exists
// because /api/v1/documents/[id]/file is scoped to the document's OWNER
// and would 404 for the assigned lawyer — but the lawyer must be able to
// inspect the attachments the client shared.
//
// Authorization is case-scoped: the caller must be able to view the
// request (owner or assigned lawyer), AND the document must actually be
// attached to that request. A document id that is not on the request is
// 404, so this route can never be used to read an arbitrary document.
// ============================================================

import { NextResponse } from "next/server";
import fs from "node:fs";
import { requireAuth, notFound } from "@/lib/rbac";
import { getRequestById } from "@/lib/legal-request-db";
import { canViewConsultation } from "@/lib/consultation-detail";
import { readTable } from "@/lib/db";
import { documentFileReference, resolveDocumentFile } from "@/lib/document-storage";
import { detectPreviewKind, previewContentType } from "@/lib/document-preview";
import type { V1DocumentDetail } from "@legalir/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { id, docId } = await params;

  const row = getRequestById(id);
  if (!row || !canViewConsultation(row, auth.ctx.userId)) {
    return notFound("درخواست یافت نشد");
  }

  // The document must be one of THIS request's attachments.
  if (!(row.attachmentDocumentIds ?? []).includes(docId)) {
    return notFound("سند یافت نشد");
  }

  const doc = readTable<V1DocumentDetail>("documents").find((d) => d.id === docId);
  if (!doc) return notFound("سند یافت نشد");

  if (detectPreviewKind(doc.mime, doc.name) === "unsupported") {
    return NextResponse.json(
      { code: "UNSUPPORTED", message: "پیش‌نمایش این نوع فایل پشتیبانی نمی‌شود" },
      { status: 415 }
    );
  }

  const file = resolveDocumentFile(documentFileReference(doc));
  if (!file) return notFound("فایل سند یافت نشد");

  const buf = fs.readFileSync(file.absolutePath);
  const encodedName = encodeURIComponent(file.fileName);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": previewContentType(doc.mime, doc.name),
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      // Private, case-scoped content — never cache in shared proxies.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
