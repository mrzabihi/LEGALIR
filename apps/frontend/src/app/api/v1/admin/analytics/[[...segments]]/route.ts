// ============================================================
// LEGALIR — Admin Analytics API (BI read surface)
// ============================================================
// A dedicated, read-only route tree for the /admin/analytics dashboard. It is
// a separate file (more specific than the admin catch-all dispatcher) so the
// entire analytics authorization + range surface is reviewable in one place.
//
// SECURITY
//   • Every handler requires `admin:analytics:read` — server-side, no exceptions.
//   • Export requires `admin:analytics:export` and is appended to the audit trail.
//   • Read-only over existing tables; this route mutates nothing.
//
// RANGE
//   `?preset=today|7d|30d|jalali_month|custom` (+ `?from&to` for custom).
//   Day boundaries are Tehran; the previous period is always equal-length.
//
// Every response embeds the data-quality flags inside the report, so a number
// never travels without its caveat.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { adminError, intParam } from "@/lib/admin/http";
import { recordAudit } from "@/lib/admin/audit";
import { buildAnalyticsOverview } from "@/lib/admin/analytics/metrics";
import { buildSubscriptionSalesReport } from "@/lib/admin/analytics/subscription-analytics";
import { buildEnergyReport, listEnergyUsers } from "@/lib/admin/analytics/energy-analytics";
import { buildCustomerAnalytics, listPurchaseRanking } from "@/lib/admin/analytics/customer-analytics";
import { buildFinanceAnalytics } from "@/lib/admin/analytics/finance-analytics";
import { analyticsDataQuality } from "@/lib/admin/analytics/quality";
import {
  listDrillOrders,
  listDrillUsers,
  resolveDrillWindow,
} from "@/lib/admin/analytics/drill";
import type { AnalyticsRangeKey, OrderStatus, PurchaseRankingSort } from "@legalir/types";
import type { ResolveRangeInput } from "@/lib/admin/analytics/range";

const RANGE_KEYS: readonly AnalyticsRangeKey[] = ["today", "7d", "30d", "jalali_month", "custom"];

/** Parse the shared range control into a resolver input. */
function rangeInput(url: URL): ResolveRangeInput {
  const raw = url.searchParams.get("preset");
  const preset: AnalyticsRangeKey = RANGE_KEYS.includes(raw as AnalyticsRangeKey)
    ? (raw as AnalyticsRangeKey)
    : "30d";
  return {
    preset,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    rangeDays: intParam(url, "rangeDays", 0) || undefined,
  };
}

const ok = <T>(data: T) => NextResponse.json({ data });

interface Ctx {
  request: NextRequest;
  url: URL;
  segments: string[];
}

interface RouteParams {
  params: Promise<{ segments?: string[] }>;
}

