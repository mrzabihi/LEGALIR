import { NextResponse } from "next/server";
import { findSessionById, readRewardLedger } from "@/lib/db";

function getUserIdFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUserIdFromCookie(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10);

  const all = readRewardLedger(userId);
  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    pointsDelta: e.points_delta,
    sourceType: e.source_type,
    sourceId: e.source_id,
    description: e.description,
    createdAt: e.created_at,
  }));

  return NextResponse.json({
    data: {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
}
