// ============================================================
// LEGALIR — Analytics React Query hooks
// ============================================================
// One hook per analytics report. Every cache key is namespaced under
// ["admin","analytics", …] and folds in the shared range, so switching the
// range control refetches exactly the affected reports. The hooks carry no
// authorization logic — the server enforces `admin:analytics:read`.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsSubscriptions,
  fetchAnalyticsEnergy,
  fetchAnalyticsCustomers,
  fetchAnalyticsFinance,
  fetchAnalyticsQuality,
  fetchAnalyticsEnergyUsers,
  fetchAnalyticsRanking,
  type AnalyticsRangeQuery,
  type EnergyUsersQuery,
  type PurchaseRankingQuery,
} from "@/lib/api/analytics";

/** The range parts of a stable query key. */
function keyParts(range: AnalyticsRangeQuery): [string, string | null, string | null, number | null] {
  return [range.preset, range.from ?? null, range.to ?? null, range.rangeDays ?? null];
}

export function useAnalyticsOverview(range: AnalyticsRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "overview", ...keyParts(range)],
    queryFn: () => fetchAnalyticsOverview(range),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsSubscriptions(range: AnalyticsRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "subscriptions", ...keyParts(range)],
    queryFn: () => fetchAnalyticsSubscriptions(range),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsEnergy(range: AnalyticsRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "energy", ...keyParts(range)],
    queryFn: () => fetchAnalyticsEnergy(range),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsCustomers(range: AnalyticsRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "customers", ...keyParts(range)],
    queryFn: () => fetchAnalyticsCustomers(range),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsFinance(range: AnalyticsRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "finance", ...keyParts(range)],
    queryFn: () => fetchAnalyticsFinance(range),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsQuality(enabled = true) {
  return useQuery({
    queryKey: ["admin", "analytics", "quality"],
    queryFn: () => fetchAnalyticsQuality(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsEnergyUsers(
  range: AnalyticsRangeQuery,
  query: EnergyUsersQuery,
  enabled = true
) {
  return useQuery({
    queryKey: ["admin", "analytics", "energy-users", ...keyParts(range), query],
    queryFn: () => fetchAnalyticsEnergyUsers(range, query),
    placeholderData: (prev) => prev,
    retry: 1,
    enabled,
  });
}

export function useAnalyticsRanking(
  range: AnalyticsRangeQuery,
  query: PurchaseRankingQuery,
  enabled = true
) {
  return useQuery({
    queryKey: ["admin", "analytics", "ranking", ...keyParts(range), query],
    queryFn: () => fetchAnalyticsRanking(range, query),
    placeholderData: (prev) => prev,
    retry: 1,
    enabled,
  });
}