/** GET dispatcher — every branch is read-only and permission-gated upstream. */
function handleGet(c: Ctx): NextResponse {
  const [a, b] = c.segments;
  const input = rangeInput(c.url);

  // `/admin/analytics` with no segment → the executive overview.
  if (!a) return ok(buildAnalyticsOverview(input));

  switch (a) {
    case "overview":
      return ok(buildAnalyticsOverview(input));

    case "subscriptions":
      return ok(buildSubscriptionSalesReport(input));

    case "customers": {
      if (b === "ranking") {
        const sortRaw = c.url.searchParams.get("sort");
        const sort: PurchaseRankingSort =
          sortRaw === "count" || sortRaw === "recency" ? sortRaw : "net";
        return ok(
          listPurchaseRanking(input, {
            search: c.url.searchParams.get("search") ?? undefined,
            sort,
            page: intParam(c.url, "page", 1),
            pageSize: intParam(c.url, "pageSize", 25),
          })
        );
      }
      return ok(buildCustomerAnalytics(input));
    }

    case "energy": {
      if (b === "users") {
        const sortRaw = c.url.searchParams.get("sort");
        const sort = sortRaw === "consumed" || sortRaw === "recent" ? sortRaw : "balance";
        return ok(
          listEnergyUsers(input, {
            search: c.url.searchParams.get("search") ?? undefined,
            sort,
            page: intParam(c.url, "page", 1),
            pageSize: intParam(c.url, "pageSize", 25),
          })
        );
      }
      return ok(buildEnergyReport(input));
    }

    case "finance":
      return ok(buildFinanceAnalytics(input));

    // Range-preserving drill-down: a KPI links here with the SAME window it
    // reported on, so the opened list reconciles to the number clicked. The
    // window travels as resolved ISO bounds; a bare preset is honoured only
    // when a hand-typed URL supplies one (absent → the full ledger, no window).
    case "drill": {
      const presetRaw = c.url.searchParams.get("preset");
      const preset = RANGE_KEYS.includes(presetRaw as AnalyticsRangeKey)
        ? (presetRaw as AnalyticsRangeKey)
        : undefined;
      const window = resolveDrillWindow({
        fromIso: c.url.searchParams.get("fromIso"),
        toIso: c.url.searchParams.get("toIso"),
        preset,
        rangeDays: intParam(c.url, "rangeDays", 0) || undefined,
      });

      if (b === "orders") {
        return ok(
          listDrillOrders(window, {
            search: c.url.searchParams.get("search") ?? undefined,
            status: (c.url.searchParams.get("status") as OrderStatus | null) ?? undefined,
            planCode: c.url.searchParams.get("planCode") ?? undefined,
            page: intParam(c.url, "page", 1),
            pageSize: intParam(c.url, "pageSize", 20),
          })
        );
      }
      if (b === "users") {
        return ok(
          listDrillUsers(window, {
            search: c.url.searchParams.get("search") ?? undefined,
            role: c.url.searchParams.get("role") ?? undefined,
            sort: c.url.searchParams.get("sort") === "oldest" ? "oldest" : "recent",
            page: intParam(c.url, "page", 1),
            pageSize: intParam(c.url, "pageSize", 25),
          })
        );
      }
      return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
    }

    case "quality":
      return ok({ items: analyticsDataQuality() });

    default:
      return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
  }
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { segments = [] } = await params;
  const auth = requirePermission(request, "admin:analytics:read");
  if (!auth.ok) return auth.response;

  // The drill-down reads the destination surface's rows, so it additionally
  // requires that surface's own read permission — a user who cannot open
  // /admin/orders must not reach the same ledger through the analytics link.
  const [a, b] = segments;
  if (a === "drill") {
    const needed =
      b === "orders" ? "admin:billing:read" : b === "users" ? "admin:users:read" : null;
    if (!needed) return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
    const gate = requirePermission(request, needed);
    if (!gate.ok) return gate.response;
  }

  return handleGet({ request, url: new URL(request.url), segments });
}

/** POST is only used for the export sub-route (audited, permission-gated). */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { segments = [] } = await params;
  if (segments[0] !== "export") {
    return adminError(405, "METHOD_NOT_ALLOWED", "متد پشتیبانی نمی‌شود");
  }
  const auth = requirePermission(request, "admin:analytics:export");
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { kind?: string; preset?: string; rangeDays?: number; from?: string; to?: string }
    | null;
  const kind = body?.kind;

  const url = new URL(request.url);
  const input = rangeInput(url);
  if (body?.preset) input.preset = body.preset as AnalyticsRangeKey;
  if (body?.from) input.from = body.from;
  if (body?.to) input.to = body.to;
  if (body?.rangeDays) input.rangeDays = body.rangeDays;

  const { buildAnalyticsExport, isAnalyticsExportKind } = await import("@/lib/admin/analytics/export");
  if (!kind || !isAnalyticsExportKind(kind)) {
    return adminError(404, "NOT_FOUND", "نوع خروجی پشتیبانی نمی‌شود");
  }
  const result = buildAnalyticsExport(kind, input);
  if ("error" in result) {
    return adminError(500, "EXPORT_FAILED", "تولید فایل خروجی ناموفق بود");
  }

  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: "analytics.export",
    resourceType: "analytics",
    resourceId: kind,
    after: { rows: result.rowCount },
    ip: request.headers.get("x-forwarded-for") ?? null,
    requestId: request.headers.get("x-correlation-id") ?? request.headers.get("x-request-id"),
  });

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(result.bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
