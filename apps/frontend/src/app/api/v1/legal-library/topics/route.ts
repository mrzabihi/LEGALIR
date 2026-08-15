// ============================================================
// LEGALIR — GET /api/v1/legal-library/topics
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById } from "@/lib/db";
import { readLegalLibrary } from "@/lib/legal-library-db";

function getUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }, { status: 401 });
  }

  const { topics } = readLegalLibrary();
  return NextResponse.json({ data: topics, meta: { requestId: crypto.randomUUID() } });
}
