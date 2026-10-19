// ============================================================
// LEGALIR — DELETE /api/v1/judicial/requests/[id]/attachments/[attachmentId]
// ============================================================
// Soft-remove an attachment from the request. The underlying document is NOT
// deleted — it belongs to «اسناد من» and may be used by other work. Only the
// link is removed, which is what the user asked for.
//
// A foreign attachment id (or one belonging to another request) returns 404 —
// the same answer as a missing one.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { listAttachments, unlinkAttachment } from "@/lib/judicial/db";

interface Params {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id, attachmentId } = await params;
  const removed = unlinkAttachment(auth.ctx.userId, id, attachmentId);
  if (!removed) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "این پیوست یافت نشد." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { items: listAttachments(auth.ctx.userId, id) },
  });
}
