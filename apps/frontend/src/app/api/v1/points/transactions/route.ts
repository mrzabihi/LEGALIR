import { NextResponse } from "next/server";
import { readRewardLedger } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/api/server-auth";

/**
 * GET /api/v1/points/transactions?page&pageSize
 * The user's points ledger, newest first. This is the audit trail behind
 * the balance — every credit and debit appears here.
 */
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20)
  );

  const all = readRewardLedger(userId);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
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
    data: { items, pagination: { page, pageSize, total, totalPages } },
  });
}
