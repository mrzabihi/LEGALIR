// ============================================================
// LEGALIR — GET /api/v1/documents/[id]/preview
// ============================================================
// Returns the auth-gated preview descriptor for a document: how it
// should be previewed (pdf / image / unsupported) and the same-origin
// endpoints that serve its bytes.
//
// SECURITY: ownership is resolved from the session cookie and the
// document is looked up scoped to that user, so requesting another
// user's document id yields 404 — never a file. The returned URLs are
// API routes (not storage paths), so every byte request re-checks
// ownership too.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument } from "@/lib/demo-seed";
import { documentFileReference, resolveDocumentFile } from "@/lib/document-storage";
import { detectPreviewKind } from "@/lib/document-preview";
import type { V1DocumentPreview } from "@legalir/types";

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

  const kind = detectPreviewKind(doc.mime, doc.name);
  const file = resolveDocumentFile(documentFileReference(doc));
  const available = file !== null && kind !== "unsupported";

  const preview: V1DocumentPreview = {
    documentId: doc.id,
    name: doc.name,
    mime: doc.mime,
    sizeBytes: file?.sizeBytes ?? doc.sizeBytes,
    kind,
    fileUrl: available ? `/api/v1/documents/${doc.id}/file` : null,
    downloadUrl: `/api/v1/documents/${doc.id}/download`,
    available,
  };

  return NextResponse.json({ data: preview });
}
