// ============================================================
// LEGALIR — POST /api/v1/judicial/requests/[id]/ready-document
// ============================================================
// The second start path: the user already HAS a finished document and wants a
// structured place to keep it, review it against their answers and move on.
//
// This path NEVER generates AI text. `generateDraft` refuses a request whose
// `startMode` is `ready_document`, so the user is not forced through a
// regeneration they did not ask for.
//
// The document is resolved through the owner-scoped `documents` table — the
// body carries an id, never a name/mime/size — and a foreign id is reported as
// not-found, exactly like a missing one.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { setReadyDocument } from "@/lib/judicial/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { documentId?: unknown };
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
      { code: "VALIDATION_ERROR", message: "سند انتخاب نشده است." },
      { status: 400 }
    );
  }

  const updated = setReadyDocument(auth.ctx.userId, id, body.documentId);
  if (!updated) {
    // Either the request or the document is missing FOR THIS USER — the two
    // are deliberately indistinguishable.
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یا سند یافت نشد." },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { request: updated } });
}
