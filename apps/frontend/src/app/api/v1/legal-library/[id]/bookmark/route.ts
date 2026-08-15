// ============================================================
// LEGALIR — POST/DELETE /api/v1/legal-library/[id]/bookmark
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { setBookmark } from "@/lib/legal-library-db";

function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

function unauthorized() {
  return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }, { status: 401 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  if (!userId) return unauthorized();

  const { id } = await params;
  setBookmark(userId, id, true);
  return NextResponse.json({ data: { bookmarked: true }, meta: { requestId: crypto.randomUUID() } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  if (!userId) return unauthorized();

  const { id } = await params;
  setBookmark(userId, id, false);
  return NextResponse.json({ data: { bookmarked: false }, meta: { requestId: crypto.randomUUID() } });
}
