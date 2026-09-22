// ============================================================
// LEGALIR — GET /api/v1/subscription/usage/history
// ============================================================
// The usage ledger for the signed-in user, newest first. Each row is a
// billable activity with its point cost, service quota and status.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getUsageHistory } from "@/lib/usage/engine";
import { getActivity } from "@/lib/usage/activities";
import type { UsageHistoryItem, UsageHistoryResponse } from "@legalir/types";

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  const all = getUsageHistory(userId, 1000);
  const total = all.length;
  const paged = all.slice((page - 1) * pageSize, page * pageSize);

  const items: UsageHistoryItem[] = paged.map((t) => ({
    id: t.id,
    activityType: t.activityType,
    displayNameFa: getActivity(t.activityType)?.displayNameFa ?? t.activityType,
    pointsCost: t.pointsCost,
    serviceQuotaType: t.serviceQuotaType,
    serviceQuotaCost: t.serviceQuotaCost,
    status: t.status,
    createdAt: t.createdAt,
  }));

  const body: UsageHistoryResponse = {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };

  return NextResponse.json({ data: body });
}
