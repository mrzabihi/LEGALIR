// ============================================================
// LEGALIR — GET /api/v1/usage/report
// ============================================================
// The signed-in user's OWN consumption report. Ownership comes from the
// session, never from a client-supplied user id — a caller can only ever read
// their own rows.
//
// Energy and tokens are returned separately; see `lib/usage/report.ts`.
//
// Query: from, to (ISO), serviceKey, activityType, status, page, pageSize.
// ============================================================

import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { buildUsageReport, listUserServiceOptions } from "@/lib/usage/report";
import { ACTIVITY_REGISTRY } from "@/lib/usage/activities";
import type {
  ActivityType,
  UsageReportQuery,
  UsageTransactionStatus,
} from "@legalir/types";

const STATUSES: UsageTransactionStatus[] = ["RESERVED", "COMPLETED", "REVERSED", "FAILED"];
const ACTIVITIES = new Set<string>(ACTIVITY_REGISTRY.map((a) => a.code));

export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status");
  const activityRaw = searchParams.get("activityType");

  const query: UsageReportQuery = {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    serviceKey: searchParams.get("serviceKey") ?? undefined,
    activityType:
      activityRaw && ACTIVITIES.has(activityRaw) ? (activityRaw as ActivityType) : undefined,
    status:
      statusRaw && (STATUSES as string[]).includes(statusRaw)
        ? (statusRaw as UsageTransactionStatus)
        : undefined,
    page: Number(searchParams.get("page") ?? 1) || 1,
    pageSize: Number(searchParams.get("pageSize") ?? 20) || 20,
  };

  return NextResponse.json({
    data: {
      report: buildUsageReport(userId, query),
      // Filter menus are derived from the user's own real rows, never a
      // hard-coded catalog that could offer an empty filter.
      services: listUserServiceOptions(userId),
      actions: ACTIVITY_REGISTRY.map((a) => ({
        activityType: a.code,
        actionNameFa: a.displayNameFa,
      })),
    },
  });
}
