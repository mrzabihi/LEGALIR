// ============================================================
// LEGALIR — GET/DELETE /api/v1/documents/[id] (demo dataset)
// ============================================================
// GET returns the full V1DocumentDetail; DELETE removes the row
// from the JSON DB (scoped to the authenticated user).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getDemoDocument,
  deleteDemoDocument,
  deleteDemoRelationshipsFor,
} from "@/lib/demo-seed";
import { removeActivity } from "@/lib/db";
import { deleteDocumentFile, documentFileReference } from "@/lib/document-storage";

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

  return NextResponse.json({ data: doc });
}

export async function DELETE(
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

  // Resolve the stored file reference before the row is removed, so the
  // bytes can be unlinked too — otherwise the file would be orphaned.
  const doc = getDemoDocument(userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  const ok = deleteDemoDocument(userId, id);
  if (!ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  // Clean up every resource the document owned: the mirrored activity
  // row, the relationship edges, and the bytes on disk.
  removeActivity(userId, id);
  deleteDemoRelationshipsFor(userId, id);
  deleteDocumentFile(documentFileReference(doc));

  return NextResponse.json({ data: { deleted: true as const } });
}
