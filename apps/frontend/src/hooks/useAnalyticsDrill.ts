// ============================================================
// LEGALIR — Range-preserving drill hooks for the orders/users pages
// ============================================================
// A BI KPI opens an operational page with the window it reported on. These
// hooks make that window OPTIONAL: with no `?fromIso&toIso` in the URL they
// behave exactly like the plain admin hooks (same query-key namespace, same
// `/admin/orders|/users` fetcher), and only when a window is present do they
// switch to the drill endpoint that scopes the rows to it. So the destination
// pages keep one code path, and the default experience is unchanged.
//
// Requires a Suspense boundary (Next.js `useSearchParams`). The server, not
// these hooks, enforces the destination permission.
// ============================================================

"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminOrders, fetchAdminUsers } from "@/lib/api/admin";
import {
  drillWindowFromParams,
  fetchDrillOrders,
  fetchDrillUsers,
  type AnalyticsDrillWindow,
  type DrillOrdersQuery,
  type DrillUsersQuery,
} from "@/lib/api/analytics";

/** The active drill window from the URL, or `null` when the page is unfiltered. */
export function useDrillWindow(): AnalyticsDrillWindow | null {
  const sp = useSearchParams();
  return drillWindowFromParams(sp);
}

/**
 * The order list for a page that may be opened as a KPI drill-down. With no
 * window this is identical to `useAdminOrders` (same key + fetcher); with one,
 * it lists only orders purchased inside the window.
 */
export function useOrdersList(query: DrillOrdersQuery, enabled = true) {
  const window = useDrillWindow();
  const isDrill = window != null;
  return useQuery({
    // Default path reuses the exact `["admin","orders",query]` key so nothing
    // changes for a normal visit; the drill path caches under its own bounds.
    queryKey: isDrill
      ? ["admin", "orders", "drill", window.fromIso, window.toIso, query]
      : ["admin", "orders", query],
    queryFn: () => (isDrill ? fetchDrillOrders(window, query) : fetchAdminOrders(query)),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
    enabled,
  });
}

/**
 * The user list for a page that may be opened as a KPI drill-down. With no
 * window this is identical to `useAdminUsers`; with one, it lists only users
 * whose account was created inside the window.
 */
export function useUsersList(query: DrillUsersQuery, enabled = true) {
  const window = useDrillWindow();
  const isDrill = window != null;
  return useQuery({
    queryKey: isDrill
      ? ["admin", "users", "drill", window.fromIso, window.toIso, query]
      : ["admin", "users", query],
    queryFn: () => (isDrill ? fetchDrillUsers(window, query) : fetchAdminUsers(query)),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
    enabled,
  });
}
