// ============================================================
// LEGALIR — Analytics API client
// ============================================================
// Thin fetch wrappers over the read-only analytics route tree. No
// authorization logic lives here — it is a UX helper; the server re-checks
// `admin:analytics:read` on every call.
//
// The shared range control is the SAME object for every report, so one filter
// drives the whole dashboard: `{ preset, from, to, rangeDays }`.
// ============================================================

import { apiClient } from "./client";
import type {
  AnalyticsOverview,
  SubscriptionSalesReport,
  EnergyReport,
  EnergyUsersPage,
  CustomerAnalyticsReport,
  PurchaseRankingPage,
  PurchaseRankingSort,
  FinanceAnalytics,
  AnalyticsDataQualityFlag,
  AnalyticsRangeKey,
} from "@legalir/types";

const A = "/api/v1/admin/analytics";

/** The shared dashboard range control. */
export interface AnalyticsRangeQuery {
  preset: AnalyticsRangeKey;
  /** Inclusive YYYY-MM-DD bounds — only used by the `custom` preset. */
  from?: string | null;
  to?: string | null;
  rangeDays?: number;
}

function rangeQs(range: AnalyticsRangeQuery): string {
  const sp = new URLSearchParams();
  sp.set("preset", range.preset);
  if (range.preset === "custom" && range.from && range.to) {
    sp.set("from", range.from);
    sp.set("to", range.to);
  } else if (range.rangeDays) {
    sp.set("rangeDays", String(range.rangeDays));
  }
  return `?${sp.toString()}`;
}

function listQs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `&${s}` : "";
}

// ---------------------------------------------------------------------------
// Report fetchers (each returns the report, whose `quality` carries caveats)
// ---------------------------------------------------------------------------

export function fetchAnalyticsOverview(range: AnalyticsRangeQuery): Promise<AnalyticsOverview> {
  return apiClient.get<AnalyticsOverview>(`${A}/overview${rangeQs(range)}`);
}

export function fetchAnalyticsSubscriptions(
  range: AnalyticsRangeQuery
): Promise<SubscriptionSalesReport> {
  return apiClient.get<SubscriptionSalesReport>(`${A}/subscriptions${rangeQs(range)}`);
}

export function fetchAnalyticsEnergy(range: AnalyticsRangeQuery): Promise<EnergyReport> {
  return apiClient.get<EnergyReport>(`${A}/energy${rangeQs(range)}`);
}

export function fetchAnalyticsCustomers(range: AnalyticsRangeQuery): Promise<CustomerAnalyticsReport> {
  return apiClient.get<CustomerAnalyticsReport>(`${A}/customers${rangeQs(range)}`);
}

export function fetchAnalyticsFinance(range: AnalyticsRangeQuery): Promise<FinanceAnalytics> {
  return apiClient.get<FinanceAnalytics>(`${A}/finance${rangeQs(range)}`);
}

export function fetchAnalyticsQuality(): Promise<{ items: AnalyticsDataQualityFlag[] }> {
  return apiClient.get<{ items: AnalyticsDataQualityFlag[] }>(`${A}/quality`);
}

// ---------------------------------------------------------------------------
// Paginated table fetchers (drill-downs)
// ---------------------------------------------------------------------------

export interface EnergyUsersQuery {
  search?: string;
  sort?: "balance" | "consumed" | "recent";
  page?: number;
  pageSize?: number;
}

export function fetchAnalyticsEnergyUsers(
  range: AnalyticsRangeQuery,
  query: EnergyUsersQuery = {}
): Promise<EnergyUsersPage> {
  const extra = listQs({
    search: query.search,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  });
  return apiClient.get<EnergyUsersPage>(`${A}/energy/users${rangeQs(range)}${extra}`);
}

export interface PurchaseRankingQuery {
  search?: string;
  sort?: PurchaseRankingSort;
  page?: number;
  pageSize?: number;
}

export function fetchAnalyticsRanking(
  range: AnalyticsRangeQuery,
  query: PurchaseRankingQuery = {}
): Promise<PurchaseRankingPage> {
  const extra = listQs({
    search: query.search,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  });
  return apiClient.get<PurchaseRankingPage>(`${A}/customers/ranking${rangeQs(range)}${extra}`);
}

// ---------------------------------------------------------------------------
// Export (POST → .xlsx bytes)
// ---------------------------------------------------------------------------

export type AnalyticsExportKind = "subscriptions" | "customers" | "energy";

/**
 * Download an analytics export. A POST is used (the range travels in the body)
 * so this cannot be a plain anchor; the response is streamed to a Blob and
 * handed to the browser. The server audits every export.
 */
export async function downloadAnalyticsExport(
  kind: AnalyticsExportKind,
  range: AnalyticsRangeQuery
): Promise<void> {
  const res = await fetch(`${A}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      kind,
      preset: range.preset,
      from: range.from ?? undefined,
      to: range.to ?? undefined,
      rangeDays: range.rangeDays,
    }),
  });
  if (!res.ok) throw new Error("EXPORT_FAILED");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1]!) : `analytics-${kind}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
