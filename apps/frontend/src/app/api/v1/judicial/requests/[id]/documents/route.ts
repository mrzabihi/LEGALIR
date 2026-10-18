// ============================================================
// LEGALIR — GET /api/v1/judicial/requests/[id]/documents
// ============================================================
// The document step's canonical endpoint. It reuses the existing «اسناد من»
// system — this route only REFERENCES a document, it never uploads, copies or
// re-parses a file, so there is no parallel upload path.
//
//   GET  — the picker: which of my documents can I attach, and which are
//          already attached to this request?
//   POST — link one of the caller's OWN ready documents, with a role.
//
// Unlinking lives at `.../attachments/[attachmentId]`; `.../attachments` is a
// thin alias of this file so no second implementation can exist.
//
// SECURITY
//   • reads come from the owner-scoped `listDemoDocuments(userId)` and the
//     link goes through the owner-scoped `linkAttachment`, so tampering with a
//     document id can never reach another user's file;
//   • the client supplies only an id and a role — the name/mime/size are
//     copied server-side from the resolved row;
//   • a document that is still processing is refused rather than linked as if
//     its text were usable.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listDemoDocuments } from "@/lib/demo-seed";
import { getOwnedRequest, linkAttachment, listAttachments } from "@/lib/judicial/db";
import {
  JUDICIAL_ATTACHMENT_ROLE_FA,
  type JudicialAttachmentRole,
} from "@legalir/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const request = getOwnedRequest(auth.ctx.userId, id);
  if (!request) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  const linked = listAttachments(auth.ctx.userId, id);
  const linkedIds = new Set(linked.map((a) => a.documentId));

  return NextResponse.json({
    data: {
      linked,
      available: listDemoDocuments(auth.ctx.userId).map((d) => ({
        id: d.id,
        name: d.name,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        status: d.status,
        updatedAt: d.updatedAt,
        alreadyLinked: linkedIds.has(d.id),
      })),
      roles: JUDICIAL_ATTACHMENT_ROLE_FA,
      readyDocument: request.readyDocument,
    },
  });
}

function isRole(value: unknown): value is JudicialAttachmentRole {
  return typeof value === "string" && value in JUDICIAL_ATTACHMENT_ROLE_FA;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { documentId?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  if (typeof body.documentId !== "string" || !body.documentId) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "مدرک انتخاب نشده است." },
      { status: 400 }
    );
  }
  if (!isRole(body.role)) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "نقش مدرک مشخص نشده است." },
      { status: 400 }
    );
  }

  const result = linkAttachment({
    userId: auth.ctx.userId,
    requestId: id,
    documentId: body.documentId,
    role: body.role,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "درخواست یافت نشد." },
        { status: 404 }
      );
    }
    if (result.code === "DOCUMENT_NOT_FOUND") {
      // A foreign document id must look exactly like a missing one.
      return NextResponse.json(
        { code: "DOCUMENT_NOT_FOUND", message: "این مدرک در حساب شما یافت نشد." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        code: "DOCUMENT_NOT_READY",
        message: "این مدرک هنوز آمادهٔ استفاده نیست. پس از پردازش دوباره تلاش کنید.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      data: {
        attachment: result.attachment,
        linked: listAttachments(auth.ctx.userId, id),
      },
    },
    { status: 201 }
  );
}
