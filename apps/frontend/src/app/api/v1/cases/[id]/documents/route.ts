// ============================================================
// LEGALIR — /api/v1/cases/[id]/documents
// ============================================================
// Links documents to a case. A case document is a LINK, not a copy:
// the file lives in the documents table (owned by its uploader) and
// this route records which case it belongs to.
//
// AUTHORIZATION (PART 15): ownership is checked TWICE —
//   1. the case must belong to the caller, and
//   2. the document must belong to the caller.
// A user can never attach someone else's document to their own case,
// nor read a case they do not own.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseById,
  getCaseDocuments,
  linkCaseDocument,
  unlinkCaseDocument,
  addCaseTimelineEvent,
} from "@/lib/case-db";
import { getDemoDocument } from "@/lib/demo-seed";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Resolve the case, enforcing ownership. Returns null when not permitted. */
function ownedCase(userId: string, caseId: string) {
  const c = getCaseById(caseId);
  if (!c || c.user_id !== userId) return null;
  return c;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  // Only documents the caller still owns are surfaced — a link whose
  // document was deleted (or never belonged to the caller) is dropped.
  const documents = getCaseDocuments(id)
    .map((link) => {
      const doc = getDemoDocument(userId, link.document_id);
      if (!doc) return null;
      return {
        id: doc.id,
        name: doc.name,
        mime: doc.mime,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        linkedAt: link.created_at,
        addedByUserId: link.added_by_user_id,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return NextResponse.json({ data: documents });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  let body: { documentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  const documentId = body.documentId?.trim();
  if (!documentId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه سند الزامی است" }, { status: 400 });
  }

  // The document must belong to the caller — this is the IDOR guard.
  const doc = getDemoDocument(userId, documentId);
  if (!doc) {
    return NextResponse.json({ code: "NOT_FOUND", message: "سند یافت نشد" }, { status: 404 });
  }

  const link = linkCaseDocument({
    id: generateId(),
    caseId: id,
    documentId,
    addedByUserId: userId,
  });

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "document_added",
    title: "سند اضافه شد",
    description: doc.name,
    metadata: { documentId, linkId: link.id },
  });

  return NextResponse.json(
    {
      data: {
        id: doc.id,
        name: doc.name,
        mime: doc.mime,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        linkedAt: link.created_at,
        addedByUserId: link.added_by_user_id,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });
  }

  const { id } = await params;
  if (!ownedCase(userId, id)) {
    return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  }

  const documentId = new URL(req.url).searchParams.get("documentId")?.trim();
  if (!documentId) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "شناسه سند الزامی است" }, { status: 400 });
  }

  const removed = unlinkCaseDocument(id, documentId);
  if (!removed) {
    return NextResponse.json({ code: "NOT_FOUND", message: "سند در این پرونده یافت نشد" }, { status: 404 });
  }

  return NextResponse.json({ data: { documentId, removed: true } });
}
