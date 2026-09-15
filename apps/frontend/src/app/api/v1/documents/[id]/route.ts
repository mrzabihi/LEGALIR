// ============================================================
// LEGALIR — GET/DELETE /api/v1/documents/[id] (demo dataset)
// ============================================================
// GET returns the full V1DocumentDetail; DELETE removes the row
// from the JSON DB (scoped to the authenticated user).
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument, deleteDemoDocument } from "@/lib/demo-seed";
import { removeActivity } from "@/lib/db";

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
  const ok = deleteDemoDocument(userId, id);
  if (!ok) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  removeActivity(userId, id);

  return NextResponse.json({ data: { deleted: true as const } });
}
