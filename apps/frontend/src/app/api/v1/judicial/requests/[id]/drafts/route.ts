// ============================================================
// LEGALIR — GET /api/v1/judicial/requests/[id]/drafts
// ============================================================
// The version history of a request, newest first. Versions are immutable:
// regenerating appends a version, it never overwrites the text the user has
// already read or approved.
//
// Generation itself lives at POST .../[id]/draft — this route is a pure read
// so the review surface can page through earlier versions without any charge.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getOwnedRequest, listDrafts } from "@/lib/judicial/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!getOwnedRequest(auth.ctx.userId, id)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "درخواست یافت نشد." },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { items: listDrafts(auth.ctx.userId, id) } });
}
